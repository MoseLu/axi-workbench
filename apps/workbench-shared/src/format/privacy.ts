/**
 * M35：跨端共享的隐私脱敏工具。
 *
 * 设计原则：纯函数；不调用任何外部 API；输出永远可逆（仅格式化不加密）。
 *
 * 用途：UI 列表 / 详情页展示给非授权人员时使用。
 * 注意：脱敏不是安全机制 —— 后端必须做权限控制；这里只是显示层美化。
 */

/**
 * 电话号码脱敏 —— 13800138000 → 138****8000
 * - 大陆 11 位：保留前 3 + 后 4
 * - 不足 7 位：全 *
 * - 非大陆：按地区扩展（CN / HK / any）
 */
export function maskPhone(phone: string, region: 'CN' | 'HK' | 'any' = 'CN'): string {
  if (typeof phone !== 'string') return '';
  const cleaned = phone.replace(/[\s\-()+]/g, '');
  if (region === 'CN') {
    if (cleaned.length !== 11) return cleaned.length < 7 ? '' : cleaned;
    return cleaned.slice(0, 3) + '****' + cleaned.slice(7);
  }
  if (region === 'HK') {
    // 香港 8 位：保留前 2 + 后 2
    if (cleaned.length !== 8) return '';
    return cleaned.slice(0, 2) + '****' + cleaned.slice(6);
  }
  // any: 保留前 3 + 后 2
  if (cleaned.length < 7) return '';
  return cleaned.slice(0, 3) + '*'.repeat(Math.max(0, cleaned.length - 5)) + cleaned.slice(-2);
}

/**
 * 身份证号脱敏 —— 110101199001011234 → 110101********1234
 * 保留前 6 位（地区码）+ 后 4 位
 */
export function maskIdCard(idCard: string, keepHead: number = 6, keepTail: number = 4): string {
  if (typeof idCard !== 'string') return '';
  if (idCard.length <= keepHead + keepTail) return '';
  return idCard.slice(0, keepHead) + '*'.repeat(idCard.length - keepHead - keepTail) + idCard.slice(-keepTail);
}

/**
 * 邮箱脱敏 —— foo@bar.com → f**@bar.com
 * 保留首字符 + @ 后全部
 */
export function maskEmail(email: string): string {
  if (typeof email !== 'string' || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 1) return email;
  return local[0] + '**' + '@' + domain;
}

/**
 * 姓名脱敏 —— 张三 → 张*；欧阳娜娜 → 欧**（保留首字符）
 */
export function maskName(name: string): string {
  if (typeof name !== 'string') return '';
  if (name.length === 0) return '';
  if (name.length === 1) return name;
  return name[0] + '*'.repeat(name.length - 1);
}

/**
 * 银行卡号脱敏 —— 6222021234567890 → 622202****7890
 * 保留前 6 + 后 4（行业通用规范）
 */
export function maskBankCard(card: string): string {
  if (typeof card !== 'string') return '';
  if (card.length < 10) return '';
  return card.slice(0, 6) + '*'.repeat(Math.max(0, card.length - 10)) + card.slice(-4);
}

/**
 * 通用字符串脱敏 —— 保留头尾 + 中间 * 替换
 * @example mask('13800138000', 3, 4) === '138****8000'
 */
export function mask(input: string, keepHead: number = 2, keepTail: number = 2, char: string = '*'): string {
  if (typeof input !== 'string') return '';
  if (input.length <= keepHead + keepTail) return input;
  return input.slice(0, keepHead) + char.repeat(input.length - keepHead - keepTail) + input.slice(-keepTail);
}