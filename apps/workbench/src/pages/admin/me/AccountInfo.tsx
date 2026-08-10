import React, { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, Form, Input, message } from 'antd';
import { AxiSvgIcon } from '@axi/core';
import { useAuth } from '../../../contexts/AuthContext';
import { useI18n } from '../../../i18n';
import {
  loadProfile,
  readFileAsDataUrl,
  resolveAvatarSrc,
  saveProfile,
  type UserProfile,
} from './profileStore';
import './AccountInfo.css';

/**
 * Cool Admin-style personal information form.
 *
 * Authentication is email-code based in Workbench, so the login email is
 * intentionally read-only here. Editable fields are Workbench profile
 * presentation data and are persisted through the existing profile store.
 */
const AccountInfo: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile(user));
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarDataUrl, setAvatarDataUrl] = useState(profile.avatarDataUrl);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarPreviewTriggerRef = useRef<HTMLButtonElement>(null);
  const avatarPreviewCloseRef = useRef<HTMLButtonElement>(null);
  const avatarPreviewDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => {
      const next = loadProfile(user);
      setProfile(next);
      setNickname(next.nickname);
      setAvatarDataUrl(next.avatarDataUrl);
    };

    onChange();
    window.addEventListener('wb-profile-changed', onChange);
    return () => window.removeEventListener('wb-profile-changed', onChange);
  }, [user]);

  const onPickAvatar = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error(t('account.avatar.invalidType'));
      return;
    }

    try {
      setAvatarDataUrl(await readFileAsDataUrl(file));
    } catch {
      message.error(t('account.avatar.readFailed'));
    }
  };

  const closeAvatarPreview = useCallback(() => {
    setAvatarPreviewOpen(false);
    window.requestAnimationFrame(() => avatarPreviewTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!avatarPreviewOpen) return;

    const frame = window.requestAnimationFrame(() => avatarPreviewCloseRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeAvatarPreview();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [avatarPreviewOpen, closeAvatarPreview]);

  const onPreviewKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      avatarPreviewDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const save = () => {
    const nextNickname = nickname.trim();
    if (!nextNickname) {
      message.error(t('account.nickname.required'));
      return;
    }

    const next = saveProfile({ nickname: nextNickname, avatarDataUrl }, user);
    setProfile(next);
    setNickname(next.nickname);
    setAvatarDataUrl(next.avatarDataUrl);
    message.success(t('account.saveSuccess'));
  };

  return (
    <main aria-labelledby="wb-account-page-title" className="wb-account-page">
      <section className="wb-account-page__panel">
        <h1 id="wb-account-page-title">{t('account.title')}</h1>

        <Form className="wb-account-page__form" layout="vertical" onFinish={save}>
          <Form.Item label={t('account.avatar.label')}>
            <div className="wb-account-page__avatar-field">
              <button
                aria-haspopup="dialog"
                aria-label={t('account.avatar.preview')}
                className="wb-account-page__avatar-preview-trigger"
                ref={avatarPreviewTriggerRef}
                title={t('account.avatar.preview')}
                type="button"
                onClick={() => setAvatarPreviewOpen(true)}
              >
                <img alt={t('account.avatar.alt')} className="wb-account-page__avatar" src={resolveAvatarSrc(avatarDataUrl)} />
              </button>
              <Button type="default" onClick={() => fileRef.current?.click()}>
                {t('account.avatar.pick')}
              </Button>
              <input
                ref={fileRef}
                accept="image/*"
                aria-label={t('account.avatar.fileAriaLabel')}
                className="wb-account-page__file-input"
                type="file"
                onChange={(event) => {
                  void onPickAvatar(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </div>
          </Form.Item>

          <Form.Item
            label={t('account.nickname.label')}
            required
            rules={[{ message: t('account.nickname.required'), required: true }]}
          >
            <Input
              autoComplete="nickname"
              placeholder={t('account.nickname.placeholder')}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </Form.Item>

          <Form.Item extra={t('account.email.hint')} label={t('account.email.label')}>
            <Input autoComplete="email" readOnly value={profile.email || t('account.email.unbound')} />
          </Form.Item>

          <Form.Item>
            <Button htmlType="submit" type="primary">
              {t('account.submit')}
            </Button>
          </Form.Item>
        </Form>
      </section>

      {avatarPreviewOpen && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="axi-dashboard-avatar-preview-layer"
            role="presentation"
            onMouseDown={closeAvatarPreview}
          >
            <div
              aria-label={t('account.avatar.previewTitle')}
              aria-modal="true"
              className="axi-dashboard-avatar-preview-viewer"
              ref={avatarPreviewDialogRef}
              role="dialog"
              onKeyDown={onPreviewKeyDown}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="axi-dashboard-avatar-preview-header">
                <button
                  aria-label={t('account.avatar.previewClose')}
                  ref={avatarPreviewCloseRef}
                  type="button"
                  onClick={closeAvatarPreview}
                >
                  <AxiSvgIcon name="close" size={15} />
                </button>
              </header>
              <div className="axi-dashboard-avatar-preview-body">
                <div className="axi-dashboard-avatar-preview-image">
                  <img alt={t('account.avatar.alt')} src={resolveAvatarSrc(avatarDataUrl)} />
                </div>
                <button
                  className="axi-dashboard-avatar-preview-change"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                >
                  <AxiSvgIcon name="upload" size={14} />
                  <span>{t('account.avatar.pick')}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </main>
  );
};

export default AccountInfo;
