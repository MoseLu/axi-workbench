package services

import (
	"encoding/json"
	"fmt"

	"notification-service/models"
)

type notificationTemplate struct {
	subject  string
	category models.TabCategory
	dotOnly  bool
	content  func(map[string]json.RawMessage) string
}

// eventNotificationTemplates is deliberately code-owned. The platform keeps
// user-facing i18n in the clients; this registry only turns durable event
// facts into a stable notification category and a safe fallback message.
var eventNotificationTemplates = map[string]notificationTemplate{
	"tenant.created": {
		subject:  "工作区已创建",
		category: models.TabMe,
		content:  func(_ map[string]json.RawMessage) string { return "Axi 工作区已完成初始化" },
	},
	"tenant.member.changed": {
		subject:  "成员权限已更新",
		category: models.TabMe,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf("你的工作区权限已更新为 %s", firstPayloadValue(payload, "role", "viewer"))
		},
	},
	"project.created": {
		subject:  "项目已创建",
		category: models.TabHome,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf("项目 %s 已创建", firstPayloadValue(payload, "name", "projectId"))
		},
	},
	"task.created": {
		subject:  "任务已创建",
		category: models.TabHome,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf("任务 %s 已创建", firstPayloadValue(payload, "title", "taskId"))
		},
	},
	"dictionary.changed": {
		subject:  "业务字典已更新",
		category: models.TabWorkspace,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf(
				"字典 %s 已更新至第 %s 版",
				firstPayloadValue(payload, "key", "unknown"),
				firstPayloadValue(payload, "version", "unknown"),
			)
		},
	},
	"workflow.completed": {
		subject:  "工作流已完成",
		category: models.TabWorkspace,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf("工作流 %s 已成功完成", firstPayloadValue(payload, "workflowName", "workflowId"))
		},
	},
	"workflow.failed": {
		subject:  "工作流执行失败",
		category: models.TabWorkspace,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf("工作流 %s 执行失败，请检查执行记录", firstPayloadValue(payload, "workflowName", "workflowId"))
		},
	},
	"file.uploaded": {
		subject:  "文件已上传",
		category: models.TabWorkspace,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf("文件 %s 已上传", firstPayloadValue(payload, "fileName", "name"))
		},
	},
	"file.scan.rejected": {
		subject:  "文件未通过安全扫描",
		category: models.TabWorkspace,
		dotOnly:  true,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf("文件 %s 被安全扫描拒绝", firstPayloadValue(payload, "fileName", "name"))
		},
	},
	"security.login": {
		subject:  "安全提醒",
		category: models.TabMe,
		content: func(payload map[string]json.RawMessage) string {
			return fmt.Sprintf("检测到一次新的登录：%s", firstPayloadValue(payload, "client", "unknown device"))
		},
	},
}

func notificationTemplateForEvent(topic string) (notificationTemplate, bool) {
	template, ok := eventNotificationTemplates[topic]
	return template, ok
}

func firstPayloadValue(payload map[string]json.RawMessage, keys ...string) string {
	for _, key := range keys {
		if value := eventPayloadString(payload, key); value != "" {
			return value
		}
	}
	return ""
}
