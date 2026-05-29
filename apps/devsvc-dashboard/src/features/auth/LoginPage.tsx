import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LockKeyhole } from "lucide-react";

import userAvatarUrl from "../../assets/user-avatar.jpg";
import { adminUsername } from "./auth";

export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState(adminUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const redirectTo = (location.state as { from?: string } | null)?.from || "/overview";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onLogin(username.trim(), password)) {
      navigate(redirectTo === "/login" ? "/overview" : redirectTo, { replace: true });
      return;
    }
    setError(t("用户名或密码不正确"));
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
      </section>
    </main>
  );
}
