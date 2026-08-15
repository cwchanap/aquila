import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAudioPlan, type AudioPlanV1 } from './audio-plan';

/**
 * Node-only loader for per-story audio plan files. Kept out of the shared
 * `audio-plan` module (and the package entry) so browser bundles importing
 * `@aquila/stories` never pull in `node:fs`/`node:path`.
 */
export function loadAudioPlan(rawDir: string): AudioPlanV1 | undefined {
    const planPath = join(rawDir, 'docs', 'audio-plan.json');
    if (!existsSync(planPath)) return undefined;

    let value: unknown;
    try {
        value = JSON.parse(readFileSync(planPath, 'utf8'));
    } catch (error) {
        throw new Error(
            `[story-compiler] ${planPath}: invalid audio-plan JSON`,
            { cause: error }
        );
    }

    try {
        return parseAudioPlan(value);
    } catch (error) {
        throw new Error(`[story-compiler] ${planPath}: invalid audio plan`, {
            cause: error,
        });
    }
}
