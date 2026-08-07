import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, RightOutlined } from '@ant-design/icons';
import './MeSubLayout.css';

export function MeSubPage({
  title,
  children,
  trailing,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  /** 右侧操作，如微信「完成」 */
  trailing?: React.ReactNode;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="wb-me-sub">
      <header className="wb-me-sub__bar">
        <button
          type="button"
          className="wb-me-sub__back"
          onClick={() => (onBack ? onBack() : navigate(-1))}
          aria-label="返回"
        >
          <ArrowLeftOutlined />
        </button>
        <h1 className="wb-me-sub__title">{title}</h1>
        <div className="wb-me-sub__trailing">{trailing}</div>
      </header>
      <div className="wb-me-sub__body">{children}</div>
    </div>
  );
}

export function MeHint({ children }: { children: React.ReactNode }) {
  return <div className="wb-me-sub__hint">{children}</div>;
}

export function MeGroup({ children }: { children: React.ReactNode }) {
  return <div className="wb-me-sub__group">{children}</div>;
}

export function MeNavRow({
  label,
  value,
  chevron = true,
  onClick,
}: {
  label: string;
  value?: string;
  chevron?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`wb-me-sub__row ${onClick ? '' : 'is-static'} has-divider`}
      onClick={onClick}
    >
      <span>{label}</span>
      <span className="wb-me-sub__value">
        {value}
        {chevron ? <RightOutlined style={{ fontSize: 'var(--text-sm)', color: 'var(--color-chevron)' }} /> : null}
      </span>
    </Tag>
  );
}

export function MeSwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="wb-me-sub__switch has-divider">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}
