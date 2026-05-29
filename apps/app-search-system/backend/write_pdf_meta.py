#!/usr/bin/env python3
"""
从网络目录路径提取元数据并写入 manifest。

用途：
1. 首次全量：扫描网络目录 → 提取元数据 → 写入 manifest + ChromaDB（仅元数据，无 embedding）
2. 后续增量：读取 manifest → 与 ChromaDB 中已有 pdf_path 比对 → 只写入新增的

Manifest 格式（供同步脚本读取）:
[
  { "pdf_path": "...", "category": "...", "process": "...", "job_name": "...", "pdf_name": "..." },
  ...
]

注意：写入 ChromaDB 时仅写元数据（无 embedding），
embedding 由 build_embedding.py build --manifest manifest.json 补充。
"""
import json
import re
import os
import sys
import argparse

# 添加 backend 路径以导入 build_embedding
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import build_embedding

# ============================================================
# 路径配置
# ============================================================
DEFAULT_NETWORK_DIR = r"\\cnszxapp01\Quality ISO\01-ProcedureSOPcontrolplan\02-SOP\04-SOP(PDF)"
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
DEFAULT_MANIFEST = os.path.join(DATA_DIR, "sop_manifest.json")
DEFAULT_PDF_LIST = os.path.join(DATA_DIR, "all_pdfs.txt")


# ============================================================
# 核心逻辑
# ============================================================

def load_pdf_paths(network_dir: str = None, txt_list: str = None) -> list:
    """加载所有 PDF 绝对路径。

    优先级：
    1. txt_list 文件（手动维护或上次扫描缓存）
    2. 自动 find 扫描 network_dir
    """
    txt = txt_list or DEFAULT_PDF_LIST
    import os as _os
    print(f"[DEBUG] cwd={_os.getcwd()}, txt={txt!r}, exists={_os.path.exists(txt)}")
    if _os.path.exists(txt):
        with open(txt, encoding='utf-8') as f:
            raw = f.readlines()
        print(f"[DEBUG] raw lines: {len(raw)}")
        paths = [line.strip() for line in raw
                if line.strip() and line.strip().lower().endswith('.pdf')]
        print(f"  从缓存文件读取: {len(paths)} 个文件 ({txt})")
        return paths

    nd = network_dir or DEFAULT_NETWORK_DIR
    print(f"  扫描网络目录: {nd}")
    import subprocess
    # find 命令：UNC 路径在 bash 下用 //
    nd_unix = nd.replace('\\', '/')
    result = subprocess.run(
        ["find", nd_unix, "-name", "*.pdf"],
        capture_output=True, text=True
    )
    paths = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    print(f"  扫描到 {len(paths)} 个文件")
    return paths


def extract_all_dims(paths: list) -> list:
    """对所有路径提取元数据（纯规则，无需 LLM）"""
    records = []
    for i, path in enumerate(paths):
        dims = build_embedding.extract_file_dimensions(path)
        records.append({'pdf_path': path, **dims})
        if (i + 1) % 50 == 0:
            print(f"  已处理 {i + 1}/{len(paths)} ...")
    return records


def save_manifest(records: list, manifest_path: str):
    """保存 manifest JSON"""
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"  Manifest 已保存: {manifest_path} ({len(records)} 条)")


def load_manifest(manifest_path: str) -> list:
    """加载 manifest JSON"""
    if not os.path.exists(manifest_path):
        return []
    with open(manifest_path, encoding='utf-8') as f:
        return json.load(f)


def get_existing_pdf_paths() -> set:
    """从 ChromaDB 读取已有 pdf_path 集合"""
    _, collection = build_embedding.init_chroma()
    existing = collection.get(include=['metadatas'])
    paths = set()
    for m in (existing.get('metadatas') or []):
        if m and m.get('pdf_path'):
            paths.add(m['pdf_path'])
    print(f"  ChromaDB 已有: {len(paths)} 个文件, {collection.count()} 条记录")
    return paths


