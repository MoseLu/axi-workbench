/**
 * plugin.test.ts — TDD-hard test for the AST source stamper.
 *
 * Per AGENTS.md §145-151, every behavior change to a Success
 * Criterion, an Acceptance row, a pure helper, hook, or component
 * under `src/overlay/**` (and by extension the plugin that powers it)
 * must follow the red-then-green flow. These tests assert the
 * observable contract of the plugin:
 *
 *   1. The transform injects `Name.__axi_source__ = { file, line, column }`
 *      at the correct offsets for top-level function components.
 *   2. React.memo / forwardRef / styled call-expression wrappers
 *      get stamped on the inner function body.
 *   3. Idempotency: re-running transform on already-stamped code is a
 *      no-op.
 *   4. Parse failures fall through silently.
 *
 * Line numbers are 0-based (matching the Vite 8 parseAst plugin's
 * output and source-map.ts expectations).
 */

import { describe, expect, it } from 'vitest'
import path from 'node:path'
import sourceAttrsAstPlugin from '../src/plugin.js'

type TransformHook = (code: string, id: string) => { code: string; map: null } | null

function runTransform(code: string, id: string): { code: string; map: null } | null {
  const plugin = sourceAttrsAstPlugin()
  const transform = plugin.transform as unknown as TransformHook
  return transform(code, id)
}

const SAMPLE_ID = '/Volumes/code/workspace/projects/axi-workbench/apps/axi-artboard/src/Foo.tsx'
const SAMPLE_REL = path.relative(process.cwd(), SAMPLE_ID).replaceAll('\\', '/')

describe('sourceAttrsAstPlugin', () => {
  it('stamps a top-level function component declaration', () => {
    const src = `export function Foo() {\n  return null;\n}\n`
    const out = runTransform(src, SAMPLE_ID)
    expect(out).not.toBeNull()
    expect(out!.code).toContain('Foo.__axi_source__')
    expect(out!.code).toMatch(/line:\s*0/)
    expect(out!.code).toContain(`file: ${JSON.stringify(SAMPLE_REL)}`)
  })

  it('stamps a const arrow function component', () => {
    const src = `const Bar = () => {\n  return <div/>;\n};\nexport default Bar;\n`
    const out = runTransform(src, SAMPLE_ID.replace('Foo.tsx', 'Bar.tsx'))
    expect(out).not.toBeNull()
    expect(out!.code).toContain('Bar.__axi_source__')
  })

  it('stamps React.memo wrapper inner function', () => {
    const src = `import { memo } from 'react';\nconst Baz = memo(function Inner() {\n  return null;\n});\n`
    const out = runTransform(src, SAMPLE_ID.replace('Foo.tsx', 'Baz.tsx'))
    expect(out).not.toBeNull()
    // The inner function `Inner` is the body that gets stamped, not Baz.
    expect(out!.code).toContain('Inner.__axi_source__')
  })

  it('stamps forwardRef wrapper inner function', () => {
    const src = `import { forwardRef } from 'react';\nconst Qux = forwardRef(function Real() {\n  return null;\n});\n`
    const out = runTransform(src, SAMPLE_ID.replace('Foo.tsx', 'Qux.tsx'))
    expect(out).not.toBeNull()
    expect(out!.code).toContain('Real.__axi_source__')
  })

  it('is idempotent — re-running transform is a no-op', () => {
    const src = `export function Once() {\n  return null;\n}\n`
    const first = runTransform(src, SAMPLE_ID.replace('Foo.tsx', 'Once.tsx'))
    expect(first).not.toBeNull()
    const second = runTransform(first!.code, SAMPLE_ID.replace('Foo.tsx', 'Once.tsx'))
    expect(second).toBeNull()
  })

  it('skips test files', () => {
    const src = `export function Skip() {\n  return null;\n}\n`
    const out = runTransform(src, SAMPLE_ID.replace('Foo.tsx', 'Skip.test.tsx'))
    expect(out).toBeNull()
  })

  it('falls through silently on parse failure', () => {
    const src = `export function Broken( { return null; }\n` // intentionally malformed
    const out = runTransform(src, SAMPLE_ID.replace('Foo.tsx', 'Broken.tsx'))
    expect(out).toBeNull()
  })

  it('ignores lowercase (non-component) identifiers', () => {
    const src = `export function notAComponent() {\n  return null;\n}\n`
    const out = runTransform(src, SAMPLE_ID.replace('Foo.tsx', 'utils.ts'))
    expect(out).toBeNull()
  })
})
