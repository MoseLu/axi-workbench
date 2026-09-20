import { stat } from 'fs/promises'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const OSS = require('ali-oss')
const __filename = fileURLToPath(import.meta.url)

const MIME_TYPES = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`)
  }
  return value
}

function readOptionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }
  return ''
}

function readPositiveNumberEnv(name, fallback) {
  const raw = process.env[name]?.trim()
  if (!raw) {
    return fallback
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

function sanitizePrefix(value) {
  return String(value || '')
    .split('/')
    .map(segment => sanitizeSegment(segment))
    .filter(Boolean)
    .join('/')
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  return MIME_TYPES[extension] || 'application/octet-stream'
}

function joinUrl(baseUrl, objectKey) {
  return `${baseUrl.replace(/\/+$/, '')}/${objectKey.replace(/^\/+/, '')}`
}

function encodeObjectKey(objectKey) {
  return objectKey
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

function buildPublicUrl({ bucket, region, publicBaseUrl, objectKey }) {
  if (publicBaseUrl) {
    return joinUrl(publicBaseUrl, encodeObjectKey(objectKey))
  }

  return `https://${bucket}.${region}.aliyuncs.com/${encodeObjectKey(objectKey)}`
}

async function uploadAttachment() {
  const filePath = readRequiredEnv('BLINKO_ATTACHMENT_FILE')
  const noteId = sanitizeSegment(process.env.BLINKO_ATTACHMENT_NOTE_ID || 'unassigned')
  const accessKeyId = readRequiredEnv('AXI_ALIYUN_OSS_ACCESS_KEY_ID')
  const accessKeySecret = readRequiredEnv('AXI_ALIYUN_OSS_ACCESS_KEY_SECRET')
  const bucket = readOptionalEnv(
    'BLINKO_OSS_BUCKET',
    'AXI_ALIYUN_OSS_PUBLIC_BUCKET',
    'AXI_ALIYUN_OSS_PRIVATE_BUCKET',
  )
  if (!bucket) {
    throw new Error('缺少可用的 OSS bucket 配置')
  }
  const region = readRequiredEnv('AXI_ALIYUN_OSS_REGION')
  const prefix = sanitizePrefix(process.env.BLINKO_OSS_PREFIX || 'blinko')
  const endpoint = process.env.AXI_ALIYUN_OSS_ENDPOINT?.trim() || undefined
  const publicBaseUrl = process.env.BLINKO_OSS_PUBLIC_BASE_URL?.trim() || ''
  const signedUrlExpiresSeconds = readPositiveNumberEnv('BLINKO_OSS_SIGNED_URL_EXPIRES_SECONDS', 0)
  const stsToken = process.env.AXI_ALIYUN_OSS_STS_TOKEN?.trim() || undefined
  const timeout = Number(process.env.BLINKO_OSS_TIMEOUT_MS || 60000)

  const fileStat = await stat(filePath)
  if (!fileStat.isFile()) {
    throw new Error(`附件源文件不存在: ${filePath}`)
  }

  const fileName = path.basename(filePath)
  const objectKey = path.posix.join(prefix, noteId, sanitizeSegment(fileName))

  const client = new OSS({
    accessKeyId,
    accessKeySecret,
    authorizationV4: true,
    bucket,
    region,
    secure: true,
    timeout,
    ...(endpoint ? { endpoint } : {}),
    ...(stsToken ? { stsToken } : {}),
  })
  const signerClient = new OSS({
    accessKeyId,
    accessKeySecret,
    bucket,
    region,
    secure: true,
    timeout,
    ...(endpoint ? { endpoint } : {}),
    ...(stsToken ? { stsToken } : {}),
  })

  await client.put(objectKey, filePath, {
    headers: {
      'Content-Type': getContentType(filePath),
    },
  })

  const publicUrl = signedUrlExpiresSeconds > 0
    ? signerClient.signatureUrl(objectKey, { expires: signedUrlExpiresSeconds })
    : buildPublicUrl({
      bucket,
      region,
      publicBaseUrl,
      objectKey,
    })

  process.stdout.write(JSON.stringify({
    name: fileName,
    path: publicUrl,
    size: fileStat.size,
    type: getContentType(filePath),
  }))
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectExecution) {
  void uploadAttachment().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[fatal] 附件上传失败: ${message}`)
    process.exitCode = 1
  })
}
