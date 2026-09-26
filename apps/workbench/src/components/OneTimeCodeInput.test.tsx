import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => {
      const dict: Record<string, string> = {
        'auth.otp.ariaLabel': '六位数字验证码',
        'auth.otp.slotPrefix': '验证码第 ',
        'auth.otp.slotSuffix': ' 位',
      };
      return dict[key] ?? fallback ?? key;
    },
  }),
}));

import { OneTimeCodeInput } from './OneTimeCodeInput';

describe('OneTimeCodeInput', () => {
  it('renders six independently labeled digit inputs', () => {
    const markup = renderToStaticMarkup(
      <OneTimeCodeInput onChange={() => undefined} value={['1', '2', '', '', '', '']} />,
    );

    expect((markup.match(/<input/g) ?? [])).toHaveLength(6);
    expect(markup).toContain('aria-label="验证码第 1 位"');
    expect(markup).toContain('aria-label="验证码第 6 位"');
  });
});
