# Short-story artwork

The five short stories (`elevator_game`, `three_am_laundromat`, `day_4012`,
`demon_lord_is_hiring`, `one_pot_before_dawn`) have complete visual releases.
Like every other generated asset they live on the R2 CDN and are never part of
the Vercel bundle (see "Generated Asset Delivery" in `CLAUDE.md`).

| Asset                     | Source in git                                                                    | Published to                                                              |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Backgrounds and portraits | `packages/assets/media/<story>/` + `packages/stories/release-plans/<story>.json` | `vn/stories/<story>/current.json` and the content-addressed `vn/objects/` |
| Cover                     | `packages/assets/media/<story>/covers/cover.png`                                 | `vn/covers/<story>.webp` (480 by 720)                                     |
| Voice                     | `packages/assets/voice/<story>/`                                                 | `vn/voice/<story>/`                                                       |

## Reader behaviour

`PRODUCTION_VISUAL_STORY_IDS` (in `packages/stories/src/story-metadata.ts`) is
the allowlist of stories that always read the **production** release, including
on preview deployments. The Seventh Mirror follows the per-environment preview
pointers instead. A reader's saved Text or Visual Novel preference is
preserved.

The reader needs `PUBLIC_ASSET_BASE_URL` and `PUBLIC_ASSET_ENVIRONMENT`. Without
them (a bare local checkout) the shorts have no art, covers or voice and the
reader falls back to text and gradient covers; set both to the production host
in `apps/web/.env` to see everything locally.

## Publishing

Visual releases go through the publisher (needs `R2_RELEASE_ACCESS_KEY_ID` and
`R2_RELEASE_SECRET_ACCESS_KEY`):

```sh
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story <story> --environment production \
  --plan packages/stories/release-plans/<story>.json \
  --source-root packages/assets/media \
  --destination r2 --confirm-production <story> --json
```

Covers and voice go through `bun --filter @aquila/infra-cloudflare media:sync`
(`--dry-run` lists changes). The `Media Sync` workflow runs it when a PR
touching `packages/assets/voice/` or a cover merges to `main`, so those two need
no manual step.

Each story's release plan covers every authored background and portrait,
including shared scenes and endings. Original prompts, checksums and generation
provenance stay out of git under the gitignored `packages/assets/generation/`.
