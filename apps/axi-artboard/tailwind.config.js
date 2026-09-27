/**
 * tailwind.config.js — design-token bridge.
 *
 * Tailwind 3 reads JS configuration. We mirror the CSS variables from
 * src/styles/tokens.scss so the utility classes (`bg-ink-0`,
 * `text-pin`, `font-mono`, …) resolve at compile time.
 *
 * The 3-way alignment with src/styles/tokens.scss and the :root block
 * in src/index.scss is enforced by scripts/check-tokens.mjs.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          0: 'var(--color-ink-0)',
          1: 'var(--color-ink-1)',
          2: 'var(--color-ink-2)',
          3: 'var(--color-ink-3)',
        },
        rule: {
          1: 'var(--color-rule-1)',
          2: 'var(--color-rule-2)',
          3: 'var(--color-rule-3)',
        },
        bone: 'var(--color-bone)',
        'bone-soft': 'var(--color-bone-soft)',
        'ink-text': 'var(--color-ink-text)',
        'ink-mute': 'var(--color-ink-mute)',
        'ink-dim': 'var(--color-ink-dim)',
        pin: 'var(--color-pin)',
        'pin-soft': 'var(--color-pin-soft)',
        'pin-ghost': 'var(--color-pin-ghost)',
        coral: 'var(--color-coral)',
        amber: 'var(--color-amber)',
        steel: 'var(--color-steel)',
        'steel-soft': 'var(--color-steel-soft)',
      },
      fontFamily: {
        display: [
          '"Space Grotesk"',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
}
