/**
 * plugin.ts — AST-based source-stamp Vite plugin.
 *
 * Walks the @babel/parser AST and stamps every JSX-derived function
 * component with `__axi_source__ = { file, line, column }` so the
 * browser-side `source-map.ts` can resolve components back to their
 * original source location.
 *
 * Why @babel (and not Vite 8's `parseAst` from rolldown): the
 * workbench hosts this on Vite 5.4, which does not expose the
 * rolldown AST. @babel/parser is the canonical TypeScript + JSX
 * parser and the API surface used by babel/eslint toolchain.
 *
 * Strategy: parse → walk top-level statements → for each
 * component-like identifier, splice a statement that assigns
 * `Name.__axi_source__ = { file, line, column }`. Splicing happens
 * from the END of the file backwards so earlier offsets stay valid.
 * Line numbers are computed once from the original `code` and re-used.
 */

import type { Plugin } from 'vite'
import path from 'node:path'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import type { File, Node } from '@babel/types'

// @babel/traverse ships as default + named; CJS/ESM interop pattern.
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse

export interface SourceAttrsAstOptions {
  /** Glob patterns to instrument. Default: /\.[jt]sx$/ */
  include?: RegExp[]
  /** Glob patterns to skip. Default: node_modules, dist, *.test.* */
  exclude?: RegExp[]
}

interface BodyStamp {
  kind: 'body'
  /** Character offset inside the function body where the stamp
   *  statement will be inserted (i.e. `body.start + 1`). */
  insertAt: number
  name: string
  line: number
}

interface ModuleStamp {
  kind: 'module'
  /** Identifier name. We always stamp at the top of the file. */
  name: string
}

type Stamp = BodyStamp | ModuleStamp

export default function sourceAttrsAstPlugin(_options: SourceAttrsAstOptions = {}): Plugin {
  const include = _options.include ?? [/\.[jt]sx?$/]
  const exclude = _options.exclude ?? [/node_modules/, /dist/, /\.test\./, /\.spec\./]

  return {
    name: 'axi-artboard:source-attrs-ast',
    enforce: 'post',

    transform(code, id) {
      if (!include.some((p) => p.test(id))) return null
      if (exclude.some((p) => p.test(id))) return null

      let program: File
      try {
        program = parse(code, {
          sourceType: 'module',
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true,
          allowSuperOutsideMethod: true,
          allowUndeclaredExports: true,
          errorRecovery: true,
          plugins: [
            'jsx',
            'typescript',
            ...(id.endsWith('.tsx') || id.endsWith('.jsx') ? [] : []),
          ],
        })
      } catch {
        // Parse failure → silently fall through. source-map.ts will
        // report `unknown` for those components.
        return null
      }

      // Idempotency: HMR + transform chains can re-invoke `transform`
      // for the same module. If we already stamped this file, leave
      // it alone. We detect prior stamping by looking for our
      // distinctive `file: "<relpath>"` pattern in the source.
      const relPath = path.relative(process.cwd(), id).replaceAll('\\', '/')
      const stamp = `file: ${JSON.stringify(relPath)}`
      if (code.includes(stamp)) {
        return null
      }

      // Build the per-file line index ONCE for every `lineOf` call
      // we'll make. The transform hook is single-threaded per file
      // in dev mode.
      cachedSource = code
      cachedLineStarts = buildLineIndex(code)
      lineCache.clear()

      // First pass: collect every binding the module declares so the
      // re-export specifier pass can decide whether the local name is
      // actually a component this file defined.
      const bindings = new Set<string>()
      for (const stmt of program.program.body) collectDeclaredNames(stmt, bindings)

      // Second pass: collect Stamps.
      const stamps: Stamp[] = []
      for (const stmt of program.program.body) collectStamps(stmt, stamps, bindings)

      // Drop the module-level cache so the next file doesn't see
      // stale offsets.
      cachedSource = null
      cachedLineStarts = null
      lineCache.clear()

      if (stamps.length === 0) return null

      // Splice from end backwards so offsets remain valid.
      const bodyStamps = stamps.filter((s): s is BodyStamp => s.kind === 'body')
      const moduleStamps = stamps.filter((s): s is ModuleStamp => s.kind === 'module')
      bodyStamps.sort((a, b) => b.insertAt - a.insertAt)

      let out = code
      for (const s of bodyStamps) {
        const stmt = `;${s.name}.__axi_source__ = { file: ${JSON.stringify(relPath)}, line: ${s.line}, column: 0 };\n`
        out = out.slice(0, s.insertAt) + stmt + out.slice(s.insertAt)
      }
      if (moduleStamps.length > 0) {
        const head =
          '/* injected by axi-artboard */\n' +
          moduleStamps
            .map(
              (s) =>
                `;${s.name}.__axi_source__ = { file: ${JSON.stringify(relPath)}, line: 0, column: 0 };\n`
            )
            .join('')
        out = head + out
      }
      return { code: out, map: null }
    },
  }
}

function collectDeclaredNames(stmt: Node, out: Set<string>): void {
  switch (stmt.type) {
    case 'FunctionDeclaration':
      if (stmt.id?.name) out.add(stmt.id.name)
      return
    case 'VariableDeclaration':
      for (const d of stmt.declarations) collectDeclName(d, out)
      return
    case 'ExportNamedDeclaration':
      if (stmt.declaration) collectDeclaredNames(stmt.declaration, out)
      for (const spec of stmt.specifiers ?? []) {
        if (spec.type === 'ExportSpecifier' && spec.local.type === 'Identifier') {
          out.add(spec.local.name)
        }
      }
      return
    case 'ExportDefaultDeclaration':
      if (stmt.declaration.type === 'FunctionDeclaration' && stmt.declaration.id) {
        out.add(stmt.declaration.id.name)
      }
      return
    default:
      return
  }
}

