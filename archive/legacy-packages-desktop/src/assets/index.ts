/**
 * Icon System - 图标使用指南
 * 
 * 使用方式:
 * 
 * 1. 直接使用 (推荐):
 *    import Icon from '@/components/Icon';
 *    <Icon name="legacy-edit" size={20} />
 * 
 * 2. 直接引用路径:
 *    import { iconPaths } from '@/assets/icons';
 *    <img src={iconPaths['legacy-edit']} />
 * 
 * 3. 动态导入:
 *    import { getIconPath } from '@/assets/icons';
 *    <img src={getIconPath('legacy-edit')} />
 */

import type { IconName, IconCategory } from './types';

// 图标分类
export const iconCategories: Record<IconCategory, { label: string; description: string }> = {
  actions: { label: '操作', description: '常用操作按钮图标' },
  analytics: { label: '分析', description: '数据分析和统计相关' },
  commerce: { label: '商业', description: '电商和商业相关' },
  communication: { label: '通讯', description: '消息和通讯相关' },
  iot: { label: 'IoT', description: '物联网设备相关' },
  legacy: { label: '传统', description: '兼容旧版本的图标' },
  location: { label: '位置', description: '地图和位置相关' },
  login: { label: '登录', description: '登录页面专用' },
  media: { label: '媒体', description: '文件和媒体相关' },
  micro: { label: '微服务', description: '微服务模块图标' },
  misc: { label: '杂项', description: '其他未分类图标' },
  navigation: { label: '导航', description: '导航和方向相关' },
  people: { label: '人物', description: '用户和团队相关' },
  status: { label: '状态', description: '状态提示和反馈' },
  system: { label: '系统', description: '系统功能相关' },
};

// 基础路径
const BASE_PATH = '/src/assets/icons';

/**
 * 获取图标路径
 * @param name 图标名称 (不含文件扩展名)
 * @returns 图标的完整路径
 */
export function getIconPath(name: string): string {
  // 根据图标名称推断分类
  const parts = name.split('-');
  const category = parts[0];
  
  // 构建路径
  const iconName = parts.slice(1).join('-');
  return `${BASE_PATH}/${category}/${iconName}.svg`;
}

/**
 * 图标路径映射 (按分类组织)
 * 使用时: import { iconPaths } from '@/assets/icons';
 *        <img src={iconPaths.legacy.edit} />
 */
