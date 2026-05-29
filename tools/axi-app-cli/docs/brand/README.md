# Axi Brand Assets

## Source Of Truth

- Primary mark: `axi-trident-icon.svg`
- Visual concept: mono trident mark
- Current delivered source: single-color vector

## Integration Notes

- Generated web projects ship the exact mono SVG under `apps/web/public/brand/axi-trident-icon.svg`.
- Generated web projects also ship a runtime-tinted React component under `apps/web/src/shared/branding/AxiLogoMark.tsx`.
- The runtime component uses `currentColor` so the mark remains legible across light and dark themes while preserving the mono mark semantics.

## Follow-Up

- Provide a dedicated simplified 16px favicon variant when the favicon-specific asset is ready.
- Add platform export packs later if iOS, Android, PWA, or Windows icon bundles are needed.
