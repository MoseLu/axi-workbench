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
requireMatch(layout, /axiWorkbenchIconMap\.sun[\s\S]*axiWorkbenchIconMap\.moon/, 'Web theme action must use dedicated sun and moon glyphs');
requireMatch(breadcrumbs, /axiWorkbenchIconMap/, 'breadcrumbs must resolve through the shared Workbench icon semantics');
requireMatch(foundationIcons, /notification:/, 'shared semantic icon registry must include notifications');
requireMatch(foundationIcons, /moon:/, 'shared semantic icon registry must include the moon glyph');
requireMatch(foundationIcons, /sun:/, 'shared semantic icon registry must include the sun glyph');
requireMatch(foundationIcons, /logout:\s*'admin-logout'/, 'shared semantic icon registry must use the canonical logout glyph');
requireMatch(workbenchIcon, /resolveAxiWorkbenchIcon/, 'Web must render icon semantics through the shared SVG registry');
requireMatch(globalSearch, /axiWorkbenchIconMap\.search[\s\S]*axiWorkbenchIconMap\.forward/, 'global search controls must use shared Workbench icon semantics');
requireMatch(login, /AxiLogoMark/, 'Web login must use the shared four-color Axi mark');
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
requireMatch(
  main,
  /@axi\/tokens\/css[\s\S]*@axi\/core\/styles\.css[\s\S]*@axi\/shell\/styles\.css[\s\S]*@axi\/settings\/styles\.css/,
  'shared Axi CSS layers must load before the local bridge',
);
requireMatch(
  tokens,
  /:root[\s\S]*--palette-blue-antd:\s*#409eff[;\s\S]*--mpms-layout-bg:/,
  'local compatibility tokens must remain inside a valid root block',
);
forbidMatch(webShellCss, /wb-mobile-shell|wb-desktop-topbar|body\.wb-desktop-body|AppLayout/, 'Web shell CSS must not own a mobile shell or legacy desktop layout');

console.log('Workbench UI contracts: PASS');
