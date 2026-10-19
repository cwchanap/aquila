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
checksums, and generation provenance are in
`packages/assets/generation/short-stories-2026-10-18/`. Each story has a complete
production release plan in `packages/stories/release-plans/`; the plan covers
every authored background and portrait, including shared scenes and endings.

Regenerate the checked-in web delivery assets after changing source artwork:

```sh
bun --filter web build:short-story-assets
bun --filter web verify:short-story-assets
```

The build command runs the existing publisher against the local public asset
directory, retaining immutable object and release filenames and updating only the
five local pointers. It also makes 480 by 720 WebP covers. The verify command
checks release integrity and decodes every image, then checks all cover formats
and dimensions. Normal application builds serve the committed optimized files;
they do not re-encode artwork or require generation credentials.

To see the artwork, open a short story, open reader settings, and choose Visual
Novel (the mobile Text reader offers this in its menu). Text remains available.
