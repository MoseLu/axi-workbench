// 文档源配置
export interface DocSource {
  id: string
  name: string
  path: string
  enabled: boolean
  type: 'local' | 'api'  // 本地文件系统 或 API 数据源
  apiUrl?: string        // API 数据源的 URL
}

// 默认文档源
export const docSources: DocSource[] = [
  {
    id: 'obsidian',
    name: 'Obsidian 知识库',
    path: 'F:/docs/obsidian/',
    enabled: true,
    type: 'local',
  },
  {
    id: 'blinko-notes',
    name: 'Blinko 闪念笔记 (同步)',
    path: 'F:/docs/project/app/blinko-notes/',
    enabled: true,
    type: 'local',
  },
  {
    id: 'axi-workspace-governance',
    name: 'Axi Workspace Governance',
    path: 'F:/docs/project/docs/axi-workspace-governance/',
    enabled: true,
    type: 'local',
  },
  // API 模式（需要 Blinko 服务运行）
  // {
  //   id: 'blinko-api',
  //   name: 'Blinko 闪念笔记 (API)',
  //   path: '',
  //   enabled: false,
  //   type: 'api',
  //   apiUrl: 'http://localhost:1111/api',
  // },
]

// 需要排除的文件夹
export const excludePatterns = [
  '.git',
  'node_modules',
  '.obsidian',
  '.trash',
]

// 支持的文件扩展名
export const supportedExtensions = ['.md', '.markdown']
