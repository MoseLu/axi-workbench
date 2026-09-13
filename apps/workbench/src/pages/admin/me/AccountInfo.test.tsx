import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    updateUsername: vi.fn(async () => true),
    user: {
      email: 'admin@example.test',
      id: 'admin',
      name: '管理员',
      status: 'active',
    },
  }),
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dictionary: Record<string, string> = {
        'account.avatar.label': '头像',
        'account.avatar.alt': '头像',
        'account.avatar.pick': '选择头像',
        'account.avatar.preview': '预览头像',
        'account.avatar.fileAriaLabel': '选择头像文件',
        'account.title': '基本信息',
        'account.username.label': '用户名',
        'account.username.placeholder': '请输入用户名',
        'account.username.invalid': '用户名格式不正确',
        'account.username.hint': '用于首页展示',
        'account.username.updateFailed': '保存失败',
        'account.email.label': '登录邮箱',
        'account.email.hint': '登录邮箱由身份服务绑定',
        'account.email.unbound': '未绑定',
        'account.submit': '保存修改',
      };
      return dictionary[key] ?? key;
    },
  }),
}));

import AccountInfo from './AccountInfo';

describe('AccountInfo', () => {
  it('renders its avatar as a dialog trigger instead of a static image', () => {
    const markup = renderToStaticMarkup(<AccountInfo />);

    expect(markup).toContain('wb-account-page__avatar-preview-trigger');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-label="预览头像"');
    expect(markup).toContain('title="预览头像"');
    expect(markup).toContain('wb-account-page__avatar-edit');
    expect(markup).toContain('aria-label="选择头像"');
  });
});
