import type { ReactNode } from "react";
import { AxiScrollArea } from "@axi/shell";

import type { AppSettings } from "../../settings/useAppSettings";

/**
 * Content region: hosts the routed pages inside the shared scroll surface,
 * including the top progress bar, the watermark layer and the page transition
 * wrapper. Only used for host pages; hosted apps render their routes directly.
 */
export function ShellContentArea({
  children,
  loadingLabel,
  pathname,
  showProgress,
  showWatermark,
  isTablePage,
  pageTransition,
  watermarkText
}: {
  children: ReactNode;
  loadingLabel: string;
  pathname: string;
  showProgress: boolean;
  showWatermark: boolean;
  isTablePage: boolean;
  pageTransition: AppSettings["pageTransition"];
  watermarkText: string;
}) {
  return (
    <section className={`app-view-container ${isTablePage ? "app-view-container-services" : ""}`}>
      {showProgress ? <div className="top-progress" role="progressbar" aria-label={loadingLabel} /> : null}
      {showWatermark ? <div className="global-watermark" data-watermark={watermarkText} aria-hidden="true">{watermarkText}</div> : null}
      <AxiScrollArea className={isTablePage ? "services-scrollbar" : ""}>
        <div className={`page-transition page-transition-${pageTransition}`} key={pathname}>
          {children}
        </div>
      </AxiScrollArea>
    </section>
  );
}
