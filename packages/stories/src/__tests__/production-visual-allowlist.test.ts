import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_VISUAL_STORY_IDS } from '../story-metadata';

const MEDIA_DIR = join(import.meta.dirname, '../../../assets/media');

const storiesWithArt = readdirSync(MEDIA_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(storyId =>
        readdirSync(join(MEDIA_DIR, storyId)).some(
            dir => dir === 'backgrounds' || dir === 'characters'
        )
    )
    // The Seventh Mirror's art lives in the private source bucket, and its
    // readers follow per-environment pointers rather than this allowlist.
    .filter(storyId => storyId !== 'the_seventh_mirror');

describe('production visual allowlist', () => {
    // A story with art ready is published to production and allowlisted; a
    // story without art must not send readers to a release that cannot exist.
    it('lists exactly the stories with artwork in packages/assets/media', () => {
        expect([...PRODUCTION_VISUAL_STORY_IDS].sort()).toEqual(
            storiesWithArt.sort()
        );
    });
});
