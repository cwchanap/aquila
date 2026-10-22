# Bundled short-story artwork

The five short stories ship complete visual releases with the web app. Their
backgrounds and portraits use the existing content-addressed runtime format and
WebAssetResolver; covers are optimized WebP images on the story cards. No R2
upload or remote pointer activation is needed for these bundled releases.

`BUNDLED_VISUAL_STORY_IDS` is the delivery allowlist. These stories always load
`/assets/vn/stories/<story_id>/current.json` from the app's own origin, including
on preview deployments. The Seventh Mirror continues to use its existing remote
asset configuration. A reader's saved Text or Visual Novel preference is preserved.

Source PNGs live in `packages/assets/media/<story_id>/`. The original prompts,
checksums, and generation provenance stay out of git under the gitignored
`packages/assets/generation/` directory. Each story has a complete
production release plan in `packages/stories/release-plans/`; the plan covers
every authored background and portrait, including shared scenes and endings.

The delivery assets are gitignored build output, regenerated from source
artwork rather than committed:

```sh
bun --filter web build:short-story-assets
bun --filter web verify:short-story-assets
```

The build command runs the existing publisher against the local public asset
directory, retaining immutable object and release filenames and updating only the
five local pointers. It also makes 480 by 720 WebP covers. The verify command
checks release integrity and decodes every image, requires the public/assets
delivery tree to mirror those verified bytes exactly, then checks all cover
formats and dimensions. The web `build` script runs the asset build automatically, so
deploys need no extra configuration. `bun dev` runs the build script in
`--ensure` mode first: it republishes only a story whose pointer, manifest,
objects, or cover are missing or whose inputs (release plan, generated
image-assets manifest, included source artwork) changed since the last
publish, so restarts after the first are effectively free. E2E CI still runs
the full asset build explicitly before Playwright starts the dev server.
The build needs only the committed source PNGs, never generation
credentials. The publisher's
`.publisher-metadata/` sidecars and `.publisher-transactions/` markers are
gitignored local-store bookkeeping.

To see the artwork, open a short story, open reader settings, and choose Visual
Novel (the mobile Text reader offers this in its menu). Text remains available.
