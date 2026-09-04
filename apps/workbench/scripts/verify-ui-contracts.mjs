import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) throw new Error(message);
};
const forbidMatch = (text, pattern, message) => {
  if (pattern.test(text)) throw new Error(message);
};

const layout = read('apps/workbench/src/layouts/MainLayout.tsx');
const breadcrumbs = read('apps/workbench/src/lib/breadcrumbs.ts');
const navigation = read('apps/workbench/src/lib/navigationRegistry.ts');
const app = read('apps/workbench/src/App.tsx');
const main = read('apps/workbench/src/main.tsx');
const webShellCss = read('apps/workbench/src/layouts/MainLayout.css');
const tokens = read('apps/workbench/src/styles/tokens.css');
const loginCss = read('apps/workbench/src/pages/Login.css');
const webPackage = read('apps/workbench/package.json');
const foundationIcons = read('packages/workbench-foundation/src/icons.ts');
const workbenchIcon = read('apps/workbench/src/components/WorkbenchIcon.tsx');
const globalSearch = read('apps/workbench/src/components/Layout/GlobalSearchDialog.tsx');
const login = read('apps/workbench/src/pages/Login.tsx');
const favicon = read('apps/workbench/public/favicon.svg');

function readSourceTree(relativeDir) {
  const directory = path.join(root, relativeDir);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readSourceTree(path.join(relativeDir, entry.name));
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fs.readFileSync(fullPath, 'utf8')] : [];
  }).join('\n');
}

const webSource = readSourceTree('apps/workbench/src');

