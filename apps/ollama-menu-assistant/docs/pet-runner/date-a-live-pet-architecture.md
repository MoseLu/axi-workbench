# Date A Live Pet Architecture

This document defines the fourth built-in pet category, `date-a-live`, and the
first thirteen rollout slots for Date A Live desktop pets.

## Category Contract

- Canonical group id: `date-a-live`
- Simplified Chinese title: `约会大作战`
- English title: `Date A Live`
- Accepted aliases: `dal`, `date-a-live`, `datealive`, `约战`, `约会大作战`
- Pet root pattern: `<pet-root>/<pet-id>/pet.json`
- Atlas contract: use the shared 32-row redraw atlas in
  [miku-redraw-atlas.md](./miku-redraw-atlas.md)

Use the canonical group id in new pet metadata:

```json
{
  "id": "tohka-yatogami",
  "localizedDisplayNames": {
    "zh-Hans": "夜刀神十香",
    "en": "Tohka Yatogami"
  },
  "description": "Date A Live pet; slot PRINCESS.",
  "spritesheetPath": "spritesheet.webp",
  "group": "date-a-live"
}
```

## Rollout Slots

The first pass is organized as thirteen menu entries. Kaguya and Yuzuru both use
the official `BERSERK` code-name family, but they remain separate desktop pets.

| Slot | Pet id | Menu title | English title | Code name | Visual anchor | Interaction accent |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | `tohka-yatogami` | 十香 | Tohka | PRINCESS | purple palette, sword-bearing chibi silhouette | confident arrival, bright food-happy idle |
| 02 | `yoshino` | 四糸乃 | Yoshino | HERMIT | blue hood, hand puppet, soft rounded silhouette | shy blink, puppet-forward head pat |
| 03 | `kurumi-tokisaki` | 融合灵装-狂三 | Fusion Spirit Dress Kurumi | NIGHTMARE | red-black gothic palette, clock-eye cue | slow theatrical wave, shadowy look-around |
| 04 | `kurumi-kimono` | 和服-狂三 | Kimono Kurumi | NIGHTMARE | red-and-white kimono, long black twin tails, autumn-handdrawn reference simplified into chibi form | graceful sleeve wave, calm seasonal idle |
| 05 | `kotori-itsuka` | 琴里 | Kotori | EFREET | red twin tails, black/white ribbon variants | commander hands-on-hips, candy-like upbeat tap |
| 06 | `kaguya-yamai` | 耶俱矢 | Kaguya | BERSERK | wind motif, confident twin-sister pose language | dramatic arrival, energetic run |
| 07 | `yuzuru-yamai` | 夕弦 | Yuzuru | BERSERK | wind motif, calmer twin-sister pose language | measured arrival, composed paired idle |
| 08 | `miku-izayoi` | 美九 | Miku | DIVA | lavender idol styling, music-performance silhouette | singing wave, spotlight-like idle posture |
| 09 | `natsumi` | 七罪 | Natsumi | WITCH | green witch motif, compact guarded posture | suspicious look-around, transform-flavored tap |
| 10 | `origami-tobiichi` | 折纸 | Origami | ANGEL | white/light palette, precise angular silhouette | disciplined idle, crisp mechanical run |
| 11 | `nia-honjo` | 二亚 | Nia | SISTER | manga-artist cue, relaxed older-sister posture | sketchbook/body tap, playful tired idle |
| 12 | `mukuro-hoshimiya` | 六喰 | Mukuro | ZODIAC | long golden hair, key/space motif | floating calm idle, lock-and-unlock tap beat |
| 13 | `mio-takamiya` | 澪 | Mio | DEUS | white/pale spirit-of-origin motif, serene silhouette | quiet float, gentle origin-themed idle |

## Pet Id Conventions

- Prefer romanized kebab-case ids: `kurumi-tokisaki`, `mukuro-hoshimiya`.
- Keep short ids only when they are unambiguous: `yoshino`, `natsumi`.
- Do not use plain `miku` for Date A Live. Use `miku-izayoi` so the catalog does
  not collide with the Hatsune Miku group.
- Keep the Yamai sisters separate as `kaguya-yamai` and `yuzuru-yamai`.
- Use `mio-takamiya` for 崇宫澪.

## Sprite Direction

Every pet should preserve the shared desktop scale:

- 8 columns x 32 rows, `192x208` per frame
- transparent final background
- readable face and hair silhouette at `128x139 pt`
- no text, UI, scenery, visible grid, frame numbers, or detached effects

The Date A Live set should share a category-level feel: chibi proportions,
strong outlines, flat cel shading, and a slightly sharper fantasy-action pose
language than the Miku/Nekopara/Sakurasou sets.

## References

- Official Date A Live IV character list:
  https://date-a-live4th-anime.com/character/
- Official Date A Live: Rio Reincarnation character page:
  https://ifi.games/date-a-live/chara/
