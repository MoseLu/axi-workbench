import { describe, expect, it } from 'vitest';
import { mobilePageTitleKey, resolveMobileNavKey } from './navigation';

describe('微信式移动应用导航', () => {
  it('保留独立的五项移动导航与旧工作区兼容路径', () => {
    expect(resolveMobileNavKey('/home')).toBe('home');
    expect(resolveMobileNavKey('/projects/atlas')).toBe('projects');
    expect(resolveMobileNavKey('/workspace')).toBe('workspace');
    expect(resolveMobileNavKey('/focus/today')).toBe('workspace');
    expect(resolveMobileNavKey('/scan')).toBe('scan');
    expect(resolveMobileNavKey('/me/preferences')).toBe('me');
  });

  it('为移动顶栏提供明确的页面标题', () => {
    expect(mobilePageTitleKey('/home')).toBe('page.home');
    expect(mobilePageTitleKey('/search')).toBe('page.search');
    expect(mobilePageTitleKey('/projects')).toBe('page.projects');
    expect(mobilePageTitleKey('/scan')).toBe('page.scan');
    expect(mobilePageTitleKey('/unknown')).toBe('page.home');
  });
});
