/**
 * DisplayApp 内联 SVG 图标
 */

export const IconPush = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);

export const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

export const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M11.5 11.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const IconExit = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <path d="M7 3H4a1 1 0 00-1 1v10a1 1 0 001 1h3M13 5l4 4-4 4M9 9h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-.33-1 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .33 1 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.3.47.65.6 1 .08.32.11.66.09 1 0 .34-.03.68-.09 1-.13.35-.34.7-.6 1z"/>
  </svg>
);

export const IconPrev = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const IconNext = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const IconClipboard = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="8" y="6" width="32" height="36" rx="4"/>
    <path d="M16 6V12a8 8 0 0116 0V6"/>
    <path d="M24 22v10M19 27h10" strokeLinecap="round"/>
  </svg>
);

export const IconPdf = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--axi-text-muted, #94a3b8)" strokeWidth="1.5">
    <rect x="6" y="2" width="22" height="30" rx="3"/>
    <path d="M6 8h22M12 14h10M12 20h8" strokeLinecap="round"/>
    <path d="M28 24l6 6v8a2 2 0 01-2 2H10a2 2 0 01-2-2V8a2 2 0 012-2h16" strokeLinecap="round"/>
  </svg>
);
