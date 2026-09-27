import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LockKeyhole } from "lucide-react";

import userAvatarUrl from "../../assets/user-avatar.jpg";
import { listDevLoginAccounts } from "./auth";

type LoginFailure = { ok: false; error: string };
type LoginSuccess = { ok: true; user: { role: "user" | "developer" | "admin" } };
type LoginResult = LoginSuccess | LoginFailure;
type LegacyBoolean = boolean;

export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => LoginResult | LegacyBoolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const accounts = listDevLoginAccounts();
  const [username, setUsername] = useState(accounts[0]?.username ?? "admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const redirectTo = (location.state as { from?: string } | null)?.from || "/overview";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onLogin(username.trim(), password);
    // Backward compatibility: legacy callers returned boolean.
    if (typeof result === "boolean") {
      if (result) {
        navigate(redirectTo === "/login" ? "/overview" : redirectTo, { replace: true });
      } else {
        setError(t("用户名或密码不正确"));
      }
      return;
    }
    if (result.ok) {
      navigate(redirectTo === "/login" ? "/overview" : redirectTo, { replace: true });
      return;
    }
    setError(t((result as LoginFailure).error));
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-heading">
          <img className="login-avatar" src={userAvatarUrl} alt="" />
          <div>
            <span>{t("Axi DevSvc Dashboard")}</span>
            <h1>{t("Axi DevSvc Dashboard")}</h1>
          </div>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label className="login-field">
            <span>{t("用户名")}</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError("");
              }}
            />
          </label>
          <label className="login-field">
            <span>{t("密码")}</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
            />
          </label>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="login-button" type="submit">
            <LockKeyhole size={16} />
            <span>{t("登录")}</span>
          </button>
        </form>
        <section className="login-dev-accounts" aria-label={t("开发账号")}>
          <h2>{t("开发账号")}</h2>
          <ul>
            {accounts.map((account) => (
              <li key={account.username}>
                <button
                  type="button"
                  onClick={() => {
                    setUsername(account.username);
                    setPassword(account.username);
                    setError("");
                  }}
                >
                  <strong>{account.displayName}</strong>
                  <span className="login-dev-username">{account.username}</span>
                  <span className="login-dev-role">{account.role}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="login-dev-hint">{t("每个角色的用户名与密码相同；点击即可填充表单。")}</p>
        </section>
      </section>
    </main>
  );
}
