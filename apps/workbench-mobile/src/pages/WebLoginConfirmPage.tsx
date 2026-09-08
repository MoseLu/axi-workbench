import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';
import { approveMobileWebLoginQr } from '../lib/mobileControl';
import { parseWebLoginQrPayload } from '../lib/webLoginQr';

type QRDetection = { rawValue?: string };
type QRDetector = { detect(source: CanvasImageSource): Promise<readonly QRDetection[]> };
type QRDetectorConstructor = new (options?: { formats?: string[] }) => QRDetector;

function detector() {
  const runtime = globalThis as typeof globalThis & { BarcodeDetector?: QRDetectorConstructor };
  return runtime.BarcodeDetector ? new runtime.BarcodeDetector({ formats: ['qr_code'] }) : null;
}

/** Identity-only scanner, intentionally outside the domain approval Scan route. */
export default function WebLoginConfirmPage() {
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>();
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState('请扫描网页登录二维码。');
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const approve = useCallback(async (raw: string) => {
    try {
      const payload = parseWebLoginQrPayload(raw);
      stop(); setOpening(true); setError(''); setMessage('正在确认网页登录…');
      await approveMobileWebLoginQr(payload);
      setMessage('网页登录已确认。');
    } catch { setError('二维码无效、已失效，或当前设备尚未完成配对。'); }
    finally { setOpening(false); }
  }, [stop]);

  const start = useCallback(async () => {
    const qrDetector = detector();
    if (!qrDetector || !navigator.mediaDevices?.getUserMedia) { setError('当前环境不支持二维码识别。'); return; }
    stop(); setOpening(true); setError(''); setMessage('正在打开摄像头…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('video unavailable');
      videoRef.current.srcObject = stream; await videoRef.current.play(); setMessage('将网页登录二维码放入取景框。');
      const detect = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        try { const found = (await qrDetector.detect(video)).find((item) => item.rawValue?.trim()); if (found?.rawValue) { await approve(found.rawValue); return; } } catch { /* retry while camera remains open */ }
        timerRef.current = window.setTimeout(() => void detect(), 250);
      };
      void detect();
    } catch { setError('无法打开摄像头，请检查权限。'); setOpening(false); }
  }, [approve, stop]);

  const readImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const qrDetector = detector();
    if (!qrDetector) { setError('当前环境不支持图片二维码识别。'); return; }
    const objectURL = URL.createObjectURL(file); const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('image')); image.src = objectURL; });
      const found = (await qrDetector.detect(image)).find((item) => item.rawValue?.trim());
      if (!found?.rawValue) throw new Error('not found');
      await approve(found.rawValue);
    } catch { setError('未识别到网页登录二维码。'); } finally { URL.revokeObjectURL(objectURL); }
  };

  useEffect(() => stop, [stop]);
  return <main className="axi-mobile-login axi-mobile-login--confirm-web"><div className="axi-mobile-login__brand"><span>{t('app.name')}</span></div><div className="axi-mobile-login__copy"><p>身份登录</p><h1>确认网页登录</h1><small>这是一次性 Identity 登录确认，不是领域审批。</small></div><section className="axi-mobile-login__form"><video ref={videoRef} className="wb-login-confirm-video" autoPlay muted playsInline /><p role="status">{message}</p>{error ? <p className="axi-mobile-login__error" role="alert">{error}</p> : null}<button type="button" disabled={opening} onClick={() => void start()}>{opening ? '正在处理…' : '打开相机'}</button><label className="axi-mobile-login__file">从相册选择<input type="file" hidden accept="image/*" onChange={(event) => void readImage(event)} /></label><button type="button" className="axi-mobile-login__secondary" onClick={() => navigate('/home')}><MobileIcon name="back" size={16} />返回工作台</button></section></main>;
}
