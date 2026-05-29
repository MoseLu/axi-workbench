#!/usr/bin/env python3
"""Read-only Axi Docs manifest/search contract for Workstation integration."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DOC_KINDS = {
    "AGENTS.md": "agent_rules",
    "CLAUDE.md": "agent_rules_legacy",
    "README.md": "readme",
    "TODO.md": "todo",
    "MILESTONES.md": "milestone",
    "docs/PRD.md": "prd",
    "docs/TDD.md": "tdd",
}


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def discover_project_docs(root: Path) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    for rel, kind in DOC_KINDS.items():
        path = root / rel
        if path.exists():
            docs.append({
                "kind": kind,
                "path": str(path),
                "relativePath": rel,
                "bytes": path.stat().st_size,
            })
    for path in sorted((root / "docs").glob("*.md")) if (root / "docs").exists() else []:
        rel = path.relative_to(root).as_posix()
        if rel not in DOC_KINDS:
            docs.append({
                "kind": "reference",
                "path": str(path),
                "relativePath": rel,
                "bytes": path.stat().st_size,
            })
    return docs


def discover_sop_manifest(root: Path) -> dict[str, Any]:
    manifest_path = root / "backend" / "data" / "sop_manifest.json"
    records = load_json(manifest_path, [])
    if not isinstance(records, list):
        records = []
    return {
        "path": str(manifest_path),
        "exists": manifest_path.exists(),
        "recordCount": len(records),
        "sample": [
            {
                "pdfName": item.get("pdf_name") or item.get("job_name") or item.get("pdf_path"),
                "pdfPathRef": item.get("pdf_path"),
                "category": item.get("category"),
            }
            for item in records[:5]
            if isinstance(item, dict)
        ],
    }


def search(root: Path, query: str, limit: int = 10) -> list[dict[str, Any]]:
    needle = query.casefold().strip()
    if not needle:
        return []
    results: list[dict[str, Any]] = []
    for doc in discover_project_docs(root):
        haystack = f"{doc['kind']} {doc['relativePath']}".casefold()
        if needle in haystack:
            results.append({"source": "project_doc", **doc})
    manifest = load_json(root / "backend" / "data" / "sop_manifest.json", [])
    if isinstance(manifest, list):
        for item in manifest:
            if not isinstance(item, dict):
                continue
            haystack = json.dumps(item, ensure_ascii=False).casefold()
            if needle in haystack:
                results.append({
                    "source": "sop_manifest",
                    "kind": "sop",
                    "pdfName": item.get("pdf_name") or item.get("job_name"),
                    "pdfPathRef": item.get("pdf_path"),
                    "category": item.get("category"),
                })
            if len(results) >= limit:
                break
    return results[:limit]


def build_manifest(root: Path, query: str | None) -> dict[str, Any]:
    manifest = {
        "resourceId": "axi-docs",
        "owner": "app-search-system",
        "mode": "read_only",
        "capabilities": ["project_doc_manifest", "sop_manifest", "search_fixture"],
        "projectDocs": discover_project_docs(root),
        "sopManifest": discover_sop_manifest(root),
    }
    if query is not None:
        manifest["search"] = {
            "query": query,
            "results": search(root, query),
        }
    return manifest


def validate(manifest: dict[str, Any]) -> None:
    kinds = {doc["kind"] for doc in manifest["projectDocs"]}
    required = {"agent_rules", "todo", "milestone"}
    missing = sorted(required - kinds)
    if missing:
        raise SystemExit(f"missing project docs: {', '.join(missing)}")
    if manifest["sopManifest"]["recordCount"] <= 0:
        raise SystemExit("SOP manifest is empty or unreadable")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--query", default=None)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    manifest = build_manifest(root, args.query)
    if args.check:
        validate(manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
