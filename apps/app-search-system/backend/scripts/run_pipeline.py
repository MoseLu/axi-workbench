#!/usr/bin/env python3
"""
run_pipeline.py - SOP处理流水线调度器（改进版）

功能：
1. 串联三个阶段：扫描 → 图片转换 → 索引构建
2. 支持单独运行某个阶段
3. 支持定时调度
4. 真正的增量处理（基于哈希）

使用方式：
    python run_pipeline.py          # 运行完整流程
    python run_pipeline.py --scan   # 只运行扫描
    python run_pipeline.py --convert # 只运行图片转换
    python run_pipeline.py --index   # 只运行索引构建
    python run_pipeline.py --watch  # 持续监控模式
"""

import os
import sys
import time
import json
import sqlite3
import threading
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from .config import DIR, DB, CHROMA, PROCESS, SCHEDULE, setup_logging, load_config
    from .state_manager import StateManager, PDFStatus, PageStatus
except ImportError:
    from config import DIR, DB, CHROMA, PROCESS, SCHEDULE, setup_logging, load_config
    from state_manager import StateManager, PDFStatus, PageStatus

logger = setup_logging("pipeline", "pipeline")
PIPELINE_LOCK = threading.Lock()

# 流水线警告日志限流（最多打印5次）
_pipeline_warn_count = 0
_pipeline_warn_max = 5
_pipeline_warn_done = False


def _log_pipeline_warn_once(msg: str):
    """流水线警告日志，最多打印5次"""
    global _pipeline_warn_count, _pipeline_warn_done
    if _pipeline_warn_done:
        return
    if _pipeline_warn_count < _pipeline_warn_max:
        _pipeline_warn_count += 1
        logger.warning(msg)
    else:
        _pipeline_warn_done = True
        logger.warning("流水线持续出错，已切换静默模式，后续不再打印。")


def cleanup_pdf_artifacts(state: StateManager, pdf_record: dict):
    """清理单个PDF对应的图片和页面记录。"""
    pages = state.get_pages_by_pdf(pdf_record['id'])
    for page in pages:
        image_path = page.get('image_path')
        if image_path and os.path.exists(image_path):
            try:
                os.remove(image_path)
            except OSError as exc:
                logger.warning(f"删除图片失败 {image_path}: {exc}")


def delete_chroma_docs(doc_ids: List[str]):
    """删除Chroma中的指定文档。"""
    if not doc_ids:
        return

    import chromadb

    chroma_client = chromadb.PersistentClient(path=str(DIR.CHROMA_DIR))
    collection = chroma_client.get_or_create_collection(
        name=CHROMA.COLLECTION_NAME,
        metadata={"description": "SOP页面双向索引"}
    )
    collection.delete(ids=doc_ids)


def cleanup_deleted_documents(state: StateManager) -> dict:
    """清理已删除PDF残留的页面记录、图片和Chroma索引。"""
    deleted_pdfs = state.get_deleted_pdfs()
    if not deleted_pdfs:
        return {'deleted_pdfs': 0, 'deleted_pages': 0, 'error': None}

    deleted_pages = 0
    for pdf_record in deleted_pdfs:
        pages = state.get_pages_by_pdf(pdf_record['id'])
        doc_ids = [page['doc_id'] for page in pages if page.get('doc_id')]

        if doc_ids:
            delete_chroma_docs(doc_ids)
            deleted_pages += len(doc_ids)

        cleanup_pdf_artifacts(state, pdf_record)
        state.delete_pages_by_pdf(pdf_record['id'])
        logger.info(f"已清理删除PDF: {pdf_record['pdf_name']} ({len(doc_ids)} 页)")

    return {'deleted_pdfs': len(deleted_pdfs), 'deleted_pages': deleted_pages, 'error': None}


# ============== 阶段1: 扫描 ==============

