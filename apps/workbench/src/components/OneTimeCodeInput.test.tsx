import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
