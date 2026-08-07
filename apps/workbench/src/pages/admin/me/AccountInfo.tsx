import React, { useEffect, useRef, useState } from 'react';
import { RightOutlined } from '@ant-design/icons';
import avatarDefault from '../../../assets/avatar-me.jpg';
import {
  loadProfile,
  phoneDisplay,
  readFileAsDataUrl,
  saveProfile,
  type UserProfile,
} from './profileStore';
import { MeGroup, MeSubPage } from './MeSubChrome';
import './AccountInfo.css';

type EditField = 'nickname' | 'email' | 'phone';

const editMeta: Record<
  EditField,
  { title: string; placeholder: string; inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'] }
> = {
  nickname: { title: '设置名字', placeholder: '请输入名字', inputMode: 'text' },
  email: { title: '设置邮箱', placeholder: 'name@example.com', inputMode: 'email' },
  phone: { title: '设置手机号', placeholder: '请输入手机号', inputMode: 'tel' },
};

const AccountInfo: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  const [editField, setEditField] = useState<EditField | null>(null);
  const [draft, setDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onChange = () => setProfile(loadProfile());
    window.addEventListener('wb-profile-changed', onChange);
    return () => window.removeEventListener('wb-profile-changed', onChange);
  }, []);

  useEffect(() => {
    if (editField) {
      // 进入三级页后聚焦输入
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [editField]);

  const openEdit = (field: EditField) => {
    setDraft(field === 'phone' ? profile.phone : profile[field]);
    setEditField(field);
  };

  const saveEdit = () => {
    if (!editField) return;
    if (editField === 'nickname') {
      const v = draft.trim();
      if (!v) {
        window.alert('名字不能为空');
        return;
      }
      setProfile(saveProfile({ nickname: v }));
    } else if (editField === 'email') {
      const v = draft.trim();
      if (v && (!v.includes('@') || !v.includes('.'))) {
        window.alert('请输入有效邮箱');
        return;
      }
      setProfile(saveProfile({ email: v }));
    } else if (editField === 'phone') {
      const v = draft.trim();
      if (v && v.length < 6) {
        window.alert('手机号格式不正确');
        return;
      }
      setProfile(saveProfile({ phone: v }));
    }
    setEditField(null);
  };

  const onPickAvatar = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('请选择图片文件');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfile(saveProfile({ avatarDataUrl: dataUrl }));
    } catch {
      window.alert('头像读取失败');
    }
  };

  const avatarSrc = profile.avatarDataUrl || avatarDefault;

  // 微信式三级全屏编辑页（非弹窗）
  if (editField) {
    const meta = editMeta[editField];
    const initial =
      editField === 'phone' ? profile.phone : profile[editField];
    const dirty = draft !== initial;
    const canSave =
      editField === 'nickname' ? dirty && draft.trim().length > 0 : dirty;
    return (
      <MeSubPage
        title={meta.title}
        onBack={() => setEditField(null)}
        trailing={
          <button
            type="button"
            className={`wb-account__done${canSave ? ' is-enabled' : ''}`}
            disabled={!canSave}
            onClick={saveEdit}
          >
            完成
          </button>
        }
      >
        <div className="wb-account__edit-row">
          <input
            ref={inputRef}
            className="wb-account__edit-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode={meta.inputMode}
            placeholder={meta.placeholder}
          />
          {draft ? (
            <button
              type="button"
              className="wb-account__edit-clear"
              aria-label="清除"
              onClick={() => setDraft('')}
            >
              ×
            </button>
          ) : null}
        </div>
      </MeSubPage>
    );
  }

  return (
    <MeSubPage title="个人信息">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          onPickAvatar(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <MeGroup>
        <button type="button" className="wb-account__avatar-row" onClick={() => fileRef.current?.click()}>
          <span>头像</span>
          <span className="wb-account__avatar-trail">
            <img className="wb-account__avatar" src={avatarSrc} alt="头像" />
            <RightOutlined style={{ fontSize: 'var(--text-sm)', color: 'var(--color-chevron)' }} />
          </span>
        </button>
        <button type="button" className="wb-me-sub__row has-divider" onClick={() => openEdit('nickname')}>
          <span>昵称</span>
          <span className="wb-me-sub__value">
            {profile.nickname}
            <RightOutlined style={{ fontSize: 'var(--text-sm)', color: 'var(--color-chevron)' }} />
          </span>
        </button>
        <button type="button" className="wb-me-sub__row has-divider" onClick={() => openEdit('email')}>
          <span>邮箱</span>
          <span className="wb-me-sub__value">
            {profile.email}
            <RightOutlined style={{ fontSize: 'var(--text-sm)', color: 'var(--color-chevron)' }} />
          </span>
        </button>
        <button type="button" className="wb-me-sub__row has-divider" onClick={() => openEdit('phone')}>
          <span>手机号</span>
          <span className="wb-me-sub__value">
            {phoneDisplay(profile.phone)}
            <RightOutlined style={{ fontSize: 'var(--text-sm)', color: 'var(--color-chevron)' }} />
          </span>
        </button>
      </MeGroup>

      <MeGroup>
        <div className="wb-me-sub__row is-static has-divider">
          <span>WorkBench ID</span>
          <span className="wb-me-sub__value">{profile.workbenchId}</span>
        </div>
        <div className="wb-me-sub__row is-static has-divider">
          <span>注册时间</span>
          <span className="wb-me-sub__value">{profile.registeredAt}</span>
        </div>
        <div className="wb-me-sub__row is-static has-divider">
          <span>账号状态</span>
          <span className="wb-me-sub__value">{profile.status}</span>
        </div>
      </MeGroup>
    </MeSubPage>
  );
};

export default AccountInfo;
