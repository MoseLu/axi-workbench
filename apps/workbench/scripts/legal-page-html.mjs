const faviconLinks = `
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`;

export function createLegalDocumentHtml({ kind, markup, assets }) {
  const title = kind === 'privacy' ? '公理工作台隐私政策' : '公理工作台服务条款';
  const cssLinks = assets.css.map((href) => `    <link rel="stylesheet" href="${href}" />`).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN" class="axi-legal-route">
  <head>
    <meta charset="UTF-8" />
${faviconLinks}
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f7f7f7" />
    <title>${title}</title>
${cssLinks}
  </head>
  <body class="axi-legal-route">
    <div id="root">${markup}</div>
  </body>
</html>`;
}
