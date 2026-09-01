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
requireMatch(layout, /AxiLogoMark/, 'Web brand must use the shared four-color Axi mark');
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
requireMatch(login, /axi-login-form--sms[\s\S]*OneTimeCodeInput/, 'Web login SMS flow must use the shared six-slot verification input');
requireMatch(login, /短信登录/, 'Web login must expose the SMS login surface');
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
