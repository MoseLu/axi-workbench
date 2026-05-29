/**
 * 全局类型声明
 */

// 全局接口（不需要 import 即可使用）
declare global {
  interface ElectronAPI {
    minimizeWindow?: () => void;
    maximizeWindow?: () => Promise<void>;
    closeWindow?: () => void;
    isMaximized?: () => Promise<boolean>;
    onMaximizeChange?: (callback: (isMax: boolean) => void) => (() => void) | undefined;
    getStats?: () => Promise<unknown>;
    searchHybrid?: (query: string) => Promise<unknown>;
    suggest?: (query: string, limit: number) => Promise<unknown>;
    setThemeColor?: (color: string) => void;
  }

  interface CapacitorAppPlugin {
    exitApp?: () => Promise<void>;
  }

  interface CapacitorPlugins {
    App?: CapacitorAppPlugin;
  }

  interface Window {
    electronAPI?: ElectronAPI;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: CapacitorPlugins;
      appInfo?: { version?: string };
    };
    cordova?: {
      plugins?: {
        backbutton?: { exitApp?: () => void };
      };
    };
    CAPACITOR?: boolean;
    CAPACITOR_API_URL?: string;
  }

  interface Device {
    id: number;
    uuid: string;
    display_name?: string;
    device_group?: string;
    sequence_num?: string;
    current_job?: string;
    assigned_jobs?: string;
    status?: 'offline' | 'online' | 'logged_in';
    login_status?: string;
    device_password?: string;
    latitude?: number;
    longitude?: number;
    location_updated_at?: string;
    ip_address?: string;
    last_seen?: string;
    device_info?: Record<string, unknown>;
  }

  interface SearchResult {
    id?: number | string;
    image_path?: string;
    image_url?: string;
    pdf_path?: string;
    pdf_url?: string;
    pdf_name?: string;  // 完整文件名（不含 .pdf），作为合辑展示标题
    job_name?: string;   // 从文件名提取的作业名称（去掉 .pdf 和 SOP日期后缀）
    page_num?: number;
    similarity?: number;
    category?: string;   // 分类（装配/成品包装/PA组件包装/化学品/测试）
    process?: string;    // 工序（包装/装配/测试/目检等）
    machine?: string;   // 机型（BNF/Cashbox/NV200S等，来自parent目录）
    allPages?: SearchResult[];
  }

  interface ApiResponse<T = unknown> {
    data?: T;
    error?: string;
  }

  interface LoginResult {
    token: string;
    user: User;
  }

  interface User {
    id: number;
    username: string;
    must_change_password?: boolean;
  }

  interface OtaUpdate {
    version: string;
    displayVersion?: string;
    filename?: string;
    size?: number;
    note?: string;
    downloadUrl: string;
  }

  interface CommandPayload {
    image_url?: string;
    image_path?: string;
    pdf_url?: string;
    pdf_path?: string;
    pdf_name?: string;
    job_name?: string;
    category?: string;
    process?: string;
    machine?: string;
    page_num?: number;
    initial_page_index?: number;
    total_pages?: number;
    pages?: Array<{
      image_url?: string;
      image_path?: string;
      page_num?: number;
    }>;
  }

  interface SSECommand {
    type: 'show_image' | 'show_job' | 'set_fullscreen' | 'exit_fullscreen' | 'clear' | 'bundle_update';
    payload?: CommandPayload & { version?: string; downloadUrl?: string };
  }
}

// Extend CSSProperties to support -webkit-app-region (Electron title bar drag)
type ExtendedCSSProperties = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

// 全局图片路径
declare module '*.png' {
  const value: string;
  export default value;
}
declare module '*.svg' {
  const value: string;
  export default value;
}

// Make this file a module (required for `declare global` to work)
export {};
