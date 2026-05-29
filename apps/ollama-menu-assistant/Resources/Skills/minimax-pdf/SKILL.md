---
name: minimax-pdf
description: Create, fill, and restyle polished PDF files with the bundled MiniMax PDF toolchain. Use when the task involves generating a new PDF from structured content, filling PDF form fields, or reformatting Markdown, text, JSON, or PDF input into a designed document.
---

# MiniMax PDF

Use this skill when the user needs a PDF deliverable rather than a slide deck or DOCX.

## When to use

- Create a new designed PDF from structured content
- Fill fields in an existing PDF form
- Reformat Markdown, text, JSON, or PDF source into a polished PDF

## Workflow

1. Run `bash scripts/make.sh check` before substantial work. If dependencies are missing and installation is appropriate, use `bash scripts/make.sh fix`.
2. Pick one route:
   - **Create**: read `design/design.md`, then run `bash scripts/make.sh run ...`
   - **Fill**: inspect fields with `bash scripts/make.sh fill --input form.pdf --inspect`, then write values with `bash scripts/make.sh fill --input form.pdf --out filled.pdf --values '{"Field":"Value"}'`
   - **Reformat**: read `design/design.md`, then run `bash scripts/make.sh reformat --input source.md --title "..." --type report --out output.pdf`
3. When the user needs full option details, read `README.md`.
4. Keep outputs inside the current workspace unless the user asks for another destination.

## Notes

- The bundled scripts expect Python plus PDF dependencies, and cover rendering also needs Node.js plus Playwright/Chromium.
- Supported create and reformat document types are documented in `README.md`.
- Relative paths in this skill are anchored to this skill directory.
