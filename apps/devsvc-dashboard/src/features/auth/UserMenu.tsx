import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, LogOut, Pencil, Upload, UserRound, X } from "lucide-react";

import { AxiPopoverMenu } from "@axi/crud";
import { adminUsername, readAvatarFile, type AuthUser } from "./auth";

export function UserMenu({
  user,
  onAvatarChange,
  onLogout
}: {
  user: AuthUser;
  onAvatarChange: (avatarDataUrl: string) => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const displayName = user.displayName === adminUsername ? t("管理员") : user.displayName;
  const avatarNode = (iconSize: number) =>
    user.avatarDataUrl ? <img className="user-avatar-img" src={user.avatarDataUrl} alt="" /> : <UserRound size={iconSize} />;

  function closeMenu() {
    setOpen(false);
  }

  async function changeAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      onAvatarChange(await readAvatarFile(file));
      closeMenu();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t("头像读取失败"));
    }
  }

  const popoverContent = (
    <div className="user-menu-popover">
      <div className="user-menu-profile">
        <div className="user-menu-avatar-wrap">
          <button
            className="user-menu-avatar-tile"
            type="button"
            aria-label={t("预览头像")}
            onClick={() => {
              closeMenu();
              setPreviewOpen(true);
            }}
          >
            {avatarNode(22)}
          </button>
          <button
            className="user-menu-avatar-edit"
            type="button"
            aria-label={t("更换头像")}
            onClick={(event) => {
              event.stopPropagation();
              avatarInputRef.current?.click();
            }}
          >
            <Pencil size={11} />
          </button>
        </div>
        <div className="user-menu-profile-copy">
          <strong>{displayName}</strong>
          <span>team@cool-js.com</span>
        </div>
      </div>
      <div className="user-menu-actions">
        <button className="user-menu-action" type="button" onClick={closeMenu}>
          <UserRound size={15} />
          <span>{t("个人中心")}</span>
        </button>
        <button className="user-menu-action" type="button" onClick={() => {
          closeMenu();
          onLogout();
        }}>
          <LogOut size={15} />
          <span>{t("退出登录")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="user-menu">
      <input ref={avatarInputRef} className="user-avatar-input" type="file" accept="image/*" onChange={changeAvatar} />
      <AxiPopoverMenu
        content={popoverContent}
        open={open}
        rootClassName="user-popover-root"
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}
      >
        <button className="user-trigger" type="button" aria-expanded={open}>
          <span className="user-name">{displayName}</span>
          <span className="user-avatar">
            {avatarNode(18)}
          </span>
        </button>
      </AxiPopoverMenu>
      {previewOpen ? (
        <div
          className="avatar-preview-layer"
          role="presentation"
          onMouseDown={() => {
            setPreviewOpen(false);
          }}
        >
          <div
            className="avatar-preview-viewer"
            role="dialog"
            aria-modal="true"
            aria-label={t("头像预览")}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <header className="avatar-preview-header">
              <span>
                <ImageIcon size={14} />
	                {t("头像预览")}
              </span>
	              <button type="button" aria-label={t("关闭头像预览")} onClick={() => setPreviewOpen(false)}>
                <X size={15} />
              </button>
            </header>
            <div className="avatar-preview-body">
              <div className="avatar-preview-image">{avatarNode(42)}</div>
              <button className="avatar-preview-change" type="button" onClick={() => avatarInputRef.current?.click()}>
                <Upload size={14} />
	                <span>{t("更换头像")}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
