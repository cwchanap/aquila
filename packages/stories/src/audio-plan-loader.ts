import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAudioPlan, type AudioPlanV1 } from './audio-plan';

export class AudioPlanInputError extends Error {
    constructor(message: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'AudioPlanInputError';
    }
}

/**
 * Node-only loader for per-story audio plan files. Kept out of the shared
 * `audio-plan` module (and the package entry) so browser bundles importing
 * `@aquila/stories` never pull in `node:fs`/`node:path`.
 */
export function loadAudioPlan(rawDir: string): AudioPlanV1 | undefined {
    const planPath = join(rawDir, 'docs', 'audio-plan.json');
    if (!existsSync(planPath)) return undefined;

    const planText = readFileSync(planPath, 'utf8');
    let value: unknown;
    try {
        value = JSON.parse(planText);
    } catch (error) {
        throw new AudioPlanInputError(
            `[story-compiler] ${planPath}: invalid audio-plan JSON`,
            error
        );
    }

    try {
        return parseAudioPlan(value);
    } catch (error) {
        throw new AudioPlanInputError(
            `[story-compiler] ${planPath}: invalid audio plan`,
            error
        );
    }
}
