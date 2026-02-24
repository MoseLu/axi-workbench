import { z } from "zod"

export const DocumentChunkSchema = z.object({
  id: z.string(),
  content: z.string(),
  score: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  sourceDocumentId: z.string(),
})

export const SearchResultResponse = z.object({
  chunks: z.array(DocumentChunkSchema),
  searchLatencyMs: z.number(),
})

export const IngestResponse = z.object({
  documentId: z.string(),
  chunksIndexed: z.number(),
})

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>
export type SearchResultResponse = z.infer<typeof SearchResultResponse>
export type IngestResponse = z.infer<typeof IngestResponse>
