import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { completeScannedMobilePairing, scanMobilePairingQr, type MobileQrPairingResult } from '../lib/mobileControl';
import { parseMobilePairingQrPayload } from '../lib/mobilePairingQr';

type QRDetection = { rawValue?: string };
type QRDetector = { detect(source: CanvasImageSource): Promise<readonly QRDetection[]> };
type QRDetectorConstructor = new (options?: { formats?: string[] }) => QRDetector;

function createQRDetector(): QRDetector | null {
  const runtime = globalThis as typeof globalThis & { BarcodeDetector?: QRDetectorConstructor };
  return runtime.BarcodeDetector ? new runtime.BarcodeDetector({ formats: ['qr_code'] }) : null;
}

/** Camera flow for the one-time Web-owned mobile pairing QR. */
export default function PairingScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const recognitionRunRef = useRef(0);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('将电脑端“设备管理”中的配对二维码放入取景框。');
  const [pairing, setPairing] = useState<MobileQrPairingResult | null>(null);

  const stopCamera = useCallback(() => {
    recognitionRunRef.current += 1;
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const resolvePayload = useCallback(async (rawValue: string): Promise<boolean> => {
    try {
      const payload = parseMobilePairingQrPayload(rawValue);
      stopCamera();
      setReady(false);
      setSubmitting(true);
      setError('');
      setStatus('正在登记本机，等待网页端确认…');
      const nextPairing = await scanMobilePairingQr(payload);
      setPairing(nextPairing);
      return true;
    } catch {
      setError('这不是有效的手机配对二维码，或二维码已失效。');
      setStatus('');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [stopCamera]);

  const beginRecognition = useCallback((detector: QRDetector, runID: number) => {
    const detectNextFrame = async () => {
      if (recognitionRunRef.current !== runID || pairing) return;
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        timerRef.current = window.setTimeout(() => void detectNextFrame(), 180);
        return;
      }
      try {
        const match = (await detector.detect(video)).find((candidate) => candidate.rawValue?.trim());
        if (match?.rawValue && await resolvePayload(match.rawValue)) return;
      } catch {
        setError('无法识别二维码，请调整角度后重试。');
      }
      if (recognitionRunRef.current === runID) timerRef.current = window.setTimeout(() => void detectNextFrame(), 260);
    };
    void detectNextFrame();
  }, [pairing, resolvePayload]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setOpening(true);
    setReady(false);
    setError('');
    setStatus('正在打开摄像头…');
    const detector = createQRDetector();
    if (!detector || !navigator.mediaDevices?.getUserMedia) {
      setOpening(false);
      setError('当前环境不支持二维码识别，请使用真机应用。');
      return;
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
      setStatus('将配对二维码放入取景框。');
      beginRecognition(detector, runID);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(/permission|notallowed|denied/i.test(message) ? '未获得摄像头权限，请在系统设置中允许后重试。' : '无法打开摄像头。');
      setStatus('');
    } finally {
      setOpening(false);
    }
  }, [beginRecognition, stopCamera]);

  const scanImage = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const detector = createQRDetector();
    if (!detector) {
      setError('当前环境不支持图片二维码识别。');
      return;
    }
    stopCamera();
    setReady(false);
    setOpening(true);
    setError('');
    setStatus('正在读取二维码…');
    const objectURL = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('image load failed')); image.src = objectURL; });
      const match = (await detector.detect(image)).find((candidate) => candidate.rawValue?.trim());
      if (!match?.rawValue) throw new Error('not found');
      await resolvePayload(match.rawValue);
    } catch {
      setError('未识别到有效的手机配对二维码。');
      setStatus('');
    } finally {
      URL.revokeObjectURL(objectURL);
      setOpening(false);
    }
  }, [resolvePayload, stopCamera]);

  useEffect(() => {
    if (!pairing) return undefined;
    let cancelled = false;
    let pollTimer: number | undefined;
    const poll = async () => {
      try {
        const session = await completeScannedMobilePairing();
        if (cancelled) return;
        if (session) {
          setStatus('配对完成，正在打开工作台…');
          window.setTimeout(() => { if (!cancelled) navigate('/home', { replace: true }); }, 500);
          return;
        }
        pollTimer = window.setTimeout(() => void poll(), 2_000);
      } catch {
        if (!cancelled) {
          setError('网页端尚未确认配对，或本次二维码已失效。');
          setStatus('请在网页端确认后重试。');
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [navigate, pairing]);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <section className="wb-scan wb-scan--pairing" aria-busy={opening || submitting}>
      <header className="wb-scan__header">
        <button type="button" className="wb-scan__back" onClick={() => navigate('/home')} aria-label="返回"><MobileIcon name="back" size={19} /><span>返回</span></button>
        <h1>扫描配对二维码</h1>
        <span aria-hidden="true" />
      </header>
      <div className="wb-scan__stage">
        <video ref={videoRef} className="wb-scan__video" playsInline muted autoPlay />
        {opening || submitting ? <div className="wb-scan__loading">{submitting ? '正在登记本机…' : '正在打开摄像头…'}</div> : null}
        <div className="wb-scan__mask" aria-hidden="true"><div className="wb-scan__frame"><span className="wb-scan__corner tl" /><span className="wb-scan__corner tr" /><span className="wb-scan__corner bl" /><span className="wb-scan__corner br" /><div className="wb-scan__line" /></div></div>
        <p className="wb-scan__hint">{pairing ? '已扫描，请在电脑端确认这台手机。' : status}</p>
      </div>
      <div className="wb-scan__actions">
        <div className="wb-scan__toolbar">
          <button type="button" className="wb-scan__tool wb-scan__tool--primary" disabled={opening || submitting || Boolean(pairing)} onClick={() => void startCamera()}>{ready ? '重新扫描' : '打开相机'}</button>
          <label className={`wb-scan__tool ${opening || submitting || pairing ? 'is-disabled' : ''}`}>从相册选择<input type="file" name="mobilePairingQrImage" accept="image/*" hidden disabled={opening || submitting || Boolean(pairing)} onChange={(event) => void scanImage(event)} /></label>
        </div>
      </div>
      {error ? <p className="wb-scan__status wb-scan__status--error" role="alert">{error}</p> : null}
    </section>
  );
}
