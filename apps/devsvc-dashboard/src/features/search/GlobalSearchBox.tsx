import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CornerDownLeft, Search, Star, X } from "lucide-react";

import { makeGlobalSearchItems, type AppTFunction, type GlobalSearchItem, type NavRouteKey } from "../../app-registry";
import { AxiSvgIcon } from "@axi/core";
import type { AxiResource } from "../axi-resources/axiResources";
import type { HostedApp } from "../hosted/hostedApps";

export function makeProjectSearchItems(projects: any[], t: AppTFunction): GlobalSearchItem[] {
  return projects.flatMap((project) => {
    const projectTitle = project.title || project.id;
    const projectKeywords = [
      project.id,
      project.title,
      project.description,
      project.pm2?.status,
      project.health?.status
    ].filter(Boolean).join(" ").toLowerCase();
    const projectItem: GlobalSearchItem = {
      key: `project:${project.id}`,
      path: "/services",
      trackKey: "/services",
      title: projectTitle,
      group: t("项目"),
      icon: <AxiSvgIcon name="component" size={16} />,
      breadcrumb: `${t("服务")} / ${t("项目")}`,
      keywords: projectKeywords
    };
    const serviceItems = (project.services || []).map((service) => ({
      key: `service:${project.id}:${service.id}`,
      path: "/services" as const,
      trackKey: "/services" as const,
      title: service.name || service.id,
      group: t("服务"),
      icon: <AxiSvgIcon name="settings" size={16} />,
      breadcrumb: `${projectTitle} / ${t("服务")}`,
      keywords: [
        project.id,
        project.title,
        project.description,
        service.id,
        service.name,
        service.description,
        service.pm2?.status,
        service.health?.status,
        ...(service.health?.checks || []).flatMap((check) => [check.url, check.command, check.detail])
      ].filter(Boolean).join(" ").toLowerCase()
    }));
    return [projectItem, ...serviceItems];
  });
}

