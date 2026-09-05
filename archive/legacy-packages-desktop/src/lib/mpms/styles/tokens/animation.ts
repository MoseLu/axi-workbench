/**
 * Animation Design Tokens
 * 动画设计令牌
 */

export interface AnimationTokens {
  // Durations
  durationFast: number;
  durationNormal: number;
  durationSlow: number;

  // Easing functions
  easeInOut: string;
  easeOut: string;
  easeIn: string;
  sharp: string;

  // Keyframes (as CSS strings)
  fadeIn: string;
  fadeOut: string;
  slideInUp: string;
  slideOutDown: string;
  scaleIn: string;
  scaleOut: string;
}

export const defaultAnimations: AnimationTokens = {
  // Durations (in milliseconds)
  durationFast: 100,
  durationNormal: 200,
  durationSlow: 300,

  // Easing functions
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Keyframes (CSS keyframe definitions)
  fadeIn: `
    from { opacity: 0; }
    to { opacity: 1; }
  `,
  fadeOut: `
    from { opacity: 1; }
    to { opacity: 0; }
  `,
  slideInUp: `
    from {
      transform: translateY(10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  `,
  slideOutDown: `
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(10px);
      opacity: 0;
    }
  `,
  scaleIn: `
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  `,
  scaleOut: `
    from {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(0.95);
      opacity: 0;
    }
  `,
};

/**
 * Generate CSS animation variables from animation tokens
 * 从动画令牌生成CSS动画变量
 */
export function generateAnimationCSSVariables(tokens: AnimationTokens): Record<string, string | number> {
  return {
    '--mpms-duration-fast': tokens.durationFast,
    '--mpms-duration-normal': tokens.durationNormal,
    '--mpms-duration-slow': tokens.durationSlow,

    '--mpms-ease-in-out': tokens.easeInOut,
    '--mpms-ease-out': tokens.easeOut,
    '--mpms-ease-in': tokens.easeIn,
    '--mpms-sharp': tokens.sharp,
  };
}

/**
 * Inject keyframe animations into document head
 * 将关键帧动画注入文档头部
 */
export function injectAnimationKeyframes(tokens: AnimationTokens): void {
  if (typeof document === 'undefined') return;

  const styleId = 'mpms-animation-keyframes';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes mpms-fade-in {
      ${tokens.fadeIn}
    }
    @keyframes mpms-fade-out {
      ${tokens.fadeOut}
    }
    @keyframes mpms-slide-in-up {
      ${tokens.slideInUp}
    }
    @keyframes mpms-slide-out-down {
      ${tokens.slideOutDown}
    }
    @keyframes mpms-scale-in {
      ${tokens.scaleIn}
    }
    @keyframes mpms-scale-out {
      ${tokens.scaleOut}
    }
  `;
  document.head.appendChild(style);
}
