# Fleet 运维底座

这套目录把多台服务器管理收敛成一个可增可减的控制面：

- `registry/machines.json` 是唯一人工维护入口。
- `scripts/fleetctl.py` 从注册表生成 Ansible inventory、SSH config、运维别名、监控目标和主机清单。
- `ansible/playbooks/` 负责真正落机：基础包、Tailscale、Netdata、Cockpit、Docker、Uptime Kuma、Portainer。
- `generated/` 是可删除的生成物，不要手工编辑。

## 快速开始

```bash
cd /Volumes/code/workspace/projects/axi-workbench/infra/fleet-console
python3 scripts/fleetctl.py validate
python3 scripts/fleetctl.py render --network bootstrap
python3 scripts/fleetctl.py doctor --network bootstrap
python3 -m pip install -r requirements.txt
cd ansible
ansible lifecycle_active -m ping
ansible-playbook playbooks/inspect.yml
```

`--network bootstrap` 使用公网 IP 或局域网 IP，适合首次接入。Tailscale 全部登录后，改用：

```bash
python3 scripts/fleetctl.py render --network tailscale
```

## 执行顺序

1. 先渲染 bootstrap inventory。
2. 用 `ansible all -m ping` 验证 SSH。
3. 执行 `playbooks/bootstrap.yml` 安装基础运维组件。
4. 完成 Tailscale 登录或提供 `fleet_tailscale_authkey` 后重新渲染 tailscale inventory。
5. 在 `tag_uptime_kuma` 主机执行 Uptime Kuma，在 `tag_portainer` 主机执行 Portainer。

```bash
ansible-playbook playbooks/bootstrap.yml
ansible-playbook playbooks/uptime-kuma.yml
ansible-playbook playbooks/portainer.yml
```

默认情况下 Uptime Kuma 和 Portainer 只绑定 `127.0.0.1`，通过 SSH tunnel 或 Tailscale/反代暴露。不要把 `3001`、`9443`、`9090`、`19999` 直接暴露到公网。

腾讯云 OpenCloudOS 9.4 上，Netdata 官方 el9 原生包可能缺 `libprotobuf.so.25` 依赖；`bootstrap.yml` 会记录提示并继续执行。确认 GitHub release 下载稳定后，可在变量里开启 `fleet_netdata_static_fallback: true` 改走静态安装。

## 常用命令

```bash
python3 scripts/fleetctl.py list --network bootstrap
python3 scripts/fleetctl.py doctor --network bootstrap
python3 scripts/fleetctl.py smoke --targets generated/monitor-targets.json --lifecycle active
python3 scripts/fleetctl.py uptime-kuma-sql | ssh -F generated/ssh_config fleet-homelab-ubuntu-vm 'docker exec -i uptime-kuma sqlite3 /app/data/kuma.db && docker restart uptime-kuma'
ssh -F generated/ssh_config fleet-homelab-ubuntu-vm
source generated/aliases.sh
fleet_ssh_homelab_ubuntu_vm
fleet_cockpit_tencent_2c2g 9090
```

## Axi Fleet Console

`dashboard/` 是本地资产管理台，基于 React Router + Ant Design 展示服务器注册表、服务入口、项目分组和凭证元数据。`/credentials` 会展示本地知识库导出的 `bw://` 引用和服务器绑定，不展示真实 secret 值。

```bash
cd /Volumes/code/workspace/projects/axi-workbench/infra/fleet-console
python3 scripts/fleetctl.py render --network bootstrap
cd dashboard
npm install
npm run dev -- --port 4173
```

打开 `http://127.0.0.1:4173/`，页面路由包括 `/dashboard`、`/devices`、`/services`、`/projects`、`/credentials`。

在 Axi Dashboard 宿主中打开时，Fleet 不需要固定端口。宿主注入
`AXI_APP_BASE=/apps/axi-fleet-console/` 和 `AXI_APP_PORT`，页面以
`/apps/axi-fleet-console/dashboard` 这类稳定路由访问；独立开发模式仍可继续使用
`npm run dev -- --port 4173`。

凭据来源由 `registry/machines.json` 的 `defaults.credential_vault_path` 指定，默认是 `/Users/mose/knowledge_base`，也可用 `LOCAL_CREDENTIALS_VAULT` 覆盖。重新运行 `python3 scripts/fleetctl.py render --network bootstrap` 会把知识库中的 `credential-ref` / `server` 页面脱敏导出到 `dashboard/public/fleet-data.json`。

如果只需要本地查看已构建看板，可以用静态服务：

```bash
cd /Volumes/code/workspace/projects/axi-workbench/infra/fleet-console/dashboard
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 -d dist
```

## 增减机器

新增机器只改 `registry/machines.json`：

- 复制一个机器对象。
- 改 `id / provider / role / ssh_user / public_ip / tailscale_name / tags / lifecycle`。
- 重新执行 `python3 scripts/fleetctl.py validate && python3 scripts/fleetctl.py render --network bootstrap`。

下线机器先把 `lifecycle` 改成 `maintenance`，确认没有业务依赖后再改成 `retired`。`retired` 机器不会出现在生成的 Ansible inventory 里，但仍保留历史记录。