export function GlobalSearchBox({
  hostedApps = [],
  axiResources = [],
  projects,
  recentAccessKeys,
  onClearRecentAccess,
  onSelectSearchItem
}: {
  hostedApps?: HostedApp[];
  axiResources?: AxiResource[];
  projects: any[];
  recentAccessKeys: NavRouteKey[];
  onClearRecentAccess: () => void;
  onSelectSearchItem: (key: NavRouteKey) => void;
}) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const globalSearchItems = useMemo(() => [
    ...makeGlobalSearchItems(t, hostedApps, axiResources),
    ...makeProjectSearchItems(projects, t)
  ], [axiResources, hostedApps, language, projects, t]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalizedKeyword) return globalSearchItems;
    return globalSearchItems.filter((item) => item.keywords.includes(normalizedKeyword));
  }, [globalSearchItems, normalizedKeyword]);
  const visibleResults = results.slice(0, 8);
  const quickAccess = globalSearchItems.slice(0, 4);
  const recentAccessItems = recentAccessKeys
    .map((key) => globalSearchItems.find((item) => item.trackKey === key))
    .filter(Boolean) as GlobalSearchItem[];

  function focusSearchInput() {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closeSearchPanel() {
    setOpen(false);
    setKeyword("");
  }

  function selectSearchItem(item: GlobalSearchItem) {
    if (item.trackKey) onSelectSearchItem(item.trackKey);
    navigate(item.path);
    closeSearchPanel();
  }

  function openSearchPanel() {
    setOpen(true);
    setSelectedIndex(0);
    focusSearchInput();
  }

  function moveSelectedIndex(direction: 1 | -1) {
    if (!visibleResults.length) return;
    setSelectedIndex((current) => (current + direction + visibleResults.length) % visibleResults.length);
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearchPanel();
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [visibleResults.length]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [keyword]);

  const searchModal = open && typeof document !== "undefined" ? createPortal(
    <div
      className="global-search-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSearchPanel();
      }}
    >
      <div className="search-modal-backdrop" onMouseDown={closeSearchPanel} />
      <div className="search-modal-container" role="dialog" aria-modal="true" aria-label={t("全局搜索")} onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-modal-header">
          <form
            className="search-modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              const selected = visibleResults[selectedIndex];
              if (selected) selectSearchItem(selected);
            }}
          >
            <label className="search-modal-icon" htmlFor="global-search-input">
              <Search size={20} />
            </label>
            <input
              ref={inputRef}
              id="global-search-input"
              className="search-modal-input"
              type="search"
              aria-label={t("全局搜索")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={t("搜索菜单、Axi 应用、服务、项目")}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveSelectedIndex(-1);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveSelectedIndex(1);
                }
                if (event.key === "Escape") {
                  closeSearchPanel();
                }
              }}
            />
            <div className="search-modal-actions">
              {keyword ? (
                <button className="search-modal-clear" type="button" onClick={() => setKeyword("")}>
                  {t("清空")}
                </button>
              ) : null}
              {keyword ? <div className="search-modal-divider" role="separator" /> : null}
              <button className="search-modal-close" type="button" aria-label={t("关闭")} onClick={closeSearchPanel}>
                <X size={20} />
              </button>
            </div>
          </form>
        </div>

        <div className="search-modal-body">
          {keyword && visibleResults.length ? (
            <div className="search-results">
              <section className="result-section">
                <div className="result-section-source">{t("全局搜索结果")}</div>
                <div className="result-section-list" role="listbox" aria-label={t("全局搜索结果")}>
                  {visibleResults.map((item, index) => (
                    <button
                      className={`result-hit ${index === selectedIndex ? "is-active" : ""}`}
                      key={item.key}
                      type="button"
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => selectSearchItem(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <span className="result-hit-icon">{item.icon}</span>
                      <span className="result-hit-content">
                        <span className="result-hit-title">{item.title}</span>
                        <span className="result-hit-path">{item.breadcrumb}</span>
                      </span>
                      <span className="result-hit-action">
                        <CornerDownLeft size={18} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : keyword ? (
            <div className="search-empty">
              <Search size={56} />
              <div className="search-empty-message">{t("没有匹配")} “{keyword}”</div>
              <div className="search-empty-suggestions">
                {quickAccess.map((item) => (
                  <button key={item.key} type="button" onClick={() => setKeyword(item.title)}>
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="search-hints">
              {recentAccessItems.length ? (
                <div className="hint-group">
                  <div className="hint-group-heading">
                    <div className="hint-group-title">{t("最近访问")}</div>
                    <button type="button" onClick={onClearRecentAccess}>
                      {t("清空记录")}
                    </button>
                  </div>
                  {recentAccessItems.map((item) => (
                    <button className="hint-item hint-item-rich" key={item.key} type="button" onClick={() => selectSearchItem(item)}>
                      <span className="hint-item-icon">{item.icon}</span>
                      <span className="hint-item-content">
                        <span>{item.title}</span>
                        <small>{item.breadcrumb}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="hint-group">
                <div className="hint-group-title">{t("快捷访问")}</div>
                {quickAccess.map((item) => (
                  <button className="hint-item" key={item.key} type="button" onClick={() => selectSearchItem(item)}>
                    <Star size={16} />
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="search-modal-footer">
          <ul className="search-commands">
            <li>
              <kbd>↓</kbd>
              <kbd>↑</kbd>
              <span>{t("导航")}</span>
            </li>
            <li>
              <kbd><CornerDownLeft size={14} /></kbd>
              <span>{t("选择")}</span>
            </li>
            <li>
              <kbd>ESC</kbd>
              <span>{t("关闭")}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button className="global-search-trigger" type="button" aria-label={t("打开全局搜索")} onClick={openSearchPanel}>
        <Search size={15} />
        <span>{t("搜索")}</span>
        <kbd>Ctrl K</kbd>
      </button>
      {searchModal}
    </>
  );
}
