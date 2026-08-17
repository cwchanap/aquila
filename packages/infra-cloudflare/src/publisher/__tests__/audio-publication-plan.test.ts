import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
    getAudioCurrentPointerPath,
    getAudioObjectPath,
    getAudioReleaseManifestPath,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { LocalDeliveryStore } from '../stores/local-delivery-store';
import { sha256Bytes } from '../hash';
import { buildPreparedAudioRelease } from '../audio-runtime-release';
import { buildAudioPublicationPlan } from '../audio-publication-plan';
import type { NormalizedAudioAsset } from '../audio-encoder';
import type { AudioCoverageEntryV1 } from '../audio-source';

const target: PublicationTarget = { kind: 'preview', previewId: 'gate-1' };
const storyId = 'example_story';
const roots: string[] = [];

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { recursive: true, force: true }))
    );
});

function asset(): NormalizedAudioAsset {
    const bytes = Uint8Array.from([11, 22, 33]);
    const sha256 = sha256Bytes(bytes);
    return {
        type: 'sfx',
        key: 'door-open',
        bytes,
        sha256,
        path: getAudioObjectPath(sha256),
        byteLength: bytes.byteLength,
        durationMs: 2_200,
        loop: false,
        contentType: 'audio/mpeg',
    };
}

function release() {
    const audioAsset = asset();
    const coverage: AudioCoverageEntryV1[] = [
        {
            type: 'sfx',
            key: 'door-open',
            usageCount: 1,
            disposition: 'included',
        },
    ];
    return buildPreparedAudioRelease({
        storyId,
        target,
        assets: [audioAsset],
        coverage,
    });
}

async function storeFixture(): Promise<LocalDeliveryStore> {
    const root = await mkdtemp(join(tmpdir(), 'aquila-audio-plan-'));
    roots.push(root);
    return new LocalDeliveryStore(root);
}

describe('buildAudioPublicationPlan', () => {
    it('plans MP3 and audio-manifest candidates with immutable metadata', async () => {
        const store = await storeFixture();
        const preparedRelease = release();

        const plan = await buildAudioPublicationPlan({
            store,
            preparedRelease,
        });

        expect(plan.objects).toHaveLength(1);
        expect(plan.objects[0]).toMatchObject({
            kind: 'object',
            key: getAudioObjectPath(preparedRelease.assets[0]!.sha256),
            bytes: preparedRelease.assets[0]!.bytes,
            contentType: 'audio/mpeg',
            cacheControl: 'public, max-age=31536000, immutable',
            status: 'create',
        });
        expect(plan.manifest).toMatchObject({
            kind: 'manifest',
            key: getAudioReleaseManifestPath(
                storyId,
                preparedRelease.releaseId,
                target
            ),
            bytes: preparedRelease.manifestBytes,
            contentType: 'application/json',
            cacheControl: 'public, max-age=31536000, immutable',
            status: 'create',
        });
        expect(plan.advisoryPointer).toMatchObject({
            exists: false,
            activationNeeded: true,
        });
    });

    it('reuses exact immutable candidates and rejects a conflicting object', async () => {
        const store = await storeFixture();
        const preparedRelease = release();
        const first = await buildAudioPublicationPlan({
            store,
            preparedRelease,
        });

        for (const candidate of [...first.objects, first.manifest]) {
            await store.createImmutable({
                key: candidate.key,
                bytes: candidate.bytes,
                contentType: candidate.contentType,
                cacheControl: candidate.cacheControl,
            });
        }

        const reused = await buildAudioPublicationPlan({
            store,
            preparedRelease,
        });
        expect(reused.objects[0]?.status).toBe('reuse');
        expect(reused.manifest.status).toBe('reuse');

        const conflictingStore = await storeFixture();
        const objectKey = getAudioObjectPath(preparedRelease.assets[0]!.sha256);
        await conflictingStore.createImmutable({
            key: objectKey,
            bytes: Uint8Array.from([99, 98, 97]),
            contentType: 'audio/mpeg',
            cacheControl: 'public, max-age=31536000, immutable',
        });
        await expect(
            buildAudioPublicationPlan({
                store: conflictingStore,
                preparedRelease,
            })
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'integrity' });
    });

    it('advisory-reads an existing audio pointer without writing or activating it', async () => {
        const store = await storeFixture();
        const preparedRelease = release();
        const pointerKey = getAudioCurrentPointerPath(storyId, target);
        await store.createImmutable({
            key: pointerKey,
            bytes: new TextEncoder().encode(
                `${JSON.stringify({
                    schemaVersion: 1,
                    storyId,
                    releaseId: preparedRelease.releaseId,
                    publishedAt: '2026-08-17T00:00:00.000Z',
                    manifestPath: getAudioReleaseManifestPath(
                        storyId,
                        preparedRelease.releaseId,
                        target
                    ),
                    manifestSha256: preparedRelease.manifestSha256,
                })}\n`
            ),
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
        });

        const plan = await buildAudioPublicationPlan({
            store,
            preparedRelease,
        });

        expect(plan.advisoryPointer).toMatchObject({
            exists: true,
            activationNeeded: false,
            beforeReleaseId: preparedRelease.releaseId,
        });
        expect((await store.inspectPointer(pointerKey)).exists).toBe(true);
    });
});
