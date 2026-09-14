import { useEffect, useMemo, useState } from "react";
import { Button as AntButton, Tooltip } from "antd";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useTableToolbarSlot } from "../../app-shell/toolbarSlot";
import { AxiTable } from "@axi/crud";
import { AxiTag } from "@axi/core";
import { api, requestErrorMessage } from "../../lib/api";
import { metricTagType, StatusChip } from "../status/status";
import type { AxiResource, AxiResourcesPayload, VerifyCommand } from "./axiResources";

const surfaceLabels: Record<string, string> = {
  "dashboard-host": "应用宿主",
  "hosted-app": "托管应用",
  "hosted-subroute": "托管子路由",
  "resource-index": "资源索引"
};

// Helper to format relative time
function formatRelativeTime(isoTimestamp?: string): string {
  if (!isoTimestamp) return "—";
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString("zh-CN");
}

// Helper to get verification source label
function getVerificationSourceLabel(source?: string): string {
  const labels: Record<string, string> = {
    local: "本地验证",
    ci: "CI 验证",
    remote: "远程验证"
  };
  return labels[source || ""] || "—";
}

// Enhanced verification status renderer for failed resources
function VerificationStatus({ resource }: { resource: AxiResource }) {
  const { t } = useTranslation();
  const isFailed = resource.status === "failed";

  if (!isFailed) {
    return <StatusChip value={resource.status} />;
  }

  return (
    <Tooltip
      title={
        <div style={{ maxWidth: 280, whiteSpace: "pre-wrap" }}>
          {resource.verificationSummary && (
            <div style={{ marginBottom: 8 }}>
              <strong>{t("失败原因")}:</strong>
              <br />
              {resource.verificationSummary}
            </div>
          )}
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            <div>{t("验证来源")}: {getVerificationSourceLabel(resource.verificationSource)}</div>
            <div>{t("验证时间")}: {formatRelativeTime(resource.lastVerifiedAt)}</div>
            {resource.owner && <div>{t("联系 Owner")}: {resource.owner}</div>}
          </div>
        </div>
      }
      placement="topLeft"
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <StatusChip value={resource.status} />
        <span style={{ fontSize: 11, color: "var(--red)" }}>
          {resource.verificationSummary
            ? resource.verificationSummary.length > 20
              ? resource.verificationSummary.slice(0, 20) + "..."
              : resource.verificationSummary
            : t("验证失败")}
        </span>
        {resource.owner && (
          <span style={{ fontSize: 10, color: "var(--amber)" }}>
            {t("联系 Owner")}: {resource.owner}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

// Helper to format absolute time
function formatAbsoluteTime(isoTimestamp?: string): string {
  if (!isoTimestamp) return "—";
  const date = new Date(isoTimestamp);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Helper to format verify command for display
function formatVerifyCommand(cmd: VerifyCommand): string {
  return cmd.command.join(" ");
}

// Detail view component for single resource
function AxiResourceDetail({ resource }: { resource: AxiResource }) {
  const { t } = useTranslation();

  // Visibility label map
  const visibilityLabels: Record<string, string> = {
    always: "公开",
    deferred: "延迟展示",
    hidden: "隐藏",
    admin: "仅管理员"
  };

  return (
    <div className="resource-detail">
      {/* Basic Info Section */}
      <div className="resource-detail-section">
        <h3 className="resource-detail-section-title">{t("基本信息")}</h3>
        <div className="resource-detail-grid">
          {resource.owner && (
            <div className="resource-detail-item">
              <span className="resource-detail-label">{t("Owner 名称")}</span>
              <span className="resource-detail-value">{resource.owner}</span>
            </div>
          )}
          {resource.visibility && (
            <div className="resource-detail-item">
              <span className="resource-detail-label">{t("可见性")}</span>
              <span className="resource-detail-value">
                <AxiTag className="metric-tag" effect="light" round type="info">
                  {t(visibilityLabels[resource.visibility] || resource.visibility)}
                </AxiTag>
              </span>
            </div>
          )}
          {resource.kind && (
            <div className="resource-detail-item">
              <span className="resource-detail-label">{t("类型")}</span>
              <span className="resource-detail-value">
                <AxiTag className="metric-tag" effect="light" round type={metricTagType(resource.kind)}>
                  {t(resource.kind)}
                </AxiTag>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Verification Status Section */}
      <div className="resource-detail-section">
        <h3 className="resource-detail-section-title">{t("验证状态")}</h3>
        <div className="resource-detail-grid">
          <div className="resource-detail-item">
            <span className="resource-detail-label">{t("验证时间")}</span>
            <span className="resource-detail-value">
              {formatAbsoluteTime(resource.lastVerifiedAt)}
              {resource.lastVerifiedAt && (
                <span className="resource-detail-relative">
                  ({formatRelativeTime(resource.lastVerifiedAt)})
                </span>
              )}
            </span>
          </div>
          <div className="resource-detail-item">
            <span className="resource-detail-label">{t("验证来源")}</span>
            <span className="resource-detail-value">
              {getVerificationSourceLabel(resource.verificationSource)}
            </span>
          </div>
          {resource.verificationSummary && (
            <div className="resource-detail-item resource-detail-item-full">
              <span className="resource-detail-label">{t("验证摘要")}</span>
              <span className="resource-detail-value resource-detail-pre">{resource.verificationSummary}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions Section */}
      <div className="resource-detail-section">
        <h3 className="resource-detail-section-title">{t("操作")}</h3>
        <div className="resource-detail-grid">
          {resource.verifyCommands && resource.verifyCommands.length > 0 && (
            <div className="resource-detail-item resource-detail-item-full">
              <span className="resource-detail-label">{t("Verify Commands")}</span>
              <div className="resource-detail-commands">
                {resource.verifyCommands.map((cmd) => (
                  <div key={cmd.id} className="resource-detail-command">
                    <span className="resource-detail-command-label">{cmd.label}</span>
                    <code className="resource-detail-command-code">{formatVerifyCommand(cmd)}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
          {resource.evidenceLink && (
            <div className="resource-detail-item resource-detail-item-full">
              <span className="resource-detail-label">{t("证据链接")}</span>
              <span className="resource-detail-value">
                <AntButton href={resource.evidenceLink} size="small" type="link" target="_blank" icon="link">
                  {t("查看证据")}
                </AntButton>
              </span>
            </div>
          )}
          {!resource.verifyCommands?.length && !resource.evidenceLink && (
            <div className="resource-detail-item">
              <span className="resource-detail-value" style={{ color: "var(--gray)" }}>—</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AxiResourcesPage() {
  const { t } = useTranslation();
  const { resourceId } = useParams();
  const tableToolbarContainer = useTableToolbarSlot();
  const [data, setData] = useState<AxiResourcesPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resources = data?.resources || [];
  const visibleResources = resourceId ? resources.filter((resource) => resource.id === resourceId) : resources;
  const singleResource = resourceId && visibleResources.length === 1 ? visibleResources[0] : null;

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api("/api/axi/resources") as AxiResourcesPayload);
    } catch (reason) {
      setError(requestErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<any[]>(() => [
    {
      title: t("resources.column.axiResources"),
      children: [
        {
          title: t("名称"),
          dataIndex: "title",
          width: 260,
          render: (_: string, resource: AxiResource) => (
            <div className="service-cell">
              <div className="service-name">{t(resource.title)}</div>
              <div className="service-desc" title={resource.id}>{resource.id}</div>
            </div>
          )
        },
        {
          title: t("类型"),
          dataIndex: "kind",
          width: 150,
          render: (value: string) => <AxiTag className="metric-tag" effect="light" round type={metricTagType(value)}>{t(value)}</AxiTag>
        }
      ]
    },
    {
      title: t("resources.column.appReclaim"),
      children: [
        {
          title: t("状态"),
          dataIndex: "status",
          align: "center" as const,
          width: 160,
          render: (_: string, resource: AxiResource) => <VerificationStatus resource={resource} />
        },
        {
          title: t("收归方式"),
          dataIndex: "surface",
          align: "center" as const,
          width: 130,
          render: (value: string) => <AxiTag className="metric-tag" effect="light" round type="info">{t(surfaceLabels[value] || value)}</AxiTag>
        },
        {
          title: t("resources.column.axiEntry"),
          dataIndex: "dashboardRoute",
          align: "center" as const,
          width: 150,
          render: (value?: string) => value ? (
            <AntButton href={value} size="small" type="link">
              {t("打开")}
            </AntButton>
          ) : (
            <AxiTag className="metric-tag" effect="light" round type="info">{t("资源索引")}</AxiTag>
          )
        }
      ]
    },
    {
      title: t("Owner"),
      children: [
        {
          title: t("Owner 路径"),
          dataIndex: "ownerPath",
          width: 360,
          render: (value: string, resource: AxiResource) => (
            <div className="service-cell">
              <div className="service-name">{resource.ownerPathExists ? t("已登记") : t("未配置")}</div>
              {/* 不暴露绝对路径，只显示存在状态 */}
              <div className="service-desc">—</div>
              {resource.owner && (
                <div className="service-desc" style={{ color: resource.status === "failed" ? "var(--red)" : "inherit" }}>
                  {resource.status === "failed" ? (
                    <Tooltip title={t("请联系 Owner 解决验证失败问题")}>
                      <span>{t("联系 Owner")}: {resource.owner}</span>
                    </Tooltip>
                  ) : (
                    <span>{t("Owner")}: {resource.owner}</span>
                  )}
                </div>
              )}
            </div>
          )
        },
        {
          title: t("能力"),
          dataIndex: "capabilities",
          width: 260,
          render: (values?: string[]) => (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {(values || []).slice(0, 4).map((value) => <AxiTag key={value} className="metric-tag" effect="light" round type={metricTagType(value)}>{t(value)}</AxiTag>)}
            </div>
          )
        },
        {
          title: t("说明"),
          dataIndex: "notes",
          render: (value?: string) => <span className="service-desc" title={value}>{value ? t(value) : "-"}</span>
        },
        {
          title: t("文档"),
          dataIndex: "docsRoute",
          align: "center" as const,
          width: 100,
          render: (value?: string) => value ? (
            <AntButton href={value} size="small" type="link" target="_blank" icon="book">
              {t("文档")}
            </AntButton>
          ) : (
            <span className="service-desc">—</span>
          )
        }
      ]
    }
  ], [t]);

  return (
    <section className="panel services-panel">
      {error ? <div className="hosted-app-state is-error">{error}</div> : null}
      {singleResource ? (
        <>
          <AxiResourceDetail resource={singleResource} />
          <AxiTable<AxiResource>
            bordered
            className="services-table server-ant-table"
            columns={columns}
            dataSource={visibleResources}
            loading={loading}
            pagination={false}
            rowKey="id"
            scroll={{ x: 1380 }}
            size="small"
            tableLayout="fixed"
            toolbarContainer={tableToolbarContainer}
            toolbar={{ storageKey: "axi-resources-table" }}
          />
        </>
      ) : (
        <AxiTable<AxiResource>
          bordered
          className="services-table server-ant-table"
          columns={columns}
          dataSource={visibleResources}
          loading={loading}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1380 }}
          size="small"
          tableLayout="fixed"
          toolbarContainer={tableToolbarContainer}
          toolbar={{ storageKey: "axi-resources-table" }}
        />
      )}
    </section>
  );
}
