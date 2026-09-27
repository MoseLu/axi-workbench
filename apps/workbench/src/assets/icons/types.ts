/**
 * Icon Types - 图标类型定义
 */

// 图标分类
export type IconCategory = 
  | 'actions'
  | 'analytics'
  | 'commerce'
  | 'communication'
  | 'iot'
  | 'legacy'
  | 'location'
  | 'login'
  | 'media'
  | 'micro'
  | 'misc'
  | 'navigation'
  | 'people'
  | 'status'
  | 'system';

// 图标名称 (扁平格式: 分类-名称)
export type IconName =
  // actions
  | 'actions-batch-unbind' | 'actions-close-border' | 'actions-close' | 'actions-collapse-fullscreen'
  | 'actions-delete-alt' | 'actions-delete-batch' | 'actions-delete' | 'actions-download-alt'
  | 'actions-download' | 'actions-edit' | 'actions-expand-fullscreen' | 'actions-expand'
  | 'actions-export' | 'actions-eye' | 'actions-fold' | 'actions-import' | 'actions-modify-bind'
  | 'actions-pause' | 'actions-pin' | 'actions-play' | 'actions-plus-border' | 'actions-plus'
  | 'actions-print' | 'actions-pull' | 'actions-quick' | 'actions-recycle-bin' | 'actions-refresh'
  | 'actions-screen-full' | 'actions-screen-normal' | 'actions-search-alt' | 'actions-search'
  | 'actions-share' | 'actions-sort' | 'actions-stop' | 'actions-sync' | 'actions-unbind'
  | 'actions-upload-example' | 'actions-upload'
  // legacy
  | 'legacy-add' | 'legacy-edit' | 'legacy-delete' | 'legacy-search' | 'legacy-filter'
  | 'legacy-sort' | 'legacy-refresh' | 'legacy-sync' | 'legacy-download' | 'legacy-upload'
  | 'legacy-save' | 'legacy-close' | 'legacy-check' | 'legacy-help' | 'legacy-more'
  | 'legacy-setting' | 'legacy-lock' | 'legacy-unlock' | 'legacy-user' | 'legacy-users'
  | 'legacy-home' | 'legacy-menu' | 'legacy-star' | 'legacy-heart' | 'legacy-flag'
  | 'legacy-folder' | 'legacy-file' | 'legacy-image' | 'legacy-camera' | 'legacy-video'
  | 'legacy-music' | 'legacy-phone' | 'legacy-mail' | 'legacy-calendar' | 'legacy-clock'
  | 'legacy-shop' | 'legacy-cart' | 'legacy-wifi' | 'legacy-power' | 'legacy-error'
  | 'legacy-warning' | 'legacy-info' | 'legacy-success' | 'legacy-trend' | 'legacy-stats'
  | 'legacy-team' | 'legacy-work' | 'legacy-left' | 'legacy-right' | 'legacy-up'
  | 'legacy-down' | 'legacy-back' | 'legacy-forward' | 'legacy-play' | 'legacy-pause'
  | 'legacy-stop' | 'legacy-fullscreen' | 'legacy-expand' | 'legacy-compress'
  // status
  | 'status-success' | 'status-fail' | 'status-warn' | 'status-info' | 'status-info-alt'
  | 'status-notice' | 'status-question' | 'status-msg' | 'status-404'
  // system
  | 'system-settings' | 'system-set' | 'system-unlock' | 'system-lock' | 'system-auth'
  | 'system-dict' | 'system-ban' | 'system-exit' | 'system-lang' | 'system-theme'
  | 'system-light' | 'system-dark' | 'system-light-alt' | 'system-github'
  // navigation
  | 'navigation-home' | 'navigation-home-alt' | 'navigation-home-variant'
  | 'navigation-left' | 'navigation-right' | 'navigation-back' | 'navigation-forward'
  | 'navigation-arrow-left' | 'navigation-arrow-right' | 'navigation-menu'
  | 'navigation-hamburger' | 'navigation-tabbar-menu' | 'navigation-bg'
  // people
  | 'people-user' | 'people-team' | 'people-work' | 'people-workbench' | 'people-task'
  | 'people-my' | 'people-dept' | 'people-avatar'
  // media
  | 'media-image' | 'media-pic' | 'media-camera' | 'media-video' | 'media-file'
  | 'media-folder' | 'media-doc' | 'media-emoji'
  // location
  | 'location-map' | 'location-local' | 'location-discover'
  // micro
  | 'micro-quality' | 'micro-production' | 'micro-logistics' | 'micro-engineering'
  // misc
  | 'misc-design' | 'misc-component' | 'misc-common' | 'misc-tutorial'
  | 'misc-list' | 'misc-windmill' | 'misc-star'
  // login
  | 'login-bg' | 'login-bg-main';

// Icon 组件属性
export interface IconProps {
  /** 图标名称 */
  name: IconName;
  /** 图标尺寸 */
  size?: number;
  /** 图标颜色 */
  color?: string;
  /** 样式类名 */
  className?: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 是否居中显示 (适用于 flex 容器) */
  center?: boolean;
}
