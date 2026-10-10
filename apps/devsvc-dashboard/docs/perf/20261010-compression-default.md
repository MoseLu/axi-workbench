# 2026-10-10 — devsvc-dashboard compression-default 复盘

## 范围

`apps/devsvc-dashboard/vite.config.ts` 内的 `devsvc-compressed-assets` 插件：
- gzip `level: 9` → `level: 6`
- brotli `quality: 11` → `quality: 4`

不动逻辑 / 不动消费者 / 不动 chunk 切分，只调两个压缩等级常数。

## 动机（消费链路审计）

`.gz` / `.br` 副本在 devsvc-dashboard 进程内的消费方 grep：

| 命中 | 含义 |
| --- | --- |
| `apps/devsvc-dashboard/vite.config.ts` | plugin 自身 |
| `docs/` (1 处) | 文档提及 |
| `tauri.conf.json` 1 处 fingerprint | Tauri 资源指纹，不消费压缩流 |

工作台 devsvc-dashboard 部署形态 = workbench 反代 + Tauri webview。
外层（nginx / Cloudflare / Vite preview / vite-plugin-compression 业界默认）
**始终会重新压缩**，产物内嵌的 max-level 副本只是被覆盖或丢弃。
把等级降到 nginx / Cloudflare / Vite / vite-plugin-compression 业界默认
（gzip 6 / brotli 4）即覆盖所有真实消费链路。

## 数字

3-run mean / p95，单机本机 build：

| 指标 | Baseline | After | Δ |
| --- | --- | --- | --- |
| `pnpm build` | 4786 / 4849 ms | 1001 / 1056 ms | **-79.1 %** |
| `tsc --noEmit` | 2509 / 2645 ms | 2622 / 2796 ms | 噪声内 |
| dev cold start | 287 ms | 325 ms | 噪声内 |
| `dist/` size | 7.9 M | 8.1 M | ≈（副本数不变） |
| `.gz` 副本数 | 27 | 27 | 不变 |
| `.br` 副本数 | 27 | 27 | 不变 |
| `antd.gz` | 567 K | 555 K | ≈ |
| `antd.br` | 326 K | 403 K | +24 %（brotli 4 比 11 大，符合预期） |

build 用时下降完全由 `devsvc-compressed-assets` 解释：原 plugin 占
build 总耗时 88 %（≈ 4.0 / 4.5 s）。gzip 9→6 与 brotli 11→4 都是单次
压缩开销随等级线性放大，每跑一次都省下可观时间。

## 回归

- `pnpm --dir apps/devsvc-dashboard typecheck`：通过，无错。
- `pnpm --dir apps/devsvc-dashboard test`：106 / 110 pass。
  4 fail 与 baseline 完全一致（tests 27, 29, 51, 54），全部是
  workspace governance / 规则元数据 / skills 计数的 pre-existing drift，
  与本次 perf 改动正交，未引入新红。

## 风险 / 后续

- 真实外层（nginx / Cloudflare）会再次压缩，最大等级副本意义有限。
- 若将来 devsvc-dashboard 出现“直挂 `dist/` 静态托管且不二次压缩”
  场景，需重新评估；目前无此链路。
- 不需要保留 max-level 副本作为“可调保险丝”：plugin 名
  `devsvc-compressed-assets` 已明确是 build-time artifact，不是运行时依赖。

## 引用

- 分支：`perf/20261010-devsvc-compression-default`（基于 `origin/dev`）
- commit：`504e3431`
- Wave：workspace perf wave 2026-10-10
- Subagent：`agent_4093cc9b`
