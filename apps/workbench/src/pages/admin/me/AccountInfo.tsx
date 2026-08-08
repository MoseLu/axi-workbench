import React, { useEffect, useRef, useState } from 'react';
import { Button, Descriptions, Input, Space, message, type InputRef } from 'antd';
import { AxiSvgIcon } from '@axi/core';
import { AxiDialog, AxiTableGroup } from '@axi/crud';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import { useAuth } from '../../../contexts/AuthContext';
import {
  loadProfile,
  phoneDisplay,
  readFileAsDataUrl,
  saveProfile,
  type UserProfile,
} from './profileStore';
import { DesktopSettingsPage } from './DesktopSettingsPage';
import './AccountInfo.css';

type EditField = 'nickname' | 'email' | 'phone';

const editMeta: Record<
  EditField,
  { label: string; placeholder: string; inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'] }
> = {
  nickname: { label: '昵称', placeholder: '请输入昵称', inputMode: 'text' },
  email: { label: '邮箱', placeholder: 'name@example.com', inputMode: 'email' },
  phone: { label: '手机号', placeholder: '请输入手机号', inputMode: 'tel' },
};

const AccountInfo: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile(user));
  const [editField, setEditField] = useState<EditField | null>(null);
  const [draft, setDraft] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    const onChange = () => setProfile(loadProfile(user));
    window.addEventListener('wb-profile-changed', onChange);
    return () => window.removeEventListener('wb-profile-changed', onChange);
  }, [user]);

  useEffect(() => {
    if (!editField) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [editField]);

  const openEdit = (field: EditField) => {
    setDraft(field === 'phone' ? profile.phone : profile[field]);
    setEditError(null);
    setEditField(field);
  };

  const closeEdit = () => {
    setEditError(null);
    setEditField(null);
  };

  const saveEdit = () => {
    if (!editField) return;
    const value = draft.trim();
    if (editField === 'nickname' && !value) {
      setEditError('昵称不能为空');
      return;
    }
    if (editField === 'email' && value && (!value.includes('@') || !value.includes('.'))) {
      setEditError('请输入有效邮箱');
      return;
    }
    if (editField === 'phone' && value && value.length < 6) {
      setEditError('手机号格式不正确');
      return;
    }
    setProfile(saveProfile({ [editField]: value }, user));
    message.success('资料已更新');
    closeEdit();
  };

  const onPickAvatar = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfile(saveProfile({ avatarDataUrl: dataUrl }, user));
      message.success('头像已更新');
    } catch {
      message.error('头像读取失败');
    }
  };

  const editing = editField ? editMeta[editField] : null;
  const initialValue = editField ? (editField === 'phone' ? profile.phone : profile[editField]) : '';
  const canSave = Boolean(editField && draft !== initialValue && (editField !== 'nickname' || draft.trim().length > 0));

  return (
    <DesktopSettingsPage activeKey="/admin/me/account" title="账号资料">
      <input
        ref={fileRef}
        accept="image/*"
        style={{ display: 'none' }}
        type="file"
        onChange={(event) => {
          void onPickAvatar(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <AxiTableGroup title="个人资料">
        <div className="wb-account__identity">
          {profile.avatarDataUrl ? (
            <img alt="头像" className="wb-account__avatar" src={profile.avatarDataUrl} />
          ) : (
            <span aria-label="默认头像" className="wb-account__avatar wb-account__avatar--default">
              <AxiSvgIcon name={axiWorkbenchIconMap.account} size={24} />
            </span>
          )}
          <div>
            <strong>{profile.nickname}</strong>
            <span>{profile.email}</span>
          </div>
          <Button size="small" onClick={() => fileRef.current?.click()}>更新头像</Button>
        </div>
        <Descriptions column={2} colon={false} size="small">
          <Descriptions.Item label="昵称">
            <span className="wb-account__value">{profile.nickname}<Button size="small" type="link" onClick={() => openEdit('nickname')}>修改</Button></span>
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">
            <span className="wb-account__value">{profile.email}<Button size="small" type="link" onClick={() => openEdit('email')}>修改</Button></span>
          </Descriptions.Item>
          <Descriptions.Item label="手机号">
            <span className="wb-account__value">{phoneDisplay(profile.phone)}<Button size="small" type="link" onClick={() => openEdit('phone')}>修改</Button></span>
          </Descriptions.Item>
        </Descriptions>
      </AxiTableGroup>

      <AxiTableGroup title="账户状态">
        <Descriptions column={1} colon={false} size="small">
          <Descriptions.Item label="账号状态">{profile.status || '已登录'}</Descriptions.Item>
        </Descriptions>
      </AxiTableGroup>

      <AxiDialog
        closeLabel="关闭"
        controls={['close']}
        footer={(
          <Space>
            <Button onClick={closeEdit}>取消</Button>
            <Button disabled={!canSave} type="primary" onClick={saveEdit}>保存</Button>
          </Space>
        )}
        open={Boolean(editing)}
        title={editing ? `修改${editing.label}` : ''}
        width={460}
        onClose={closeEdit}
      >
        {editing ? (
          <label className="wb-account__edit-field" htmlFor="wb-account-edit-input">
            <span>{editing.label}</span>
            <Input
              id="wb-account-edit-input"
              ref={inputRef}
              inputMode={editing.inputMode}
              placeholder={editing.placeholder}
              status={editError ? 'error' : undefined}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setEditError(null);
              }}
            />
            {editError ? <small role="alert">{editError}</small> : null}
          </label>
        ) : null}
      </AxiDialog>
    </DesktopSettingsPage>
  );
};

export default AccountInfo;
