# Blinko 云端三端同步

## 推荐拓扑

1. 本机用坚果云客户端同步 `blinko-notes/` Markdown 镜像目录。
2. 云服务器定时从坚果云 WebDAV 拉取镜像目录到 `/srv/sync/blinko-notes`。
3. 云服务器运行 `blinko-sync-cycle.mjs`，把镜像变更导入云端 Blinko，再把云端 Blinko 变更导出回镜像目录。
4. 云服务器再把更新后的镜像目录回推到坚果云，形成三端闭环。

这个方案的关键点是：

- 在线检索入口以云端 Blinko 为准，Hermes / Axi Docs 始终连云端。
- 本机可以关机，云服务器继续跑定时同步。
- 附件小于等于 100MB 走 OSS，大于 100MB 保持 local-only，不强行推到云端。
- 目前同步策略默认非破坏性 `copy`，不会因为某一端短时缺文件就级联删除。

## 目录与文件

- 云端 Blinko 服务：`http://127.0.0.1:1111`
- Axi Docs 应用目录：`/root/.hermes/apps/axi-docs/app`
- 云端镜像目录：`/srv/sync/blinko-notes`
- 同步脚本：`deploy/linux/blinko-nutstore-sync.sh`
- 定时器：`deploy/linux/blinko-mirror-sync.timer`
- WebDAV 配置文件：`/etc/blinko-sync.env`

## 环境变量

应用环境在 `.env.server`：

- `BLINKO_API_URL`
- `BLINKO_SYNC_DIR`
- `BLINKO_ATTACHMENT_MAX_BYTES`
- `BLINKO_OSS_UPLOAD_COMMAND`
  建议写成带引号的 shell 值，例如 `'node ./scripts/blinko-oss-upload-hook.mjs'`
- `BLINKO_OSS_BUCKET`
- `BLINKO_OSS_PREFIX`
- `BLINKO_OSS_PUBLIC_BASE_URL`
- `BLINKO_OSS_SIGNED_URL_EXPIRES_SECONDS`
  如果桶不是匿名可读，建议配置一个较长的签名时效，例如 `315360000`
- `AXI_ALIYUN_OSS_*`
  `BLINKO` 附件上传钩子会优先使用 `BLINKO_OSS_BUCKET`，其次是 `AXI_ALIYUN_OSS_PUBLIC_BUCKET`，最后才回退到 `AXI_ALIYUN_OSS_PRIVATE_BUCKET`

WebDAV 定时同步环境在 `/etc/blinko-sync.env`：

- `BLINKO_RCLONE_URL`
- `BLINKO_RCLONE_VENDOR`
- `BLINKO_RCLONE_USER`
- `BLINKO_RCLONE_PASSWORD`
- `BLINKO_RCLONE_REMOTE_PATH`

## 部署步骤

### 1. 安装 rclone

```bash
curl -fsSL https://rclone.org/install.sh | bash
```

### 2. 准备 WebDAV 配置

```bash
cp /root/.hermes/apps/axi-docs/app/deploy/linux/blinko-sync.env.example /etc/blinko-sync.env
vim /etc/blinko-sync.env
```

如果坚果云给的是 WebDAV 地址、用户名、应用密码，就填到这个文件里。

### 3. 安装并启用定时器

```bash
install -m 0644 /root/.hermes/apps/axi-docs/app/deploy/linux/blinko-mirror-sync.service /etc/systemd/system/blinko-mirror-sync.service
install -m 0644 /root/.hermes/apps/axi-docs/app/deploy/linux/blinko-mirror-sync.timer /etc/systemd/system/blinko-mirror-sync.timer
systemctl daemon-reload
systemctl enable --now blinko-mirror-sync.timer
```

### 4. 手动跑一次

```bash
/bin/bash /root/.hermes/apps/axi-docs/app/deploy/linux/blinko-nutstore-sync.sh
```

## 附件策略

- `<= 100MB`：导入镜像时触发 `BLINKO_OSS_UPLOAD_COMMAND`，把附件上传到 OSS，然后把 OSS URL 写回 Blinko 附件字段。
- `> 100MB`：仅保留在镜像目录 `_assets/<note-id>/`，同步脚本记录 warning，不上传云端。

默认 OSS 上传钩子是 `scripts/blinko-oss-upload-hook.mjs`，复用现有 Axi 环境变量：

- `AXI_ALIYUN_OSS_ACCESS_KEY_ID`
- `AXI_ALIYUN_OSS_ACCESS_KEY_SECRET`
- `AXI_ALIYUN_OSS_PUBLIC_BUCKET`
- `AXI_ALIYUN_OSS_PRIVATE_BUCKET`
- `AXI_ALIYUN_OSS_REGION`
- `AXI_ALIYUN_OSS_ENDPOINT`
- `AXI_ALIYUN_OSS_STS_TOKEN`

如果桶不是匿名可读，可以二选一：

- 配置 `BLINKO_OSS_PUBLIC_BASE_URL` 指向现有 CDN / 下载代理域名
- 配置 `BLINKO_OSS_SIGNED_URL_EXPIRES_SECONDS`，由上传钩子直接返回长时效签名 URL
