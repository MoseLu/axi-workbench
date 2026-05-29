# Redraw Atlas Contract

This contract is the source of truth for 32-row pet atlases handed from visual
generation to `OllamaPetRunner`. It started with Miku, and the same geometry and
row map now apply to every built-in pet.

## Geometry

- Output: `<pet-root>/<pet-id>/spritesheet.redraw.webp`
- Primary pet root: `/Users/mose/Library/Application Support/OllamaMenuAssistant/Pets`
- Compatibility pet root: `/Users/mose/.codex/pets`
- Columns: 8
- Rows: 32
- Frame size: 192 x 208 px
- Atlas size: 1536 x 6656 px
- Display size in Runner: 128 x 139 pt
- Background: transparent after chroma-key removal

The Runner still supports the existing 9-row and 24-row sheets. If
`spritesheet.redraw.webp` exists it is loaded first, then
`spritesheet.directional.webp`, then the `pet.json` spritesheet path.

## Verified Rollout

Verified on 2026-05-10:

- Pets: `miku`, `miku-sakura`, `miku-snow`, `chocola`, `vanilla`, `mashiro`, `mashiro-school`
- Each `spritesheet.redraw.webp` is 1536 x 6656 px
- Every runtime-used frame cell in the row map below is non-empty
- The same seven redraw atlases are present in both pet roots listed above

## Visual Identity Lock

Keep each pet's identity stable across every row. For Miku, this means:

- chibi desktop pet proportions
- compact pixel-art-adjacent silhouette
- teal twin tails, dark outline, readable face at 128 x 139 pt
- no text, labels, UI, shadows, detached effects, speed lines, or scenery
- every frame centered with safe padding inside its 192 x 208 slot

## Row Map

| Row | State | Frames | FPS | Notes |
| --- | --- | ---: | ---: | --- |
| 0 | `idle` | 6 | 6 | Calm breathing idle. |
| 1 | `running-right` | 8 | 10 | Right-facing run. |
| 2 | `running-left` | 8 | 10 | Left-facing run. |
| 3 | `waving` | 4 | 8 | Simple click fallback. |
| 4 | `jumping` | 5 | 8 | Hop fallback and feet fallback. |
| 5 | `failed` | 6 | 6 | Reserved Assistant row. |
| 6 | `waiting` | 6 | 7 | Base-atlas breath fallback. |
| 7 | `running` | 6 | 10 | Front/back vertical fallback. |
| 8 | `review` | 6 | 6 | Reserved Assistant row. |
| 9 | `running-up` | 6 | 10 | Back/up run. |
| 10 | `running-down` | 6 | 10 | Front/down run. |
| 11 | `running-up-right` | 8 | 10 | Diagonal up-right run. |
| 12 | `running-up-left` | 8 | 10 | Diagonal up-left run. |
| 13 | `running-down-right` | 8 | 10 | Diagonal down-right run. |
| 14 | `running-down-left` | 8 | 10 | Diagonal down-left run. |
| 15 | `catching-breath` | 6 | 7 | Run fatigue, changing expression. |
| 16 | `arrive-hands-on-hips` | 6 | 7 | Arrival pose, hands on hips. |
| 17 | `arrive-peace` | 6 | 7 | Arrival pose, peace sign. |
| 18 | `dragging` | 5 | 8 | Being dragged by mouse. |
| 19 | `head-pat` | 6 | 7 | Click head region. |
| 20 | `body-tap` | 4 | 8 | Click body region during calm idle. |
| 21 | `left-tail-tap` | 6 | 7 | Click left tail/side region. |
| 22 | `right-tail-tap` | 6 | 7 | Click right tail/side region. |
| 23 | `feet-tap` | 5 | 8 | Click feet/lower region. |
| 24 | `idle-blink` | 6 | 5 | Still idle variant: slow blink. |
| 25 | `idle-look-around` | 6 | 5 | Still idle variant: looking left/right. |
| 26 | `idle-hair-sway` | 6 | 6 | Still idle variant: twin-tail sway. |
| 27 | `idle-stretch` | 8 | 6 | Still idle variant: small stretch/yawn. |
| 28 | `idle-blink-tap` | 5 | 8 | Body click while blink idle is active. |
| 29 | `idle-look-around-tap` | 6 | 7 | Body click while look-around idle is active. |
| 30 | `idle-hair-sway-tap` | 6 | 7 | Body click while hair-sway idle is active. |
| 31 | `idle-stretch-tap` | 6 | 7 | Body click while stretch idle is active. |

## Row Prompt Template

Use this template per row when generating real visual rows:

```text
Create one 8-frame horizontal sprite animation strip for a tiny chibi Miku
desktop pet.

State: <state name>
Frame count to use: <frames>, with any unused cells fully empty/transparent
after cleanup.
Style: pixel-art-adjacent desktop pet, thick dark outline, flat cel shading,
limited palette, crisp readable face, compact 192 x 208 frame.
Identity lock: teal twin tails, same head shape, same face, same outfit colors,
same proportions, same outline weight as the canonical Miku pet reference.
Pose/action: <state-specific note from the table>.
Background: perfectly flat #00ff00 chroma-key, no texture, no floor, no shadow.
Avoid: text, labels, UI, scenery, detached effects, motion lines, dust, sparkles,
blur, gradients, shadows, cropped limbs, frame numbers, visible grid.
```

## Runtime Behavior

- No target: Runner rotates through `idle`, `idle-blink`, `idle-look-around`,
  `idle-hair-sway`, and `idle-stretch`.
- Body click: the active idle variant chooses its matching body interaction row.
- Head, side/tail, and feet clicks keep their region-specific rows.
- Dragging loops `dragging`.
- Long runs can interrupt into `catching-breath`.
- Arrival plays `catching-breath`, then `arrive-hands-on-hips`, then
  `arrive-peace`.
