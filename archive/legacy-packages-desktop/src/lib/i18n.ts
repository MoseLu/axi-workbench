/**
 * 中文本地化文件 / Chinese Localization
 */

export const zh_CN = {
  // App
  app: {
    title: 'Mini-Agent',
    subtitle: 'AI 编程助手',
    connecting: '连接中...',
    connected: '已连接',
  },

  // Sidebar (Left)
  sidebar: {
    title: '导航菜单',
    searchPlaceholder: '搜索菜单...',
    dashboard: '仪表盘',
    chat: 'AI 聊天',
    editor: '代码编辑器',
    terminal: '终端',
    mcpServers: 'MCP 服务器',
    systemMonitor: '系统监控',
    settings: '系统设置',
    menuList: '菜单列表',
    userList: '用户列表',
    roleList: '角色列表',
    collapse: '折叠菜单',
    expand: '展开菜单',
  },

  // Header Bar
  header: {
    collapse: '折叠菜单',
    github: 'GitHub',
    international: '国际化',
    notifications: '通知',
    messages: '消息',
    preferences: '偏好设置',
    themeSwitch: '主题切换',
    admin: '管理员',
  },

  // Right Sidebar (Settings)
  rightSidebar: {
    title: '系统设置',
    themeMode: '主题模式',
    themeColor: '主题颜色',
    layoutSettings: '界面设置',
    sidebarWidth: '侧边栏宽度',
    tabBar: '标签栏',
    breadcrumb: '面包屑',
    show: '显示',
    hide: '隐藏',
  },

  // Main Layout
  layout: {
    split: '分屏',
    chat: '聊天',
    editor: '编辑器',
    terminal: '终端',
    settings: '设置',
    mcpServers: 'MCP 服务器',
    systemMonitor: '系统监控',
    changeTheme: '更换主题',
  },

  // Theme
  theme: {
    dark: '深色',
    light: '浅色',
    ocean: '海洋',
    forest: '森林',
  },

  // Chat Panel
  chat: {
    title: 'AI 聊天',
    newSession: '新建会话',
    session: '会话',
    noSessionActive: '暂无活跃会话',
    createNewSession: '创建新会话',
    typeMessage: '输入消息...',
    createSessionFirst: '请先创建会话',
    dismiss: '忽略',
    thinking: '思考中',
  },

  // Terminal Panel
  terminal: {
    title: '终端',
    terminal: '终端',
    newTerminal: '新建终端',
    noTerminalOpen: '暂无打开的终端',
    createNewTerminal: '创建新终端',
    enterCommand: '输入命令...',
    welcomeMessageLine1: 'Mini-Agent 终端',
    welcomeMessageLine2: '输入命令或使用 AI 聊天',
  },

  // Code Editor
  editor: {
    title: '代码编辑器',
    noFileOpen: '暂无打开的文件',
    selectFileOrCreate: '从资源管理器选择文件或创建新文件',
    hideSidebar: '隐藏侧边栏',
    showSidebar: '显示侧边栏',
    save: '保存',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    loading: '加载编辑器中...',
  },

  // File Tree
  fileTree: {
    explorer: '资源管理器',
    newFile: '新建文件',
    newFolder: '新建文件夹',
    refresh: '刷新',
    collapse: '折叠',
  },

  // Settings Panel
  settings: {
    title: '设置',
    llmConfig: 'LLM 配置',
    model: '模型',
    modelPlaceholder: 'gpt-4o, claude-3-5-sonnet-20241022 等',
    modelHint: 'OpenAI: gpt-4o, gpt-4-turbo | Anthropic: claude-3-5-sonnet-20241022',
    apiBaseUrl: 'API 基础地址',
    apiBasePlaceholder: 'https://api.openai.com/v1 (默认)',
    apiKey: 'API 密钥',
    apiKeyPlaceholder: 'sk-...',
    maxSteps: '最大步数',
    maxStepsHint: '每次对话的最大智能体步数',
    workspace: '工作区',
    workingDirectory: '工作目录',
    browse: '浏览',
    keyboardShortcuts: '快捷键',
    saveFile: '保存文件',
    closeTab: '关闭标签页',
    toggleTerminal: '切换终端',
    commandPalette: '命令面板',
    updates: '更新',
    currentVersion: '当前版本',
    cancel: '取消',
    save: '保存',
    saving: '保存中...',
    saved: '设置已保存',
    error: '错误',
  },

  // MCP Panel
  mcp: {
    title: 'MCP 服务器',
    noServersConfigured: '暂无配置的 MCP 服务器',
    addFirstServer: '添加您的第一个服务器',
    addServer: '添加服务器',
    serverName: '名称',
    serverNamePlaceholder: '我的服务器',
    command: '命令',
    commandPlaceholder: 'npx, python, node 等',
    arguments: '参数',
    argumentsPlaceholder: '-y @modelcontextprotocol/server-filesystem /path',
    stop: '停止',
    start: '启动',
    delete: '删除',
    done: '完成',
    failedToStart: '服务器启动失败',
  },

  // Welcome Screen
  welcome: {
    title: '欢迎使用 Mini-Agent',
    subtitle: 'AI 编程助手',
    newFile: '新建文件',
    createNewFile: '创建新文件',
    terminal: '终端',
    openTerminal: '打开终端',
    settings: '设置',
    configureAI: '配置 AI',
    aiChat: 'AI 聊天',
    startChatting: '开始聊天',
    fastLightweight: '快速且轻量',
    fastDescription: '使用 Tauri 构建，资源占用极低',
    secure: '安全可靠',
    secureDescription: '您的代码保留在本地设备上',
    fullControl: '完全可控',
    fullControlDescription: 'MCP 集成和可定制的 AI',
    version: '版本',
    copyVersion: '复制版本',
    copied: '已复制',
    github: 'GitHub',
    keyboardHint: '按 Ctrl+Shift+P 打开命令面板',
    openFile: '打开文件',
    configureAI: '配置 AI',
  },

  // Command Palette
  commandPalette: {
    placeholder: '输入命令或搜索...',
    noCommandsFound: '未找到命令',
  },

  // System Monitor
  monitor: {
    title: '系统监控',
    cpu: 'CPU 使用率',
    memory: '内存使用',
    uptime: '运行时间',
    close: '关闭',
  },

  // General
  general: {
    loading: '加载中...',
    error: '错误',
    success: '成功',
    confirm: '确认',
    cancel: '取消',
    close: '关闭',
    save: '保存',
    delete: '删除',
    add: '添加',
    edit: '编辑',
    refresh: '刷新',
  },
}

export type Locale = typeof zh_CN
export default zh_CN