def upsert_records_to_chroma(records: list, existing_paths: set, batch_size: int = 50):
    """将元数据记录写入 ChromaDB（附占位 embedding，向量由 build_embedding.py 重建时补充）。

    注意：ChromaDB 要求 upsert 时必须提供 embedding。
    这里使用零向量占位，后续 build_embedding.py 会用真实 embedding 覆盖整条记录。
    """
    import numpy as np
    _, collection = build_embedding.init_chroma()

    new_records = [r for r in records if r['pdf_path'] not in existing_paths]
    if not new_records:
        print("  所有文件均已存在，无需写入")
        return 0

    print(f"  需要写入: {len(new_records)} 个新文件（embedding 用零向量占位）")

    i = 0
    while i < len(new_records):
        batch = new_records[i:i + batch_size]
        ids, docs, metas, embeddings = [], [], [], []
        for r in batch:
            safe = "".join(c for c in os.path.basename(r['pdf_path']) if c.isalnum() or c in ' -_')
            doc_id = f"{safe}_meta"
            doc_text = (
                f"作业名称: {r.get('job_name', '')} "
                f"分类: {r.get('category', '')} "
                f"机型: {r.get('machine', '')} "
                f"工序: {r.get('process', '')}"
            )
            ids.append(doc_id)
            docs.append(doc_text)
            metas.append({
                'category': r.get('category', ''),
                'category_parts': json.dumps(r.get('category_parts', []), ensure_ascii=False),
                'process': r.get('process', ''),
                'machine': r.get('machine', ''),
                'job_name': r.get('job_name', ''),
                'pdf_name': r.get('pdf_name', ''),
                'pdf_path': r['pdf_path'],
                'page_num': 0,
                'image_path': '',
            })
            # 零向量占位，build_embedding.py 会用真实 embedding 覆盖
            embeddings.append(np.zeros(1536, dtype=np.float32).tolist())
        collection.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
        i += batch_size
        print(f"    写入批次 {i}/{len(new_records)} ...")

    print(f"  写入完成，ChromaDB 总记录: {collection.count()}")
    return len(new_records)


# ============================================================
# 主入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="PDF 路径元数据提取与同步")
    parser.add_argument('--dir', default=DEFAULT_NETWORK_DIR,
                        help='网络目录路径（扫描 PDF 文件）')
    parser.add_argument('--manifest', default=DEFAULT_MANIFEST,
                        help='输出 manifest 文件路径')
    parser.add_argument('--list', dest='txt_list', default=DEFAULT_PDF_LIST,
                        help='PDF 路径列表文件')
    parser.add_argument('--rebuild', action='store_true',
                        help='清空 manifest 后重新扫描（忽略已有记录）')
    parser.add_argument('--skip-scan', action='store_true',
                        help='跳过目录扫描，仅用 manifest 增量同步')
    args = parser.parse_args()

    print("=" * 60)
    print("PDF 元数据同步工具")
    print("=" * 60)

    # Step 1: 加载/扫描路径
    if args.skip_scan:
        records = load_manifest(args.manifest)
        if not records:
            print("  manifest 为空，请先不带 --skip-scan 运行一次全量扫描")
            return
        print(f"  从 manifest 加载: {len(records)} 条")
        paths = [r['pdf_path'] for r in records]
    else:
        paths = load_pdf_paths(args.dir, args.txt_list)
        if not paths:
            print("  未找到任何 PDF 文件")
            return

        # Step 2: 提取元数据
        print("  提取元数据（纯规则，无 LLM）...")
        records = extract_all_dims(paths)

        # Step 3: 保存 manifest
        save_manifest(records, args.manifest)

    # Step 4: 增量写入 ChromaDB
    if args.rebuild:
        print("\n  [rebuild] 跳过 ChromaDB 写入（manifest 已保存）")
        print(f"\n  下一步: python build_embedding.py build --manifest {args.manifest}")
        return

    print("\n  增量写入 ChromaDB ...")
    existing_paths = get_existing_pdf_paths()
    upsert_records_to_chroma(records, existing_paths)

    print(f"\n  Manifest: {args.manifest}")
    print(f"\n  下一步: python build_embedding.py build --manifest {args.manifest}")
    print("  （build_embedding 会根据 pdf_path 判断哪些文件需要处理）")


if __name__ == '__main__':
    main()
