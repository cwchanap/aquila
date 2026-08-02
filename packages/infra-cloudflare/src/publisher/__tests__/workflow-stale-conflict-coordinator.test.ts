import { describe, expect, it } from 'vitest';
import {
    coordinateStaleConflict,
    type StaleConflictCoordinatorOptions,
} from '../../../../../.github/scripts/r2-stale-conflict-coordinator';
import { PublisherError } from '../errors';
import type { PublisherReportV1 } from '../report';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
} from '../stores/delivery-store';

const PUBLISH_ARGS = [
    'publish',
    '--story',
    'example_story',
    '--environment',
    'preview',
    '--preview-id',
    'gate-123',
    '--plan',
    '/workspace/aquila/plan.json',
    '--source-root',
    '/workspace/aquila/source',
    '--destination',
    'r2',
    '--json',
];
const ACTIVATE_ARGS = [
    'activate',
    '--story',
    'example_story',
    '--environment',
    'preview',
    '--preview-id',
    'gate-123',
    '--release',
    `sha256-${'a'.repeat(64)}`,
    '--expect-manifest-sha256',
    'b'.repeat(64),
    '--destination',
    'r2',
    '--reactivate',
    '--json',
];

function report(
    command: PublisherReportV1['command'],
    status: PublisherReportV1['status']
): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command,
        status,
        storyId: 'example_story',
        target: { kind: 'preview', previewId: 'gate-123' },
        counts: {
            included: 0,
            omitted: 0,
            objectsCreated: 0,
            objectsReused: 0,
            manifestsCreated: 0,
            manifestsReused: 0,
            pointersWritten: 0,
        },
        actions: [],
        warnings: [],
        errors: [],
        pointer: { changed: false },
    };
}

function fakeStore(events: string[], label: string) {
    let closeCount = 0;
    const store: DeliveryStore = {
        stat: async () => null,
        read: async () => {
            throw new Error('unused');
        },
        createImmutable: async request => {
            events.push(`${label}:create:${request.key}`);
            return { status: 'created' as const };
        },
        inspectPointer: async () => ({ exists: false as const }),
        readPointer: async () => ({ exists: false as const }),
        compareAndSwapPointer: async () => ({ status: 'written' as const }),
        async *listKeys() {},
        async *list() {},
        close: async () => {
            closeCount += 1;
            events.push(`${label}:close`);
        },
    };
    return { store, closeCount: () => closeCount };
}

function options(
    runCommand: NonNullable<
        StaleConflictCoordinatorOptions['cliOverrides']
    >['runCommand'],
    events: string[]
) {
    const publish = fakeStore(events, 'publish');
    const activation = fakeStore(events, 'activation');
    return {
        value: {
            publishArgs: PUBLISH_ARGS,
            activationArgs: ACTIVATE_ARGS,
            createPublishStore: async () => publish.store,
            createActivationStore: async () => activation.store,
            cliOverrides: {
                repositoryRoot: '/workspace/aquila',
                environment: {
                    R2_PUBLISHER_ACCESS_KEY_ID: 'publisher-access',
                    R2_PUBLISHER_SECRET_ACCESS_KEY: 'publisher-secret',
                },
                createLocalStore: async () => {
                    throw new Error('local store must not be selected');
                },
                runCommand,
            },
        } satisfies StaleConflictCoordinatorOptions,
        publish,
        activation,
    };
}

const immutable = (key: string): ImmutableCreateRequest => ({
    key,
    bytes: new Uint8Array([1]),
    contentType: 'image/webp',
    cacheControl: 'public, max-age=31536000, immutable',
});

describe('workflow stale-conflict coordinator', () => {
    it('drifts through the activation CLI while publish is blocked at its first immutable create', async () => {
        const events: string[] = [];
        let drifted = false;
        const setup = options(async command => {
            if (command.command === 'activate') {
                events.push('activation:run');
                drifted = true;
                return report('activate', 'success');
            }
            await command.store.createImmutable(immutable('vn/objects/one'));
            await command.store.createImmutable(immutable('vn/objects/two'));
            events.push('publish:resumed');
            return report('publish', drifted ? 'conflict' : 'success');
        }, events);

        const result = await coordinateStaleConflict(setup.value);

        expect(result.publishExit).toBe(4);
        expect(result.activationExit).toBe(0);
        expect(result.issue).toBeUndefined();
        expect(JSON.parse(result.publishStdout)).toMatchObject({
            status: 'conflict',
            counts: { pointersWritten: 0 },
        });
        expect(events).toEqual([
            'activation:run',
            'activation:close',
            'publish:create:vn/objects/one',
            'publish:create:vn/objects/two',
            'publish:resumed',
            'publish:close',
        ]);
        expect(setup.publish.closeCount()).toBe(1);
        expect(setup.activation.closeCount()).toBe(1);
    });

    it('coordinates drift when reused objects leave only the preview manifest to create', async () => {
        const events: string[] = [];
        let drifted = false;
        const setup = options(async command => {
            if (command.command === 'activate') {
                events.push('activation:run');
                drifted = true;
                return report('activate', 'success');
            }
            await command.store.createImmutable(
                immutable(
                    `vn/previews/gate-123/stories/example_story/releases/sha256-${'c'.repeat(64)}/runtime-manifest.json`
                )
            );
            events.push('publish:resumed');
            return report('publish', drifted ? 'conflict' : 'success');
        }, events);

        const result = await coordinateStaleConflict(setup.value);

        expect(result.publishExit).toBe(4);
        expect(result.activationExit).toBe(0);
        expect(result.issue).toBeUndefined();
        expect(JSON.parse(result.publishStdout)).toMatchObject({
            status: 'conflict',
            counts: { pointersWritten: 0 },
        });
        expect(events).toEqual([
            'activation:run',
            'activation:close',
            `publish:create:vn/previews/gate-123/stories/example_story/releases/sha256-${'c'.repeat(64)}/runtime-manifest.json`,
            'publish:resumed',
            'publish:close',
        ]);
        expect(events.some(event => event.includes('/objects/'))).toBe(false);
        expect(setup.publish.closeCount()).toBe(1);
        expect(setup.activation.closeCount()).toBe(1);
    });

    it('releases and awaits publish when activation fails', async () => {
        const events: string[] = [];
        const setup = options(async command => {
            if (command.command === 'activate') {
                events.push('activation:run');
                throw new PublisherError('storage', 'activation failed');
            }
            await command.store.createImmutable(immutable('vn/objects/one'));
            await command.store.createImmutable(immutable('vn/objects/two'));
            events.push('publish:resumed');
            return report('publish', 'success');
        }, events);

        const result = await coordinateStaleConflict(setup.value);

        expect(result.publishExit).toBe(0);
        expect(result.activationExit).toBe(3);
        expect(result.issue).toBe('activation-exit-3');
        expect(events).toContain('publish:resumed');
        expect(events.at(-1)).toBe('publish:close');
        expect(setup.publish.closeCount()).toBe(1);
        expect(setup.activation.closeCount()).toBe(1);
    });
});
