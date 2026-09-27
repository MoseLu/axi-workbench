import { useEffect, useMemo, useState } from "react";
import { Button as AntButton, Tooltip } from "antd";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useTableToolbarSlot } from "../../app-shell/toolbarSlot";
import { AxiTable } from "@axi/crud";
import { AxiTag } from "@axi/core";
import { api, requestErrorMessage } from "../../lib/api";
import { metricTagType, StatusChip } from "../status/status";
import type { UserRole } from "../auth/auth";
import type { AxiResource, AxiResourcesPayload, VerifyCommand } from "./axiResources";

const surfaceLabels: Record<string, string> = {
  "dashboard-host": "应用宿主",
  "hosted-app": "托管应用",
  "hosted-subroute": "托管子路由",
  "resource-index": "资源索引"
};

/**
 * Redact an `AxiResource` for a given role.
 *
 * Ordinary users (`user`) must never see private repository absolute paths
 * or any field that may embed source code, credentials, or unauthorized
 * remote URLs. The dashboard backend is allowed to keep `ownerPath`,
 * `evidenceLink`, `docsRoute` and other absolute-path fields on the wire,
 * but the UI MUST strip them for non-admin roles before they reach any
 * renderer, table column, or tooltip.
 *
 * Admin keeps the full record; developer gets a developer-revealing subset
 * (no absolute owner paths, but a non-PII indicator is allowed).
 *
 * Pure function so security tests can call it with mock data without
 * mounting React.
 */
export function redactResourceForRole<T extends Partial<AxiResource>>(
  resource: T,
  role: UserRole
): T {
  if (role === "admin") return resource;
  // For both `user` and `developer` we strip absolute paths and remote
  // links that would force a privileged network call.
  const sanitized: Partial<AxiResource> & Pick<T, keyof T> = {
    ...resource
  };
  delete sanitized.ownerPath;
  if (role === "user") {
    delete sanitized.evidenceLink;
    delete sanitized.docsRoute;
  }
  return sanitized as T;
}

/**
 * Decide whether a role is allowed to access a hidden / private resource
 * by route. This is the source of truth used by both the page render and
 * the security tests, so hidden-route behavior cannot drift between UI
 * and tests.
 */
