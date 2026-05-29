#!/usr/bin/env python3
"""
SOP 路径维度提取（纯规则，无 OCR/LLM 依赖）。
"""

from __future__ import annotations

import os
import re

# 工序关键词集合（用于从文件名中识别工序）
_PROCESS_KEYWORDS = {
    "包装", "装配", "打包", "目检", "检查", "测试",
    "清洁", "维修", "点检", "消毒", "加注", "贴标",
    "组装", "拆卸", "擦拭",
}

# SOP 日期后缀匹配（去掉了 .pdf 后再匹配）
_SOP_DATE_PAT = re.compile(
    r"\s*SOP ?(\d{4})\.?(\d{2})\.?(\d{2,})\s*$",
    re.IGNORECASE,
)


def extract_file_dimensions(pdf_path: str) -> dict:
    """从 PDF 路径规则提取维度（无 OCR/LLM）。

    目录结构:
      .../{ProcessDir}/{CategoryDir}/filename.pdf

    返回:
      - process: grandparent 目录名，去掉末尾 SOP（如 装配 SOP -> 装配）
      - category: parent 目录名（如 Cashbox / BNF / NV200S）
      - category_parts: category 按 & 拆分后的列表
      - machine: 从文件名 body 中提取（去掉 SOP 日期 + 工序词后的产品/机型名）
      - job_name: 与 machine 相同，作为合辑标题
      - pdf_name: 完整文件名（不含 .pdf）
    """
    norm = (pdf_path or "").replace("\\", "/")
    parts = [p for p in norm.split("/") if p]
    filename = parts[-1] if parts else ""

    pdf_name = re.sub(r"\.pdf$", "", filename, flags=re.IGNORECASE).strip()

    valid_parts = [p for p in parts if p]
    if len(valid_parts) >= 3:
        parent = valid_parts[-2]
        grandparent = valid_parts[-3]
    elif len(valid_parts) == 2:
        parent = valid_parts[-1]
        grandparent = valid_parts[-2]
    else:
        parent = ""
        grandparent = ""

    if re.search(r"\s*SOP\s*$", grandparent, flags=re.IGNORECASE):
        process = re.sub(r"\s*SOP\s*$", "", grandparent, flags=re.IGNORECASE).strip()
    elif re.search(r"\s*SOP\s*$", parent, flags=re.IGNORECASE):
        process = re.sub(r"\s*SOP\s*$", "", parent, flags=re.IGNORECASE).strip()
    else:
        process = ""

    category_parts = [p.strip() for p in parent.split("&") if p.strip()]
    category = category_parts[0] if category_parts else parent

    name_body = re.sub(r"\.pdf$", "", filename, flags=re.IGNORECASE).strip()
    name_no_sopdate = _SOP_DATE_PAT.sub("", name_body).strip()

    machine = name_no_sopdate
    for kw in sorted(_PROCESS_KEYWORDS, key=len, reverse=True):
        pattern = re.compile(r"(.+?)\s+" + re.escape(kw) + r"\s*$")
        matched = pattern.match(name_no_sopdate)
        if matched:
            before = matched.group(1).strip()
            machine = before if before else name_no_sopdate
            break

    machine = re.sub(r"\s*SOP\s*$", "", machine, flags=re.IGNORECASE).strip()
    job_name = machine

    return {
        "category": category,
        "category_parts": category_parts,
        "process": process,
        "machine": machine,
        "job_name": job_name,
        "pdf_name": pdf_name,
        "pdf_path": os.path.normpath(pdf_path) if pdf_path else "",
    }
