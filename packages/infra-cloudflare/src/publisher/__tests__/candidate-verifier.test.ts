import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
    canonicalJson,
    canonicalReleaseContent,
    getObjectPath,
    getReleaseManifestPath,
    qualifyAssetIdentity,
    releaseIdFromContentSha256,
    type PublicationTarget,
    type RuntimeAssetManifestV1,
    type StoryAssetCoverageReport,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import {
    verifyPreparedRelease,
    verifyStoredRelease,
} from '../candidate-verifier';
import {
    sha256Bytes,
    sha256ManifestBytes,
    sha256ReleaseContent,
} from '../hash';
import { buildPreparedRelease } from '../runtime-release';
import { LocalDeliveryStore } from '../stores/local-delivery-store';
import type { DeliveryStore, StoredObject } from '../stores/delivery-store';
import type { EncodedAsset, EncodedVariant, PreparedRelease } from '../types';

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const STORY_ID = 'example_story';
const TARGET: PublicationTarget = { kind: 'production' };
const roots: string[] = [];
const stores: DeliveryStore[] = [];

afterEach(async () => {
    await Promise.all(stores.splice(0).map(store => store.close()));
    await Promise.all(
        roots.splice(0).map(root => rm(root, { recursive: true, force: true }))
    );
});

function contentType(format: 'webp' | 'avif'): 'image/webp' | 'image/avif' {
    return format === 'webp' ? 'image/webp' : 'image/avif';
}

async function variant(
    format: 'webp' | 'avif',
    width: number,
    height: number,
    color: { r: number; g: number; b: number; alpha?: number }
): Promise<EncodedVariant> {
    const image = sharp({
        create: {
            width,
            height,
            channels: color.alpha === undefined ? 3 : 4,
            background: color,
        },
    });
    const bytes = new Uint8Array(
        await (format === 'webp' ? image.webp() : image.avif()).toBuffer()
    );
    const sha256 = sha256Bytes(bytes);
    return {
        format,
        bytes,
        sha256,
        path: getObjectPath(sha256, format),
        byteLength: bytes.byteLength,
        contentType: contentType(format),
    };
}

function coverage(): StoryAssetCoverageReport {
    return {
        storyId: STORY_ID,
        byType: {
            background: { total: 1, included: 1, omitted: 0, unclassified: 0 },
            portrait: { total: 1, included: 1, omitted: 0, unclassified: 0 },
        },
        bySection: {
            chapter_1: { total: 2, included: 2, omitted: 0, unclassified: 0 },
        },
        totals: { total: 2, included: 2, omitted: 0, unclassified: 0 },
    };
}

async function preparedRelease(options?: {
    claimedBackgroundWidth?: number;
}): Promise<PreparedRelease> {
    const background: EncodedAsset = {
        identity: { type: 'background', key: 'chapter_1/room' },
        sourcePath: 'example/backgrounds/chapter_1/room.png',
        authoringSection: 'chapter_1',
        variants: [
            await variant('webp', 16, 9, { r: 10, g: 20, b: 30 }),
            await variant('avif', 16, 9, { r: 10, g: 20, b: 30 }),
        ],
        width: options?.claimedBackgroundWidth ?? 16,
        height: 9,
        sourceHasAlpha: false,
        outputHasAlpha: false,
    };
    const portrait: EncodedAsset = {
        identity: { type: 'portrait', key: 'mio/base' },
        sourcePath: 'example/characters/mio/base.png',
        authoringSection: 'chapter_1',
        variants: [
            await variant('webp', 9, 12, {
                r: 120,
                g: 40,
                b: 70,
                alpha: 0.5,
            }),
        ],
        width: 9,
        height: 12,
        sourceHasAlpha: true,
        outputHasAlpha: true,
    };
    const assets = [background, portrait];
    const releasePlan: StoryAssetReleasePlanV1 = {
        schemaVersion: 1,
        storyId: STORY_ID,
        channel: 'production',
        entries: assets.map(asset => ({
            identity: asset.identity,
            disposition: 'included' as const,
            sourcePath: asset.sourcePath,
            section: 'chapter_1',
        })),
    };
    return buildPreparedRelease({
        storyId: STORY_ID,
        target: TARGET,
        releasePlan,
        encodedAssets: assets,
        coverage: coverage(),
    });
}

function rewriteManifest(
    prepared: PreparedRelease,
    mutate: (manifest: RuntimeAssetManifestV1) => RuntimeAssetManifestV1
): PreparedRelease {
    const draft = mutate(structuredClone(prepared.manifest));
    const sortedDraft = {
        ...draft,
        releaseId: `sha256-${'0'.repeat(64)}` as const,
        assets: [...draft.assets].sort((left, right) =>
            qualifyAssetIdentity(left.identity).localeCompare(
                qualifyAssetIdentity(right.identity)
            )
        ),
    };
    const releaseContentSha256 = sha256ReleaseContent(
        canonicalReleaseContent(sortedDraft)
    );
    const releaseId = releaseIdFromContentSha256(
        releaseContentSha256
    ) as `sha256-${string}`;
    const manifest = { ...sortedDraft, releaseId };
    const manifestBytes = new TextEncoder().encode(
        `${canonicalJson(manifest)}\n`
    );
    return {
        ...prepared,
        releaseId,
        releaseContentSha256,
        manifest,
        manifestBytes,
        manifestSha256: sha256ManifestBytes(manifestBytes),
    };
}

