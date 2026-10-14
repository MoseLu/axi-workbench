// AI-assisted document analysis + versioned fixed context summaries
// for bounded agents. Uses a hard-coded MiniMax Anthropic-compatible
// endpoint to bypass env / proxy issues at server boot.

import crypto from 'crypto'
import * as knowledgeBase from '../lib/knowledgeBase'

// MiniMax Anthropic 兼容端点配置（直接硬编码，绕过环境变量和系统代理问题）
const MINIMAX_API_URL = 'https://api.minimaxi.com/anthropic/v1/messages'
const MINIMAX_API_KEY = process.env.MCP_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'claude-3-5-haiku-20241022'

export async function analyzeDocumentContent(
  content: string,
  fileName: string,
): Promise<{
  summary: string
  keyPoints: string[]
  concepts: Array<{ term: string; definition: string }>
  error?: string
}> {
  try {
    const truncated = content.slice(0, 8000)

    // 直接使用 fetch 调用 MiniMax API（绕过 SDK 的环境变量和代理问题）
    const apiResponse = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MINIMAX_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyze this document and return JSON only, no prose.

Document: "${fileName}"

${truncated}

Return exactly:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "concepts": [
    { "term": "concept name", "definition": "brief explanation" }
  ]
}`,
        }],
      }),
    })

    if (!apiResponse.ok) {
      const errText = await apiResponse.text()
      return { summary: '', keyPoints: [], concepts: [], error: `API error ${apiResponse.status}: ${errText.slice(0, 200)}` }
    }

    const data = apiResponse.json() as {
      content?: Array<{ type: string; text?: string }>
    }

    // MiniMax 可能返回 thinking 块 + text 块，提取 text 块内容
    const textBlock = data.content?.find(c => c.type === 'text')
    const text = textBlock?.text || ''

    if (!text.trim()) {
      return { summary: '', keyPoints: [], concepts: [], error: 'AI 返回内容为空（可能被 MiniMax 内容策略拦截）' }
    }

    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    let parsed: unknown = JSON.parse(clean)
    // 二次解码确保 \uXXXX 完全展开
    parsed = JSON.parse(JSON.stringify(parsed))
    return parsed as { summary: string; keyPoints: string[]; concepts: Array<{ term: string; definition: string }> }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { summary: '', keyPoints: [], concepts: [], error: msg }
  }
}

export async function fixedDocumentContextSummary(source: string, filePath: string) {
  const content = await knowledgeBase.readKnowledgeFile(source, filePath)
  if (content === null) return null
  const version = crypto.createHash('sha256').update(content).digest('hex')
  return {
    contextRef: {
      id: `axi-docs:${source}:${filePath}`,
      version,
      uri: `axi-docs://${encodeURIComponent(source)}/${filePath.split('/').map(encodeURIComponent).join('/')}`,
    },
    summary: {
      characterCount: content.length,
      lineCount: content.split('\n').length,
      excerpt: content.slice(0, 2000),
      truncated: content.length > 2000,
    },
  }
}
