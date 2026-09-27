/**
 * Web 端的兼容入口。认证行为由共享基础包拥有，避免 Web 与移动端各自
 * 演化出不同的 session / token 协议。
 */
export {
  AuthProvider,
  useAuth,
  type AuthContextType,
  type AuthProviderProps,
} from '@axi/workbench-foundation';
