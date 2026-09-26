// workbench-mobile/scripts/check-favicon-sync.mjs
//
// Pre-commit style guard: mobile/public/favicon.svg 必须与
// apps/workbench/public/favicon.svg 字节级一致。任何差异（哪怕仅 1 个换行
// 或属性顺序）都直接 fail，避免 web / mobile / desktop 三端的浏览器
// tab 图标 / PWA / iOS home-screen icon 出现视觉漂移。
//
// 用法：
//   node scripts/check-favicon-sync.mjs
//   pnpm exec node scripts/check-favicon-sync.mjs
//
// 也可作为 pre-commit / CI gate：`process.exitCode = 1` 即失败。

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileFavicon = path.resolve(__dirname, '..', 'public', 'favicon.svg');
const webFavicon = path.resolve(
  __dirname,
  '..',
  '..',
  'workbench',
  'public',
  'favicon.svg',
);

if (!existsSync(mobileFavicon)) {
  console.error(`[favicon-sync] FAIL: missing mobile favicon at ${mobileFavicon}`);
  process.exitCode = 1;
} else if (!existsSync(webFavicon)) {
  console.error(`[favicon-sync] FAIL: missing web favicon at ${webFavicon}`);
  process.exitCode = 1;
} else {
  const mobileBytes = readFileSync(mobileFavicon);
  const webBytes = readFileSync(webFavicon);
  if (mobileBytes.equals(webBytes)) {
    const hash = createHash('sha256').update(mobileBytes).digest('hex').slice(0, 16);
    console.log(`[favicon-sync] OK: byte-identical (sha256:${hash})`);
  } else {
    console.error(
      `[favicon-sync] FAIL: mobile favicon drift detected.\n` +
        `  mobile: ${mobileFavicon} (${mobileBytes.length} bytes, sha256:${createHash('sha256').update(mobileBytes).digest('hex').slice(0, 16)})\n` +
        `  web:    ${webFavicon} (${webBytes.length} bytes, sha256:${createHash('sha256').update(webBytes).digest('hex').slice(0, 16)})\n` +
        `修复方法：cp apps/workbench/public/favicon.svg apps/workbench-mobile/public/favicon.svg`,
    );
    process.exitCode = 1;
  }
}