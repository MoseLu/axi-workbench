---
name: minimax-docx
description: Create, edit, and restyle DOCX files with the bundled MiniMax DOCX OpenXML workflow. Use when the task involves generating a DOCX from scratch, editing existing DOCX content, applying templates, handling comments or tracked changes, or working carefully with WordprocessingML details.
---

# MiniMax DOCX

Use this skill when the user specifically wants a `.docx` deliverable or precise Word/OpenXML control.

## Start Here

1. Run `bash scripts/env_check.sh` before major DOCX work.
2. If the source file is `.doc`, convert it first with `bash scripts/doc_to_docx.sh input.doc [outdir]`.
3. Preview existing files with `bash scripts/docx_preview.sh file.docx`.

## Choose The Right Reference

- New document creation: `references/scenario_a_create.md`
- Edit existing content: `references/scenario_b_edit_content.md`
- Apply or adapt a template: `references/scenario_c_apply_template.md`
- Comments: `references/comments_guide.md`
- Track changes: `references/track_changes_guide.md`
- Typography and CJK layout: `references/typography_guide.md` and `references/cjk_typography.md`
- OpenXML ordering, namespaces, units, or schema details: the `references/openxml_*.md` files

## Workflow

1. Choose the scenario reference that matches the request.
2. Use the bundled `scripts/dotnet` project when deterministic DOCX or OpenXML work is needed.
3. Keep the final `.docx` in the workspace and preview it after changes.

## Notes

- The bundled environment expects `.NET SDK 8+`.
- `pandoc` improves previews, and LibreOffice is needed only for `.doc` to `.docx` conversion.
- Relative paths in this skill are anchored to this skill directory.
