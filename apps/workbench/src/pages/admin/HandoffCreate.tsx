import React, { useState } from 'react';
import { Alert, Button, Form, Input, Select, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { resolveGatewayURL } from '@axi/workbench-foundation';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import './HandoffCreate.css';

type HandoffDirection = 'web' | 'mobile';
type ActionLevel = 'A' | 'B' | 'C' | 'D';
type TargetSurface = 'web' | 'mobile';

interface HandoffFormValues {
  direction: HandoffDirection;
  targetSurface: TargetSurface;
  actionLevel: ActionLevel;
  objectType: string;
  objectId: string;
  reason: string;
}

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

export default function HandoffCreate() {
  const navigate = useNavigate();
  const [form] = Form.useForm<HandoffFormValues>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: HandoffFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const handoff = await createHandoffRequest({
        direction: values.direction,
        targetSurface: values.targetSurface,
        actionLevel: values.actionLevel,
        object: {
          type: values.objectType || 'workitem',
          id: values.objectId,
        },
        context: {
          reason: values.reason,
        },
      });
      navigate(`/admin/handoff/${encodeURIComponent(handoff.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建交接失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DesktopCrudFrame
      ariaLabel="创建交接"
      toolbar={
        <Space>
          <Button onClick={() => navigate('/admin/handoff')}>返回列表</Button>
        </Space>
      }
      top={<span className="wb-crud-page__context">创建 Web 交接</span>}
    >
      <div className="handoff-create-page">
        {error && (
          <Alert
            className="handoff-create-page__error"
            message={error}
            type="error"
            showIcon
          />
        )}

        <Form
          form={form}
          className="handoff-create-page__form"
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            direction: 'web',
            targetSurface: 'mobile',
            actionLevel: 'B',
            objectType: 'workitem',
          }}
        >
          <Form.Item
            label="交接方向"
            name="direction"
            rules={[{ required: true, message: '请选择交接方向' }]}
          >
            <Select>
              <Select.Option value="web">Web → Mobile</Select.Option>
              <Select.Option value="mobile">Mobile → Web</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="目标端"
            name="targetSurface"
            rules={[{ required: true, message: '请选择目标端' }]}
          >
            <Select>
              <Select.Option value="mobile">移动端</Select.Option>
              <Select.Option value="web">Web 端</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="动作等级"
            name="actionLevel"
            rules={[{ required: true, message: '请选择动作等级' }]}
          >
            <Select>
              <Select.Option value="A">A级 - 紧急</Select.Option>
              <Select.Option value="B">B级 - 高优先级</Select.Option>
              <Select.Option value="C">C级 - 普通</Select.Option>
              <Select.Option value="D">D级 - 低优先级</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="对象类型"
            name="objectType"
            rules={[{ required: true, message: '请输入对象类型' }]}
          >
            <Select>
              <Select.Option value="workitem">工作项</Select.Option>
              <Select.Option value="project">项目</Select.Option>
              <Select.Option value="task">任务</Select.Option>
              <Select.Option value="approval">审批</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="对象 ID"
            name="objectId"
            rules={[{ required: true, message: '请输入对象 ID' }]}
          >
            <Input placeholder="请输入关联对象的唯一标识" />
          </Form.Item>

          <Form.Item
            label="交接原因"
            name="reason"
            rules={[{ required: true, message: '请输入交接原因' }]}
          >
            <Input.TextArea
              placeholder="请描述交接的原因和上下文"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {loading ? '创建中...' : '创建交接'}
              </Button>
              <Button onClick={() => navigate('/admin/handoff')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </DesktopCrudFrame>
  );
}
