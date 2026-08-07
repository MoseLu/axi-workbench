import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveGatewayURL } from '@axi/workbench-foundation';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';
import { parseQRApprovalPayload, qrApprovalEndpoint } from '../lib/qrLogin';

type QRDetection = { rawValue?: string };
type QRDetector = { detect(source: CanvasImageSource): Promise<readonly QRDetection[]> };
type QRDetectorConstructor = new (options?: { formats?: string[] }) => QRDetector;

function createQRDetector(): QRDetector | null {
  const runtime = globalThis as typeof globalThis & { BarcodeDetector?: QRDetectorConstructor };
  return runtime.BarcodeDetector ? new runtime.BarcodeDetector({ formats: ['qr_code'] }) : null;
}

/**
 * 扫码仅确认 Web 发起的一次性 OIDC 事务。移动端已由 RequireSession 验证，
 * 票据不会进入 React state、日志、Storage 或 URL。
 */
export default function ScanPage() {
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionTimerRef = useRef<number | undefined>(undefined);
  const recognitionRunRef = useRef(0);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const stopCamera = useCallback(() => {
    recognitionRunRef.current += 1;
    if (recognitionTimerRef.current !== undefined) {
      window.clearTimeout(recognitionTimerRef.current);
      recognitionTimerRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const approveQRPayload = useCallback(async (rawValue: string): Promise<boolean> => {
    let payload: ReturnType<typeof parseQRApprovalPayload>;
    try {
      payload = parseQRApprovalPayload(rawValue);
    } catch {
      setError(t('scan.invalid'));
      return false;
    }

    stopCamera();
    setReady(false);
    setSubmitting(true);
    setError('');
    setStatus(t('scan.approving'));
    try {
      const response = await fetch(resolveGatewayURL(qrApprovalEndpoint(payload.transactionId)), {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: payload.ticket }),
      });
      if (response.status === 202) {
        setStatus(t('scan.approved'));
        return true;
      }
      setStatus('');
      setError(response.status === 401 ? t('scan.authRequired') : t('scan.rejected'));
      return false;
    } catch {
      setStatus('');
      setError(t('scan.failed'));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [stopCamera, t]);

  const beginRecognition = useCallback((detector: QRDetector, runID: number) => {
    const detectNextFrame = async () => {
      if (recognitionRunRef.current !== runID) return;
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        recognitionTimerRef.current = window.setTimeout(() => void detectNextFrame(), 180);
        return;
      }

      try {
        const match = (await detector.detect(video)).find((candidate) => candidate.rawValue?.trim());
        if (match?.rawValue && await approveQRPayload(match.rawValue)) return;
      } catch {
        setError(t('scan.failed'));
      }

      if (recognitionRunRef.current === runID) {
        recognitionTimerRef.current = window.setTimeout(() => void detectNextFrame(), 260);
      }
    };

    void detectNextFrame();
  }, [approveQRPayload, t]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setOpening(true);
    setReady(false);
    setStatus('');
    setError('');

    const detector = createQRDetector();
    if (!detector) {
      setOpening(false);
      setError(t('scan.unsupported'));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setOpening(false);
      setError(t('scan.unsupported'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setError(t('scan.failed'));
        return;
      }
      video.srcObject = stream;
      await video.play();
      const runID = recognitionRunRef.current;
      setReady(true);
      beginRecognition(detector, runID);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(/permission|notallowed|denied/i.test(message) ? t('scan.denied') : t('scan.failed'));
    } finally {
      setOpening(false);
    }
  }, [beginRecognition, stopCamera, t]);

  const scanImage = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const detector = createQRDetector();
    if (!detector) {
      setError(t('scan.unsupported'));
      return;
    }

    stopCamera();
    setReady(false);
    setOpening(true);
    setStatus('');
    setError('');
    const objectURL = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('image load failed'));
        image.src = objectURL;
      });
      const match = (await detector.detect(image)).find((candidate) => candidate.rawValue?.trim());
      if (!match?.rawValue) {
        setError(t('scan.notFound'));
        return;
      }
      await approveQRPayload(match.rawValue);
    } catch {
      setError(t('scan.notFound'));
    } finally {
      URL.revokeObjectURL(objectURL);
      setOpening(false);
    }
  }, [approveQRPayload, stopCamera, t]);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <section className="wb-scan" aria-busy={opening || submitting}>
      <header className="wb-scan__header">
        <button type="button" className="wb-scan__back" onClick={() => navigate('/home')} aria-label={t('common.back')}>
          <MobileIcon name="back" size={19} />
          <span>{t('common.back')}</span>
        </button>
        <h1>{t('page.scan')}</h1>
        <span aria-hidden="true" />
      </header>

      <div className="wb-scan__stage">
        <video ref={videoRef} className="wb-scan__video" playsInline muted autoPlay />
        {opening || submitting ? <div className="wb-scan__loading">{submitting ? t('scan.approving') : t('scan.loading')}</div> : null}
        <div className="wb-scan__mask" aria-hidden="true">
          <div className="wb-scan__frame">
            <span className="wb-scan__corner tl" />
            <span className="wb-scan__corner tr" />
            <span className="wb-scan__corner bl" />
            <span className="wb-scan__corner br" />
            <div className="wb-scan__line" />
          </div>
        </div>
        <p className="wb-scan__hint">{t('scan.hint')}</p>
      </div>

      <div className="wb-scan__actions">
        {status ? <p className="wb-scan__status wb-scan__status--success" role="status">{status}</p> : null}
        {error ? <p className="wb-scan__status wb-scan__status--error" role="status">{error}</p> : null}
        <div className="wb-scan__toolbar">
          <button type="button" className="wb-scan__tool wb-scan__tool--primary" disabled={opening || submitting} onClick={() => void startCamera()}>
            {ready ? t('scan.retry') : t('scan.openCamera')}
          </button>
          <label className={`wb-scan__tool ${opening || submitting ? 'is-disabled' : ''}`}>
            {t('scan.album')}
            <input type="file" accept="image/*" hidden disabled={opening || submitting} onChange={(event) => void scanImage(event)} />
          </label>
        </div>
      </div>
    </section>
  );
}
