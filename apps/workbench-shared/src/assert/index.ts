/**
 * M25：跨端共享的运行时安全工具。
 *
 * 设计原则：纯函数 + 严格类型保护；不依赖运行时 API。
 */

/**
 * exhaustiveness check：switch / if 分支穷尽性保护。
 *
 * 用法：
 *   switch (badge.kind) {
 *     case 'none': return null;
 *     case 'dot':  return <DotIcon />;
 *     case 'count': return <span>{badge.value}</span>;
 *     default: return assertNever(badge); // 类型系统会强制此分支完整
 *   }
 *
 * 运行时断言：传入即 throw（应只在开发 / 测试中出现）。
 * 生产 bundle 应通过 lint / dead-code-elimination 消除。
 */
export function assertNever(value: never): never {
  throw new Error(
    `assertNever: unexpected value ${JSON.stringify(value)} at ${new Error().stack ?? '<unknown>'}`
  );
}

/**
 * 安全调用 —— 把可能抛异常的回调转成 Either-style 返回值。
 *
 * 用法：
 *   const result = safeCall(() => JSON.parse(input), { fallback: null });
 *   if (result.ok) doSomething(result.value);
 *   else logWarn(result.error);
 *
 * 设计选择：不引入 Either 类型以保持零依赖；用 `{ ok: true, value } | { ok: false, error }` discriminated union。
 */
export type SafeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

export function safeCall<T>(fn: () => T): SafeResult<T> {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * 带 fallback 的安全调用 —— 失败时返回 fallback 而不是 discriminated union。
 *
 * 用法：
 *   const value = tryOr(() => JSON.parse(input), null);
 *   // value: T | null
 *
 * 注意：fallback 类型必须兼容 T；当 fallback 是 undefined 时用 `tryOr(fn, undefined as T | undefined)`。
 */
export function tryOr<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * 断言非空 —— 在不该出现 null/undefined 的场景抛错。
 *
 * 用法：
 *   const user = findUser(id) ?? assertPresent(findUser(id), 'user lookup');
 *
 * 仅用于开发期防御；生产期应通过上游类型保障避免使用。
 */
export function assertPresent<T>(value: T | null | undefined, message: string = 'value should be present'): T {
  if (value === null || value === undefined) {
    throw new Error(`assertPresent: ${message}`);
  }
  return value;
}