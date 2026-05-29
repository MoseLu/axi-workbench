# System Prompt 层

本目录是 EPAP prompt runtime 的不可变底座。

## 规则

- 默认不可修改。
- prompt 正文使用 `.mdc`，不使用普通 `.md`。
- 不放第三方完整 system prompt。
- 不放项目私有偏好。
- 不放临时任务上下文。
- 只保存 EPAP 自己的最低层身份、层级边界和安全原则。

修改本目录必须满足：

1. 有明确 owner 决策。
2. 更新 `docs/rules/epap-six-layer-sop.md` 或 ADR。
3. 说明为什么 global/project 层不能解决。
