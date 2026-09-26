# Loading 团子资源

## Canonical resource directory

Loading 使用的 8 张 PNG 位于：

`apps/workbench/public/loading-dango/`

文件约定：

- `01-grandfather-blue.png`：蓝色爷爷
- `02-grandmother-pink.png`：粉色奶奶
- `03-father-yellow.png`：黄色爸爸
- `04-baby-center.png`：白色宝宝
- `05-mother-green.png`：绿色妈妈
- `06-young-cyan.png`：青色青年团子
- `07-young-purple.png`：紫色青年团子
- `08-dango-family.png`：完整七成员合集图，用作中心 logo

这 7 张独立角色图由 ImageGen 参考原始七成员合集图生成，均为透明背景 RGBA PNG。`SessionLoading` 的外圈使用 01、02、03、05、06、07，中心使用 08。

## 本机备份

2026-09-26 的工作区外备份位于：

`/Users/mose/Documents/Axi Workbench Backups/2026-09-26-loading-dango/`

备份目录包含上述 8 张文件，并已与 canonical resource directory 做字节一致性校验。若换机器或该路径不存在，应以项目内 canonical resource directory 为准，不要把本机备份路径当作构建依赖。
