import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, message } from 'antd';
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onChange = () => {
      const next = loadProfile(user);
      setProfile(next);
      setNickname(next.nickname);
      setAvatarDataUrl(next.avatarDataUrl);
    };

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
              <img alt={t('account.avatar.alt')} className="wb-account-page__avatar" src={resolveAvatarSrc(avatarDataUrl)} />
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

          <Form.Item label={t('account.nickname.label')} required>
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
    </main>
  );
};

export default AccountInfo;