requireMatch(breadcrumbs, /return \[\{ label: ['"]工作台概览['"]/, 'dashboard breadcrumb must contain the current menu item');
forbidMatch(
  breadcrumbs,
  /(?:chain\.push|return)\(?(?:\{ label: )?['"]首页['"]/,
  'breadcrumb must not synthesize 首页 as a root item',
);
requireMatch(layout, /AxiDashboardShell/, 'desktop must use the shared Axi dashboard shell');
requireMatch(layout, /AxiAdminSettingsPanel/, 'desktop settings must use the shared settings panel');
requireMatch(layout, /AxiLogoMark/, 'Web brand must use the shared six-color Axi mark');
requireMatch(favicon, /viewBox="0 0 32 32"/, 'Web favicon must use the canonical 32px Axi mark viewBox');
for (const path of [
  /M16 0\.18 C13\.55 1\.35 11 3\.1 10\.65 5\.3 C10\.65 6\.7 11\.25 7\.75 11\.85 8\.8 L16 16 L20\.15 8\.8 C20\.75 7\.75 21\.35 6\.7 21\.35 5\.3 C21 3\.1 18\.45 1\.35 16 0\.18 Z/,
  /M16 2\.05 C14\.4 3 13\.1 4\.6 13 6\.3 C12\.9 8 14 10 15\.3 12\.4 C15\.55 12\.9 15\.8 13\.45 16 13\.95 C16\.2 13\.45 16\.45 12\.9 16\.7 12\.4 C18 10 19\.1 8 19 6\.3 C18\.9 4\.6 17\.6 3 16 2\.05 Z/,
  /stroke="#000000"/,
  /stroke-width="0\.28"/,
  /stroke-linecap="round"/,
  /stroke-linejoin="round"/,
  /transform="rotate\(60 16 16\)"/,
  /transform="rotate\(120 16 16\)"/,
  /transform="rotate\(180 16 16\)"/,
  /transform="rotate\(240 16 16\)"/,
  /transform="rotate\(300 16 16\)"/,
  /#0167FF/,
  /#FF0167/,
  /#E6FF01/,
  /#67FF01/,
  /#00E5FF/,
  /#9901FF/,
  /#D14DFF/,
  /#FF9A3D/,
  /#C8FF3D/,
  /#3DFFB0/,
  /#3D9BFF/,
  /#8E4DFF/,
  /#000000/,
  /data-center="pinwheel"/,
  /data-center-pair="0-180"/,
  /data-center-pair="60-240"/,
  /data-center-pair="120-300"/,
  /M14\.5 14\.7 A1\.5 1\.5 0 0 1 17\.5 14\.7 Z/,
  /M16 15\.05 L16\.82 15\.525 L16\.82 16\.475 L16 16\.95 L15\.18 16\.475 L15\.18 15\.525 Z/,
]) {
  requireMatch(favicon, path, 'Web favicon must keep the twelve-color pinwheel center-symmetric');
}
requireMatch(favicon, /data-center-pair="0-180">[\s\S]*fill="#8E4DFF"[\s\S]*fill="#3DFFB0"/, 'Web pinwheel pair 0-180 must use blue-red and green-cyan transitions');
requireMatch(favicon, /data-center-pair="60-240">[\s\S]*fill="#FF9A3D"[\s\S]*fill="#3D9BFF"/, 'Web pinwheel pair 60-240 must use red-yellow and cyan-violet transitions');
requireMatch(favicon, /data-center-pair="120-300">[\s\S]*fill="#C8FF3D"[\s\S]*fill="#D14DFF"/, 'Web pinwheel pair 120-300 must use yellow-green and violet-blue transitions');
forbidMatch(favicon, /<(?:rect|radialGradient)\b|axi-icon-bg/, 'Web favicon must remain transparent without an icon background');
forbidMatch(
  favicon,
  /fill="#FFFFFF" fill-opacity="0\.2"|stroke="#FFFFFF" stroke-opacity="0\.42"|stroke-opacity=/,
  'Web favicon petal double-layer edges must use clean black outlines without translucent duplicate strokes',
);
if ((favicon.match(/<path\b/g) ?? []).length !== 19) {
  throw new Error('Web favicon must contain twelve petal contour paths, six center semicircle paths, and one center join');
}
const fills = [...favicon.matchAll(/fill="(#[0-9A-F]{6})"/g)].map(([, color]) => color);
const outerFills = fills.slice(0, 6);
const centerFills = fills.slice(6, 12);
if (new Set([...outerFills, ...centerFills]).size !== 12 || centerFills.some((color) => outerFills.includes(color))) {
  throw new Error('Web favicon must keep six distinct center transition colors separate from the six petal colors');
}
forbidMatch(favicon, /transform="[^"]*translate/, 'Web favicon must not contain offset shadow or duplicate contour transforms');
forbidMatch(favicon, /<circle\b/, 'Web favicon center must use the interlocking semicircle structure instead of a white circle');
requireMatch(layout, /topbarPluginActions[\s\S]*axiWorkbenchIconMap\.preferences/, 'Web preferences action must use the shared settings surface');
requireMatch(breadcrumbs, /axiWorkbenchIconMap/, 'breadcrumbs must resolve through the shared Workbench icon semantics');
requireMatch(foundationIcons, /notification:/, 'shared semantic icon registry must include notifications');
requireMatch(foundationIcons, /moon:/, 'shared semantic icon registry must include the moon glyph');
requireMatch(foundationIcons, /sun:/, 'shared semantic icon registry must include the sun glyph');
requireMatch(foundationIcons, /logout:\s*'exit'/, 'shared semantic icon registry must use the canonical logout glyph');
requireMatch(workbenchIcon, /resolveAxiWorkbenchIcon/, 'Web must render icon semantics through the shared SVG registry');
requireMatch(globalSearch, /axiWorkbenchIconMap\.search[\s\S]*axiWorkbenchIconMap\.forward/, 'global search controls must use shared Workbench icon semantics');
requireMatch(login, /axi-login-card__chrome/, 'Web login must expose the client-style card chrome');
requireMatch(login, /axi-login-qr-expired-overlay/, 'Web login must own the QR expiry scrim and refresh action');
requireMatch(login, /axi-login-form--email[\s\S]*OneTimeCodeInput/, 'Web login email flow must use the shared six-slot verification input');
requireMatch(login, /axi-login-form__row--email[\s\S]*axi-login-text-button--send/, 'Web login email row must inline the send-code button on the right edge');
forbidMatch(login, /sms-verifications|login\/sms|短信登录|手机号/, 'Web login must keep the current email authentication surface');
forbidMatch(login, /axi-login-qr-status|axi-login-qr-meta|axi-login-card__footer/, 'Web login must not retain removed QR status or footer copy');
requireMatch(layout, /iconName: axiWorkbenchIconMap\.logout/, 'Web account menu must use the canonical logout icon semantic');
forbidMatch(layout, /MobileTopBar|MobileBottomNav|useIsMobile|wb-mobile-shell/, 'Web layout must not contain a viewport-switched mobile shell');
forbidMatch(layout, /logo-axi-core-color\.png|admin-sun|admin-night-mode/, 'Web chrome must not use a local logo or generic theme glyphs');
forbidMatch(breadcrumbs, /ICON_HINTS|icon: 'admin-/, 'breadcrumbs must store product semantic icon names instead of raw glyph aliases');
forbidMatch(webSource, /from ['"]@ant-design\/icons['"]/, 'Web source must not bypass the shared Axi icon registry');
forbidMatch(webPackage, /"@ant-design\/icons"/, 'Web package must not retain a direct Ant icon dependency');
forbidMatch(webSource, /MobileTopBar|MobileBottomNav|ScanIcon/, 'Web application must not retain a second mobile navigation shell');
forbidMatch(webSource, /BarcodeDetector|getUserMedia|通用识别/, 'Web must not provide a generic camera scanner without a governed business action');
requireMatch(navigation, /['"]\/admin\/operations['"]/, 'desktop navigation must expose a cross-project operations surface');
forbidMatch(navigation, /['"]\/admin\/scan['"]/, 'desktop navigation must not expose the retired generic scanner');
requireMatch(
  app,
  /path="admin\/scan"\s+element=\{<Navigate to="\/admin\/dashboard" replace\s*\/>\}/,
  'legacy scan URL must safely return to the desktop control center',
);
forbidMatch(login, /Axi 工作台/, 'Web login must keep the product wordmark in one language instead of mixing Chinese and English');
requireMatch(app, /AxiThemeProvider/, 'theme runtime must be mounted at the app boundary');
forbidMatch(layout, /PersonalOsLayout|personal-os-shell/, 'Personal OS must use the shared dashboard shell instead of a duplicate shell');
requireMatch(layout, /contentLayout=\{isPersonalOsRoute \? 'flush' : 'inset'\}/, 'Personal OS workspace must use the shared flush content layout');
requireMatch(
  main,
  /@axi\/tokens\/css[\s\S]*@axi\/core\/styles\.css[\s\S]*@axi\/shell\/styles\.css[\s\S]*@axi\/settings\/styles\.css/,
  'shared Axi CSS layers must load before the local bridge',
);
requireMatch(
  tokens,
  /:root[\s\S]*--palette-blue-antd:\s*#409eff[;\s\S]*--palette-layout-bg:\s*#f5f7fa[;\s\S]*--color-layout-bg:/,
  'local compatibility tokens must remain inside a valid root block',
);
requireMatch(
  loginCss,
  /\.axi-login-card\s*\{[\s\S]*?color-scheme:\s*light;/,
  'login card must scope native controls to the light color scheme',
);
requireMatch(loginCss, /\.axi-login-card__body\s*\{[\s\S]*?height:\s*22\.25rem;[\s\S]*?min-height:\s*22\.25rem;/, 'login body must preserve a fixed desktop height across login states');
requireMatch(loginCss, /\.axi-login-right\s*\{[\s\S]*?grid-template-rows:\s*2rem 16rem;/, 'login right rail must use a fixed desktop track');
requireMatch(loginCss, /\.axi-login-banner-slot\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?bottom:\s*0;/, 'login feedback must not reflow the desktop form track');
forbidMatch(loginCss, /axi-login-card-in/, 'login card must not animate its vertical position');
forbidMatch(loginCss, /\.axi-login-qr-expired-overlay__icon\s*\{[^}]*animation:/, 'expired QR feedback must remain static');
requireMatch(
  loginCss,
  /:autofill\s*\{[\s\S]*?box-shadow:/,
  'login inputs must define a standard autofill background override',
);
requireMatch(
  loginCss,
  /:-webkit-autofill[\s\S]*?-webkit-text-fill-color:/,
  'login inputs must preserve readable Chrome autofill text',
);
forbidMatch(webShellCss, /wb-mobile-shell|wb-desktop-topbar|body\.wb-desktop-body|AppLayout/, 'Web shell CSS must not own a mobile shell or legacy desktop layout');

console.log('Workbench UI contracts: PASS');