async function materialize(
    prepared: PreparedRelease,
    options?: { manifestBytes?: Uint8Array }
): Promise<LocalDeliveryStore> {
    const root = await mkdtemp(join(tmpdir(), 'aquila-candidate-verifier-'));
    roots.push(root);
    const store = new LocalDeliveryStore(root);
    stores.push(store);
    const seen = new Set<string>();
    for (const asset of prepared.encodedAssets) {
        for (const encoded of asset.variants) {
            if (seen.has(encoded.path)) continue;
            seen.add(encoded.path);
            await store.createImmutable({
                key: encoded.path,
                bytes: encoded.bytes,
                contentType: encoded.contentType,
                cacheControl: IMMUTABLE_CACHE,
            });
        }
    }
    await store.createImmutable({
        key: getReleaseManifestPath(
            prepared.storyId,
            prepared.releaseId,
            prepared.target
        ),
        bytes: options?.manifestBytes ?? prepared.manifestBytes,
        contentType: 'application/json',
        cacheControl: IMMUTABLE_CACHE,
    });
    return store;
}

function decorateStore(
    base: DeliveryStore,
    read: (key: string, object: StoredObject) => StoredObject
): DeliveryStore {
    return {
        stat: key => base.stat(key),
        read: async key => read(key, await base.read(key)),
        createImmutable: request => base.createImmutable(request),
        readPointer: key => base.readPointer(key),
        compareAndSwapPointer: request => base.compareAndSwapPointer(request),
        list: prefix => base.list(prefix),
        close: async () => {},
    };
}

async function validFixture(depth: 'shallow' | 'deep' = 'deep') {
    const prepared = await preparedRelease();
    const store = await materialize(prepared);
    return {
        store,
        storyId: prepared.storyId,
        target: prepared.target,
        releaseId: prepared.releaseId,
        depth,
    } as const;
}

