import { join } from 'node:path';
import type { AudioPlanV1 } from './audio-plan';
import { loadAudioPlan } from './audio-plan-loader';
import {
    buildAudioUsageReport,
    collectAudioUsage,
    type AudioUsageReport,
} from './compiler/audio-usage';
import { compileNamedStory } from './compiler/compile-named-story';
import { STORIES_RAW_ROOT } from './compiler/config';

export interface AudioPublishingContext {
    readonly storyFolder: string;
    readonly storyId: string;
    readonly plan: AudioPlanV1;
    readonly usage: AudioUsageReport;
}

export async function loadAudioPublishingContext(
    storyFolder: string,
    rawRoot: string = STORIES_RAW_ROOT
): Promise<AudioPublishingContext> {
    const rawDir = join(rawRoot, storyFolder);
    const story = await compileNamedStory(storyFolder, false, rawRoot);
    const plan = loadAudioPlan(rawDir);
    if (plan === undefined) {
        throw new Error(
            `[audio-publishing] missing audio plan: ${join(rawDir, 'docs', 'audio-plan.json')}`
        );
    }

    return {
        storyFolder,
        storyId: story.storyId,
        plan,
        usage: buildAudioUsageReport(
            story.name,
            collectAudioUsage(story),
            plan
        ),
    };
}
