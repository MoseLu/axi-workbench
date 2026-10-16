/** Suspense fallback rendered while a lazily imported shell page is loading. */
export function RouteFallback() {
  return (
    <div style={{ padding: 24, color: "var(--axi-text-secondary, #888)" }}>
      Loading…
    </div>
  );
}
