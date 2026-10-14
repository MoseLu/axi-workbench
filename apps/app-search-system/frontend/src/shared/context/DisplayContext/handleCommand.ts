/**
 * handleCommand — SSE 命令派发。
 *
 * 原 DisplayProvider 内部的 handleCommand 抽到本文件；
 * 通过参数注入 setCurrentImage/setCurrentJob/setIsFullscreen/reportStatus 等副作用，
 * 不修改业务逻辑。
 */
import apiClient from '../../api/client';
import { downloadAndApplyBundle } from '../../../services/ota.service';

export interface DispatchCommandArgs {
  cmd: SSECommand;
  currentImage: string | null;
  currentJob: string | null;
  setCurrentImage: (value: string | null) => void;
  setCurrentJob: (value: string | null) => void;
  setIsFullscreen: (value: boolean) => void;
  reportStatus: (isFullscreen: boolean, imagePath?: string, jobName?: string) => Promise<void>;
  setPendingUpdate: (value: OtaUpdate | null) => void;
}

export function dispatchCommand({
  cmd,
  currentImage,
  currentJob,
  setCurrentImage,
  setCurrentJob,
  setIsFullscreen,
  reportStatus,
  setPendingUpdate,
}: DispatchCommandArgs): void {
  console.log('[Display] handleCommand:', cmd.type, cmd.payload);
  switch (cmd.type) {
    case 'show_image':
      // 如果当前已有图片在显示（用户正在浏览），忽略 restore 命令避免覆盖
      if (!cmd.payload?.image_url && !cmd.payload?.pdf_url && !cmd.payload?.image_path) {
        // 空命令 → 只有在当前无显示时才做 restore
        if (!currentImage && !currentJob) break;
      }
      handleShowImagePayload({
        payload: cmd.payload,
        setCurrentImage,
        setCurrentJob,
        setIsFullscreen,
        reportStatus,
      });
      break;
    case 'show_job':
      if (cmd.payload?.job_name) {
        setCurrentJob(cmd.payload.job_name);
        setCurrentImage(null);
        reportStatus(true, '', cmd.payload.job_name);
      }
      break;
    case 'set_fullscreen':
      setIsFullscreen(true);
      document.documentElement.requestFullscreen?.().catch(() => {});
      reportStatus(true, currentImage || '', currentJob || '');
      break;
    case 'exit_fullscreen':
      setIsFullscreen(false);
      setCurrentImage(null);
      setCurrentJob(null);
      document.exitFullscreen?.().catch(() => {});
      reportStatus(false, '', '');
      break;
    case 'clear':
      setCurrentImage(null);
      setCurrentJob(null);
      setIsFullscreen(false);
      reportStatus(false, '', '');
      break;

    case 'bundle_update': {
      // 收到服务器广播的热更新命令：自动下载并应用新 bundle，无需用户确认
      const bundlePayload = cmd.payload as { version?: string; displayVersion?: string; downloadUrl?: string } | undefined;
      if (bundlePayload?.version && bundlePayload?.downloadUrl) {
        const fullUrl = bundlePayload.downloadUrl.startsWith('http')
          ? bundlePayload.downloadUrl
          : `${apiClient.baseURL}${bundlePayload.downloadUrl}`;
        const displayVer = bundlePayload.displayVersion || bundlePayload.version;
        console.log(`[BundleOTA] 收到 bundle_update 命令，显示版本: ${displayVer}`);
        // 保存版本到 localStorage，reload 后 getLocalBundleVersion 可读到正确版本
        localStorage.setItem('__bundle_version__', bundlePayload.version);
        // 异步下载应用，不阻塞当前渲染；成功/失败后均清除 pendingUpdate 避免重复弹窗
        downloadAndApplyBundle(fullUrl, bundlePayload.version)
          .then(() => {
            setPendingUpdate(null);
            console.log('[BundleOTA] bundle_update 命令执行完成，pendingUpdate 已清除');
          })
          .catch(e => {
            console.error('[BundleOTA] 自动应用失败:', e);
          });
      }
      break;
    }

    default:
      break;
  }
}

