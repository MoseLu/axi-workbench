import { useEffect, useMemo, useState } from "react";
import { Monitor, Minus, Plus, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SideNav } from "./components/layout/SideNav";
import { isHostedBrowser } from "./hosted";
import { AccountsPage } from "./pages/AccountsPage";
import {
  beginOutlookAuthorization,
  completeOutlookAuthorization,
  listAccounts,
  receiveCode,
} from "./services/imap";
import type {
  AccountListPayload,
  CodeAccount,
  RowState,
} from "./types";

type NotificationKind = "success" | "error" | "info";
type ScrollbarState = {
  visible: boolean;
  thumbHeight: number;
  thumbTop: number;
};

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

function App() {
  const [data, setData] = useState<AccountListPayload | null>(null);
  const [filter, setFilter] = useState("all");
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [notification, setNotification] = useState<{
    message: string;
    kind: NotificationKind;
  } | null>(null);
  const [scrollbar, setScrollbar] = useState<ScrollbarState>({
    visible: false,
    thumbHeight: 100,
    thumbTop: 0,
  });
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);

  const accounts = useMemo(() => data?.accounts ?? [], [data]);

  async function refreshAccounts() {
    try {
      const payload = await listAccounts();
      setData(payload);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : String(err), "error");
    }
  }

  useEffect(() => {
    void refreshAccounts();
  }, []);

  useEffect(() => {
    if (isHostedBrowser) return;
    void getCurrentWindow().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(() => setNotification(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  function showNotification(message: string, kind: NotificationKind = "info") {
    setNotification({ message, kind });
  }

  async function handleReceive(account: CodeAccount) {
    if (!account.available) {
      showNotification("该账号没有接码凭据", "error");
      return;
    }
    setRowStates((current) => ({
      ...current,
      [account.id]: {
        busy: true,
        code: "",
        statusLabel: "等待新验证码...",
        statusKind: "info",
        message: null,
      },
    }));

    try {
      const result = await receiveCode(account.id);
      setRowStates((current) => ({
        ...current,
        [account.id]: {
          busy: false,
          code: result.code,
          statusLabel: result.statusLabel,
          statusKind: result.statusKind,
          message: result.message,
        },
      }));
      showNotification(result.statusLabel, result.statusKind === "ok" ? "success" : "error");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRowStates((current) => ({
        ...current,
        [account.id]: {
          busy: false,
          code: "",
          statusLabel: message.slice(0, 120),
          statusKind: "bad",
          message: null,
        },
      }));
      showNotification(message, "error");
    }
  }

  async function handleAuthorize(account: CodeAccount) {
    if (!account.canAuthorize) {
      showNotification("该账号不支持自动授权", "error");
      return;
    }
    setRowStates((current) => ({
      ...current,
      [account.id]: {
        busy: true,
        code: "",
        statusLabel: "正在打开 Microsoft 授权...",
        statusKind: "info",
        message: null,
      },
    }));

    try {
      const begin = await beginOutlookAuthorization(account.id);
      if (begin.status !== "pending") {
        throw new Error(begin.statusLabel);
      }
      const email = begin.email;
      const clientId = begin.clientId;
      const deviceCode = begin.deviceCode;
      const userCode = begin.userCode ?? "";
      if (!email || !clientId || !deviceCode || !userCode) {
        throw new Error("Microsoft 授权会话信息不完整");
      }
      const authorizationLabel = `授权代码：${userCode}`;

      setRowStates((current) => ({
        ...current,
        [account.id]: {
          busy: true,
          code: userCode,
          statusLabel: authorizationLabel,
          statusKind: begin.statusKind,
          message: null,
        },
      }));
      showNotification(`输入授权码 ${userCode}`, "info");
      await waitForNextPaint();

      const complete = await completeOutlookAuthorization({
        email,
        clientId,
        deviceCode,
        interval: begin.interval ?? 5,
        expiresIn: begin.expiresIn ?? 900,
      });
      if (complete.status !== "done") {
        throw new Error(complete.statusLabel);
      }
      setRowStates((current) => ({
        ...current,
        [account.id]: {
          busy: false,
          code: "",
          statusLabel: complete.statusLabel,
          statusKind: complete.statusKind,
          message: null,
        },
      }));
      await refreshAccounts();
      showNotification(complete.statusLabel, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRowStates((current) => ({
        ...current,
        [account.id]: {
          busy: false,
          code: current[account.id]?.code ?? "",
          statusLabel: message.slice(0, 120),
          statusKind: "bad",
          message: null,
        },
      }));
      showNotification(message, "error");
    }
  }

  async function handleCopy(value: string, label: string) {
    if (!value) {
      showNotification(`${label}为空`, "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      showNotification(`${label}已复制`, "success");
    } catch (err) {
      showNotification(err instanceof Error ? err.message : "复制失败", "error");
    }
  }

  return (
    <div className="app-container">
      <div className="drag-region" data-tauri-drag-region />
      {isHostedBrowser ? null : <WindowControls />}
      <SideNav filter={filter} onFilterChange={setFilter} />

      <div className="main-wrapper">
        {notification ? (
          <div className={`app-notification is-${notification.kind}`} role="status">
            {notification.message}
          </div>
        ) : null}
        {profilePanelOpen ? (
          <div
            className="profile-modal-backdrop"
            role="presentation"
            onClick={() => setProfilePanelOpen(false)}
          >
            <section
              className="profile-modal"
              role="dialog"
              aria-modal="true"
              aria-label="个人信息"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => setProfilePanelOpen(false)}
                aria-label="关闭个人信息"
              >
                <X size={16} />
              </button>
              <div className="profile-modal-icon" aria-hidden="true">
                <ProfileInfoIcon />
              </div>
              <div className="profile-modal-title">个人信息</div>
              <dl className="profile-fields">
                <div>
                  <dt>用户名</dt>
                  <dd>
                    <button
                      type="button"
                      className="profile-value"
                      onClick={() => handleCopy("Mose", "用户名")}
                    >
                      Mose
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>年龄</dt>
                  <dd>
                    <button
                      type="button"
                      className="profile-value"
                      onClick={() => handleCopy("35", "年龄")}
                    >
                      35
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>统一邮箱</dt>
                  <dd>
                    <button
                      type="button"
                      className="profile-value"
                      onClick={() => handleCopy("1208136885@qq.com", "统一邮箱")}
                    >
                      1208136885@qq.com
                    </button>
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        ) : null}

        <AccountsPage
          accounts={accounts}
          rowStates={rowStates}
          filter={filter}
          onReceive={handleReceive}
          onAuthorize={handleAuthorize}
          onCopy={handleCopy}
          onScrollbarChange={setScrollbar}
        />
        <button
          type="button"
          className="profile-fab"
          onClick={() => setProfilePanelOpen(true)}
          title="个人信息"
          aria-label="个人信息"
        >
          <ProfileInfoIcon />
        </button>
      </div>
      {scrollbar.visible ? (
        <div className="app-scrollbar-track" aria-hidden="true">
          <div
            className="app-scrollbar-thumb"
            style={{
              height: `${scrollbar.thumbHeight}%`,
              top: `${scrollbar.thumbTop}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function WindowControls() {
  const appWindow = getCurrentWindow();

  return (
    <div className="window-controls" aria-label="窗口控制">
      <button
        type="button"
        className="window-control close"
        onClick={() => void appWindow.close()}
        aria-label="关闭窗口"
      >
        <X size={10} strokeWidth={3} />
      </button>
      <button
        type="button"
        className="window-control minimize"
        onClick={() => void appWindow.minimize()}
        aria-label="最小化"
      >
        <Minus size={11} strokeWidth={3} />
      </button>
      <div className="window-control-wrap">
        <button
          type="button"
          className="window-control zoom"
          onClick={() => void appWindow.toggleMaximize()}
          aria-label="缩放窗口"
          aria-haspopup="menu"
        >
          <Plus size={11} strokeWidth={3} />
        </button>
        <div className="window-zoom-menu" role="menu" aria-label="缩放选项">
          <div className="window-zoom-section-title">移动与调整大小</div>
          <div className="window-zoom-grid">
            <button
              type="button"
              className="window-zoom-tile active"
              onClick={() => void appWindow.toggleMaximize()}
              aria-label="缩放窗口"
            >
              <span className="zoom-icon zoom-left" />
            </button>
            <button type="button" className="window-zoom-tile" aria-label="靠右显示">
              <span className="zoom-icon zoom-right" />
            </button>
            <button type="button" className="window-zoom-tile" aria-label="置顶显示">
              <span className="zoom-icon zoom-top" />
            </button>
            <button type="button" className="window-zoom-tile" aria-label="置底显示">
              <span className="zoom-icon zoom-bottom" />
            </button>
          </div>

          <div className="window-zoom-divider" />
          <div className="window-zoom-section-title">填充与排列</div>
          <div className="window-zoom-grid">
            <button
              type="button"
              className="window-zoom-tile"
              onClick={() => void appWindow.toggleMaximize()}
              aria-label="填充"
            >
              <span className="zoom-icon zoom-fill" />
            </button>
            <button type="button" className="window-zoom-tile" aria-label="左侧排列">
              <span className="zoom-icon zoom-split-left" />
            </button>
            <button type="button" className="window-zoom-tile" aria-label="右侧排列">
              <span className="zoom-icon zoom-split-right" />
            </button>
            <button type="button" className="window-zoom-tile" aria-label="四分屏排列">
              <span className="zoom-icon zoom-quarters" />
            </button>
          </div>

          <div className="window-zoom-divider" />
          <button type="button" className="window-zoom-display" aria-label="移到内建视网膜显示器">
            <Monitor size={13} />
            <span>移到“内建视网膜显示器”</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileInfoIcon() {
  return (
    <svg
      className="profile-info-icon"
      viewBox="0 0 1024 1024"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M352.256 550.4c-65.792 0-119.296-53.504-119.296-119.296s53.504-119.296 119.296-119.296c65.792 0 119.296 53.504 119.296 119.296S418.048 550.4 352.256 550.4z m0-177.408c-32 0-57.856 26.112-57.856 57.856s26.112 57.856 57.856 57.856 57.856-26.112 57.856-57.856-25.856-57.856-57.856-57.856z"
        fill="currentColor"
      />
      <path
        d="M506.368 704.512c-16.896 0-30.72-13.824-30.72-30.72 0-68.096-55.296-123.392-123.392-123.392s-123.392 55.296-123.392 123.392c0 16.896-13.824 30.72-30.72 30.72s-30.72-13.824-30.72-30.72c0-101.888 82.944-184.832 184.832-184.832 101.888 0 184.832 82.944 184.832 184.832 0 16.896-13.824 30.72-30.72 30.72zM820.48 403.712h-209.664c-16.896 0-30.72-13.824-30.72-30.72s13.824-30.72 30.72-30.72h209.664c16.896 0 30.72 13.824 30.72 30.72s-13.824 30.72-30.72 30.72zM820.48 539.392h-209.664c-16.896 0-30.72-13.824-30.72-30.72s13.824-30.72 30.72-30.72h209.664c16.896 0 30.72 13.824 30.72 30.72s-13.824 30.72-30.72 30.72zM820.48 675.072h-209.664c-16.896 0-30.72-13.824-30.72-30.72s13.824-30.72 30.72-30.72h209.664c16.896 0 30.72 13.824 30.72 30.72s-13.824 30.72-30.72 30.72z"
        fill="currentColor"
      />
      <path
        d="M883.456 872.448H147.456c-56.576 0-102.4-45.824-102.4-102.4V252.16c0-56.576 45.824-102.4 102.4-102.4h736c56.576 0 102.4 45.824 102.4 102.4v517.888c0 56.32-45.824 102.4-102.4 102.4zM147.456 211.2c-22.528 0-40.96 18.432-40.96 40.96v517.888c0 22.528 18.432 40.96 40.96 40.96h736c22.528 0 40.96-18.432 40.96-40.96V252.16c0-22.528-18.432-40.96-40.96-40.96H147.456z"
        fill="currentColor"
      />
    </svg>
  );
}

export default App;
