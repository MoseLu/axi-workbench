import { z } from "zod"

// ============================================
// Common Schemas
// ============================================

export const UUIDSchema = z.string().uuid()
export const IdSchema = z.string().min(1)

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
})

export const SortOrderEnum = z.enum(["asc", "desc"])

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    code: z.number(),
    message: z.string(),
    data: dataSchema,
  })

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalPages: z.number().int(),
  })

export const ErrorResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
  })).optional(),
})

// ============================================
// Entity Schemas
// ============================================

export const UserStatusEnum = z.enum(["active", "inactive", "suspended"])
export const UserRoleEnum = z.enum(["admin", "user", "guest"])

export const UserSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: UserRoleEnum,
  status: UserStatusEnum,
  avatar: z.string().url().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type User = z.infer<typeof UserSchema>

export const ProjectStatusEnum = z.enum(["active", "archived", "draft", "completed"])

export const ProjectSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  status: ProjectStatusEnum,
  ownerId: UUIDSchema,
  teamId: UUIDSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Project = z.infer<typeof ProjectSchema>

export const TaskStatusEnum = z.enum(["todo", "in_progress", "review", "done", "cancelled"])
export const TaskPriorityEnum = z.enum(["low", "medium", "high", "urgent"])

export const TaskSchema = z.object({
  id: UUIDSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: TaskStatusEnum,
  priority: TaskPriorityEnum,
  projectId: UUIDSchema,
  assigneeId: UUIDSchema.optional(),
  dueDate: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Task = z.infer<typeof TaskSchema>

// ============================================
// Request Schemas
// ============================================

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
export type LoginInput = z.infer<typeof LoginInput>

export const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
})
export type RegisterInput = z.infer<typeof RegisterInput>

export const RefreshTokenInput = z.object({
  refreshToken: z.string(),
})

export const CreateProjectInput = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
})

export const UpdateProjectInput = CreateProjectInput.partial()

export const CreateTaskInput = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const UpdateTaskInput = CreateTaskInput.partial()

// ============================================
// Response Schemas
// ============================================

export const TokenResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
})
export type TokenResponse = z.infer<typeof TokenResponse>

export const UserResponse = UserSchema

export const ProjectListResponse = PaginatedResponseSchema(ProjectSchema)
export type ProjectListResponse = z.infer<typeof ProjectListResponse>

export const ProjectResponse = ProjectSchema

export const TaskListResponse = PaginatedResponseSchema(TaskSchema)
export type TaskListResponse = z.infer<typeof TaskListResponse>

export const TaskResponse = TaskSchema

// ============================================
// Index exports
// ============================================

export * from "./common"
export * from "./entities"
export * from "./requests"
export * from "./responses"