function collectDeclName(d: Node, out: Set<string>): void {
  if (d.type === 'VariableDeclarator' && d.id.type === 'Identifier') {
    out.add(d.id.name)
  }
}

// ---------- stamp collection ----------

function collectStamps(stmt: Node, out: Stamp[], bindings: Set<string>): void {
  switch (stmt.type) {
    case 'FunctionDeclaration':
      stampFunctionDecl(stmt, out)
      return
    case 'ExportNamedDeclaration':
      if (!stmt.declaration) {
        for (const spec of stmt.specifiers ?? []) {
          if (spec.type === 'ExportSpecifier') stampExportSpecifier(spec, out, bindings)
        }
        return
      }
      collectStamps(stmt.declaration, out, bindings)
      return
    case 'ExportDefaultDeclaration':
      stampDefaultDecl(stmt, out)
      return
    case 'VariableDeclaration':
      for (const d of stmt.declarations) stampVariableDecl(d, out)
      return
    default:
      return
  }
}

function stampFunctionDecl(stmt: Node, out: Stamp[]): void {
  if (stmt.type !== 'FunctionDeclaration') return
  const name = stmt.id?.name
  if (!name || !/^[A-Z]/.test(name)) return
  // Insert just AFTER the body's opening `{`. `body.start + 1` is
  // the position right after the `{`, which is a valid Statement
  // insertion point and keeps the function declaration syntactically
  // intact.
  const insertAt = (stmt.body?.start ?? stmt.start ?? 0) + 1
  out.push({
    kind: 'body',
    insertAt,
    name,
    line: lineOf(stmt.start ?? 0),
  })
}

function stampVariableDecl(d: Node, out: Stamp[]): void {
  if (d.type !== 'VariableDeclarator') return
  if (d.id.type !== 'Identifier') return
  const name = d.id.name
  if (!/^[A-Z]/.test(name)) return
  const init = d.init
  if (!init) return

  // Direct function component: assign on the outer identifier. We
  // inject inside the body (as the first statement) so we never
  // tamper with the `function Name(` or `const Name =` header.
  if (init.type === 'FunctionExpression' || init.type === 'ArrowFunctionExpression') {
    const insertAt = ((init.body?.start ?? init.start) ?? 0) + 1
    out.push({ kind: 'body', insertAt, name, line: lineOf(d.start ?? 0) })
    return
  }

  // CallExpression wrapper (React.memo(...), forwardRef(...),
  // styled.div`...` ...):
  //   - React.memo(fn) / forwardRef(fn) → stamp the inner `fn`
  //     function with `Inner.__axi_source__ = ...` so source-map.ts
  //     (which unwraps React.memo / forwardRef to find the inner
  //     function) can locate it.
  //   - styled.div`...` → we don't deep-walk tagged templates; the
  //     outer `Foo` stays without __axi_source__ and source-map.ts
  //     falls back to Function.prototype.toString() regex.
  if (init.type === 'CallExpression') {
    const arg = init.arguments[0]
    if (
      arg &&
      (arg.type === 'FunctionExpression' || arg.type === 'ArrowFunctionExpression')
    ) {
      // Prefer the inner function's own name (named function
      // expression `function Inner() { ... }`). Fall back to the
      // outer identifier for anonymous inner functions.
      const innerName =
        arg.type === 'FunctionExpression' && arg.id?.name
          ? arg.id.name
          : name
      const insertAt = ((arg.body?.start ?? arg.start) ?? 0) + 1
      out.push({
        kind: 'body',
        insertAt,
        name: innerName,
        line: lineOf(arg.start ?? d.start ?? 0),
      })
    }
    return
  }
}

function stampDefaultDecl(stmt: Node, out: Stamp[]): void {
  if (stmt.type !== 'ExportDefaultDeclaration') return
  if (stmt.declaration?.type === 'FunctionDeclaration' && stmt.declaration.id) {
    const id = stmt.declaration.id
    if (/^[A-Z]/.test(id.name)) {
      const insertAt = (stmt.declaration.body?.start ?? stmt.declaration.start ?? 0) + 1
      out.push({ kind: 'body', insertAt, name: id.name, line: lineOf(stmt.start ?? 0) })
    }
  }
}

function stampExportSpecifier(spec: Node, out: Stamp[], bindings: Set<string>): void {
  if (spec.type !== 'ExportSpecifier') return
  if (spec.local.type !== 'Identifier') return
  const localName = spec.local.name
  if (!bindings.has(localName)) return
  if (!/^[A-Z]/.test(localName)) return
  // Re-export has no obvious body to splice into. Inject at file head.
  out.push({ kind: 'module', name: localName })
}

/**
 * Per-file line-count cache, keyed by source start. The `transform`
 * hook is called once per file so this is single-threaded; the cache
 * is rebuilt on every call to keep things obvious.
 */
const lineCache = new Map<number, number>()
let cachedSource: string | null = null
let cachedLineStarts: number[] | null = null

function lineOf(offset: number): number {
  if (cachedSource === null || cachedLineStarts === null) {
    // Fallback when called outside transform (e.g. test). Returns 0;
    // the dev tooling prints 1-based lines so 0 reads as "unknown".
    return 0
  }
  if (lineCache.has(offset)) return lineCache.get(offset)!
  // Binary search lineStarts (each entry is the char offset of that
  // line's first character).
  const arr = cachedLineStarts
  let lo = 0
  let hi = arr.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (arr[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  const line = lo
  lineCache.set(offset, line)
  return line
}

/**
 * Walk every character of `source` once to build an array of line
 * start offsets. Called from `transform` before collecting stamps.
 */
function buildLineIndex(source: string): number[] {
  const out: number[] = [0]
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) out.push(i + 1)
  }
  return out
}
