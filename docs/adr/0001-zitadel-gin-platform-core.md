# ADR-0001: ZITADEL 中央身份、Gin 网关与模块化 Go 核心

- **日期**: 2026-08-07
- **状态**: 已接受
- **决策者**: Axi Workbench Owner

## 背景

Workbench 同时服务独立 Web 管理端、独立移动端与 EPS 外部业务系统，必须支持 OIDC 单点登录、扫码批准、邮箱验证、多租户、字典与用户偏好。现有 Gin 网关和认证服务使用内存状态，Spring 核心服务使用 H2，无法构成可部署的身份与业务边界。

## 决策

将 Axi 自托管 ZITADEL 定为中央 OIDC Issuer；保留并升级 Go/Gin API Gateway，新增 Gin identity-adapter 与模块化 Go platform-core。Web、移动端和 EPS 一律使用 Authorization Code + PKCE；业务数据使用 PostgreSQL 的 tenant_id 与 RLS 隔离。

## 考虑的备选方案

### 全量自研 Gin OIDC Server

- **优点**: 全部逻辑在单一 Go 代码库。
- **缺点**: OIDC、密钥轮换、会话、MFA 和协议兼容成为自维护的高风险安全边界。
- **为何不选**: ZITADEL 已承担标准身份协议，Gin 应专注 Axi 的 QR、EPS 与平台业务编排。

### 首期拆分所有历史服务

- **优点**: 部署单元边界最细。
- **缺点**: 在现有服务仍为原型时先引入跨服务一致性、可观测性与运维成本。
- **为何不选**: 首期只独立网关、身份与平台核心；字典、偏好和工作域保持 platform-core 内部模块。

### 继续使用 Spring/H2 和内存认证

- **优点**: 迁移成本最低。
- **缺点**: 不具备持久化、多租户、标准 OIDC 或生产审计能力。
- **为何不选**: 与多端和 EPS 的安全边界不兼容。

## 影响

- 网关成为业务 API 唯一入口；文件、工作流和控制面不再直接承担用户身份逻辑。
- ZITADEL 身份数据与平台业务数据分离，EPS 通过 OIDC Client 和受审计适配器接入，不共享数据库。
- 历史 `auth-service` 与 Spring `core-service` 在兼容窗口内保留，不得再接收新的生产业务能力。
- 新服务必须提供迁移、健康检查、单元测试、容器镜像与 Helm 部署清单。
