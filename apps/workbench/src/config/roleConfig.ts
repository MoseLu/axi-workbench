/**
 * 用户角色配置
 *
 * 用于在开发和本地环境中配置用户角色，以控制导航菜单的可见性。
 * 在生产环境中，角色应该从认证服务获取。
 */

import type { UserRole } from "@axi/types/auth";

// 默认角色为 developer（向后兼容）
const DEFAULT_ROLE: UserRole = "developer";

// 有效的角色列表
const VALID_ROLES: UserRole[] = ["admin", "developer", "user", "guest"];

/**
 * 读取用户角色配置
 *
 * 优先级：
 * 1. window.__APP_CONFIG__.userRole（页面级配置，优先级最高）
 * 2. import.meta.env.VITE_USER_ROLE（环境变量）
 * 3. 默认值 "developer"
 */
export function getUserRole(): UserRole {
  // 1. 页面级配置（由服务端注入或手动设置）
  if (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__APP_CONFIG__ &&
    typeof ((window as unknown) as { __APP_CONFIG__?: { userRole?: UserRole } }).__APP_CONFIG__?.userRole ===
      "string"
  ) {
    const role = ((window as unknown) as { __APP_CONFIG__?: { userRole?: UserRole } }).__APP_CONFIG__!
      .userRole!;
    if (VALID_ROLES.includes(role)) {
      return role;
    }
  }

  // 2. 环境变量（Vite）
  const envRole = import.meta.env.VITE_USER_ROLE as string | undefined;
  if (envRole && VALID_ROLES.includes(envRole as UserRole)) {
    return envRole as UserRole;
  }

  // 3. 默认值
  return DEFAULT_ROLE;
}

/**
 * 检查用户是否具有管理员权限
 */
export function isAdmin(): boolean {
  return getUserRole() === "admin";
}

/**
 * 检查用户是否具有开发者权限
 */
export function isDeveloper(): boolean {
  const role = getUserRole();
  return role === "admin" || role === "developer";
}
