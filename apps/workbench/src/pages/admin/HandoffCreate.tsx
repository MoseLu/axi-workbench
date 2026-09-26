import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveGatewayURL } from '@axi/workbench-foundation';
import { AxiBanner, AxiRow } from '@axi/widgets';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import './HandoffCreate.css';

type HandoffDirection = 'web' | 'mobile';
type ActionLevel = 'A' | 'B' | 'C' | 'D';
type TargetSurface = 'web' | 'mobile';
type ObjectType = 'workitem' | 'project' | 'task' | 'approval';

interface HandoffFormValues {
  direction: HandoffDirection;
  targetSurface: TargetSurface;
  actionLevel: ActionLevel;
  objectType: ObjectType;
  objectId: string;
  reason: string;
}

const directionOptions: Array<{ label: string; value: HandoffDirection }> = [
  { label: 'Web → Mobile', value: 'web' },
  { label: 'Mobile → Web', value: 'mobile' },
];

const targetSurfaceOptions: Array<{ label: string; value: TargetSurface }> = [
  { label: '移动端', value: 'mobile' },
  { label: 'Web 端', value: 'web' },
];

const actionLevelOptions: Array<{ label: string; value: ActionLevel }> = [
  { label: 'A级 - 紧急', value: 'A' },
  { label: 'B级 - 高优先级', value: 'B' },
  { label: 'C级 - 普通', value: 'C' },
  { label: 'D级 - 低优先级', value: 'D' },
];

const objectTypeOptions: Array<{ label: string; value: ObjectType }> = [
  { label: '工作项', value: 'workitem' },
  { label: '项目', value: 'project' },
  { label: '任务', value: 'task' },
  { label: '审批', value: 'approval' },
];

async function createHandoffRequest(payload: {
  direction: HandoffDirection;
  targetSurface: TargetSurface;
  actionLevel: ActionLevel;
  object: { type: string; id: string };
  context: { reason: string };
}): Promise<{ id: string }> {
  const response = await fetch(resolveGatewayURL('/api/v1/handoffs'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('handoff creation failed');
  }
  return response.json() as Promise<{ id: string }>;
}

function validate(values: HandoffFormValues): Partial<Record<keyof HandoffFormValues, string>> {
  const errors: Partial<Record<keyof HandoffFormValues, string>> = {};
  if (!values.direction) errors.direction = '请选择交接方向';
  if (!values.targetSurface) errors.targetSurface = '请选择目标端';
  if (!values.actionLevel) errors.actionLevel = '请选择动作等级';
  if (!values.objectType) errors.objectType = '请输入对象类型';
  if (!values.objectId.trim()) errors.objectId = '请输入对象 ID';
  if (!values.reason.trim()) errors.reason = '请输入交接原因';
  return errors;
}

/**
 * Desktop form for starting a new cross-surface handoff.  The form is
 * hand-rolled on top of native inputs so we can stay entirely inside
 * the Axi UI surface (`AxiBanner`, `AxiRow`); the antd Form / Select /
 * Input that the legacy version relied on were wrapped by `@axi/crud`
 * but the wrapper does not expose a public way to relabel the inline
 * save button, so we keep the form primitives raw.
 */
export default function HandoffCreate() {
  const navigate = useNavigate();
  const [values, setValues] = useState<HandoffFormValues>({
    actionLevel: 'B',
    direction: 'web',
    objectType: 'workitem',
    objectId: '',
    reason: '',
    targetSurface: 'mobile',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof HandoffFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateField = <K extends keyof HandoffFormValues>(field: K, value: HandoffFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setSubmitError(null);
    try {
      const handoff = await createHandoffRequest({
        actionLevel: values.actionLevel,
        context: { reason: values.reason },
        direction: values.direction,
        object: {
          id: values.objectId,
          type: values.objectType || 'workitem',
        },
        targetSurface: values.targetSurface,
      });
      navigate(`/admin/handoff/${encodeURIComponent(handoff.id)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '创建交接失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DesktopCrudFrame
      ariaLabel="创建交接"
      toolbar={
        <AxiRow>
          <button
            type="button"
            className="axi-button"
            onClick={() => navigate('/admin/handoff')}
          >
            返回列表
          </button>
        </AxiRow>
      }
      top={<span className="wb-crud-page__context">创建 Web 交接</span>}
    >
      <div className="handoff-create-page">
        {submitError ? (
          <div className="handoff-create-page__error">
            <AxiBanner message={submitError} role="alert" tone="danger" />
          </div>
        ) : null}

        <form className="handoff-create-page__form" onSubmit={handleSubmit} noValidate>
          <label className="handoff-create-page__field">
            <span className="handoff-create-page__field-label">交接方向</span>
            <select
              aria-label="交接方向"
              className="handoff-create-page__select"
              value={values.direction}
              onChange={(event) => updateField('direction', event.target.value as HandoffDirection)}
            >
              {directionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.direction ? <small className="handoff-create-page__field-error">{errors.direction}</small> : null}
          </label>

          <label className="handoff-create-page__field">
            <span className="handoff-create-page__field-label">目标端</span>
            <select
              aria-label="目标端"
              className="handoff-create-page__select"
              value={values.targetSurface}
              onChange={(event) => updateField('targetSurface', event.target.value as TargetSurface)}
            >
              {targetSurfaceOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.targetSurface ? <small className="handoff-create-page__field-error">{errors.targetSurface}</small> : null}
          </label>

          <label className="handoff-create-page__field">
            <span className="handoff-create-page__field-label">动作等级</span>
            <select
              aria-label="动作等级"
              className="handoff-create-page__select"
              value={values.actionLevel}
              onChange={(event) => updateField('actionLevel', event.target.value as ActionLevel)}
            >
              {actionLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.actionLevel ? <small className="handoff-create-page__field-error">{errors.actionLevel}</small> : null}
          </label>

          <label className="handoff-create-page__field">
            <span className="handoff-create-page__field-label">对象类型</span>
            <select
              aria-label="对象类型"
              className="handoff-create-page__select"
              value={values.objectType}
              onChange={(event) => updateField('objectType', event.target.value as ObjectType)}
            >
              {objectTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.objectType ? <small className="handoff-create-page__field-error">{errors.objectType}</small> : null}
          </label>

          <label className="handoff-create-page__field">
            <span className="handoff-create-page__field-label">对象 ID</span>
            <input
              className="handoff-create-page__input"
              maxLength={120}
              placeholder="请输入关联对象的唯一标识"
              value={values.objectId}
              onChange={(event) => updateField('objectId', event.target.value)}
            />
            {errors.objectId ? <small className="handoff-create-page__field-error">{errors.objectId}</small> : null}
          </label>

          <label className="handoff-create-page__field">
            <span className="handoff-create-page__field-label">交接原因</span>
            <textarea
              className="handoff-create-page__textarea"
              maxLength={500}
              placeholder="请描述交接的原因和上下文"
              rows={4}
              value={values.reason}
              onChange={(event) => updateField('reason', event.target.value)}
            />
            <small className="handoff-create-page__field-count">{values.reason.length}/500</small>
            {errors.reason ? <small className="handoff-create-page__field-error">{errors.reason}</small> : null}
          </label>

          <AxiRow className="handoff-create-page__actions" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="axi-button"
              disabled={submitting}
              onClick={() => navigate('/admin/handoff')}
            >
              取消
            </button>
            <button
              type="submit"
              className="axi-button axi-button--primary"
              disabled={submitting}
            >
              {submitting ? '创建中...' : '创建交接'}
            </button>
          </AxiRow>
        </form>
      </div>
    </DesktopCrudFrame>
  );
}