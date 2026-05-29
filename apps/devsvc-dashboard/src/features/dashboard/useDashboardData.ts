import { useEffect, useState } from "react";

import i18n from "../../i18n";
import { api } from "../../lib/api";

export function useDashboardData() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      setOverview(await api("/api/overview"));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

	  async function action(actionName: string, target?: string) {
	    setMessage(target ? i18n.t("正在处理 {{target}}...", { target }) : i18n.t("正在保存..."));
    const body = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({ action: actionName, target })
    });
	    if (!body.ok) throw new Error(body.stderr || body.stdout || i18n.t("操作失败"));
	    await load();
	    setMessage(i18n.t("操作完成"));
	  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, []);

  return { overview, loading, message, load, action };
}
