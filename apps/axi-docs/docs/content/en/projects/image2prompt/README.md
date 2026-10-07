---
id: axi-docs-en-projects-image2prompt
title: Image2Prompt Reference
type: project
status: published
tags: [Axi Docs, Projects, references, reference, browser-extension, vision-llm]
created: 2026-10-07
modified: 2026-10-07
graph-title: Image2Prompt Reference
graph-tags: [Projects, references, browser-extension]
description: Manifest V3 Chrome/Edge reference extension that turns any image on a web page into an AI-ready text prompt with one click. `image2prompt` is the canonical pattern reference for browser-extension UX in an AI-first product surface, built on `manifest.json` + `background.js` + `content.js` + `chrome.storage` with `Gemini 2.5 Flash` and `Zhipu GLM-4V` as the two `image2prompt` backends.
project:
  id: image2prompt
  partition: references
  path: /Volumes/code/workspace/references/short-term/image2prompt
  source-section: reference
---

# Image2Prompt Reference

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/references/short-term/image2prompt`.
> Section: reference / Partition: `references/`.

## Summary

`image2prompt` is a self-contained, zero-dependency **Manifest V3 Chrome/Edge extension** that turns any image on a web page into an AI-ready text prompt with a single click. When the user hovers over an `<img>` element, a small floating "edit" badge appears in the bottom-right corner; clicking it uploads the image to a configured vision LLM (Gemini 2.5 Flash or Zhipu GLM-4V), parses the model's reply into a text-to-image prompt, copies it to the clipboard, and optionally opens the user's preferred image-generation platform (OpenAI / Gemini ImageFX / Midjourney / 即梦 / 可灵 / Doubao / 海螺AI / Stable Diffusion Web / custom) in a new tab with the prompt pre-filled. The extension is open-source, free, ships with no build step, and uses only browser-native APIs (`chrome.storage`, `chrome.runtime`, `chrome.tabs`) plus two well-known HTTPS endpoints.

For Axi, the project is a useful pattern reference for **browser extension UX in an AI-first product surface**. It demonstrates a complete, working flow that touches every layer an Axi browser extension would need: image interception in the content script, an "always-on" prompt-generator service worker, a rich options page for API key + model + UX customization, prompt templating and multilingual generation, and a clipboard → redirect jump. The design also shows how to keep a third-party-facing product fully self-contained (no bundler, no npm runtime deps) so that it can be loaded as "unpacked" or distributed via the Chrome Web Store without a CI-built bundle. Axi teams building any "right-click on an image / on a page → do AI thing" extension should copy the storage schema, content-script guard pattern, and platform URL templating from this repo rather than reinvent them.

A second value is the **manifest-driven permissions model** and the `host_permissions` allow-list (`<all_urls>` plus `generativelanguage.googleapis.com` and `open.bigmodel.cn`). It is a clean example of how to scope a vision-model extension: the content script runs on every page but only talks to two API hosts. Axi's `axi-capability-routing` gateway can absorb the same host-allocation pattern when adding new provider integrations without re-broadcasting wildcard host permissions.

## Stack

`MV3`, `Chrome / Edge`, `Gemini 2.5 Flash`, `Zhipu GLM-4V`, `ES modules`, `Jest 29`, `<all_urls>`, `chrome.storage`, `chrome.runtime`, `chrome.tabs`

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| M1 — Manifest V3 + content/background split | shipped | `manifest.json` with `manifest_version: 3` + `background.type: "module"`, `content_scripts` with `run_at: document_idle` |
| M2 — Multi-provider prompt templating | shipped | `PROMPT_LANGUAGE_RULES` (20 languages) + `PROVIDER_DEFAULTS` + `BUILTIN_PLATFORMS` (8 platforms + customPlatforms) |
| M3 — Options page UX (API key, model, history) | shipped | `options.html` (300 LOC) + `options.js` (2567 LOC) + `options.css` (1496 LOC) with shadcn-inspired look-and-feel |
| M4 — Pure-helper test coverage | shipped | `tests/background.test.js` + `tests/content.test.js` running under `tests/package.json` (jest@^29.7.0) |
| M5 — Axi overlay docs (AGENTS, INDEX, PRD, TDD, TODO, MILESTONE, CHANGELOG) | shipped | full `image2prompt` overlay suite at the reference repo root |

## Build & Install

Because the extension ships as raw files with no bundler, the install story is also the build story.

```bash
# 1. Clone the upstream repo
git clone https://github.com/pingan8787/image2prompt.git