export const iconPaths = {
  // 传统图标 (兼容旧版本)
  legacy: {
    add: `${BASE_PATH}/legacy/add.svg`,
    edit: `${BASE_PATH}/legacy/edit.svg`,
    delete: `${BASE_PATH}/legacy/delete.svg`,
    search: `${BASE_PATH}/legacy/search.svg`,
    filter: `${BASE_PATH}/legacy/filter.svg`,
    sort: `${BASE_PATH}/legacy/sort.svg`,
    refresh: `${BASE_PATH}/legacy/refresh.svg`,
    sync: `${BASE_PATH}/legacy/sync.svg`,
    download: `${BASE_PATH}/legacy/download.svg`,
    upload: `${BASE_PATH}/legacy/upload.svg`,
    save: `${BASE_PATH}/legacy/save.svg`,
    close: `${BASE_PATH}/legacy/close.svg`,
    check: `${BASE_PATH}/legacy/check.svg`,
    help: `${BASE_PATH}/legacy/help.svg`,
    more: `${BASE_PATH}/legacy/more.svg`,
    setting: `${BASE_PATH}/legacy/setting.svg`,
    lock: `${BASE_PATH}/legacy/lock.svg`,
    unlock: `${BASE_PATH}/legacy/unlock.svg`,
    user: `${BASE_PATH}/legacy/user.svg`,
    users: `${BASE_PATH}/legacy/users.svg`,
    home: `${BASE_PATH}/legacy/home.svg`,
    menu: `${BASE_PATH}/legacy/menu.svg`,
    star: `${BASE_PATH}/legacy/star.svg`,
    heart: `${BASE_PATH}/legacy/heart.svg`,
    flag: `${BASE_PATH}/legacy/flag.svg`,
    folder: `${BASE_PATH}/legacy/folder.svg`,
    file: `${BASE_PATH}/legacy/file.svg`,
    image: `${BASE_PATH}/legacy/image.svg`,
    camera: `${BASE_PATH}/legacy/camera.svg`,
    video: `${BASE_PATH}/legacy/video.svg`,
    music: `${BASE_PATH}/legacy/music.svg`,
    phone: `${BASE_PATH}/legacy/phone.svg`,
    mail: `${BASE_PATH}/legacy/mail.svg`,
    calendar: `${BASE_PATH}/legacy/calendar.svg`,
    clock: `${BASE_PATH}/legacy/clock.svg`,
    shop: `${BASE_PATH}/legacy/shop.svg`,
    cart: `${BASE_PATH}/legacy/shopping-cart.svg`,
    wifi: `${BASE_PATH}/legacy/wifi.svg`,
    power: `${BASE_PATH}/legacy/power.svg`,
    error: `${BASE_PATH}/legacy/error.svg`,
    warning: `${BASE_PATH}/legacy/warning.svg`,
    info: `${BASE_PATH}/legacy/info.svg`,
    success: `${BASE_PATH}/legacy/success.svg`,
    trend: `${BASE_PATH}/legacy/trend.svg`,
    stats: `${BASE_PATH}/legacy/stats.svg`,
    team: `${BASE_PATH}/legacy/team.svg`,
    work: `${BASE_PATH}/legacy/work.svg`,
    // 特殊图标
    iconWorkbench: `${BASE_PATH}/legacy/icon-workbench.svg`,
    iconWork: `${BASE_PATH}/legacy/icon-work.svg`,
    iconWarn: `${BASE_PATH}/legacy/icon-warn.svg`,
    iconVip: `${BASE_PATH}/legacy/icon-vip.svg`,
    iconVideo: `${BASE_PATH}/legacy/icon-video.svg`,
    iconUser: `${BASE_PATH}/legacy/icon-user.svg`,
    iconUnlock: `${BASE_PATH}/legacy/icon-unlock.svg`,
    iconTutorial: `${BASE_PATH}/legacy/icon-tutorial.svg`,
    iconTime: `${BASE_PATH}/legacy/icon-time.svg`,
    iconTask: `${BASE_PATH}/legacy/icon-task.svg`,
    iconTag: `${BASE_PATH}/legacy/icon-tag.svg`,
    iconSet: `${BASE_PATH}/legacy/icon-set.svg`,
    iconSearch: `${BASE_PATH}/legacy/icon-search.svg`,
    iconReward: `${BASE_PATH}/legacy/icon-reward.svg`,
    iconRank: `${BASE_PATH}/legacy/icon-rank.svg`,
    iconStar: `${BASE_PATH}/legacy/icon-star.svg`,
    iconShare: `${BASE_PATH}/legacy/icon-share.svg`,
    iconSetting: `${BASE_PATH}/legacy/icon-setting.svg`,
    iconSecurity: `${BASE_PATH}/legacy/icon-security.svg`,
    iconSave: `${BASE_PATH}/legacy/icon-save.svg`,
    iconRight: `${BASE_PATH}/legacy/icon-right.svg`,
    iconRefresh: `${BASE_PATH}/legacy/icon-refresh.svg`,
    iconQuestion: `${BASE_PATH}/legacy/icon-question.svg`,
    iconPlus: `${BASE_PATH}/legacy/icon-plus.svg`,
    iconPhone: `${BASE_PATH}/legacy/icon-phone.svg`,
    iconNotice: `${BASE_PATH}/legacy/icon-notice.svg`,
    iconMore: `${BASE_PATH}/legacy/icon-more.svg`,
    iconMinus: `${BASE_PATH}/legacy/icon-minus.svg`,
    iconMessage: `${BASE_PATH}/legacy/icon-message.svg`,
    iconMenu: `${BASE_PATH}/legacy/icon-menu.svg`,
    iconLocation: `${BASE_PATH}/legacy/icon-location.svg`,
    iconLike: `${BASE_PATH}/legacy/icon-like.svg`,
    iconLeft: `${BASE_PATH}/legacy/icon-left.svg`,
    iconKey: `${BASE_PATH}/legacy/icon-key.svg`,
    iconInfo: `${BASE_PATH}/legacy/icon-info.svg`,
    iconImport: `${BASE_PATH}/legacy/icon-import.svg`,
    iconImage: `${BASE_PATH}/legacy/icon-image.svg`,
    iconHome: `${BASE_PATH}/legacy/icon-home.svg`,
    iconHelp: `${BASE_PATH}/legacy/icon-help.svg`,
    iconHeart: `${BASE_PATH}/legacy/icon-heart.svg`,
    iconFolder: `${BASE_PATH}/legacy/icon-folder.svg`,
    iconFilter: `${BASE_PATH}/legacy/icon-filter.svg`,
    iconFile: `${BASE_PATH}/legacy/icon-file.svg`,
    iconExport: `${BASE_PATH}/legacy/icon-export.svg`,
    iconError: `${BASE_PATH}/legacy/icon-error.svg`,
    iconEmail: `${BASE_PATH}/legacy/icon-email.svg`,
    iconDownload: `${BASE_PATH}/legacy/icon-download.svg`,
    iconDislike: `${BASE_PATH}/legacy/icon-dislike.svg`,
    iconDelete: `${BASE_PATH}/legacy/icon-delete.svg`,
    iconDate: `${BASE_PATH}/legacy/icon-date.svg`,
    iconCustom: `${BASE_PATH}/legacy/icon-custom.svg`,
    iconCredit: `${BASE_PATH}/legacy/icon-credit.svg`,
    iconConfig: `${BASE_PATH}/legacy/icon-config.svg`,
    iconCompany: `${BASE_PATH}/legacy/icon-company.svg`,
    iconCommon: `${BASE_PATH}/legacy/icon-common.svg`,
    iconClose: `${BASE_PATH}/legacy/icon-close.svg`,
    iconCloud: `${BASE_PATH}/legacy/icon-cloud.svg`,
    iconClock: `${BASE_PATH}/legacy/icon-clock.svg`,
    iconChart: `${BASE_PATH}/legacy/icon-chart.svg`,
    iconCart: `${BASE_PATH}/legacy/icon-cart.svg`,
    iconCamera: `${BASE_PATH}/legacy/icon-camera.svg`,
    iconBranch: `${BASE_PATH}/legacy/icon-branch.svg`,
    iconBook: `${BASE_PATH}/legacy/icon-book.svg`,
    iconBlock: `${BASE_PATH}/legacy/icon-block.svg`,
    iconBell: `${BASE_PATH}/legacy/icon-bell.svg`,
    iconBack: `${BASE_PATH}/legacy/icon-back.svg`,
    iconAuth: `${BASE_PATH}/legacy/icon-auth.svg`,
    iconArrow: `${BASE_PATH}/legacy/icon-arrow.svg`,
    iconDict: `${BASE_PATH}/legacy/icon-dict.svg`,
    screenNormal: `${BASE_PATH}/legacy/screen-normal.svg`,
    screenFull: `${BASE_PATH}/legacy/screen-full.svg`,
    statsLegacy: `${BASE_PATH}/legacy/stats.svg`,
    // 方向
    left: `${BASE_PATH}/legacy/left.svg`,
    right: `${BASE_PATH}/legacy/right.svg`,
    up: `${BASE_PATH}/legacy/up.svg`,
    down: `${BASE_PATH}/legacy/down.svg`,
    back: `${BASE_PATH}/legacy/back.svg`,
    forward: `${BASE_PATH}/legacy/forward.svg`,
    // 播放控制
    play: `${BASE_PATH}/legacy/play.svg`,
    pause: `${BASE_PATH}/legacy/pause.svg`,
    stop: `${BASE_PATH}/legacy/stop.svg`,
    // 全屏
    fullscreen: `${BASE_PATH}/legacy/fullscreen.svg`,
    expand: `${BASE_PATH}/legacy/expand.svg`,
    compress: `${BASE_PATH}/legacy/compress.svg`,
  },

  // 状态图标
  status: {
    success: `${BASE_PATH}/status/success.svg`,
    fail: `${BASE_PATH}/status/fail.svg`,
    warn: `${BASE_PATH}/status/warn.svg`,
    info: `${BASE_PATH}/status/info.svg`,
    infoAlt: `${BASE_PATH}/status/info-alt.svg`,
    notice: `${BASE_PATH}/status/notice.svg`,
    question: `${BASE_PATH}/status/question.svg`,
    msg: `${BASE_PATH}/status/msg.svg`,
    error404: `${BASE_PATH}/status/404.svg`,
  },

  // 系统图标
  system: {
    settings: `${BASE_PATH}/system/settings.svg`,
    set: `${BASE_PATH}/system/set.svg`,
    unlock: `${BASE_PATH}/system/unlock.svg`,
    lock: `${BASE_PATH}/system/lock.svg`,
    auth: `${BASE_PATH}/system/auth.svg`,
    dict: `${BASE_PATH}/system/dict.svg`,
    ban: `${BASE_PATH}/system/ban.svg`,
    exit: `${BASE_PATH}/system/exit.svg`,
    lang: `${BASE_PATH}/system/lang.svg`,
    theme: `${BASE_PATH}/system/theme.svg`,
    light: `${BASE_PATH}/system/light.svg`,
    dark: `${BASE_PATH}/system/dark.svg`,
    lightAlt: `${BASE_PATH}/system/light-alt.svg`,
    github: `${BASE_PATH}/system/github.svg`,
  },

  // 导航图标
  navigation: {
    home: `${BASE_PATH}/navigation/home.svg`,
    homeAlt: `${BASE_PATH}/navigation/home-alt.svg`,
    homeVariant: `${BASE_PATH}/navigation/home-variant.svg`,
    left: `${BASE_PATH}/navigation/left.svg`,
    right: `${BASE_PATH}/navigation/right.svg`,
    back: `${BASE_PATH}/navigation/back.svg`,
    forward: `${BASE_PATH}/navigation/forward.svg`,
    arrowLeft: `${BASE_PATH}/navigation/arrow-left.svg`,
    arrowRight: `${BASE_PATH}/navigation/arrow-right.svg`,
    menu: `${BASE_PATH}/navigation/menu.svg`,
    hamburger: `${BASE_PATH}/navigation/hamburger.svg`,
    tabbarMenu: `${BASE_PATH}/navigation/tabbar-menu.svg`,
    bg: `${BASE_PATH}/navigation/bg.svg`,
  },

  // 人物图标
  people: {
    user: `${BASE_PATH}/people/user.svg`,
    team: `${BASE_PATH}/people/team.svg`,
    work: `${BASE_PATH}/people/work.svg`,
    workbench: `${BASE_PATH}/people/workbench.svg`,
    task: `${BASE_PATH}/people/task.svg`,
    my: `${BASE_PATH}/people/my.svg`,
    dept: `${BASE_PATH}/people/dept.svg`,
    avatar: `${BASE_PATH}/people/avatar.svg`,
  },

  // 媒体图标
  media: {
    image: `${BASE_PATH}/media/image.svg`,
    pic: `${BASE_PATH}/media/pic.svg`,
    camera: `${BASE_PATH}/media/camera.svg`,
    video: `${BASE_PATH}/media/video.svg`,
    file: `${BASE_PATH}/media/file.svg`,
    folder: `${BASE_PATH}/media/folder.svg`,
    doc: `${BASE_PATH}/media/doc.svg`,
    emoji: `${BASE_PATH}/media/emoji.svg`,
  },

  // 位置图标
  location: {
    map: `${BASE_PATH}/location/map.svg`,
    local: `${BASE_PATH}/location/local.svg`,
    discover: `${BASE_PATH}/location/discover.svg`,
  },

  // 微服务图标
  micro: {
    quality: `${BASE_PATH}/micro/quality.svg`,
    production: `${BASE_PATH}/micro/production.svg`,
    logistics: `${BASE_PATH}/micro/logistics.svg`,
    engineering: `${BASE_PATH}/micro/engineering.svg`,
  },

  // 杂项图标
  misc: {
    design: `${BASE_PATH}/misc/design.svg`,
    component: `${BASE_PATH}/misc/component.svg`,
    common: `${BASE_PATH}/misc/common.svg`,
    tutorial: `${BASE_PATH}/misc/tutorial.svg`,
    list: `${BASE_PATH}/misc/list.svg`,
    windmill: `${BASE_PATH}/misc/windmill.svg`,
    star: `${BASE_PATH}/misc/star.svg`,
  },

  // 登录图标
  login: {
    bg: `${BASE_PATH}/login/bg.svg`,
    bgMain: `${BASE_PATH}/login/bg-main.svg`,
  },
};

