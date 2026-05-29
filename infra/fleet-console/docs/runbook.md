# Fleet Runbook

## 新增机器

1. 在 `fleet/registry/machines.json` 增加机器记录，`lifecycle` 先设为 `staging`。
2. 填好 `bootstrap_host`、`ssh_user`，并选择 `ssh_key_path` 或 `credential_ref` / `credential_profile`；先不要依赖 Tailscale 名称。
3. 运行：

   ```bash
   cd fleet
   python3 scripts/fleetctl.py validate
   python3 scripts/fleetctl.py render --network bootstrap
   python3 scripts/fleetctl.py doctor --network bootstrap
   cd ansible
   ansible <machine-id> -m ping
   ansible-playbook playbooks/bootstrap.yml --limit <machine-id>
   ```

4. 完成 Tailscale 登录后补 `tailscale_name`，重新渲染 `--network tailscale`。
5. 机器稳定后把 `lifecycle` 改为 `active`。

## 下线机器

1. 把 `lifecycle` 改为 `maintenance`，重新渲染 inventory。
2. 从 Uptime Kuma 暂停对应监控，确认没有部署任务指向该机器。
3. 备份必要数据和 `/etc` 下的业务配置。
4. 在机器上执行 `tailscale logout`，停止业务服务。
5. 把 `lifecycle` 改为 `retired` 并重新渲染；保留 registry 记录作为资产历史。

## 密钥轮换

1. 在目标机新增新公钥，不删除旧公钥。
2. 如果私钥仍是本地文件，更新 `ssh_key_path` 指向新私钥；如果已进入凭据系统，更新 Bitwarden 条目并保持 `credential_ref` 不变。
3. `python3 scripts/fleetctl.py render --network bootstrap` 后执行 `python3 scripts/fleetctl.py doctor --network bootstrap`。
4. 新钥验证成功后再移除旧公钥。

## 监控接入

1. 每台 Linux 机通过 `bootstrap.yml` 安装 Netdata agent。
2. 一台 `tag_uptime_kuma` 主机运行 Uptime Kuma。
3. `generated/monitor-targets.json` 是 Uptime Kuma 录入目标的来源；新增业务 URL 时，把它加到对应机器的 `monitors` 数组。
4. 管理类端口只走 Tailscale、SSH tunnel 或内网反代，不直接放公网安全组。
5. 看板为空或注册表变化后，重新导入监控项：

   ```bash
   cd fleet
   python3 scripts/fleetctl.py render --network bootstrap
   python3 scripts/fleetctl.py uptime-kuma-sql | ssh -F generated/ssh_config fleet-homelab-ubuntu-vm 'docker exec -i uptime-kuma sqlite3 /app/data/kuma.db && docker restart uptime-kuma'
   ```

### OpenCloudOS 上的 Netdata

腾讯云 OpenCloudOS 9.4 的官方仓库目前缺少 Netdata el9 包需要的 `libprotobuf.so.25`，所以 `bootstrap.yml` 会把 RedHat-like Netdata native 安装作为软失败处理，并继续完成 Tailscale、Cockpit 和基础工具配置。

如果确认目标机能稳定下载 GitHub release，可以在 group vars 或 host vars 里打开：

```yaml
fleet_netdata_static_fallback: true
```

这会改走 Netdata `--static-only` 安装路径；没有确认下载稳定前，不建议默认开启。

## 故障回收

1. 先跑 `python3 scripts/fleetctl.py smoke --targets generated/monitor-targets.json` 判断是网络、端口还是 HTTP 问题。
2. 再跑 `ansible-playbook playbooks/inspect.yml --limit <machine-id>` 看 uptime、磁盘和关键服务。
3. 对 `ielts-vocab-prod`，业务恢复仍以项目自己的 cloud deploy/runbook 为准；fleet 只处理机器层巡检和通用服务。

## 本地控制面诊断

1. `python3 scripts/fleetctl.py doctor --network bootstrap` 检查注册表、密钥路径、生命周期和监控数量。
2. `python3 scripts/fleetctl.py smoke --targets generated/monitor-targets.json --lifecycle active` 只检查正式纳管机器，避免 `staging` 机器影响日常巡检。
3. `source fleet/generated/aliases.sh` 后可用 `fleet_ssh_<machine>`、`fleet_cockpit_<machine>`、`fleet_netdata_<machine>` 快速 SSH 或开本地隧道。
