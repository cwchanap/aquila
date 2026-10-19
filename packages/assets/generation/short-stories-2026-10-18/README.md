# Five short stories: generated artwork

Generated with the built-in image_gen tool from the story image manifests and character descriptions.

[Open the gallery](gallery.html) · [Full prompt and asset mapping](jobs.json) · [Validation](validation.json)

| Story | Cover | Distinct backgrounds | Portraits |
| --- | ---: | ---: | ---: |
| The Elevator Game | 1 | 5 | 4 |
| The Demon Lord Is Hiring | 1 | 2 | 8 |
| The 3 A.M. Laundromat | 1 | 3 | 5 |
| Day 4,012 | 1 | 3 | 6 |
| One Pot Before Dawn | 1 | 3 | 8 |

52 distinct images are stored under `packages/assets/media/<story_id>/`, occupying 65 compiler-compatible file paths including shared scene copies. Portrait PNGs contain genuine alpha. Covers contain no typography.

All manifest paths are covered, all PNGs decode, aspect orientations and portrait transparency are verified, and repeated-scene copies have matching SHA-256 checksums.

The story compiler outputs already refer to the background and portrait paths. Covers are stored in each story’s `covers/cover.png`. The generated art is now connected through complete bundled visual releases and story-card covers. See `docs/infrastructure/short-story-art.md` for rebuilding and verification. Remote R2 publication is not required for these app-bundled assets.

The prompt record retains original source prompts, final prompts used, edit references, output dimensions, byte lengths, checksums, and rejected-generation reasons. Original generated images remain in Codex’s generated-image folder.
