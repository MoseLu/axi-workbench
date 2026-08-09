import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Space, message } from 'antd';
import { AxiTableGroup } from '@axi/crud';
import { useNavigate } from 'react-router-dom';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import './Scan.css';

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorInstance = { detect: (source: HTMLImageElement | HTMLVideoElement) => Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

function getBarcodeDetector() {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

/** Web 通用识别工具：仅识别、展示和复制结果，不承担审批授权。 */
const Scan: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionTimerRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [detectorAvailable] = useState(() => Boolean(getBarcodeDetector()));

  const stopDetection = useCallback(() => {
    if (detectionTimerRef.current !== null) window.clearInterval(detectionTimerRef.current);
    detectionTimerRef.current = null;
    detectingRef.current = false;
  }, []);

  const stopCamera = useCallback(() => {
    stopDetection();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopDetection]);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    const BarcodeDetector = getBarcodeDetector();
    if (!BarcodeDetector) return;
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    stopDetection();
    detectionTimerRef.current = window.setInterval(() => {
      if (detectingRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      detectingRef.current = true;
      void detector.detect(video)
        .then((codes) => {
          const value = codes.find((code) => code.rawValue)?.rawValue;
          if (value) {
            setResult(value);
            stopDetection();
          }
        })
        .catch(() => undefined)
        .finally(() => {
          detectingRef.current = false;
        });
    }, 500);
  }, [stopDetection]);

  const startCamera = useCallback(async () => {
    setError('');
    setOpening(true);
    setReady(false);
    setTorchOn(false);
    setResult(null);
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('当前浏览器不支持摄像头访问。');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
        startDetection(videoRef.current);
      }
    } catch (caught: unknown) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      setError(/Permission|NotAllowed|denied/i.test(reason) ? '未获得摄像头权限，请在浏览器设置中允许后重试。' : `无法打开摄像头：${reason}`);
    } finally {
      setOpening(false);
    }
  }, [startDetection, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
    if (!capabilities?.torch) {
      setError('当前摄像头不支持闪光灯控制。');
      return;
    }
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setError('闪光灯切换失败。');
    }
  };

  const pickImage = async (file?: File | null) => {
    if (!file) return;
    const BarcodeDetector = getBarcodeDetector();
    if (!BarcodeDetector) {
      setError('当前浏览器不支持图片中的二维码识别。');
      return;
    }
    setError('');
    setResult(null);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const codes = await new BarcodeDetector({ formats: ['qr_code'] }).detect(image);
      const value = codes.find((code) => code.rawValue)?.rawValue;
      if (value) setResult(value);
      else setError('未在所选图片中识别到二维码。');
    } catch {
      setError('图片读取或二维码识别失败。');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      message.success('识别结果已复制');
    } catch {
      setError('无法复制识别结果。');
    }
  };

  return (
    <DesktopCrudFrame
      ariaLabel="通用识别与结果处理"
      className="wb-scan"
      toolbar={(
        <Space size={8}>
          <Button disabled={!ready} size="small" onClick={() => void toggleTorch()}>{torchOn ? '关闭闪光灯' : '闪光灯'}</Button>
          <Button size="small" onClick={() => fileRef.current?.click()}>识别图片</Button>
          <Button size="small" type="primary" onClick={() => void startCamera()}>{ready ? '重新打开' : '打开摄像头'}</Button>
          <Button size="small" onClick={() => navigate('/admin/dashboard')}>关闭</Button>
        </Space>
      )}
      top={<span className="wb-crud-page__context">通用识别</span>}
    >
      <input
        ref={fileRef}
        accept="image/*"
        hidden
        id="axi-general-recognition-file"
        name="generalRecognitionFile"
        type="file"
        onChange={(event) => {
          void pickImage(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {error ? <Alert className="wb-scan__alert" message={error} showIcon type="warning" /> : null}
      {result ? <Alert action={<Button size="small" type="link" onClick={() => void copyResult()}>复制</Button>} className="wb-scan__alert" description={result} message="已识别结果" showIcon type="success" /> : null}
      <AxiTableGroup description={detectorAvailable ? '可识别二维码并展示、复制或转交结果；不产生审批授权。' : '当前浏览器仅支持摄像头预览；不产生审批授权。'} title="通用识别取景区">
        <div className="wb-scan__stage">
          <video autoPlay className="wb-scan__video" muted playsInline ref={videoRef} />
          {opening ? <div className="wb-scan__loading">正在打开摄像头…</div> : null}
          {!opening && !ready && !error ? <div className="wb-scan__loading">点击“打开摄像头”开始识别</div> : null}
          <div aria-hidden className="wb-scan__mask">
            <div className="wb-scan__frame">
              <span className="wb-scan__corner tl" />
              <span className="wb-scan__corner tr" />
              <span className="wb-scan__corner bl" />
              <span className="wb-scan__corner br" />
              <div className="wb-scan__line" />
            </div>
          </div>
          <p className="wb-scan__hint">将待识别二维码放入取景区</p>
        </div>
      </AxiTableGroup>
    </DesktopCrudFrame>
  );
};

export default Scan;