def run_scan(state: StateManager) -> dict:
    """阶段1: 扫描PDF目录，检测变更"""
    logger.info("=" * 60)
    logger.info("阶段1: PDF扫描")
    logger.info("=" * 60)

    try:
        # 扫描源目录（快速模式，不计算hash）
        source_pdfs = state.scan_source_pdfs(DIR.SOURCE_DIR)

        if not source_pdfs:
            logger.warning("未找到PDF文件")
            return {'added': 0, 'modified': 0, 'deleted': 0, 'metadata_only': 0, 'unchanged': 0, 'error': None}

        # 检测变更（使用哈希比较）
        changes = state.detect_changes(source_pdfs)

        # 记录变更
        for pdf_path in changes['added']:
            info = source_pdfs[pdf_path]
            if not state.is_file_stable(
                pdf_path,
                expected_size=info['size'],
                expected_modified=info['modified'],
                wait_seconds=SCHEDULE.FILE_STABLE_SECONDS
            ):
                logger.warning(f"  ! 文件仍在写入，延后处理: {info['name']}")
                continue

            # 计算hash并存储
            file_hash = state.calculate_file_hash(pdf_path)
            # 获取页数
            import fitz
            with fitz.open(pdf_path) as doc:
                page_count = len(doc)
            # 存储记录
            state.upsert_pdf(
                pdf_path=pdf_path,
                pdf_name=info['name'],
                file_hash=file_hash,
                file_size=info['size'],
                page_count=page_count,
                last_modified=info['modified'],
                status=PDFStatus.PENDING.value
            )
            state.log_change('added', pdf_path, info['name'], new_hash=file_hash)
            logger.info(f"  + 新增: {info['name']}")

        for pdf_path in changes['modified']:
            info = source_pdfs[pdf_path]
            if not state.is_file_stable(
                pdf_path,
                expected_size=info['size'],
                expected_modified=info['modified'],
                wait_seconds=SCHEDULE.FILE_STABLE_SECONDS
            ):
                logger.warning(f"  ! 文件仍在写入，延后处理: {info['name']}")
                continue

            old_record = state.get_pdf_by_path(pdf_path)
            old_hash = old_record.get('file_hash', '') if old_record else ''
            file_hash = state.calculate_file_hash(pdf_path)
            import fitz
            with fitz.open(pdf_path) as doc:
                page_count = len(doc)
            state.upsert_pdf(
                pdf_path=pdf_path,
                pdf_name=info['name'],
                file_hash=file_hash,
                file_size=info['size'],
                page_count=page_count,
                last_modified=info['modified'],
                status=PDFStatus.PENDING.value  # 重新标记为待处理
            )
            state.log_change('modified', pdf_path, info['name'], old_hash=old_hash, new_hash=file_hash)
            logger.info(f"  ~ 修改: {info['name']}")

        for pdf_path in changes.get('metadata_only', []):
            info = source_pdfs[pdf_path]
            state.refresh_pdf_metadata(pdf_path, info['size'], info['modified'])
            logger.info(f"  = 元数据刷新: {info['name']}")

        for pdf_path in changes['deleted']:
            old_record = state.get_pdf_by_path(pdf_path)
            old_hash = old_record.get('file_hash', '') if old_record else ''
            state.mark_pdf_deleted(pdf_path)
            state.log_change('deleted', pdf_path, old_record.get('pdf_name', ''), old_hash=old_hash)
            logger.info(f"  - 删除: {old_record.get('pdf_name', pdf_path)}")

        logger.info(f"\n变更汇总:")
        logger.info(f"  新增: {len(changes['added'])} 个")
        logger.info(f"  修改: {len(changes['modified'])} 个")
        logger.info(f"  删除: {len(changes['deleted'])} 个")
        logger.info(f"  元数据刷新: {len(changes.get('metadata_only', []))} 个")
        logger.info(f"  未变: {len(changes['unchanged'])} 个")

        return {
            'added': len(changes['added']),
            'modified': len(changes['modified']),
            'deleted': len(changes['deleted']),
            'metadata_only': len(changes.get('metadata_only', [])),
            'unchanged': len(changes['unchanged']),
            'error': None
        }

    except Exception as e:
        logger.error(f"扫描失败: {e}")
        logger.debug(traceback.format_exc())
        return {'added': 0, 'modified': 0, 'deleted': 0, 'metadata_only': 0, 'unchanged': 0, 'error': str(e)}


# ============== 阶段2: 图片转换+OCR ==============

