# 提案：把 `dbskill` 正式收编进 `WORKSPACE_INDEX.md`

> 提案日期：2026-06-10
> 提案来源：`docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md` 缺口 #1
> 提案人：axi-docs 维护者
> 收件人：`infra/axi-workspace-governance` 治理团队

## 1. 背景

`shared/dbskill/` 是工作区下真实存在的项目（"dontbesilent 商业诊断工具箱"，21 个 Agent skill + JSONL 原子库 + CC BY-NC 4.0），但**未**登记在 `/Volumes/code/workspace/WORKSPACE_INDEX.md` 的任何分区表格里。

后果：

1. `app/scripts/build-projects-index.mjs` 不会自动为其生成 `docs/content/{en,zh}/projects/dbskill/` 档案；
2. 知识图谱、Web 阅读页、MCP `axi_docs_*` 工具对该项目不可见；
3. 走 `axi-docs` 文档巡检的 agent 会遗漏该项目。

为部分缓解，`docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md` 期间由 axi-docs 维护者手工补了 7 + 8 件镜像目录，并在 `docs/projects.index.json` 加了 1 条 `hand-curated` 状态记录（通过 `preservedAddenda` 机制防 build 冲掉）。

**这是权宜之计，长期应将项目正式收编。**

## 2. 提案内容

把 `dbskill` 加入 `WORKSPACE_INDEX.md` 的 `## Shared And Infrastructure Foundations` 分区表格，作为新一行。

建议表格行内容：

```markdown
| dbskill | `/Volumes/code/workspace/shared/dbskill` | dontbesilent 商业诊断工具箱：从 12,307 条推文中提炼方法论，做成 21 个 Agent skill，可在 Claude Code / Codex / Cursor / Trae Solo 等任意支持 skill / system prompt 的 Agent 上使用。 | Markdown skills, JSONL atomic library | active reference | `README.md`, `README.zh-CN.md` | `bash tools/build-skills.sh` (optional) | CC BY-NC 4.0 — 个人/学习/研究/非商业自由使用；商业用途需联系作者单独授权。 |
```

注：

- `status: active reference` 而非 `shared provider`：dbskill 是**参考**（独立项目，非 Axi 维护），`shared/` 分区下另有 `axi-ui` / `axi-tauri-starter` 是 Axi 提供的 shared 库。
- `verification` 列给的是上游构建命令（`tools/build-skills.sh`），不是 Axi 项目的验证命令。

## 3. 实施影响

完成收编后：

1. 删 `app/scripts/build-projects-index.mjs` 中 dbskill 的 `hand-curated` 记录；
2. 重跑 `pnpm --dir app projects:build`，build 脚本会用模板重新生成 7 件套；
3. 11 件套扩展（CHANGELOG/SECURITY/README.zh-CN/AGENTS.zh-CN）按源文件存在性自动判断（dbskill 源有 `README.zh-CN.md`，会自动生成镜像）；
4. 手工建的 8 件镜像会被覆盖为 build 脚本的标准 7 + 1（README.zh-CN.md）= 8 件，差异是 README 内容从手工精简摘要变成脚本标准摘要；
5. 删除 `docs/content/{en,zh}/projects/dbskill/` 目录的 `frontmatter.mirror-strategy` 字段（该字段仅手工维护需要）；
6. 通知 dbskill 上游 maintainer（如果有）：Axi 工作区已正式收录。

## 4. 风险

- **轻微**：收编后 dbskill 镜像的 README.md 会从手工"摘要+引用 upstream 完整版"变成脚本标准"workspace project dossier"格式。**信息密度可能略降**（不再镜像 upstream 工具箱表 / 知识库结构）。**缓解**：在 dossier README 里加链接到 upstream `shared/dbskill/README.md`（脚本生成的模板已经包含此链接）。
- **极小**：CC BY-NC 4.0 许可要求署名。`WORKSPACE_INDEX.md` 的 `notes` 段会清楚标注。

## 5. 决策点（需 owner 决定）

- [ ] 是否同意收编 `dbskill` 到 `WORKSPACE_INDEX.md`？
- [ ] 同意的话：用 `## Shared And Infrastructure Foundations` 还是新建 `## Community-Authored Skills` 分区？
- [ ] 同意的话：dossier `README.md` 是接受 build 脚本的简版，还是要求 axi-docs 维护一个"扩展版"（超出 build 脚本机制）？

## 6. 提案人立场

提案人倾向**同意收编 + 接受 build 脚本简版**。理由：

1. dbskill 在工作区里已经存在 6 个月，axi-docs 的所有覆盖机制（路径、scripts、tools）默认能正确处理它——收编是补形式；
2. 简版 dossier + 链接到 upstream 是最不容易漂移的做法；
3. 如果未来 dbskill 上游做了结构变更，build 脚本会跟随 `WORKSPACE_INDEX.md` 自动调整；而手工"扩展版"则需要 axi-docs 维护者手动同步。

---

*提案在 axi-docs `docs/audits/` 留下副本，待 owner 决定后由 `infra/axi-workspace-governance` 落地。*
