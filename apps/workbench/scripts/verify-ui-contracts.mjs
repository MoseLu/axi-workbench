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
const app = read('apps/workbench/src/App.tsx');
const main = read('apps/workbench/src/main.tsx');
const webShellCss = read('apps/workbench/src/layouts/MainLayout.css');
const tokens = read('apps/workbench/src/styles/tokens.css');

requireMatch(breadcrumbs, /return \[\{ label: ['"]概览['"]/, 'dashboard breadcrumb must contain the current menu item');
forbidMatch(
  breadcrumbs,
  /(?:chain\.push|return)\(?(?:\{ label: )?['"]首页['"]/,
  'breadcrumb must not synthesize 首页 as a root item',
);
requireMatch(layout, /AxiDashboardShell/, 'desktop must use the shared Axi dashboard shell');
requireMatch(layout, /AxiAdminSettingsPanel/, 'desktop settings must use the shared settings panel');
forbidMatch(layout, /MobileTopBar|MobileBottomNav|useIsMobile|wb-mobile-shell/, 'Web layout must not contain a viewport-switched mobile shell');
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
