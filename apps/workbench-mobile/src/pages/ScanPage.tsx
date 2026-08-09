import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { decideMobileApprovalScan, resolveMobileApprovalScan, type ApprovalScanPreview } from '../lib/mobileControl';
import { parseApprovalScanPayload } from '../lib/approvalScan';

type QRDetection = { rawValue?: string };
type QRDetector = { detect(source: CanvasImageSource): Promise<readonly QRDetection[]> };
type QRDetectorConstructor = new (options?: { formats?: string[] }) => QRDetector;

function createQRDetector(): QRDetector | null {
  const runtime = globalThis as typeof globalThis & { BarcodeDetector?: QRDetectorConstructor };
  return runtime.BarcodeDetector ? new runtime.BarcodeDetector({ formats: ['qr_code'] }) : null;
}

/** Domain approval scanner.  It cannot approve OIDC login transactions. */
export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionTimerRef = useRef<number | undefined>(undefined);
  const recognitionRunRef = useRef(0);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<ApprovalScanPreview | null>(null);

  const stopCamera = useCallback(() => {
    recognitionRunRef.current += 1;
    if (recognitionTimerRef.current !== undefined) window.clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const resolvePayload = useCallback(async (rawValue: string): Promise<boolean> => {
    try {
      const { scanToken } = parseApprovalScanPayload(rawValue);
      stopCamera();
      setReady(false);
      setSubmitting(true);
      setError('');
      setStatus('正在从服务端核验审批对象…');
      const nextPreview = await resolveMobileApprovalScan(scanToken);
      setPreview(nextPreview);
      setStatus('请确认对象、影响和风险后再决定。');
      return true;
    } catch {
      setStatus('');
      setError('二维码无效、已失效，或当前设备不能读取该审批。');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [stopCamera]);

  const beginRecognition = useCallback((detector: QRDetector, runID: number) => {
    const detectNextFrame = async () => {
      if (recognitionRunRef.current !== runID || preview) return;
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        recognitionTimerRef.current = window.setTimeout(() => void detectNextFrame(), 180);
        return;
      }
      try {
        const match = (await detector.detect(video)).find((candidate) => candidate.rawValue?.trim());
        if (match?.rawValue && await resolvePayload(match.rawValue)) return;
      } catch {
        setError('无法识别二维码，请重试。');
      }
      if (recognitionRunRef.current === runID) recognitionTimerRef.current = window.setTimeout(() => void detectNextFrame(), 260);
    };
    void detectNextFrame();
  }, [preview, resolvePayload]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setOpening(true); setReady(false); setStatus(''); setError(''); setPreview(null);
    const detector = createQRDetector();
    if (!detector || !navigator.mediaDevices?.getUserMedia) {
      setOpening(false); setError('当前环境不支持二维码识别。'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('video unavailable');
      video.srcObject = stream;
      await video.play();
      const runID = recognitionRunRef.current;
      setReady(true);
      beginRecognition(detector, runID);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(/permission|notallowed|denied/i.test(message) ? '未获得摄像头权限，请在系统设置中允许后重试。' : '无法打开摄像头。');
    } finally { setOpening(false); }
  }, [beginRecognition, stopCamera]);

  const scanImage = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const detector = createQRDetector();
    if (!detector) { setError('当前环境不支持图片二维码识别。'); return; }
    stopCamera(); setReady(false); setOpening(true); setError(''); setStatus(''); setPreview(null);
    const objectURL = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('image load failed')); image.src = objectURL; });
      const match = (await detector.detect(image)).find((candidate) => candidate.rawValue?.trim());
      if (!match?.rawValue) throw new Error('not found');
      await resolvePayload(match.rawValue);
    } catch { setError('未识别到有效审批二维码。'); } finally { URL.revokeObjectURL(objectURL); setOpening(false); }
  }, [resolvePayload, stopCamera]);

  const decide = async (decision: ApprovalScanPreview['availableDecisions'][number]) => {
    if (!preview) return;
    setSubmitting(true); setError('');
    try {
      const result = await decideMobileApprovalScan(preview.scanId, decision, preview.handoffCorrelationId) as { status?: string; handoff?: { id: string } };
      if (result.status === 'handed_off' && result.handoff) setStatus(`已创建 Web 续办记录：${result.handoff.id}`);
      else setStatus(decision === 'approved' ? '已确认，服务端已记录该决定。' : '已拒绝，服务端已记录该决定。');
      setPreview(null);
    } catch { setError('提交失败：审批可能已过期、状态已变化或设备无权执行。'); }
    finally { setSubmitting(false); }
  };

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <section className="wb-scan" aria-busy={opening || submitting}>
      <header className="wb-scan__header"><button type="button" className="wb-scan__back" onClick={() => navigate('/home')} aria-label="返回"><MobileIcon name="back" size={19} /><span>返回</span></button><h1>审批扫码</h1><span aria-hidden="true" /></header>
      {preview ? <div className="wb-scan__preview" role="dialog" aria-label="审批预览"><p>受控审批</p><h2>{preview.impact}</h2><dl><div><dt>审批对象</dt><dd>{preview.object.projectId || preview.object.id}</dd></div><div><dt>动作</dt><dd>{preview.object.actionType || preview.object.actionId || '由服务端待定'}</dd></div><div><dt>风险</dt><dd>{preview.riskLevel}</dd></div><div><dt>当前状态</dt><dd>{preview.currentStatus}</dd></div><div><dt>失效时间</dt><dd>{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(Date.parse(preview.expiresAt))}</dd></div></dl><div className="wb-scan__preview-actions">{preview.availableDecisions.map((decision) => <button type="button" key={decision} disabled={submitting} onClick={() => void decide(decision)}>{decision === 'approved' ? '确认' : decision === 'rejected' ? '拒绝' : '交给 Web 续办'}</button>)}</div></div> : <><div className="wb-scan__stage"><video ref={videoRef} className="wb-scan__video" playsInline muted autoPlay />{opening || submitting ? <div className="wb-scan__loading">{submitting ? '正在核验…' : '正在打开摄像头…'}</div> : null}<div className="wb-scan__mask" aria-hidden="true"><div className="wb-scan__frame"><span className="wb-scan__corner tl" /><span className="wb-scan__corner tr" /><span className="wb-scan__corner bl" /><span className="wb-scan__corner br" /><div className="wb-scan__line" /></div></div><p className="wb-scan__hint">仅扫描受控审批二维码，不用于网页登录确认。</p></div><div className="wb-scan__actions"><div className="wb-scan__toolbar"><button type="button" className="wb-scan__tool wb-scan__tool--primary" disabled={opening || submitting} onClick={() => void startCamera()}>{ready ? '重新扫描' : '打开相机'}</button><label className={`wb-scan__tool ${opening || submitting ? 'is-disabled' : ''}`}>从相册选择<input type="file" name="approvalScanImage" accept="image/*" hidden disabled={opening || submitting} onChange={(event) => void scanImage(event)} /></label></div></div></>}
      {status ? <p className="wb-scan__status wb-scan__status--success" role="status">{status}</p> : null}{error ? <p className="wb-scan__status wb-scan__status--error" role="alert">{error}</p> : null}
    </section>
  );
}
