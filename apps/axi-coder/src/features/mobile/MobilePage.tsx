import { Bell, CheckCircle2, ExternalLink, FileCheck2, Link2, Smartphone, Terminal } from "lucide-react";
import { Metric } from "../../components/ui";
import type { AxiSuiteSnapshot } from "./axiSuiteSnapshot";

type MobilePageProps = {
  snapshot: AxiSuiteSnapshot | null;
  loading: boolean;
  onRefresh: () => void;
};

export function MobilePage({ snapshot, loading, onRefresh }: MobilePageProps) {
  const mobile = snapshot?.mobile;
  const notify = snapshot?.notify;
  const deepLinks = mobile?.deepLinks ?? ["axi://chat", "axi://todo", "axi://workbench"];
  const endpoints = notify?.endpoints ?? ["POST /v1/events", "GET /v1/events"];

  return (
    <section className="page-stack">
      <div className="mobile-hero">
        <div className="phone-frame" aria-label="Axi Mobile 状态">
          <div className="phone-speaker" />
          <div className="phone-screen">
            <span className="phone-status">
              <CheckCircle2 size={14} />
              Goal70 E2E
            </span>
            <strong>Axi Mobile</strong>
            <small>{mobile?.packageName ?? "com.mosscoder.notify"}</small>
          </div>
        </div>
        <div className="mobile-summary">
          <div className="overview-metrics">
            <Metric label="Android 包" value={mobile?.packageName ?? "com.mosscoder.notify"} />
            <Metric label="深链" value={`${deepLinks.length}`} />
            <Metric label="通知端点" value={`${endpoints.length}`} />
            <Metric label="认证头" value={notify?.authHeader ?? "X-Axi-Notify-Api-Key"} />
          </div>
          <div className="detail-card">
            <div className="panel-title">
              <FileCheck2 size={18} />
              <h2>最近真机 E2E 证据</h2>
              <button className="panel-action" onClick={onRefresh} disabled={loading} type="button">
                <FileCheck2 size={16} />
                刷新快照
              </button>
            </div>
            <code className="path-code">{mobile?.latestGoal70Artifact ?? "未找到 android-app/docs/verification/goal70-* artifact"}</code>
            <p className="muted-copy">包含 UIAutomator XML、截图、dumpsys notification、logcat tail 和 summary.txt。</p>
          </div>
        </div>
      </div>

      <div className="ops-grid">
        <article className="ops-panel">
          <div className="panel-title">
            <Link2 size={18} />
            <h2>深链验证链路</h2>
          </div>
          <div className="chip-list">
            {deepLinks.map((link) => (
              <span className="code-chip" key={link}>
                {link}
              </span>
            ))}
          </div>
          <p className="muted-copy">chat、todo、workbench 三条链路来自 Android 导航测试和 Goal70 ADB E2E。</p>
        </article>

        <article className="ops-panel">
          <div className="panel-title">
            <Bell size={18} />
            <h2>Axi Notify 中继合同</h2>
          </div>
          <div className="contract-list">
            {endpoints.map((endpoint) => (
              <ContractRow key={endpoint} label="端点" value={endpoint} />
            ))}
            <ContractRow label="认证" value={notify?.authHeader ?? "X-Axi-Notify-Api-Key"} />
          </div>
        </article>

        <article className="ops-panel">
          <div className="panel-title">
            <Terminal size={18} />
            <h2>下一步验证入口</h2>
          </div>
          <code className="path-code">make adb-goal70-e2e</code>
          <p className="muted-copy">桌面端记录验证命令和证据路径，ADB 执行仍由本地验证流程负责。</p>
          <a className="link-button" href="#" onClick={(event) => event.preventDefault()}>
            <ExternalLink size={16} />
            Android 证据评审
          </a>
        </article>
      </div>
    </section>
  );
}

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="contract-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
