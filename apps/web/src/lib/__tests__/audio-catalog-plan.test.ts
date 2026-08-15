import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { parseAudioPlan } from '@aquila/stories';
import { LOCAL_BGM_CATALOG } from '@/lib/audio/bgm-catalog';
import { LOCAL_SFX_CATALOG } from '@/lib/audio/sfx-catalog';

const planPath = resolve(
    process.cwd(),
    '../../packages/stories/raw/theSeventhMirror/docs/audio-plan.json'
);
const plan = parseAudioPlan(JSON.parse(readFileSync(planPath, 'utf8')));
const plannedTypeByKey = new Map(
    plan.assets.map(asset => [asset.key, asset.type] as const)
);
const localEntries = [
    ...Object.keys(LOCAL_SFX_CATALOG).map(key => ({
        type: 'sfx' as const,
        key,
    })),
    ...Object.keys(LOCAL_BGM_CATALOG).map(key => ({
        type: 'bgm' as const,
        key,
    })),
];

describe('local audio catalogs', () => {
    it.each(localEntries)(
        '$type:$key is present in the story audio plan',
        entry => {
            expect(plannedTypeByKey.get(entry.key)).toBe(entry.type);
        }
    );
});
