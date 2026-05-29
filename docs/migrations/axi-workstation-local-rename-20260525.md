# Axi Workstation Local Rename Migration

日期：2026-05-25

## Active Owner

本地 active owner 已由 `enterprise-project-automation-platform` 收束为 `axi-workstation`，展示名为 `Axi Workstation`。本次迁移覆盖控制面、通信入口、公共合同包和 Web Portal 主入口资产。

| Surface | Active name |
| --- | --- |
| Repository directory | `projects/axi-workstation` |
| Control plane package | `@axi/workstation-control-plane` |
| Communication gateway package | `@axi/workstation-communication-gateway` |
| Public contracts package | `@axi/workstation-contracts` |
| UI display name | `Axi Workstation` |

## Compatibility Kept In This Wave

- Remote git URLs remain `enterprise-project-automation-platform` until local registry, documentation and runtime validation complete.
- `@epap/schemas` is preserved as a local re-export package pointing to `@axi/workstation-contracts`.
- `EPAP_WORKSPACE_ROOT`, `EPAP_CONTROL_CACHE_DIR`, `EPAP_COMMUNICATION_CACHE_DIR`, `EPAP_CONTROL_PLANE_URL` and `EPAP_ENABLE_CODEX_APP_RUNTIME` remain accepted after the new `AXI_WORKSTATION_*` forms.
- Existing `.cache/epap-*`, database table names and event idempotency keys remain unchanged to avoid hiding local audit history or duplicating in-flight notification delivery.
- Rule and prompt filenames containing `epap-` remain valid compatibility paths; active content identifies Axi Workstation.

## Remaining Rename Work

Historical architecture/docs pages, legacy service packages such as `@epap/ui` and container/runtime names require a later compatibility-reviewed wave. They must not be bulk-renamed until their data path, deployment or consumer impact has been checked.
