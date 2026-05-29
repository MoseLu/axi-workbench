import { Database, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { cliLabel, formatTime, logReasonLabel, logStatusLabel } from "../../app/format";
import type { CliRoute, RequestLog } from "../providers/types";

type LogFilter = "all" | "success" | "failure";

type LogsPageProps = {
  busy: string | null;
  filter: LogFilter;
  logs: RequestLog[];
  onFilterChange: (filter: LogFilter) => void;
  onRefreshDocs: () => void;
};

const logFilters: LogFilter[] = ["all", "success", "failure"];

export function LogsPage({ busy, filter, logs, onFilterChange, onRefreshDocs }: LogsPageProps) {
  const filteredLogs = useMemo(() => logs.filter((log) => filter === "all" || log.status === filter), [filter, logs]);

  return (
    <section className="page-stack">
      <div className="content-toolbar">
        <div className="segmented">
          {logFilters.map((item) => (
            <button className={filter === item ? "active" : ""} onClick={() => onFilterChange(item)} key={item} type="button">
              {logFilterLabel(item)}
            </button>
          ))}
        </div>
        <button onClick={onRefreshDocs} disabled={busy === "docs"} type="button">
          <ShieldCheck size={17} />
          诊断规则
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>CLI</th>
              <th>提供方</th>
              <th>模型</th>
              <th>状态</th>
              <th>HTTP</th>
              <th>延迟</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  <Database size={16} />
                  暂无记录
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatTime(log.createdAt)}</td>
                  <td>{cliLabel(log.cli as CliRoute["cli"])}</td>
                  <td>{log.providerName || "-"}</td>
                  <td>{log.model || "-"}</td>
                  <td>
                    <span className={`status ${log.status}`}>{logStatusLabel(log.status)}</span>
                  </td>
                  <td>{log.httpStatus ?? "-"}</td>
                  <td>{log.latencyMs} 毫秒</td>
                  <td>{logReasonLabel(log)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type { LogFilter };

function logFilterLabel(logFilter: LogFilter) {
  switch (logFilter) {
    case "all":
      return "全部";
    case "success":
      return "成功";
    case "failure":
      return "失败";
  }
}
