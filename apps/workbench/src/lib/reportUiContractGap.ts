export interface UiContractGapInput {
  projectId?: string;
  organizationId?: string;
  workspaceId?: string;
  route: string;
  ruleId: string;
  component?: string;
  cause?: string;
  details?: Record<string, unknown>;
}

let reported = new Set<string>();

export async function reportUiContractGap(input: UiContractGapInput): Promise<void> {
  const key = `${input.projectId || 'axi-workbench'}:${input.route}:${input.ruleId}`;
  if (reported.has(key)) return;
  reported.add(key);
  try {
    const response = await fetch('/api/v1/observability/ui-contract-gaps', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      // Reporting must never replace the AXI exception page or rethrow into the UI.
      // eslint-disable-next-line no-console
      console.error('[axi-ui] ui contract gap report failed', response.status);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[axi-ui] ui contract gap report unavailable', error);
  }
}

export function resetUiContractGapReportsForTests(): void {
  reported = new Set<string>();
}
