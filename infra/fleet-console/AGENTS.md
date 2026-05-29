# Axi Fleet Console 代理指南

## 作用范围

本文档适用于 `/Volumes/code/workspace/projects/axi-workbench/infra/fleet-console` 及其所有子目录，并补充 `/Volumes/code/workspace/AGENTS.md` 里的工作区级规则。

## 修改前

- 先阅读 `README.md` 和 `docs/runbook.md`。
- 把 `registry/machines.json` 当作唯一人工维护的源数据。
- 生成物只通过脚本重建，不要手工改。

## 仓库结构

- `registry/machines.json`：机器、标签、生命周期和监控项的唯一人工入口。
- `scripts/fleetctl.py`：负责校验、渲染、诊断、探测和导出生成物。
- `ansible/`：主机初始化和服务部署 playbook。
- `dashboard/`：基于 React Router 和 Ant Design 的管理台。
- `generated/`：可丢弃的输出，如 inventory、SSH 配置、别名和监控目标。
- `dashboard/public/fleet-data.json`：生成给前端看的数据文件。

## 工作规则

- 只改源文件，不要手工编辑 `generated/` 或 `dashboard/public/fleet-data.json`。
- 新增或修改机器时，保持 `id`、`provider`、`role`、`ssh_user`、`public_ip`、`tailscale_name`、`tags`、`lifecycle` 一致。
- 生命周期只使用 `active`、`staging`、`maintenance`、`retired`。
- 不要把密钥、凭据或私钥提交进仓库。
- 不要把管理端口 `3001`、`9443`、`9090`、`19999` 直接暴露到公网。

## 验证

- 改了注册表或渲染逻辑：先跑 `python3 scripts/fleetctl.py validate`，再跑 `python3 scripts/fleetctl.py render --network bootstrap`，最后跑 `python3 scripts/fleetctl.py doctor --network bootstrap`。
- 改了看板：运行 `cd dashboard && npm run build`。
- 改了 Ansible 或 playbook：先渲染，再运行对应的 `ansible` 命令或 playbook。

## 备注

- Tailscale 没准备好之前用 `bootstrap` 网络；所有主机登录完成后切到 `tailscale`。
- 保持改动尽量小；如果运维流程变了，记得同步更新 `docs/runbook.md`。