def run_convert(state: StateManager, workers: int = None) -> dict:
    """阶段2: PDF转图片 + OCR识别"""
    if workers is None:
        workers = PROCESS.DEFAULT_WORKERS

    logger.info("=" * 60)
    logger.info("阶段2: PDF转图片 + OCR识别")
    logger.info(f"并发数: {workers}")
    logger.info("=" * 60)

    try:
        # 导入处理器
        try:
            from .pdf_processor import PDFProcessor
        except ImportError:
            from pdf_processor import PDFProcessor

        # 获取待处理的PDF
        pending = state.get_pending_pdfs()

        if not pending:
            logger.info("没有待处理的PDF")
            return {'processed': 0, 'skipped': 0, 'error': None}

        logger.info(f"待处理PDF: {len(pending)} 个")

        processor = PDFProcessor(state)
        total_indexed = 0
        total_skipped = 0

        for pdf_info in pending:
            pdf_path = pdf_info['path']

            # 检查是否需要处理
            pdf_record = state.get_pdf_by_path(pdf_path)
            if not pdf_record:
                continue

            existing_pages = state.get_pages_by_pdf(pdf_record['id'])
            if pdf_record.get('status') == PDFStatus.PENDING.value and existing_pages:
                logger.info(f"检测到PDF已重建，清理旧页面: {Path(pdf_path).name}")
                cleanup_pdf_artifacts(state, pdf_record)
                delete_chroma_docs([page['doc_id'] for page in existing_pages if page.get('doc_id')])
                state.delete_pages_by_pdf(pdf_record['id'])
                existing_pages = []

            # 检查hash是否变化
            current_hash = state.calculate_file_hash(pdf_path)
            if pdf_record.get('file_hash') != current_hash:
                logger.info(f"PDF已修改，重新处理: {Path(pdf_path).name}")
                cleanup_pdf_artifacts(state, pdf_record)
                old_pages = state.get_pages_by_pdf(pdf_record['id'])
                old_doc_ids = [page['doc_id'] for page in old_pages if page.get('doc_id')]
                delete_chroma_docs(old_doc_ids)
                state.delete_pages_by_pdf(pdf_record['id'])
                state.upsert_pdf(
                    pdf_path=pdf_path,
                    pdf_name=Path(pdf_path).name,
                    file_hash=current_hash,
                    file_size=Path(pdf_path).stat().st_size,
                    page_count=pdf_record.get('page_count', 0),
                    last_modified=datetime.fromtimestamp(Path(pdf_path).stat().st_mtime).isoformat(),
                    status=PDFStatus.PENDING.value
                )
                pdf_record = state.get_pdf_by_path(pdf_path) or pdf_record

            try:
                indexed, skipped, pages = processor.process_pdf(
                    pdf_path,
                    pdf_id=pdf_record['id'],
                    force=False,
                    workers=workers
                )
                total_indexed += indexed
                total_skipped += skipped

                # 更新PDF状态
                if indexed > 0:
                    state.update_pdf_status(pdf_path, PDFStatus.PROCESSED.value)
                else:
                    state.update_pdf_status(pdf_path, PDFStatus.PROCESSED.value)

            except Exception as e:
                logger.error(f"处理PDF失败 {Path(pdf_path).name}: {e}")
                state.update_pdf_status(pdf_path, PDFStatus.FAILED.value, error_msg=str(e))

        processor.state.close()

        logger.info(f"\n处理完成:")
        logger.info(f"  有效页面: {total_indexed} 页")
        logger.info(f"  跳过页面: {total_skipped} 页")

        return {
            'processed': total_indexed,
            'skipped': total_skipped,
            'error': None
        }

    except Exception as e:
        logger.error(f"图片转换失败: {e}")
        logger.debug(traceback.format_exc())
        return {'processed': 0, 'skipped': 0, 'error': str(e)}


# ============== 阶段3: 向量索引 ==============

