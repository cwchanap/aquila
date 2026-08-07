import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverAuthoringCatalog } from '../authoring-catalog';
import { validatePublisherCoverage } from '../coverage';
import { loadReleasePlan, resolveReleasePlanPath } from '../release-plan';

const STORY_ID = 'the_seventh_mirror';
const TARGET = { kind: 'production' } as const;
const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

describe('The Seventh Mirror production release plan', () => {
    it('covers the generated catalog with at least one included asset', async () => {
        const catalog = await discoverAuthoringCatalog(repositoryRoot, STORY_ID);
        const planPath = await resolveReleasePlanPath({
            repositoryRoot,
            storyId: STORY_ID,
            target: TARGET,
        });
        const plan = await loadReleasePlan(planPath);
        const availableSourcePaths = new Set(
            plan.entries
                .filter(entry => entry.disposition === 'included')
                .map(entry => entry.sourcePath)
        );

        const coverage = validatePublisherCoverage({
            catalog,
            plan,
            target: TARGET,
            availableSourcePaths,
        });

        expect(coverage.totals.unclassified).toBe(0);
        expect(coverage.totals.included).toBeGreaterThan(0);
    });
});
