# @axi/scaffold-runtime

## 角色

CLI 运行时、命令执行、sync、doctor、install 以及文件编排。

## 允许的工作区依赖

- `@axi/scaffold-kit`
- `@axi/scaffold-registry`

## 负责范围

- 参数解析
- 运行时上下文
- sync 与 doctor 执行
- 文件渲染与写入编排

## 禁止事项

- 直接导入 capability 包
- 定义 foundation 或 feature 模块
- 成为策略的唯一权威来源