def run_index(state: StateManager, rebuild: bool = False) -> dict:
    """阶段3: 构建ChromaDB向量索引"""
    logger.info("=" * 60)
    logger.info("阶段3: ChromaDB向量索引构建")
    logger.info("=" * 60)

    try:
        import chromadb
        from dashscope import TextEmbedding
        import dashscope

        # 加载配置
        config = load_config()
        dashscope.api_key = config.get("dashscope_api_key", "") or config.get("dashscope", {}).get("api_key", "")

        # 初始化ChromaDB
        chroma_client = chromadb.PersistentClient(path=str(DIR.CHROMA_DIR))
        collection = chroma_client.get_or_create_collection(
            name=CHROMA.COLLECTION_NAME,
            metadata={"description": "SOP页面双向索引"}
        )

        # 获取已索引的doc_id
        existing_ids = set()
        if not rebuild:
            try:
                result = collection.get(include=[])
                existing_ids = set(result.get('ids', []) or [])
                logger.info(f"已有索引: {len(existing_ids)} 条")
            except:
                pass

        # 获取需要索引的页面
        conn = sqlite3.connect(str(DB.SCAN_DB))
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.doc_id, p.job_name, p.image_path, f.pdf_path, f.file_hash,
                   p.page_num, f.pdf_name
            FROM page_index p
            JOIN pdf_files f ON p.pdf_id = f.id
            WHERE p.status = 'processed'
              AND p.job_name IS NOT NULL
              AND p.job_name != ''
              AND f.status = 'processed'
        """)
        pages_to_index = cursor.fetchall()
        conn.close()

        if not pages_to_index:
            logger.info("没有页面需要索引")
            return {'indexed': 0, 'skipped': 0, 'error': None}

        logger.info(f"待索引页面: {len(pages_to_index)} 个")

        # 提取维度信息（复用build_embedding.py的逻辑）
        from build_embedding import extract_file_dimensions

        batch_ids = []
        batch_embeddings = []
        batch_metadatas = []
        batch_documents = []
        total_indexed = 0
        total_skipped = 0

        for row in pages_to_index:
            doc_id, job_name, image_path, pdf_path, file_hash, page_num, pdf_name = row

            # 跳过已索引的
            if doc_id in existing_ids and not rebuild:
                total_skipped += 1
                continue

            try:
                # 提取维度
                dims = extract_file_dimensions(pdf_path)

                # 构建文本
                text_parts = [f"作业名称: {job_name}"]
                if dims.get('category'):
                    text_parts.append(f"分类: {dims['category']}")
                if dims.get('process'):
                    text_parts.append(f"工序: {dims['process']}")
                if dims.get('machine'):
                    text_parts.append(f"机型: {dims['machine']}")
                text_for_embedding = ' '.join(text_parts)

                # 获取embedding
                resp = TextEmbedding.call(model=PROCESS.EMBEDDING_MODEL, input=[text_for_embedding])
                if resp.status_code != 200:
                    _log_pipeline_warn_once(f"Embedding失败: {doc_id}")
                    continue

                embedding = resp.output['embeddings'][0]['embedding']

                # 构建metadata
                safe_name = "".join(c for c in Path(pdf_path).stem if c.isalnum() or c in ' -_')
                metadata = {
                    "job_name": job_name,
                    "pdf_name": dims.get('pdf_name', pdf_name),
                    "pdf_path": pdf_path,
                    "page_num": page_num,
                    "image_path": image_path,
                    "category": dims.get('category', ''),
                    "category_parts": json.dumps(dims.get('category_parts', []), ensure_ascii=False),
                    "process": dims.get('process', ''),
                    "machine": dims.get('machine', ''),
                }

                batch_ids.append(doc_id)
                batch_embeddings.append(embedding)
                batch_metadatas.append(metadata)
                batch_documents.append(text_for_embedding)

                total_indexed += 1

                # 批量写入
                if len(batch_ids) >= PROCESS.EMBEDDING_BATCH_SIZE:
                    collection.upsert(
                        ids=batch_ids,
                        embeddings=batch_embeddings,
                        metadatas=batch_metadatas,
                        documents=batch_documents
                    )
                    batch_ids.clear()
                    batch_embeddings.clear()
                    batch_metadatas.clear()
                    batch_documents.clear()

            except Exception as e:
                logger.error(f"索引失败 {doc_id}: {e}")
                total_skipped += 1

        # 写入剩余
        if batch_ids:
            collection.upsert(
                ids=batch_ids,
                embeddings=batch_embeddings,
                metadatas=batch_metadatas,
                documents=batch_documents
            )

        logger.info(f"\n索引构建完成:")
        logger.info(f"  新增: {total_indexed} 条")
        logger.info(f"  跳过: {total_skipped} 条")
        logger.info(f"  总计: {collection.count()} 条")

        return {
            'indexed': total_indexed,
            'skipped': total_skipped,
            'error': None
        }

    except Exception as e:
        logger.error(f"索引构建失败: {e}")
        logger.debug(traceback.format_exc())
        return {'indexed': 0, 'skipped': 0, 'error': str(e)}


# ============== 完整流水线 ==============

def run_full_pipeline(workers: int = None, rebuild: bool = False) -> dict:
    """运行完整流水线"""
    start_time = datetime.now()

    results = {
        'scan': {'added': 0, 'modified': 0, 'deleted': 0, 'metadata_only': 0, 'unchanged': 0, 'error': None},
        'cleanup': {'deleted_pdfs': 0, 'deleted_pages': 0, 'error': None},
        'convert': {'processed': 0, 'skipped': 0, 'error': None},
        'index': {'indexed': 0, 'skipped': 0, 'error': None},
        'duration': 0,
        'errors': []
    }

    logger.info("=" * 60)
    logger.info("开始SOP处理流水线")
    logger.info(f"开始时间: {start_time.isoformat()}")
    logger.info("=" * 60)

    if not PIPELINE_LOCK.acquire(blocking=False):
        logger.warning("已有同步流水线正在运行，跳过本轮")
        results['errors'].append('已有同步流水线正在运行')
        return results

    state = StateManager()

    try:
        # 阶段1: 扫描
        scan_result = run_scan(state)
        results['scan'] = scan_result
        if scan_result.get('error'):
            results['errors'].append(f"扫描阶段: {scan_result['error']}")

        # 阶段1.5: 删除清理
        cleanup_result = cleanup_deleted_documents(state)
        results['cleanup'] = cleanup_result
        if cleanup_result.get('error'):
            results['errors'].append(f"清理阶段: {cleanup_result['error']}")

        # 阶段2: 图片转换
        convert_result = run_convert(state, workers=workers)
        results['convert'] = convert_result
        if convert_result.get('error'):
            results['errors'].append(f"转换阶段: {convert_result['error']}")

        # 阶段3: 索引构建
        index_result = run_index(state, rebuild=rebuild)
        results['index'] = index_result
        if index_result.get('error'):
            results['errors'].append(f"索引阶段: {index_result['error']}")

    finally:
        state.close()
        PIPELINE_LOCK.release()

    end_time = datetime.now()
    results['duration'] = (end_time - start_time).total_seconds()

    logger.info("=" * 60)
    logger.info("流水线执行完成!")
    logger.info(f"耗时: {results['duration']:.1f} 秒")
    if results['errors']:
        _log_pipeline_warn_once(f"流水线有错误: {results['errors']}")
    logger.info("=" * 60)

    return results


# ============== 监控模式 ==============

def run_watch(interval_minutes: int = None, workers: int = None):
    """持续监控模式"""
    if interval_minutes is None:
        interval_minutes = SCHEDULE.WATCH_INTERVAL_MINUTES

    logger.info(f"启动持续监控模式，每 {interval_minutes} 分钟检查一次...")
    logger.info("按 Ctrl+C 停止")

    try:
        while True:
            logger.info("\n" + "=" * 60)
            logger.info(f"监控轮次: {datetime.now().isoformat()}")
            logger.info("=" * 60)

            results = run_full_pipeline(workers=workers)

            if not results['errors']:
                logger.info("本轮执行成功")
            else:
                _log_pipeline_warn_once(f"本轮有错误: {results['errors']}")

            logger.info(f"\n下次检查: {interval_minutes} 分钟后")
            time.sleep(interval_minutes * 60)

    except KeyboardInterrupt:
        logger.info("\n监控已停止")


# ============== CLI ==============

def main():
    import argparse

    parser = argparse.ArgumentParser(description='SOP处理流水线调度器')
    parser.add_argument('--scan', action='store_true', help='只运行扫描阶段')
    parser.add_argument('--convert', action='store_true', help='只运行图片转换阶段')
    parser.add_argument('--index', action='store_true', help='只运行索引构建阶段')
    parser.add_argument('--watch', action='store_true', help='持续监控模式')
    parser.add_argument('--minutes', type=int, default=SCHEDULE.WATCH_INTERVAL_MINUTES, help='监控间隔分钟数')
    parser.add_argument('--workers', type=int, default=4, help='并发数（默认4）')
    parser.add_argument('--rebuild', action='store_true', help='重建索引')
    parser.add_argument('--stats', action='store_true', help='查看当前统计')

    args = parser.parse_args()

    state = StateManager()

    # 查看统计
    if args.stats:
        stats = state.get_stats()
        state.close()
        print(f"\n当前状态:")
        print(f"  PDF文件: {stats['total_pdfs']}")
        print(f"  待处理: {stats['pending_pdfs']}")
        print(f"  已完成: {stats['processed_pdfs']}")
        print(f"  索引页面: {stats['processed_pages']}")
        print(f"  跳过页面: {stats['skipped_pages']}")
        print(f"  作业数: {stats['unique_jobs']}")
        return

    # 单独阶段运行
    if args.scan:
        result = run_scan(state)
        state.close()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if args.convert:
        result = run_convert(state, workers=args.workers)
        state.close()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if args.index:
        result = run_index(state, rebuild=args.rebuild)
        state.close()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    # 持续监控模式
    if args.watch:
        state.close()
        run_watch(interval_minutes=args.minutes, workers=args.workers)
        return

    # 默认：运行完整流水线
    results = run_full_pipeline(workers=args.workers, rebuild=args.rebuild)

    # 保存执行结果
    result_file = DIR.LOG_DIR / f"pipeline_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    logger.info(f"执行结果已保存: {result_file}")

    # 返回退出码
    if not results['errors']:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
