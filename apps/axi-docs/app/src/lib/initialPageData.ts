import type { DocSource, KnowledgeCatalog } from '../types'

export interface InitialPageData {
  sourceId: string
  path: string
  sources: DocSource[]
  catalog: KnowledgeCatalog
  content: string
}

declare global {
  interface Window {
    __AXI_DOCS_INITIAL_DATA__?: InitialPageData
  }
}
