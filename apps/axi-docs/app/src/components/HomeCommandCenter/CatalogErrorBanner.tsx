interface CatalogErrorBannerProps {
  catalogError: string | null | undefined
  onRetryCatalog?: () => void
  guideLocale: 'zh' | 'en'
}

export function CatalogErrorBanner({ catalogError, onRetryCatalog, guideLocale }: CatalogErrorBannerProps) {
  if (!catalogError) return null
  return (
    <div
      className="axi-docs-catalog-error"
      role="alert"
      aria-live="assertive"
      style={{
        border: '1px solid rgba(207, 34, 46, 0.45)',
        background: 'rgba(207, 34, 46, 0.08)',
        borderRadius: 10,
        padding: '12px 16px',
        margin: '0 0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        <strong>{guideLocale === 'zh' ? '知识目录加载失败' : 'Failed to load the knowledge catalog'}</strong>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{catalogError}</div>
      </div>
      {onRetryCatalog ? (
        <button
          className="axi-docs-catalog-error__retry"
          onClick={onRetryCatalog}
          type="button"
          style={{
            border: '1px solid rgba(207, 34, 46, 0.45)',
            background: 'transparent',
            color: 'inherit',
            borderRadius: 8,
            padding: '8px 14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {guideLocale === 'zh' ? '重试' : 'Retry'}
        </button>
      ) : null}
    </div>
  )
}