/**
 * Validation Utilities
 * 
 * 提供基于 Zod 的运行时验证工具函数
 * 用于表单验证、数据校验等场景
 */
import { z, ZodError, ZodSchema } from 'zod';

/**
 * 验证结果类型
 */
export interface ValidationResult<T> {
  /** 是否验证通过 */
  success: boolean;
  /** 验证通过时的数据 */
  data?: T;
  /** 验证失败时的错误 */
  error?: ZodError;
  /** 格式化的错误消息 */
  errors?: Record<string, string[]>;
}

/**
 * 安全解析数据
 */
export function safeParse<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }
  
  return {
    success: false,
    error: result.error,
    errors: formatErrors(result.error),
  };
}

/**
 * 格式化 Zod 错误为对象
 */
export function formatErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  
  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }
  
  return errors;
}

/**
 * 格式化单个错误
 */
export function formatErrorMessages(error: ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * 创建表单验证器
 */
export function createValidator<T>(schema: ZodSchema<T>) {
  return (data: unknown): ValidationResult<T> => {
    return safeParse(schema, data);
  };
}

/**
 * 验证并转换数据
 */
export function parseAndTransform<T extends ZodSchema>(
  schema: T,
  data: z.input<T>
): ValidationResult<z.output<T>> {
  try {
    const parsed = schema.parse(data);
    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error,
        errors: formatErrors(error),
      };
    }
    throw error;
  }
}

/**
 * 便捷验证器 - 邮箱
 */
export const email = (message = '请输入有效的邮箱地址'): z.ZodString => 
  z.string().email(message);

/**
 * 便捷验证器 - 手机号
 */
export const phone = (message = '请输入有效的手机号码'): z.ZodString => 
  z.string().regex(/^1[3-9]\d{9}$/, message);

/**
 * 便捷验证器 - 密码
 */
export const password = (options: {
  minLength?: number;
  maxLength?: number;
  requireNumber?: boolean;
  requireUpper?: boolean;
} = {}): z.ZodString => {
  const { minLength = 8, maxLength = 32, requireNumber = false, requireUpper = false } = options;
  
  let schema = z.string()
    .min(minLength, `密码至少需要 ${minLength} 个字符`)
    .max(maxLength, `密码最多 ${maxLength} 个字符`);
  
  if (requireNumber) schema = schema.regex(/\d/, '密码必须包含数字');
  if (requireUpper) schema = schema.regex(/[A-Z]/, '密码必须包含大写字母');
  
  return schema;
};

/**
 * 便捷验证器 - 用户名
 */
export const username = (message = '用户名至少 3 个字符') => 
  z.string().min(3, message).max(20, '用户名最多 20 个字符');

/**
 * 便捷验证器 - URL
 */
export const urlSchema = (message = '请输入有效的 URL') => 
  z.string().url(message);

/**
 * 便捷验证器 - 正整数
 */
export const positiveInt = (message = '请输入正整数') => 
  z.number().int().positive(message);

/**
 * 便捷验证器 - 整数
 */
export const integer = (options: { min?: number; max?: number } = {}): z.ZodNumber => {
  let schema = z.number().int('请输入整数');
  if (options.min !== undefined) schema = schema.min(options.min);
  if (options.max !== undefined) schema = schema.max(options.max);
  return schema;
};

/**
 * 便捷验证器 - 布尔值
 */
export const boolSchema = z.boolean();

/**
 * 便捷验证器 - 日期
 */
export const dateSchema = z.coerce.date();

/**
 * 便捷验证器 - 枚举值
 */
export const enumSchema = <T extends readonly string[]>(
  values: T,
  message = `值必须是以下之一: ${values.join(', ')}`
) => z.enum(values, { message });

/**
 * 创建复合验证 schema (常用于表单)
 */
export function createFormValidator<T extends z.ZodType>(schema: T) {
  return {
    validate: (data: unknown) => {
      return safeParse(schema as ZodSchema<z.output<typeof schema>>, data);
    },
    schema,
  };
}

export default {
  safeParse,
  formatErrors,
  formatErrorMessages,
  createValidator,
  parseAndTransform,
  email,
  phone,
  password,
  username,
  urlSchema,
  positiveInt,
  integer,
  boolSchema,
  dateSchema,
  enumSchema,
  createFormValidator,
};
