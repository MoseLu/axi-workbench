---
name: minimax-xlsx
description: Build styled Excel workbooks with embedded charts using the bundled MiniMax XLSX guidance. Use when the task requires `.xlsx` generation with openpyxl, workbook styling, pivot-oriented layouts, or chart creation that must be embedded and validated rather than left as manual follow-up work.
---

# MiniMax XLSX

Use this skill when the user wants a real Excel workbook, especially one with styling rules or embedded charts.

## Workflow

1. Generate or edit the workbook with `openpyxl`.
2. Read `styling.md` before applying a visual theme.
3. If charts are required, read `charts.md` and create real embedded chart objects in the workbook.
4. If pivot-style summaries or pivot-friendly layouts are required, read `pivot.md`.
5. After saving a workbook with charts, run `./scripts/MiniMaxXlsx.exe chart output.xlsx` to verify the chart objects are not broken or empty.

## Notes

- Do not leave chart insertion as a manual step for the user when charts were requested.
- `charts.md` documents when `from_rows=True` is required for row-oriented data.
- `styling.md` includes distinct palettes for grayscale, fiscal, verdant, and dusk themes.
- Relative paths in this skill are anchored to this skill directory.
