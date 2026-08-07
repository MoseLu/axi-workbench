import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobileI18n } from '../i18n';

/** 微信式扫一扫页：显式点击才申请摄像头权限，避免进入 Tab 时突然弹出系统授权。 */
export default function ScanPage() {
  const navigate = useNavigate();
  const { t } = useMobileI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setOpening(true);
    setReady(false);
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t('scan.unsupported'));
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(/permission|notallowed|denied/i.test(message) ? t('scan.denied') : t('scan.failed'));
    } finally {
      setOpening(false);
    }
  }, [stopCamera, t]);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <section className="wb-scan">
      <div className="wb-scan__stage">
        <video ref={videoRef} className="wb-scan__video" playsInline muted autoPlay />
        {!ready ? <div className="wb-scan__loading">{opening ? t('scan.loading') : t('scan.hint')}</div> : null}
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
      {error ? <p className="wb-scan__error" role="status">{error}</p> : null}
      <div className="wb-scan__toolbar">
        <button type="button" className="wb-scan__tool" onClick={() => void startCamera()}>{ready ? t('scan.retry') : t('scan.openCamera')}</button>
        <label className="wb-scan__tool wb-scan__tool--file">
          {t('scan.album')}
          <input type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
            if (event.target.files?.[0]) setError(t('scan.imageSelected'));
          }} />
        </label>
        <button type="button" className="wb-scan__tool" onClick={() => navigate('/home')}>{t('scan.close')}</button>
      </div>
    </section>
  );
}
