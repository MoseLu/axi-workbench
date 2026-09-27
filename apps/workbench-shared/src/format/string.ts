/**
 * M24：跨端共享的字符串处理工具。
 *
 * 设计原则：纯函数、不依赖运行时 API（无 DOM、无 fetch）、输入宽容。
 */

/**
 * 截断字符串，超过 max 字符则加省略号。
 * 默认按字符数（不是字节数）截断 —— 中文等宽字符按 1 个字符算。
 *
 * 算法：先按 max - suffix.length 截断，再加上 suffix；
 *        如果 suffix 自身已经 ≥ max，整个 suffix 被丢弃，只截 max 长度。
 *
 * @example truncate('Hello world', 8) === 'Hello...'
 * @example truncate('Hi', 8) === 'Hi'
 * @example truncate('测试字符串', 3) === '测试字...'（强制带省略号）
 * @example truncate('hello', 2, '...') === 'he'（suffix 被丢弃）
 */
export function truncate(input: string, max: number, suffix: string = '...'): string {
  if (typeof input !== 'string') return '';
  if (!Number.isFinite(max) || max < 0) return '';
  if (input.length <= max) return input;
  if (suffix.length >= max) return input.slice(0, max);
  return input.slice(0, max - suffix.length) + suffix;
}

/**
 * URL/文件名友好的字符串（小写、连字符、移除特殊字符）。
 * 用于博客 slug、文件路径、tag 路由。
 *
 * @example slugify('Hello World!') === 'hello-world'
 * @example slugify('  Axi / Workbench  ') === 'axi-workbench'
 * @example slugify('你好-世界') === '' // 全非 ASCII 时返回空串，调用方需自行处理
 */
export function slugify(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // 移除变音符号
    .replace(/[^a-z0-9]+/g, '-')     // 非字母数字 → 连字符
    .replace(/^-+|-+$/g, '');        // 去掉首尾连字符
}

/**
 * kebab-case / snake_case / space separated → camelCase。
 *
 * @example camelCase('hello-world') === 'helloWorld'
 * @example camelCase('hello_world') === 'helloWorld'
 * @example camelCase('Hello World') === 'helloWorld'
 */
export function camelCase(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .replace(/[-_\s]+(.)?/g, (_match, ch: string | undefined) => (ch ? ch.toUpperCase() : ''));
}

/**
 * kebab-case / snake_case / space separated → PascalCase。
 *
 * @example pascalCase('hello-world') === 'HelloWorld'
 */
export function pascalCase(input: string): string {
  const camel = camelCase(input);
  return camel.length === 0 ? '' : camel[0].toUpperCase() + camel.slice(1);
}

/**
 * camelCase / PascalCase → kebab-case。
 *
 * @example kebabCase('helloWorld') === 'hello-world'
 * @example kebabCase('HelloWorld') === 'hello-world'
 */
export function kebabCase(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}