# 2. Open Chrome / Edge extensions page
#    chrome://extensions/  (enable Developer mode in the top-right)
# 3. Click "Load unpacked" and select the project root.
#    Equivalently, drag the entire folder onto the extensions page.
```

Optional: run the Jest unit tests for the pure helper functions.

```bash
cd /Volumes/code/workspace/references/short-term/image2prompt/tests
npm install        # installs only jest
npm test           # runs background.test.js + content.test.js
```

There is no `tsc`, no `vite build`, no `pnpm build`. The whole extension is what you get when you unzip the repo.

## Architecture Highlights

**MV3 content-script injection is universal but the host surface is narrow.** `manifest.json` declares `content_scripts` with `matches: ["<all_urls>"]` and `run_at: "document_idle"`, so the content script loads on every page. The narrow `host_permissions` list — `<all_urls>` for image fetching, plus `https://generativelanguage.googleapis.com/*` and `https://open.bigmodel.cn/*` for the two vision backends — keeps the attack surface small and lets the extension call Gemini and Zhipu without a relay. This is the same split Axi would want when adding a browser-side AI capability: inject broadly to read page state, but only `fetch` to a small, named allow-list.

**The content script handles everything UI; the service worker handles everything network and persistent state.** `content.js` attaches per-image "edit" buttons on `mouseenter`, removes them on `mouseleave` and uses a `i2pTracked` dataset key (`const DATASET_KEY = "i2pTracked"` at line 44) to avoid duplicate listeners on the same element. Clicking the button collects the image (`collectImagePayload`, lines 905-950) by either decoding a `data:` URL or `fetch`-ing the original `img.currentSrc` with `credentials: "include"`, then posts a message to the background worker via `chrome.runtime.sendMessage`. The service worker in `background.js` builds the prompt (composing system instructions, aspect-ratio directive, language directive and optional custom user instructions), calls the provider, sanitizes the response, persists a history entry (`appendGenerationHistory`, line 641) into `chrome.storage.local` under `HISTORY_STORAGE_KEY = "generationHistory"`, capped at `MAX_HISTORY_ENTRIES = 100`, and answers back.

**Prompt generation is templated and multi-lingual, not hard-coded.** `PROMPT_LANGUAGE_RULES` in `background.js` (lines 43-180) defines 20 language entries (`en-US`, `en-GB`, `zh-CN`, `ja-JP`, `ko-KR`, `fr-FR`, `de-DE`, `es-ES`, `es-MX`, `it-IT`, `pt-BR`, `ru-RU`, `hi-IN`, `ar-AE`, `nl-NL`, `tr-TR`, `th-TH`, `vi-VN`, `id-ID`, `pl-PL`), each carrying a `directive` that is concatenated into the system prompt to force the model to reply only in that language. Richness levels (`concise`, `standard`, `detailed`, `very-detailed` — `getRichnessInstruction` at line 844) and aspect-ratio post-processing (`appendAspectRatioToPrompt` at line 817) are similarly data-driven, so adding a new output style means adding an entry rather than editing the call site.

**Provider / platform indirection makes the extension truly multi-model.** `PROVIDER_DEFAULTS` (background.js) and `LLM_PROVIDERS` (options.js) describe each model provider declaratively; `BUILTIN_PLATFORMS` (options.js, lines 382-423) describes each downstream image generator as `{ id, labels, url }` with a `{{prompt}}` template that is replaced at redirect time. Users can register additional platforms through `customPlatforms`. The redirect itself lives in `buildPlatformUrl` (content.js, line 890), which encodes the prompt and either substitutes `{{prompt}}` or appends `?prompt=` / `&prompt=` depending on the URL shape. This is the cleanest model of "extension → AI → redirect to product" that Axi could lift for any "explain this page" or "summarize this video" extension.

