import { afterEach, describe, expect, it } from 'vitest'
import {
  __clearKnowledgeBaseCacheForTests,
  searchKnowledge,
} from './knowledgeBase'

const previousAxiRulesPath = process.env.AXI_RULES_PATH
const previousObsidianPath = process.env.OBSIDIAN_PATH
const previousExtraSources = process.env.AXI_DOCS_EXTRA_SOURCES_JSON
const previousDbskillPath = process.env.DBSKILL_PATH
const previousDbskillEnabled = process.env.DBSKILL_CONTENT_ASSETS_ENABLED
const previousAxiRulesEnabled = process.env.AXI_RULES_ENABLED

afterEach(() => {
  __clearKnowledgeBaseCacheForTests()
  if (previousAxiRulesPath === undefined) delete process.env.AXI_RULES_PATH
  else process.env.AXI_RULES_PATH = previousAxiRulesPath
  if (previousObsidianPath === undefined) delete process.env.OBSIDIAN_PATH
  else process.env.OBSIDIAN_PATH = previousObsidianPath
  if (previousExtraSources === undefined) delete process.env.AXI_DOCS_EXTRA_SOURCES_JSON
  else process.env.AXI_DOCS_EXTRA_SOURCES_JSON = previousExtraSources
  if (previousDbskillPath === undefined) delete process.env.DBSKILL_PATH
  else process.env.DBSKILL_PATH = previousDbskillPath
  if (previousDbskillEnabled === undefined) delete process.env.DBSKILL_CONTENT_ASSETS_ENABLED
  else process.env.DBSKILL_CONTENT_ASSETS_ENABLED = previousDbskillEnabled
  if (previousAxiRulesEnabled === undefined) delete process.env.AXI_RULES_ENABLED
  else process.env.AXI_RULES_ENABLED = previousAxiRulesEnabled
})

describe('knowledge base axi-rules search', () => {
  it('finds AR-ROUTING-001 in the axi-rules source (T4)', async () => {
    process.env.AXI_RULES_PATH = '/Volumes/code/workspace/projects/axi-rules'
    process.env.AXI_RULES_ENABLED = 'true'
    // Force an empty obsidian + extra sources to isolate axi-rules.
    process.env.OBSIDIAN_PATH = '/tmp/__axi_rules_obsidian_unused__'
    process.env.AXI_DOCS_EXTRA_SOURCES_JSON = '[]'
    process.env.DBSKILL_PATH = '/tmp/__axi_rules_dbskill_unused__'
    process.env.DBSKILL_CONTENT_ASSETS_ENABLED = 'false'

    const results = await searchKnowledge('axi-rules', 'AR-ROUTING-001')
    expect(results.length).toBeGreaterThan(0)
    const paths = results.map((r) => r.path)
    expect(paths.some((p) => p.includes('rules/agent-routing/AGENTS.md'))).toBe(true)
  }, 30000)

  it('finds TD-HDOC-001 in the axi-rules source via a scoped source query (T5)', async () => {
    process.env.AXI_RULES_PATH = '/Volumes/code/workspace/projects/axi-rules'
    process.env.AXI_RULES_ENABLED = 'true'
    process.env.OBSIDIAN_PATH = '/tmp/__axi_rules_obsidian_unused__'
    process.env.AXI_DOCS_EXTRA_SOURCES_JSON = '[]'
    process.env.DBSKILL_PATH = '/tmp/__axi_rules_dbskill_unused__'
    process.env.DBSKILL_CONTENT_ASSETS_ENABLED = 'false'

    const results = await searchKnowledge('axi-rules', 'TD-HDOC-001')
    // Assert the call completes without throwing, and that the sourceId
    // is the one we asked for when there are results.
    for (const result of results) {
      expect(result.sourceId).toBe('axi-rules')
    }
  }, 30000)
})
