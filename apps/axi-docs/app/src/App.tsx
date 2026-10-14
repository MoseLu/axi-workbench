import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { HubPage } from './App/HubPage'
import { NotFoundPage } from './components/NotFoundPage'
import { WorkspaceArchitecturePage } from './components/WorkspaceArchitecturePage'
import {
  DEFAULT_LOCALE,
  getDefaultGuideRoute,
  getSiteLocaleConfig,
} from './config/siteConfig'
import {
  buildDocumentRoute,
  decodeDocumentId,
} from './lib/routes'
import type { InitialPageData } from './lib/initialPageData'

const DEFAULT_GUIDE_ROUTE = getDefaultGuideRoute()

function RouteFallback() {
  const navigate = useNavigate()

  return (
    <div className="standalone-route">
      <NotFoundPage
        description={getSiteLocaleConfig(DEFAULT_LOCALE).ui.notFound.fallbackDescription}
        onPrimaryAction={() => navigate('/')}
        onSecondaryAction={() => navigate('/')}
        title={getSiteLocaleConfig(DEFAULT_LOCALE).ui.notFound.fallback}
      />
    </div>
  )
}

function docSetRouteForSource(sourceId: string | null): string {
  if (sourceId === 'axi-skills') return '/en/skills'
  if (sourceId === 'axi-skills-zh') return '/zh/skills'
  if (sourceId === 'workspace') return '/zh/workspace'
  return DEFAULT_GUIDE_ROUTE
}

function LegacyCategoryRedirect() {
  const [searchParams] = useSearchParams()
  const sourceId = searchParams.get('source')
  const documentFromParam = searchParams.get('doc')
  const node = searchParams.get('node')
  const decodedDocument = documentFromParam ? decodeDocumentId(documentFromParam) : null

  if (decodedDocument) {
    return <Navigate replace to={buildDocumentRoute(decodedDocument)} />
  }

  if (sourceId && node && !node.startsWith('branch:') && /\//u.test(node)) {
    return <Navigate replace to={buildDocumentRoute({ sourceId, path: node })} />
  }

  return <Navigate replace to={docSetRouteForSource(sourceId)} />
}

function App({ initialData }: { initialData?: InitialPageData | null }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={DEFAULT_GUIDE_ROUTE} />} />
      <Route path="/:locale/guide/:guideId" element={<HubPage pageMode="home" initialData={initialData} />} />
      <Route path="/:locale/:collection" element={<HubPage pageMode="home" initialData={initialData} />} />
      <Route path="/workspace/architecture" element={<WorkspaceArchitecturePage />} />
      <Route path="/nodes/:categoryId" element={<LegacyCategoryRedirect />} />
      <Route path="/nodes/:categoryId/sub/:subId" element={<LegacyCategoryRedirect />} />
      <Route path="/docs/:sourceId/*" element={<HubPage pageMode="document" initialData={initialData} />} />
      <Route path="*" element={<RouteFallback />} />
    </Routes>
  )
}

export default App