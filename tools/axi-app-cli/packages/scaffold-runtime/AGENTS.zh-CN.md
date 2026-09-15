# 包说明
最后更新：2026-04-03 16:33:20 +08:00
父级：[AGENTS.md](../../AGENTS.md)
范围：packages/scaffold-runtime

## 角色

- 执行 CLI 命令、同步、doctor、安装和文件编排。
- 消费已组装的注册表，并将脚手架策略应用到真实项目树。

## 本地约束

- 仅依赖 `@axi/scaffold-kit` 和 `@axi/scaffold-registry`。
- 不要直接导入能力包。
- 保持机器可读的命令契约稳定，尤其是 `list --json` 和 `doctor --json`。
- 将 `.axi/modules.json` 视为期望状态，将 `.axi/scaffold.manifest.json` 视为已应用状态。

## 当前焦点

- 在不膨胀轻量 CLI 外壳的前提下，正式化命令类与生命周期阶段。
- 在稳定的注册表输入基础上，持续强化 sync、repair 和 drift 检测行为。
