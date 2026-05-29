#!/usr/bin/env python3
"""
前端可以直接调用的Python API模块
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# 直接导入并调用
from build_embedding import suggest_job_names, search_by_job_name, search_by_text_description, get_stats

def handle_request(action, param=""):
    """处理前端请求"""
    if action == "suggest":
        return suggest_job_names(param, 10)
    elif action == "search":
        return search_by_job_name(param, 10)
    elif action == "semantic":
        return search_by_text_description(param, 10)
    elif action == "stats":
        return get_stats()
    return []

if __name__ == "__main__":
    import json
    action = sys.argv[1] if len(sys.argv) > 1 else "stats"
    param = sys.argv[2] if len(sys.argv) > 2 else ""
    result = handle_request(action, param)
    print(json.dumps(result, ensure_ascii=False))
