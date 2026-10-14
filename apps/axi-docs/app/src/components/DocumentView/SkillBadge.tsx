// Skill badge — rich metadata for MCP/agent use
export function SkillBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 980,
      background: 'var(--axi-docs-tag-bg)', color: 'var(--axi-docs-tag-text)',
      border: '1px solid var(--axi-docs-tag-border)',
      fontSize: 'var(--axi-docs-font-size-xs)', fontWeight: 500,
    }}>
      <span style={{ color: 'var(--axi-docs-color-text-muted)', fontWeight: 400 }}>{label}:</span>
      <span>{value}</span>
    </div>
  )
}