#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


TEXT_SUFFIXES = {
    ".c",
    ".cc",
    ".cpp",
    ".css",
    ".go",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".rb",
    ".rs",
    ".scss",
    ".sh",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}


@dataclass
class Change:
    status: str
    path: str
    additions: int | None
    deletions: int | None
    mtime: float | None
    feature_hint: str

    @property
    def changed_lines(self) -> int:
        return (self.additions or 0) + (self.deletions or 0)


SUBJECT_HINTS = {
    "ai-chat": "update ai chat experience",
    "docs-and-guidance": "refresh docs and editing guidance",
    "infrastructure": "normalize infrastructure configuration text",
}


def run_git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    return result.stdout


def run_git_live(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def parse_status(repo: Path) -> list[tuple[str, str]]:
    lines = run_git(repo, "status", "--porcelain=v1").splitlines()
    pairs: list[tuple[str, str]] = []
    for line in lines:
        if not line:
            continue
        pairs.append((line[:2], line[3:]))
    return pairs


def tracked_numstat(repo: Path) -> dict[str, tuple[int | None, int | None]]:
    output = run_git(repo, "diff", "--numstat", "HEAD")
    stats: dict[str, tuple[int | None, int | None]] = {}
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        added_raw, deleted_raw, path = parts
        added = None if added_raw == "-" else int(added_raw)
        deleted = None if deleted_raw == "-" else int(deleted_raw)
        stats[path] = (added, deleted)
    return stats


def estimate_untracked_stats(path: Path) -> tuple[int | None, int | None]:
    if not path.exists() or path.suffix.lower() not in TEXT_SUFFIXES:
        return None, None
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8", errors="replace")
    line_count = len(text.splitlines()) or 1
    return line_count, 0


def normalize_stem(path: Path) -> str:
    stem = path.stem
    for suffix in (".test", ".spec"):
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
    if stem.startswith("test_"):
        stem = stem[5:]
    return stem


def feature_hint_for(path_text: str) -> str:
    path = Path(path_text)
    parts = [part.lower() for part in path.parts]
    stem = normalize_stem(path).lower()

    if any(part in {"docs", "readme.md", "agents.md"} for part in parts):
        return "docs-and-guidance"
    if path.name in {"vite.config.ts", "app.py"}:
        return "infrastructure"
    if "test" in stem or "tests" in parts:
        return f"tests-for-{stem or path.parent.name.lower()}"
    if "chat" in stem or "ai" in stem or "assistant" in stem:
        return "ai-chat"
    if len(parts) >= 3 and parts[0] in {"src", "backend"}:
        return "-".join(parts[1:3])
    if len(parts) >= 2:
        return "-".join(parts[:2])
    return stem or path.name.lower()


def collect_changes(repo: Path) -> list[Change]:
    status_pairs = parse_status(repo)
    stats = tracked_numstat(repo)
    changes: list[Change] = []
    for status, path_text in status_pairs:
        abs_path = repo / path_text
        additions, deletions = stats.get(path_text, (None, None))
        if status == "??":
            additions, deletions = estimate_untracked_stats(abs_path)
        mtime = abs_path.stat().st_mtime if abs_path.exists() else None
        changes.append(
            Change(
                status=status,
                path=path_text,
                additions=additions,
                deletions=deletions,
                mtime=mtime,
                feature_hint=feature_hint_for(path_text),
            )
        )
    changes.sort(key=lambda item: (float("inf") if item.mtime is None else item.mtime, item.path))
    return changes


def summarize_groups(changes: Iterable[Change]) -> list[dict]:
    groups: dict[str, list[Change]] = defaultdict(list)
    for change in changes:
        groups[change.feature_hint].append(change)

    summaries: list[dict] = []
    for feature_hint, items in sorted(
        groups.items(),
        key=lambda pair: min(float("inf") if item.mtime is None else item.mtime for item in pair[1]),
    ):
        changed_lines = sum(item.changed_lines for item in items)
        earliest = min((item.mtime for item in items if item.mtime is not None), default=None)
        latest = max((item.mtime for item in items if item.mtime is not None), default=None)
        summaries.append(
            {
                "feature_hint": feature_hint,
                "changed_lines": changed_lines,
                "needs_split": changed_lines > 1000,
                "earliest_mtime": iso_mtime(earliest),
                "latest_mtime": iso_mtime(latest),
                "files": [
                    {
                        "path": item.path,
                        "status": item.status,
                        "additions": item.additions,
                        "deletions": item.deletions,
                        "mtime": iso_mtime(item.mtime),
                    }
                    for item in items
                ],
            }
        )
    return summaries


def build_feature_groups(changes: Iterable[Change]) -> list[dict]:
    groups: dict[str, list[Change]] = defaultdict(list)
    for change in changes:
        groups[change.feature_hint].append(change)

    feature_groups: list[dict] = []
    for feature_hint, items in sorted(
        groups.items(),
        key=lambda pair: min(float("inf") if item.mtime is None else item.mtime for item in pair[1]),
    ):
        sorted_items = sorted(
            items,
            key=lambda item: (float("inf") if item.mtime is None else item.mtime, item.path),
        )
        changed_lines = sum(item.changed_lines for item in sorted_items)
        earliest = min((item.mtime for item in sorted_items if item.mtime is not None), default=None)
        latest = max((item.mtime for item in sorted_items if item.mtime is not None), default=None)
        feature_groups.append(
            {
                "feature_hint": feature_hint,
                "changed_lines": changed_lines,
                "needs_split": changed_lines > 1000,
                "earliest_mtime": iso_mtime(earliest),
                "latest_mtime": iso_mtime(latest),
                "items": sorted_items,
            }
        )
    return feature_groups


def build_commit_batches(changes: Iterable[Change]) -> list[dict]:
    batches: list[dict] = []
    for group in build_feature_groups(changes):
        feature_hint = str(group["feature_hint"])
        items: list[Change] = list(group["items"])
        parts: list[list[Change]] = []
        current_part: list[Change] = []
        current_lines = 0

        for item in items:
            item_lines = item.changed_lines
            if item_lines > 1000:
                raise RuntimeError(
                    f"Cannot auto-split {item.path}: the single file changes {item_lines} lines. "
                    "Split this feature manually before using execute."
                )
            if current_part and current_lines + item_lines > 1000:
                parts.append(current_part)
                current_part = []
                current_lines = 0
            current_part.append(item)
            current_lines += item_lines

        if current_part:
            parts.append(current_part)

        multiple_parts = len(parts) > 1
        for index, part in enumerate(parts, start=1):
            changed_lines = sum(item.changed_lines for item in part)
            subject = suggest_subject(feature_hint, changed_lines)
            if multiple_parts:
                subject = f"{subject} (part {index})"
            batches.append(
                {
                    "feature_hint": feature_hint,
                    "subject": subject,
                    "changed_lines": changed_lines,
                    "paths": [item.path for item in part],
                    "statuses": [item.status for item in part],
                }
            )

    return batches


def suggest_subject(feature_hint: str, changed_lines: int) -> str:
    base = SUBJECT_HINTS.get(feature_hint)
    if base:
        return base

    normalized = feature_hint.replace("_", "-")
    parts = [part for part in normalized.split("-") if part]
    if not parts:
        return "update repository changes"
    if parts[0] == "tests" and len(parts) > 2:
        return f"update tests for {' '.join(parts[2:])}"
    if changed_lines == 0 and len(parts) >= 2:
        return f"remove obsolete {' '.join(parts)} artifact"
    return f"update {' '.join(parts)}"


def render_plan(repo: Path, changes: list[Change]) -> str:
    branch = run_git(repo, "branch", "--show-current").strip()
    head = run_git(repo, "rev-parse", "HEAD").strip()
    groups = build_commit_batches(changes)

    lines = [
        f"repo: {repo}",
        f"branch: {branch}",
        f"head: {head}",
        f"working_tree: {'clean' if not changes else 'dirty'}",
    ]

    if not changes:
        lines.append("plan: no pending changes")
        return "\n".join(lines) + "\n"

    lines.append("commit_plan:")
    for index, group in enumerate(groups, start=1):
        lines.append(
            f"{index}. {group['subject']} | feature={group['feature_hint']} | changed_lines={group['changed_lines']}"
        )
        if len(group["statuses"]) != len(group["paths"]):
            raise ValueError("commit batch planner produced mismatched status/path lists")
        for status, path in zip(group["statuses"], group["paths"]):
            lines.append(f"   - {status} {path}")
    return "\n".join(lines) + "\n"


def iso_mtime(value: float | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value).isoformat(timespec="seconds")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def analyze_command(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    changes = collect_changes(repo)
    payload = {
        "repo": str(repo),
        "head": run_git(repo, "rev-parse", "HEAD").strip(),
        "branch": run_git(repo, "branch", "--show-current").strip(),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "changes": [
            {
                "status": item.status,
                "path": item.path,
                "additions": item.additions,
                "deletions": item.deletions,
                "changed_lines": item.changed_lines,
                "mtime": iso_mtime(item.mtime),
                "feature_hint": item.feature_hint,
            }
            for item in changes
        ],
        "suggested_groups": summarize_groups(changes),
    }
    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        write_text(Path(args.output), rendered + "\n")
    print(rendered)
    return 0


def plan_command(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    changes = collect_changes(repo)
    print(render_plan(repo, changes), end="")
    return 0


def has_staged_changes(repo: Path) -> bool:
    result = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=repo,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.returncode == 1


def create_submit_log(repo: Path, commits: list[str]) -> Path:
    submit_dir = repo / "docs" / "logs" / "submit"
    submit_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    branch = run_git(repo, "branch", "--show-current").strip()
    head = run_git(repo, "rev-parse", "HEAD").strip()
    status = run_git(repo, "status", "--short").strip()

    commit_lines = []
    for sha in commits:
        subject = run_git(repo, "show", "-s", "--format=%s", sha).strip()
        commit_lines.append(f"- {sha} {subject}")

    body = "\n".join(
        [
            "# Submit Record",
            "",
            f"- Generated at: {datetime.now().isoformat(timespec='seconds')}",
            f"- Branch: {branch}",
            f"- HEAD: {head}",
            f"- Workspace clean before log commit: {'yes' if not status else 'no'}",
            "",
            "## Commits",
            *commit_lines,
            "",
            "## Workspace Status",
            "```text",
            status or "(clean)",
            "```",
            "",
        ]
    )
    target = submit_dir / f"{timestamp}-batch-submit.md"
    write_text(target, body)
    return target


def execute_command(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    changes = collect_changes(repo)
    print(render_plan(repo, changes), end="")
    if not changes:
        return 0

    batches = build_commit_batches(changes)
    committed: list[str] = []

    for batch in batches:
        run_git_live(repo, "add", "--", *batch["paths"])
        if not has_staged_changes(repo):
            continue
        run_git_live(repo, "commit", "-m", str(batch["subject"]))
        committed.append(run_git(repo, "rev-parse", "HEAD").strip())

    if not committed:
        print("result: no commits were created")
        return 0

    log_path = create_submit_log(repo, committed)
    run_git_live(repo, "add", "--", str(log_path.relative_to(repo)))
    if has_staged_changes(repo):
        run_git_live(repo, "commit", "-m", "log batch commit submission record")
        committed.append(run_git(repo, "rev-parse", "HEAD").strip())

    print("result: completed")
    print(f"submit_log: {log_path}")
    print("commits:")
    for sha in committed:
        subject = run_git(repo, "show", "-s", "--format=%s", sha).strip()
        print(f"- {sha} {subject}")
    return 0


def write_log_command(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    target = create_submit_log(repo, [raw_sha.strip() for raw_sha in args.commit])
    print(target)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Plan and record feature-based git commit batches.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    analyze = subparsers.add_parser("analyze", help="Inspect the current working tree and suggest commit groups.")
    analyze.add_argument("--repo", default=".", help="Repository path. Defaults to the current directory.")
    analyze.add_argument("--output", help="Optional path to write the JSON analysis.")
    analyze.set_defaults(func=analyze_command)

    plan = subparsers.add_parser("plan", help="Print a concise commit plan for slash-command workflows.")
    plan.add_argument("--repo", default=".", help="Repository path. Defaults to the current directory.")
    plan.set_defaults(func=plan_command)

    execute = subparsers.add_parser("execute", help="Plan, commit batches, and write the submit log in one run.")
    execute.add_argument("--repo", default=".", help="Repository path. Defaults to the current directory.")
    execute.set_defaults(func=execute_command)

    write_log = subparsers.add_parser("write-log", help="Create a submit log entry for a finished batch.")
    write_log.add_argument("--repo", default=".", help="Repository path. Defaults to the current directory.")
    write_log.add_argument("--commit", action="append", required=True, help="Commit SHA to include. Repeat for each commit.")
    write_log.set_defaults(func=write_log_command)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
