/**
 * @axi/artboard-vite-plugin — public entry point.
 *
 * Provides the AST-based source-stamp plugin and the dev-only
 * perception-endpoint plugin. Consumers typically want both:
 *
 *   import { defineConfig } from 'vite'
 *   import { artboardVitePlugin } from '@axi/artboard-vite-plugin'
 *
 *   export default defineConfig({
 *     plugins: [artboardVitePlugin()],
 *   })
 *
 * For finer control, import the two plugins individually.
 */

export { default as sourceAttrsAstPlugin } from './plugin.js'
export { default as perceptionEndpointPlugin } from './perception-endpoint.js'
export type { SourceAttrsAstOptions } from './plugin.js'
export type { PerceptionEndpointOptions } from './perception-endpoint.js'

import type { Plugin } from 'vite'
import sourceAttrsAstPlugin from './plugin.js'
import perceptionEndpointPlugin, { type PerceptionEndpointOptions } from './perception-endpoint.js'
import type { SourceAttrsAstOptions } from './plugin.js'

export interface ArtboardVitePluginOptions {
  sourceAttrs?: SourceAttrsAstOptions
  perception?: PerceptionEndpointOptions
}

/**
 * Combined plugin that registers both the AST source stamper (runs in
 * dev and prod) and the perception HTTP endpoints (dev only). This is
 * the recommended consumer entry point.
 */
export default function artboardVitePlugin(
  options: ArtboardVitePluginOptions = {}
): Plugin[] {
  return [
    sourceAttrsAstPlugin(options.sourceAttrs),
    perceptionEndpointPlugin(options.perception),
  ]
}

export {
  getLatest,
  setLatest,
  subscribe,
  mergePublished,
} from './server-perception.js'
export type { ServerPerceptionPacket } from './server-perception.js'
