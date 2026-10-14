/** Fallback route element rendered when no host route matches the current path. */
export function ShellNotFoundPage({
  backLabel,
  label,
  message,
  onBack
}: {
  backLabel: string;
  label: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <div role="alert" style={{ padding: 32, textAlign: 'center' }}>
      <h2 style={{ marginBottom: 8 }}>{label}</h2>
      <p style={{ color: 'var(--axi-color-text-secondary, #888)' }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onBack}
        style={{ marginTop: 16, padding: '6px 16px', borderRadius: 6, border: '1px solid currentColor', background: 'transparent', cursor: 'pointer' }}
      >
        {backLabel}
      </button>
    </div>
  );
}
