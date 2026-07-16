# The Seventh Mirror Lead Portraits

## Goal

Generate the complete authored portrait-expression set for the two lead characters
in `theSeventhMirror`: Asakura Mio and Asakura Yuma.

## Scope

Create 11 independent PNG assets under
`packages/assets/media/the_seventh_mirror/characters/`:

- `asakura_mio`: `base`, `angry`, `scared`, `sad`, `determined`, `shocked`, `exhausted`
- `asakura_yuma`: `base`, `scared`, `sad`, `determined`

The prompts in `packages/stories/raw/theSeventhMirror/docs/characters.md` are the
source of truth. The generated asset manifest already includes Mio's expressions
and Yuma's `base`; Yuma's other authored expressions will remain available as
assets without changing generated story code until scenes reference them.

## Generation approach

Generate each expression independently with the built-in image-generation tool.
Preserve the authored character identity, upper-body visual-novel framing, clean
background treatment, and expression-specific lighting. Keep each character's
hair, age, clothing, and facial proportions consistent across its expression set.

Do not combine the characters into a shared composition or crop a paired image.
Do not add text, logos, watermarks, unrelated props, or new narrative details.
Use opaque PNGs; native transparency is not part of the current authored asset
contract.

## Validation

- All 11 expected paths exist and use the exact character/expression filenames.
- Each image is a portrait-oriented upper-body composition suitable for the
  visual-novel reader.
- Mio's and Yuma's identities remain recognizable across their expression sets.
- Expression, clothing, lighting, and palette match the corresponding source
  prompt.
- No generated story/compiler files are changed.

If an individual result breaks identity or framing, regenerate that expression
only and re-check the full set before handoff.
