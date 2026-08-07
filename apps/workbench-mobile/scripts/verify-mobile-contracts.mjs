import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(appRoot, file), 'utf8');
const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) throw new Error(message);
};
const forbidMatch = (text, pattern, message) => {
  if (pattern.test(text)) throw new Error(message);
};

const app = read('src/App.tsx');
const shell = read('src/layouts/MobileShell.tsx');
const header = read('src/components/MobileHeader.tsx');
const tabBar = read('src/components/MobileTabBar.tsx');
const mobileIcons = read('src/components/MobileIcons.tsx');
const login = read('src/pages/LoginPage.tsx');
const navigation = read('src/lib/navigation.ts');
const packageJson = read('package.json');
const mobileStyles = read('src/styles/wechat-mobile.css');

requireMatch(app, /MobileShell/, 'mobile application must own an independent shell');
requireMatch(app, /WorkbenchLocaleProvider[\s\S]*BrowserRouter/, 'mobile application must mount shared locale before its own router');
requireMatch(app, /path="scan"/, 'mobile application must own the scan route');
requireMatch(shell, /MobileHeader[\s\S]*MobileTabBar/, 'mobile shell must own its header and tab bar composition');
requireMatch(header, /wb-mobile-topbar/, 'mobile header must keep the WeChat-style mobile top bar');
requireMatch(tabBar, /wb-bottom-nav/, 'mobile tab bar must keep the WeChat-style five-tab navigation');
requireMatch(navigation, /'workspace'[\s\S]*'scan'/, 'mobile navigation must own workspace and scan tabs');
requireMatch(packageJson, /"@axi\/workbench-foundation"/, 'mobile app must consume the shared foundation package');
requireMatch(mobileIcons, /AxiSvgIcon[\s\S]*resolveAxiWorkbenchIcon/, 'mobile icons must resolve to the shared Axi SVG registry');
requireMatch(login, /AxiLogoMark/, 'mobile login must use the shared four-color Axi mark');
requireMatch(header, /MobileIcon className="wb-mobile-topbar__plus" name="plus"/, 'mobile header must render the shared plus glyph inside its mobile-only circular affordance');
requireMatch(mobileStyles, /\.wb-mobile-topbar__plus svg[\s\S]*width:\s*10px/, 'mobile plus affordance must size the shared SVG inside its mobile-only circle');

forbidMatch(app, /from ['"]@axi\/shell['"]|<AxiDashboardShell/, 'mobile app must not import the Web admin dashboard shell');
forbidMatch(shell, /<AxiDashboardShell|<AxiBreadcrumb|<AxiTabBar/, 'mobile shell must not inherit Web admin chrome');
forbidMatch(header, /AxiMark|AxiBreadcrumb|AxiTabBar/, 'mobile header must not inherit Web branding or navigation chrome');
forbidMatch(`${app}\n${shell}\n${header}\n${tabBar}`, /(?:\.\.\/)+workbench\//, 'mobile app must not import implementation code from the Web app');
forbidMatch(`${mobileIcons}\n${header}\n${tabBar}`, /<svg|<path|<circle|<rect/, 'mobile must not maintain a parallel hand-drawn icon set');
forbidMatch(mobileStyles, /\.wb-mobile-topbar__plus::before|\.wb-mobile-topbar__plus::after/, 'mobile plus affordance must not redraw the shared glyph with CSS pseudo-elements');

console.log('Workbench Mobile UI contracts: PASS');
