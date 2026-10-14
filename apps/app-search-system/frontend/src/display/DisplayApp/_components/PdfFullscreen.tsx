/**
 * PDF 全屏展示（推送的 SOP）
 */
interface PdfFullscreenProps {
  src: string;
  loading: boolean;
  jobName: string | null;
  onLoaded: () => void;
  onDismiss: () => void;
}

export default function PdfFullscreen({ src, loading, jobName, onLoaded, onDismiss }: PdfFullscreenProps) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        background: 'var(--axi-text, #000)',
        cursor: 'pointer', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => {
        if (src.startsWith('blob:')) URL.revokeObjectURL(src);
        onDismiss();
      }}
    >
      {/* 加载遮罩：fetch 期间显示 */}
      {loading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', zIndex: 10, flexDirection: 'column', gap: 12,
        }}>
          <div style={{ color: 'white', fontSize: 18 }}>正在加载 SOP...</div>
          <div style={{ color: 'var(--axi-text-muted, #64748b)', fontSize: 13 }}>{jobName}</div>
        </div>
      )}
      <iframe
        src={src}
        title={jobName || 'SOP'}
        style={{ width: '100%', height: '100%', border: 'none', zIndex: 1 }}
        onLoad={onLoaded}
        onError={() => { onLoaded(); console.error('[PDF] iframe 加载失败'); }}
      />
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.6)', color: 'white', padding: '8px 20px', borderRadius: 20,
        fontSize: 14, pointerEvents: 'none',
      }}>
        {jobName || 'Axi Docs Display'} · 点击或按 ESC 退出
      </div>
    </div>
  );
}