**All settings and history are stored client-side via `chrome.storage.local` and merged with defaults on load.** Both `background.js` and `options.js` define an identical `DEFAULT_CONFIG` shape (visible at the top of each file). On boot they call `chrome.storage.sync.get(...)` (options page also reads `chrome.storage.local`) and merge the saved values on top of the defaults. This pattern — duplicated defaults + merge-on-load — is how the extension survives schema evolution: missing keys silently fall back to defaults and old keys (`geminiApiKey`, `zhipuApiKey`, `model`, `zhipuModel`) are migrated by `sanitizeProviderSettings` (background.js, line 949) into the newer `providerSettings` shape.

## Notes

- `manifest.json` declares `manifest_version: 3` with `background.type: "module"`; the content-script and service-worker pair (`background.js` 1021 LOC + `content.js` 1050 LOC) is the canonical MV3 / extension example.
- The host surface is narrow on purpose: `<all_urls>` for image fetching plus `generativelanguage.googleapis.com` and `open.bigmodel.cn` for the two backends; this is the split to reuse for any `axi-*-extension` product.
- Provider + platform templating is data, not code: `PROMPT_LANGUAGE_RULES` (20 languages), `PROVIDER_DEFAULTS`, `BUILTIN_PLATFORMS` (8 platforms), `customPlatforms` registration, `{{prompt}}` URL rewriting in `buildPlatformUrl`.
- Settings + history persistence goes through `chrome.storage.local` (`HISTORY_STORAGE_KEY = "generationHistory"`, capped at `MAX_HISTORY_ENTRIES = 100`); the legacy keys `geminiApiKey` and `zhipuApiKey` are migrated by `sanitizeProviderSettings` (background.js, line 949).
- Pure-helper coverage: `sanitizeDomain`, `normalizeHostname`, `isDomainBlocked`, `parseDataUrl`, `arrayBufferToBase64`, `sanitizeHistoryEntry`, `appendAspectRatioToPrompt`, `buildPlatformUrl` are exercised by `tests/background.test.js` + `tests/content.test.js` under `tests/package.json` (jest@^29.7.0).
- Clipboard fallback chain: `copyToClipboard` (content.js, line 865) — try `navigator.clipboard.writeText` first, fall back to a hidden `<textarea>` + `document.execCommand("copy")`. Lift into any Axi tooling that has to work across content / popup / background contexts.
- Schema migration in `chrome.storage` is a clean pattern for any Axi extension that needs to evolve its storage shape without breaking installed users.

## Cross-References

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Image2Prompt Reference".
- Project root: `/Volumes/code/workspace/references/short-term/image2prompt`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/short-term/image2prompt/AGENTS.md`
- Project `README.md`: `/Volumes/code/workspace/references/short-term/image2prompt/README.md`
- Upstream repository: `https://github.com/pingan8787/image2prompt`
- **Axi browser extension surface** (any future `axi-*-extension` product): copy the `<all_urls>` content-script + narrow `host_permissions` split, the `i2pTracked` dataset dedupe pattern, the `applyButtonAppearance` CSS-variable style binding, and the `buildPlatformUrl` `{{prompt}}` templating.
- **AI capability routing (`/Users/mose/.cc-connect/bin/ai-capability`)**: the `LLM_PROVIDERS` declarative table and `sanitizeProviderSettings` migration are the same shape as the routing registry; the extension is a working example of how to add a new provider by editing one table entry instead of patching call sites.
- **Visual prompt generation feature** for any Axi product that wants a "describe this image" button: the `collectImagePayload` flow (data-URL vs `fetch` with `credentials: "include"`, base64 encoding via `arrayBufferToBase64`, mime detection from `blob.type`) is the canonical implementation.
- **i18n**: the `UI_STRINGS` and `TEXT_CONTENT` pattern (a single `language` field, two flat string tables, `getUiString(key)` lookup with English fallback) is a low-dep way to ship bilingual UI without pulling in `react-i18next` or `i18next`.
- **Clipboard fallback chain**: `copyToClipboard` (content.js line 865) — try `navigator.clipboard.writeText` when the document has focus, otherwise fall back to a hidden `<textarea>` + `document.execCommand("copy")`. Worth lifting into Axi tooling that has to work across contexts (background, popup, content).
- **Schema migration in `chrome.storage`**: `sanitizeProviderSettings` (background.js line 949) is a clean example of reading legacy flat keys (`geminiApiKey`, `zhipuApiKey`) into a new nested `providerSettings` shape without breaking existing users.