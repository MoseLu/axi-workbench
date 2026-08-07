import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Scan.css';

/**
 * 扫一扫 — 工作台内页（底栏 Tab），不是登录页。
 * Web 优先调起摄像头；无权限时支持从相册/图片识别入口占位。
 */
const Scan: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    setReady(false);
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('当前环境不支持摄像头，请使用真机 App 扫一扫，或从相册选择二维码。');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Permission|NotAllowed|denied/i.test(msg)) {
        setError('未获得摄像头权限。请在系统设置中允许后重试，或使用相册。');
      } else {
        setError(`无法打开摄像头：${msg}`);
      }
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
    if (!capabilities?.torch) {
      setError('当前设备不支持闪光灯');
      return;
    }
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setError('闪光灯切换失败');
    }
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 占位：真实解码可接 jsQR / BarcodeDetector
    setError(`已选择图片「${file.name}」。二维码解析将接入 BarcodeDetector / 原生扫码桥。`);
  }

  return (
    <div className="wb-scan">
      <div className="wb-scan__stage">
        <video ref={videoRef} className="wb-scan__video" playsInline muted autoPlay />
        {!ready && !error && <div className="wb-scan__loading">正在打开摄像头…</div>}
        <div className="wb-scan__mask" aria-hidden>
          <div className="wb-scan__frame">
            <span className="wb-scan__corner tl" />
            <span className="wb-scan__corner tr" />
            <span className="wb-scan__corner bl" />
            <span className="wb-scan__corner br" />
            <div className="wb-scan__line" />
          </div>
        </div>
        <p className="wb-scan__hint">将二维码放入框内，即可自动扫描</p>
      </div>

      {error && <div className="wb-scan__error">{error}</div>}

      <div className="wb-scan__toolbar">
        <button type="button" className="wb-scan__tool" onClick={() => void toggleTorch()}>
          {torchOn ? '关闭闪光灯' : '打开闪光灯'}
        </button>
        <label className="wb-scan__tool wb-scan__tool--file">
          相册
          <input type="file" accept="image/*" capture="environment" hidden onChange={onPickImage} />
        </label>
        <button type="button" className="wb-scan__tool" onClick={() => void startCamera()}>
          重试
        </button>
        <button type="button" className="wb-scan__tool" onClick={() => navigate('/admin/dashboard')}>
          关闭
        </button>
      </div>
    </div>
  );
};

export default Scan;
