<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-23 | Updated: 2026-03-23 -->

# asserts

## Purpose
SOP 静态资源目录，存放生产作业标准文档（图片、PDF），按产品线和工序分类。

## Subdirectories

| Directory | Purpose |
|---------|---------|
| `PA组件包装SOP/` | PA 组件包装标准作业程序文档（大量 PA* 产品编号子目录） |
| `成品包装SOP/` | 成品包装 SOP（ATM/BV/NV 等产品线） |
| `装配 SOP/` | 装配作业标准文档 |
| `化学品SOP/` | 化学品作业标准文档 |
| `测试 SOP/` | 测试 SOP 文档 |

## For AI Agents

### Working In This Directory
- **静态资源目录**，不要在此创建代码文件
- 这些 SOP 文档由 `backend/sync_sop.py` 同步到 ChromaDB 向量数据库
- 文档格式：图片、PDF，由后端 `jinja2` 渲染后通过 Electron 显示

### Common Patterns
- 子目录按产品线（PA*/NV*/BV*/CBA* 等）组织
- 部分子目录为多产品组合（如 `PA00400&PA02334/`）
- 文件名格式：`产品编号/PA*.pdf` 或 `产品编号/*.png/jpg`

## Dependencies

### Internal
- `backend/sync_sop.py` - SOP 同步脚本
- `backend/chroma/` - 向量数据库

<!-- MANUAL: -->

## Traceability

| 文档 | 路径 | 说明 |
|------|------|------|
| AGENTS.md | `./AGENTS.md` | 资源目录 AI 文档（当前） |
| AGENTS.md (parent) | `../AGENTS.md` | 项目根文档（L2） |
| TODO.md (inherited) | `../TODO.md` | 全项目任务（继承自父级 L2） |
| MILESTONES.md (inherited) | `../MILESTONES.md` | 全项目里程碑（继承自父级 L2） |