interface ShowImagePayload {
  image_url?: string;
  image_path?: string;
  pdf_url?: string;
  pdf_path?: string;
  pdf_name?: string;
  job_name?: string;
  pages?: Array<{ image_url?: string; image_path?: string; page_num?: number }>;
  initial_page_index?: number;
  category?: string;
  machine?: string;
  process?: string;
}

function handleShowImagePayload({
  payload,
  setCurrentImage,
  setCurrentJob,
  setIsFullscreen,
  reportStatus,
}: {
  payload: ShowImagePayload | undefined;
  setCurrentImage: (value: string | null) => void;
  setCurrentJob: (value: string | null) => void;
  setIsFullscreen: (value: boolean) => void;
  reportStatus: (isFullscreen: boolean, imagePath?: string, jobName?: string) => Promise<void>;
}): void {
  const hasRenderablePages = !!payload?.pages?.some(page => page.image_url || page.image_path);
  if (payload?.pages && payload.pages.length > 0 && hasRenderablePages) {
    const jobName: string = payload.job_name || '';
    const pages = payload.pages.map(page => ({
      image_url: page.image_url || '',
      image_path: page.image_path || '',
      page_num: page.page_num || 0,
    }));
    const requestedInitialPageIndex = typeof payload.initial_page_index === 'number'
      ? payload.initial_page_index
      : 0;
    const initialPageIndex = Math.min(Math.max(requestedInitialPageIndex, 0), pages.length - 1);
    const initialPage = pages[initialPageIndex] || pages[0];
    const initialImage = initialPage.image_url || initialPage.image_path || payload.image_url || payload.image_path || '';
    console.log('[Display] 收到多页 SOP 推送:', jobName, pages.length);
    setCurrentImage(initialImage);
    setCurrentJob(jobName);
    setIsFullscreen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
    reportStatus(true, initialImage, jobName);
    window.dispatchEvent(new CustomEvent('sop:showPages', {
      detail: {
        pages,
        initialPageIndex,
        jobName,
        pdfUrl: payload.pdf_url || '',
        pdfPath: payload.pdf_path || '',
        pdfName: payload.pdf_name || '',
        category: payload.category || '',
        machine: payload.machine || '',
        process: payload.process || '',
      },
    }));
    return;
  }
  if (payload?.image_url) {
    // 图片推送（image_url 为完整相对路径，如 /api/image-file?...）
    const imgUrl: string = payload.image_url;
    const jobName: string = payload.job_name || '';
    console.log('[Display] 收到图片推送:', imgUrl, jobName);
    setCurrentImage(imgUrl);
    setCurrentJob(jobName);
    setIsFullscreen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
    reportStatus(true, imgUrl, jobName);
    return;
  }
  if (payload?.pdf_url) {
    // PDF 兜底：下载后用 blob URL 在 iframe 中全屏展示
    const pdfUrl: string = payload.pdf_url;
    const jobName: string = payload.job_name || '';
    const baseURL = apiClient.baseURL;
    const fullUrl = pdfUrl.startsWith('http')
      ? pdfUrl
      : `${baseURL}${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`;
    setCurrentJob(jobName);
    setCurrentImage(null);
    setIsFullscreen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
    reportStatus(true, '', jobName);
    // 通知 DisplayApp 显示 PDF 全屏
    window.dispatchEvent(new CustomEvent('sop:showPdf', {
      detail: {
        pdfUrl: fullUrl,
        jobName,
        pdfPath: payload.pdf_path || '',
        pdfName: payload.pdf_name || '',
        category: payload.category || '',
        machine: payload.machine || '',
        process: payload.process || '',
      },
    }));
    return;
  }
  if (payload?.image_path) {
    setCurrentImage(payload.image_path);
    setCurrentJob(payload.job_name || '');
    setIsFullscreen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
    reportStatus(true, payload.image_path, payload.job_name || '');
  }
}