describe('candidate verifier', () => {
    it('deep-verifies exact stored manifest identity, bytes, and checksum', async () => {
        const options = await validFixture();
        const expected = await options.store.read(
            getReleaseManifestPath(
                options.storyId,
                options.releaseId,
                options.target
            )
        );

        const verified = await verifyStoredRelease(options);

        expect(verified.manifest).toEqual(
            JSON.parse(new TextDecoder().decode(expected.bytes))
        );
        expect(verified.manifestBytes).toEqual(Uint8Array.from(expected.bytes));
        expect(verified.manifestSha256).toBe(
            createHash('sha256').update(expected.bytes).digest('hex')
        );
        expect(verified.releaseId).toBe(options.releaseId);
    });

    it.each([
        [
            'manifest content type',
            (object: StoredObject) => ({
                ...object,
                contentType: 'text/plain',
            }),
        ],
        [
            'manifest cache control',
            (object: StoredObject) => ({ ...object, cacheControl: 'no-cache' }),
        ],
    ])('rejects corrupt %s', async (_name, corrupt) => {
        const options = await validFixture();
        const manifestPath = getReleaseManifestPath(
            options.storyId,
            options.releaseId,
            options.target
        );
        const store = decorateStore(options.store, (key, object) =>
            key === manifestPath ? corrupt(object) : object
        );

        await expect(
            verifyStoredRelease({ ...options, store })
        ).rejects.toThrow();
    });

    it('rejects a non-exact manifest body', async () => {
        const prepared = await preparedRelease();
        const bytes = new TextEncoder().encode(
            ` ${new TextDecoder().decode(prepared.manifestBytes)}`
        );
        const store = await materialize(prepared, { manifestBytes: bytes });

        await expect(
            verifyStoredRelease({
                store,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                depth: 'shallow',
            })
        ).rejects.toThrow();
    });

    it.each([
        [
            'byte length',
            (object: StoredObject) => ({
                ...object,
                byteLength: object.byteLength + 1,
            }),
        ],
        [
            'body digest',
            (object: StoredObject) => ({
                ...object,
                bytes: Uint8Array.from(object.bytes, (byte, index) =>
                    index === 0 ? byte ^ 0xff : byte
                ),
            }),
        ],
        [
            'content type',
            (object: StoredObject) => ({
                ...object,
                contentType: 'application/octet-stream',
            }),
        ],
        [
            'cache control',
            (object: StoredObject) => ({
                ...object,
                cacheControl: 'max-age=60',
            }),
        ],
    ])('rejects corrupt object %s', async (_name, corrupt) => {
        const options = await validFixture();
        const store = decorateStore(options.store, (key, object) =>
            key.endsWith('.webp') ? corrupt(object) : object
        );

        await expect(
            verifyStoredRelease({ ...options, store })
        ).rejects.toThrow();
    });

    it('rejects decoded dimensions that differ from the manifest', async () => {
        const prepared = await preparedRelease({ claimedBackgroundWidth: 17 });
        const store = await materialize(prepared);

        await expect(
            verifyPreparedRelease({
                store,
                preparedRelease: prepared,
                depth: 'deep',
            })
        ).rejects.toThrow(/dimension/i);
    });

    it('rejects a portrait AVIF variant', async () => {
        const original = await preparedRelease();
        const backgroundAvif = original.manifest.assets.find(
            asset => asset.identity.type === 'background'
        )?.variants.avif;
        if (backgroundAvif === undefined)
            throw new Error('Missing fixture AVIF');
        const prepared = rewriteManifest(original, manifest => {
            const portrait = manifest.assets.find(
                asset => asset.identity.type === 'portrait'
            );
            if (portrait === undefined)
                throw new Error('Missing fixture portrait');
            portrait.variants.avif = backgroundAvif;
            return manifest;
        });
        const store = await materialize(prepared);

        await expect(
            verifyPreparedRelease({
                store,
                preparedRelease: prepared,
                depth: 'deep',
            })
        ).rejects.toThrow(/portrait.*avif/i);
    });

    it('rejects a release without a background', async () => {
        const original = await preparedRelease();
        const prepared = rewriteManifest(original, manifest => ({
            ...manifest,
            assets: manifest.assets.filter(
                asset => asset.identity.type !== 'background'
            ),
        }));
        const store = await materialize(prepared);

        await expect(
            verifyPreparedRelease({
                store,
                preparedRelease: prepared,
                depth: 'shallow',
            })
        ).rejects.toThrow(/background/i);
    });

    it('uses validatePointerManifestPair for a candidate pointer', async () => {
        const verified = await verifyStoredRelease(await validFixture());

        expect(() =>
            verified.validatePointer({
                ...verified.pointerCandidate,
                manifestSha256: '0'.repeat(64) as never,
            })
        ).toThrow();
    });

    it('matches a prepared release byte-for-byte', async () => {
        const prepared = await preparedRelease();
        const store = await materialize(prepared);

        const verified = await verifyPreparedRelease({
            store,
            preparedRelease: prepared,
            depth: 'deep',
        });

        expect(verified.manifestBytes).toEqual(prepared.manifestBytes);
        expect(verified.manifestSha256).toBe(prepared.manifestSha256);
        expect(verified.releaseContentSha256).toBe(
            prepared.releaseContentSha256
        );
    });

    it('reads a shared content-addressed body once', async () => {
        const original = await preparedRelease();
        const portrait = original.manifest.assets.find(
            asset => asset.identity.type === 'portrait'
        );
        if (portrait === undefined) throw new Error('Missing fixture portrait');
        const prepared = rewriteManifest(original, manifest => ({
            ...manifest,
            assets: [
                ...manifest.assets,
                {
                    ...structuredClone(portrait),
                    identity: { type: 'portrait', key: 'mio/smile' },
                },
            ],
        }));
        const base = await materialize(prepared);
        let portraitReads = 0;
        const store = decorateStore(base, (key, object) => {
            if (key === portrait.variants.webp.path) portraitReads += 1;
            return object;
        });

        await verifyPreparedRelease({
            store,
            preparedRelease: prepared,
            depth: 'deep',
        });

        expect(portraitReads).toBe(1);
    });

    it.each(['byteLength', 'dimensions'] as const)(
        'validates shared-object %s for every manifest reference',
        async corruption => {
            const original = await preparedRelease();
            const portrait = original.manifest.assets.find(
                asset => asset.identity.type === 'portrait'
            );
            if (portrait === undefined)
                throw new Error('Missing fixture portrait');
            const prepared = rewriteManifest(original, manifest => ({
                ...manifest,
                assets: [
                    ...manifest.assets,
                    {
                        ...structuredClone(portrait),
                        identity: { type: 'portrait', key: 'mio/smile' },
                        ...(corruption === 'dimensions'
                            ? { width: portrait.width + 1 }
                            : {
                                  variants: {
                                      webp: {
                                          ...portrait.variants.webp,
                                          byteLength:
                                              portrait.variants.webp
                                                  .byteLength + 1,
                                      },
                                  },
                              }),
                    },
                ],
            }));
            const store = await materialize(prepared);

            await expect(
                verifyPreparedRelease({
                    store,
                    preparedRelease: prepared,
                    depth: 'deep',
                })
            ).rejects.toThrow();
        }
    );
});
