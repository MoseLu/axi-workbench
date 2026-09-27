interface DocumentRepository {
  branch: string
  pathPrefix?: string
  url: string
}

const DOCUMENT_REPOSITORIES: Record<string, DocumentRepository> = {
  workspace: {
    url: 'https://github.com/axiomaticworld/axi-workspace-governance',
    branch: 'dev',
  },
  'axi-skills': {
    url: 'https://github.com/MoseLu/axi-skills',
    branch: 'dev',
  },
  'axi-skills-zh': {
    url: 'https://github.com/MoseLu/axi-skills',
    branch: 'dev',
  },
  'axi-docs-en': {
    url: 'https://github.com/axiomaticworld/axi-docs',
    branch: 'dev',
    pathPrefix: 'docs/content/en',
  },
  'axi-docs-zh': {
    url: 'https://github.com/axiomaticworld/axi-docs',
    branch: 'dev',
    pathPrefix: 'docs/content/zh',
  },
  dbskill: {
    url: 'https://github.com/dontbesilent2025/dbskill',
    branch: 'main',
  },
}

export function buildDocumentEditUrl(sourceId: string, documentPath: string): string | null {
  const repository = DOCUMENT_REPOSITORIES[sourceId]
  if (!repository) return null

  const repositoryPath = [repository.pathPrefix, documentPath]
    .filter(Boolean)
    .join('/')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')

  return `${repository.url}/edit/${encodeURIComponent(repository.branch)}/${repositoryPath}`
}