export function canRoleAccessResource(
  resource: Pick<AxiResource, "visibility" | "audience"> | undefined,
  role: UserRole
): boolean {
  if (!resource) return false;
  // `deferred` means "not surfaced yet" — even admin must wait for the
  // resource to be promoted out of deferred.
  if (resource.visibility === "deferred") return false;
  // `hidden` is the admin-only escape hatch: ordinary users and developers
  // must be redirected to an authorization error when they reach a hidden
  // route directly; admins can still browse the controlled info.
  if (role === "admin") return true;
  if (resource.visibility === "hidden") return false;
  if (resource.visibility === "admin") return false;
  if (resource.audience) {
    const priority: Record<UserRole, number> = { user: 0, developer: 1, admin: 2 };
    const audienceLevel = priority[resource.audience];
    if (typeof audienceLevel === "number" && priority[role] < audienceLevel) return false;
  }
  return true;
}

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

      {/* Type-specific Detail Sections */}
      {resource.kind === "shared-rule-index" && resource.rulesMetadata && (
        <div className="resource-detail-section">
          <h3 className="resource-detail-section-title">{t("规则详情")}</h3>
          <div className="resource-detail-grid">
            {resource.rulesMetadata.ruleFamilies && resource.rulesMetadata.ruleFamilies.length > 0 && (
              <div className="resource-detail-item resource-detail-item-full">
                <span className="resource-detail-label">{t("规则族")}</span>
                <div className="resource-detail-tags">
                  {resource.rulesMetadata.ruleFamilies.map((family) => (
                    <AxiTag key={family} className="metric-tag" effect="light" round type="primary">
                      {family}
                    </AxiTag>
                  ))}
                </div>
              </div>
            )}
            {resource.rulesMetadata.applicableScopes && resource.rulesMetadata.applicableScopes.length > 0 && (
              <div className="resource-detail-item resource-detail-item-full">
                <span className="resource-detail-label">{t("适用场景")}</span>
                <div className="resource-detail-tags">
                  {resource.rulesMetadata.applicableScopes.map((scope) => (
                    <AxiTag key={scope} className="metric-tag" effect="light" round type="success">
                      {scope}
                    </AxiTag>
                  ))}
                </div>
              </div>
            )}
            {resource.rulesMetadata.sourcePrecedence && resource.rulesMetadata.sourcePrecedence.length > 0 && (
              <div className="resource-detail-item resource-detail-item-full">
                <span className="resource-detail-label">{t("Source Precedence")}</span>
                <div className="resource-detail-tags">
                  {resource.rulesMetadata.sourcePrecedence.map((source, idx) => (
                    <AxiTag key={source} className="metric-tag" effect="light" round type="warning">
                      {idx + 1}. {source}
                    </AxiTag>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {resource.kind === "shared-skill-registry" && resource.skillsMetadata && (
        <div className="resource-detail-section">
          <h3 className="resource-detail-section-title">{t("技能详情")}</h3>
          <div className="resource-detail-grid">
            {resource.skillsMetadata.skillCategories && resource.skillsMetadata.skillCategories.length > 0 && (
              <div className="resource-detail-item resource-detail-item-full">
                <span className="resource-detail-label">{t("技能分类")}</span>
                <div className="resource-detail-tags">
                  {resource.skillsMetadata.skillCategories.map((category) => (
                    <AxiTag key={category} className="metric-tag" effect="light" round type="primary">
                      {category}
                    </AxiTag>
                  ))}
                </div>
              </div>
            )}
            {resource.skillsMetadata.version && (
              <div className="resource-detail-item">
                <span className="resource-detail-label">{t("版本")}</span>
                <span className="resource-detail-value">
                  <AxiTag className="metric-tag" effect="light" round type="info">
                    v{resource.skillsMetadata.version}
                  </AxiTag>
                </span>
              </div>
            )}
            {resource.skillsMetadata.skillCount !== undefined && (
              <div className="resource-detail-item">
                <span className="resource-detail-label">{t("技能数量")}</span>
                <span className="resource-detail-value">{resource.skillsMetadata.skillCount}</span>
              </div>
            )}
            {resource.skillsMetadata.i18nStatus && (
              <div className="resource-detail-item">
                <span className="resource-detail-label">{t("i18n 状态")}</span>
                <span className="resource-detail-value">
                  <AxiTag
                    className="metric-tag"
                    effect="light"
                    round
                    type={resource.skillsMetadata.i18nStatus === "full" ? "success" : resource.skillsMetadata.i18nStatus === "partial" ? "warning" : "info"}
                  >
                    {resource.skillsMetadata.i18nStatus === "full" ? "完全本地化" : resource.skillsMetadata.i18nStatus === "partial" ? "部分本地化" : "无本地化"}
                  </AxiTag>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {resource.kind === "local-registry" && resource.registryMetadata && (
        <div className="resource-detail-section">
          <h3 className="resource-detail-section-title">{t("Registry 详情")}</h3>
          <div className="resource-detail-grid">
            {resource.registryMetadata.registryUrl && (
              <div className="resource-detail-item resource-detail-item-full">
                <span className="resource-detail-label">{t("Registry 地址")}</span>
                <span className="resource-detail-value">
                  <code className="resource-detail-code">{resource.registryMetadata.registryUrl}</code>
                </span>
              </div>
            )}
            {resource.registryMetadata.healthEndpoint && (
              <div className="resource-detail-item resource-detail-item-full">
                <span className="resource-detail-label">{t("健康检查端点")}</span>
                <span className="resource-detail-value">
                  <code className="resource-detail-code">{resource.registryMetadata.healthEndpoint}</code>
                </span>
              </div>
            )}
            {resource.registryMetadata.packageCount !== undefined && (
              <div className="resource-detail-item">
                <span className="resource-detail-label">{t("包数量")}</span>
                <span className="resource-detail-value">{resource.registryMetadata.packageCount}</span>
              </div>
            )}
            {resource.registryMetadata.healthStatus && (
              <div className="resource-detail-item">
                <span className="resource-detail-label">{t("健康状态")}</span>
                <span className="resource-detail-value">
                  <AxiTag
                    className="metric-tag"
                    effect="light"
                    round
                    type={resource.registryMetadata.healthStatus === "healthy" ? "success" : resource.registryMetadata.healthStatus === "unhealthy" ? "danger" : "info"}
                  >
                    {resource.registryMetadata.healthStatus === "healthy" ? "健康" : resource.registryMetadata.healthStatus === "unhealthy" ? "不健康" : "未知"}
                  </AxiTag>
                </span>
              </div>
            )}
            {resource.health && (
              <div className="resource-detail-item">
                <span className="resource-detail-label">{t("检查间隔")}</span>
                <span className="resource-detail-value">{resource.health.interval / 1000}s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {resource.kind === "governance-infrastructure" && resource.governanceMetadata && (
        <div className="resource-detail-section">
          <h3 className="resource-detail-section-title">{t("治理详情")}</h3>
          <div className="resource-detail-grid">
            {resource.governanceMetadata.projectCount !== undefined && (
              <div className="resource-detail-item">
                <span className="resource-detail-label">{t("项目注册数")}</span>
                <span className="resource-detail-value">{resource.governanceMetadata.projectCount}</span>
              </div>
            )}
            {resource.governanceMetadata.graphValidation && (
              <>
                <div className="resource-detail-item">
                  <span className="resource-detail-label">{t("Graph 校验")}</span>
                  <span className="resource-detail-value">
                    <AxiTag
                      className="metric-tag"
                      effect="light"
                      round
                      type={resource.governanceMetadata.graphValidation.valid ? "success" : "danger"}
                    >
                      {resource.governanceMetadata.graphValidation.valid ? "有效" : "无效"}
                    </AxiTag>
                  </span>
                </div>
                {resource.governanceMetadata.graphValidation.errorCount !== undefined && (
                  <div className="resource-detail-item">
                    <span className="resource-detail-label">{t("错误数")}</span>
                    <span className="resource-detail-value" style={{ color: resource.governanceMetadata.graphValidation.errorCount > 0 ? "var(--red)" : "inherit" }}>
                      {resource.governanceMetadata.graphValidation.errorCount}
                    </span>
                  </div>
                )}
                {resource.governanceMetadata.graphValidation.warningCount !== undefined && (
                  <div className="resource-detail-item">
                    <span className="resource-detail-label">{t("警告数")}</span>
                    <span className="resource-detail-value" style={{ color: resource.governanceMetadata.graphValidation.warningCount > 0 ? "var(--amber)" : "inherit" }}>
                      {resource.governanceMetadata.graphValidation.warningCount}
                    </span>
                  </div>
                )}
              </>
            )}
            {resource.governanceMetadata.lastValidatedAt && (
              <div className="resource-detail-item resource-detail-item-full">
                <span className="resource-detail-label">{t("最近校验时间")}</span>
                <span className="resource-detail-value">
                  {formatAbsoluteTime(resource.governanceMetadata.lastValidatedAt)}
                  <span className="resource-detail-relative">
                    ({formatRelativeTime(resource.governanceMetadata.lastValidatedAt)})
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AxiResourcesPage({ userRole = "developer" as UserRole }: { userRole?: UserRole } = {}) {
  const { t } = useTranslation();
  const { resourceId } = useParams();
  const tableToolbarContainer = useTableToolbarSlot();
  const [data, setData] = useState<AxiResourcesPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resources = Array.isArray(data?.resources) ? data.resources : [];
  // Hidden / admin / private-visibility resources are dropped for the
  // current role before they reach any column renderer. This mirrors the
  // nav filtering so the table and the sidebar cannot disagree.
  const roleVisibleResources = resources.filter((resource) => canRoleAccessResource(resource, userRole));
  const visibleResources = resourceId ? roleVisibleResources.filter((resource) => resource.id === resourceId) : roleVisibleResources;
  const singleResource = resourceId && visibleResources.length === 1 ? visibleResources[0] : null;
  // When the URL is asking for a hidden resource, surface an authorization
  // error instead of rendering it. Admin still gets the full record.
  const accessDenied = Boolean(resourceId) && !singleResource && resources.some((resource) => resource.id === resourceId);

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
          title: t("证据"),
          dataIndex: "evidenceLink",
          align: "center" as const,
          width: 100,
          render: (value?: string) => {
            // Hidden / private / admin-only resources must never expose a
            // remote evidence link to a non-admin user. The redactor drops
            // the field entirely for `user`; admins keep it.
            const safeResource = redactResourceForRole({ evidenceLink: value } as Pick<AxiResource, "evidenceLink">, userRole);
            const safeLink = (safeResource as Pick<AxiResource, "evidenceLink">).evidenceLink;
            return safeLink ? (
              <Tooltip title={safeLink}>
                <AntButton href={safeLink} size="small" type="link" target="_blank" icon="link">
                  {t("查看")}
                </AntButton>
              </Tooltip>
            ) : (
              <span className="service-desc">—</span>
            );
          }
        },
        {
          title: t("resources.column.axiEntry"),
          dataIndex: "dashboardRoute",
          align: "center" as const,
          width: 100,
          render: (value?: string) => value ? (
            <AntButton href={value} size="small" type="link">
              {t("打开")}
            </AntButton>
          ) : (
            <span className="service-desc">—</span>
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
          render: (value: string, resource: AxiResource) => {
            // ownerPath is the local absolute workspace path. We never
            // render the raw string for non-admin roles; only the
            // existence indicator and the redacted owner handle survive.
            const safeResource = redactResourceForRole({ ownerPath: value } as Pick<AxiResource, "ownerPath">, userRole);
            const safePath = (safeResource as Pick<AxiResource, "ownerPath">).ownerPath;
            return (
              <div className="service-cell">
                <div className="service-name">{resource.ownerPathExists ? t("已登记") : t("未配置")}</div>
                {/* 不暴露绝对路径，只显示存在状态 */}
                <div className="service-desc" data-owner-path={userRole === "admin" ? safePath : ""}>{userRole === "admin" && safePath ? t("已配置路径") : "—"}</div>
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
            );
          }
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
          render: (value?: string) => {
            const safeResource = redactResourceForRole({ docsRoute: value } as Pick<AxiResource, "docsRoute">, userRole);
            const safeDocs = (safeResource as Pick<AxiResource, "docsRoute">).docsRoute;
            return safeDocs ? (
              <AntButton href={safeDocs} size="small" type="link" target="_blank" icon="book">
                {t("文档")}
              </AntButton>
            ) : (
              <span className="service-desc">—</span>
            );
          }
        }
      ]
    }
  ], [t, userRole]);

  return (
    <section className="panel services-panel">
      {error ? <div className="hosted-app-state is-error">{error}</div> : null}
      {accessDenied ? (
        <div className="hosted-app-state is-error" data-testid="axi-resources-access-denied" role="alert">
          {t("无权访问该资源")}
        </div>
      ) : singleResource ? (
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