// 扁平化路径映射 (便于快速查找)
export const iconPathMap: Record<IconName, string> = {
  // actions
  'actions-batch-unbind': `${BASE_PATH}/actions/batch-unbind.svg`,
  'actions-close-border': `${BASE_PATH}/actions/close-border.svg`,
  'actions-close': `${BASE_PATH}/actions/close.svg`,
  'actions-collapse-fullscreen': `${BASE_PATH}/actions/collapse-fullscreen.svg`,
  'actions-delete-alt': `${BASE_PATH}/actions/delete-alt.svg`,
  'actions-delete-batch': `${BASE_PATH}/actions/delete-batch.svg`,
  'actions-delete': `${BASE_PATH}/actions/delete.svg`,
  'actions-download-alt': `${BASE_PATH}/actions/download-alt.svg`,
  'actions-download': `${BASE_PATH}/actions/download.svg`,
  'actions-edit': `${BASE_PATH}/actions/edit.svg`,
  'actions-expand-fullscreen': `${BASE_PATH}/actions/expand-fullscreen.svg`,
  'actions-expand': `${BASE_PATH}/actions/expand.svg`,
  'actions-export': `${BASE_PATH}/actions/export.svg`,
  'actions-eye': `${BASE_PATH}/actions/eye.svg`,
  'actions-fold': `${BASE_PATH}/actions/fold.svg`,
  'actions-import': `${BASE_PATH}/actions/import.svg`,
  'actions-modify-bind': `${BASE_PATH}/actions/modify-bind.svg`,
  'actions-pause': `${BASE_PATH}/actions/pause.svg`,
  'actions-pin': `${BASE_PATH}/actions/pin.svg`,
  'actions-play': `${BASE_PATH}/actions/play.svg`,
  'actions-plus-border': `${BASE_PATH}/actions/plus-border.svg`,
  'actions-plus': `${BASE_PATH}/actions/plus.svg`,
  'actions-print': `${BASE_PATH}/actions/print.svg`,
  'actions-pull': `${BASE_PATH}/actions/pull.svg`,
  'actions-quick': `${BASE_PATH}/actions/quick.svg`,
  'actions-recycle-bin': `${BASE_PATH}/actions/recycle-bin.svg`,
  'actions-refresh': `${BASE_PATH}/actions/refresh.svg`,
  'actions-screen-full': `${BASE_PATH}/actions/screen-full.svg`,
  'actions-screen-normal': `${BASE_PATH}/actions/screen-normal.svg`,
  'actions-search-alt': `${BASE_PATH}/actions/search-alt.svg`,
  'actions-search': `${BASE_PATH}/actions/search.svg`,
  'actions-share': `${BASE_PATH}/actions/share.svg`,
  'actions-sort': `${BASE_PATH}/actions/sort.svg`,
  'actions-stop': `${BASE_PATH}/actions/stop.svg`,
  'actions-sync': `${BASE_PATH}/actions/sync.svg`,
  'actions-unbind': `${BASE_PATH}/actions/unbind.svg`,
  'actions-upload-example': `${BASE_PATH}/actions/upload-example.svg`,
  'actions-upload': `${BASE_PATH}/actions/upload.svg`,
  // legacy
  'legacy-add': iconPaths.legacy.add,
  'legacy-edit': iconPaths.legacy.edit,
  'legacy-delete': iconPaths.legacy.delete,
  'legacy-search': iconPaths.legacy.search,
  'legacy-filter': iconPaths.legacy.filter,
  'legacy-sort': iconPaths.legacy.sort,
  'legacy-refresh': iconPaths.legacy.refresh,
  'legacy-sync': iconPaths.legacy.sync,
  'legacy-download': iconPaths.legacy.download,
  'legacy-upload': iconPaths.legacy.upload,
  'legacy-save': iconPaths.legacy.save,
  'legacy-close': iconPaths.legacy.close,
  'legacy-check': iconPaths.legacy.check,
  'legacy-help': iconPaths.legacy.help,
  'legacy-more': iconPaths.legacy.more,
  'legacy-setting': iconPaths.legacy.setting,
  'legacy-lock': iconPaths.legacy.lock,
  'legacy-unlock': iconPaths.legacy.unlock,
  'legacy-user': iconPaths.legacy.user,
  'legacy-users': iconPaths.legacy.users,
  'legacy-home': iconPaths.legacy.home,
  'legacy-menu': iconPaths.legacy.menu,
  'legacy-star': iconPaths.legacy.star,
  'legacy-heart': iconPaths.legacy.heart,
  'legacy-flag': iconPaths.legacy.flag,
  'legacy-folder': iconPaths.legacy.folder,
  'legacy-file': iconPaths.legacy.file,
  'legacy-image': iconPaths.legacy.image,
  'legacy-camera': iconPaths.legacy.camera,
  'legacy-video': iconPaths.legacy.video,
  'legacy-music': iconPaths.legacy.music,
  'legacy-phone': iconPaths.legacy.phone,
  'legacy-mail': iconPaths.legacy.mail,
  'legacy-calendar': iconPaths.legacy.calendar,
  'legacy-clock': iconPaths.legacy.clock,
  'legacy-shop': iconPaths.legacy.shop,
  'legacy-cart': iconPaths.legacy.cart,
  'legacy-wifi': iconPaths.legacy.wifi,
  'legacy-power': iconPaths.legacy.power,
  'legacy-error': iconPaths.legacy.error,
  'legacy-warning': iconPaths.legacy.warning,
  'legacy-info': iconPaths.legacy.info,
  'legacy-success': iconPaths.legacy.success,
  'legacy-trend': iconPaths.legacy.trend,
  'legacy-stats': iconPaths.legacy.statsLegacy,
  'legacy-team': iconPaths.legacy.team,
  'legacy-work': iconPaths.legacy.work,
  'legacy-left': iconPaths.legacy.left,
  'legacy-right': iconPaths.legacy.right,
  'legacy-up': iconPaths.legacy.up,
  'legacy-down': iconPaths.legacy.down,
  'legacy-back': iconPaths.legacy.back,
  'legacy-forward': iconPaths.legacy.forward,
  'legacy-play': iconPaths.legacy.play,
  'legacy-pause': iconPaths.legacy.pause,
  'legacy-stop': iconPaths.legacy.stop,
  'legacy-fullscreen': iconPaths.legacy.fullscreen,
  'legacy-expand': iconPaths.legacy.expand,
  'legacy-compress': iconPaths.legacy.compress,
  
  // status
  'status-success': iconPaths.status.success,
  'status-fail': iconPaths.status.fail,
  'status-warn': iconPaths.status.warn,
  'status-info': iconPaths.status.info,
  'status-info-alt': iconPaths.status.infoAlt,
  'status-notice': iconPaths.status.notice,
  'status-question': iconPaths.status.question,
  'status-msg': iconPaths.status.msg,
  'status-404': iconPaths.status.error404,

  // system
  'system-settings': iconPaths.system.settings,
  'system-set': iconPaths.system.set,
  'system-unlock': iconPaths.system.unlock,
  'system-lock': iconPaths.system.lock,
  'system-auth': iconPaths.system.auth,
  'system-dict': iconPaths.system.dict,
  'system-ban': iconPaths.system.ban,
  'system-exit': iconPaths.system.exit,
  'system-lang': iconPaths.system.lang,
  'system-theme': iconPaths.system.theme,
  'system-light': iconPaths.system.light,
  'system-dark': iconPaths.system.dark,
  'system-light-alt': iconPaths.system.lightAlt,
  'system-github': iconPaths.system.github,

  // navigation
  'navigation-home': iconPaths.navigation.home,
  'navigation-home-alt': iconPaths.navigation.homeAlt,
  'navigation-home-variant': iconPaths.navigation.homeVariant,
  'navigation-left': iconPaths.navigation.left,
  'navigation-right': iconPaths.navigation.right,
  'navigation-back': iconPaths.navigation.back,
  'navigation-forward': iconPaths.navigation.forward,
  'navigation-arrow-left': iconPaths.navigation.arrowLeft,
  'navigation-arrow-right': iconPaths.navigation.arrowRight,
  'navigation-menu': iconPaths.navigation.menu,
  'navigation-hamburger': iconPaths.navigation.hamburger,
  'navigation-tabbar-menu': iconPaths.navigation.tabbarMenu,
  'navigation-bg': iconPaths.navigation.bg,

  // people
  'people-user': iconPaths.people.user,
  'people-team': iconPaths.people.team,
  'people-work': iconPaths.people.work,
  'people-workbench': iconPaths.people.workbench,
  'people-task': iconPaths.people.task,
  'people-my': iconPaths.people.my,
  'people-dept': iconPaths.people.dept,
  'people-avatar': iconPaths.people.avatar,

  // media
  'media-image': iconPaths.media.image,
  'media-pic': iconPaths.media.pic,
  'media-camera': iconPaths.media.camera,
  'media-video': iconPaths.media.video,
  'media-file': iconPaths.media.file,
  'media-folder': iconPaths.media.folder,
  'media-doc': iconPaths.media.doc,
  'media-emoji': iconPaths.media.emoji,

  // location
  'location-map': iconPaths.location.map,
  'location-local': iconPaths.location.local,
  'location-discover': iconPaths.location.discover,

  // micro
  'micro-quality': iconPaths.micro.quality,
  'micro-production': iconPaths.micro.production,
  'micro-logistics': iconPaths.micro.logistics,
  'micro-engineering': iconPaths.micro.engineering,

  // misc
  'misc-design': iconPaths.misc.design,
  'misc-component': iconPaths.misc.component,
  'misc-common': iconPaths.misc.common,
  'misc-tutorial': iconPaths.misc.tutorial,
  'misc-list': iconPaths.misc.list,
  'misc-windmill': iconPaths.misc.windmill,
  'misc-star': iconPaths.misc.star,

  // login
  'login-bg': iconPaths.login.bg,
  'login-bg-main': iconPaths.login.bgMain,
};

/**
 * 根据图标名称获取路径
 */
export function getIcon(name: IconName): string {
  return iconPathMap[name] || '';
}
