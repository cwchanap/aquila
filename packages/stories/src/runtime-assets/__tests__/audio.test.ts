import { describe, expect, it } from 'vitest';
import {
    AssetResolverError,
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalAudioReleaseContent,
    getAudioCurrentPointerPath,
    getAudioObjectPath,
    getAudioReleaseManifestPath,
    isRuntimePointerKey,
    parseAudioActiveReleasePointer,
    parseRuntimeAudioManifest,
    validatePointerManifestPair,
} from '..';

const OBJECT_DIGEST_A = 'a'.repeat(64);
const OBJECT_DIGEST_B = 'b'.repeat(64);
const RELEASE_DIGEST = 'e'.repeat(64);
const RELEASE_ID = `sha256-${RELEASE_DIGEST}`;
const STORY_ID = 'demo_story';
const TARGET = { kind: 'preview' as const, previewId: 'gate-1' };

function validManifestInput() {
    return {
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId: RELEASE_ID,
        assets: [
            {
                identity: { type: 'bgm', key: 'theme-main' },
                format: 'mp3',
                path: `vn/objects/${OBJECT_DIGEST_B}.mp3`,
                sha256: OBJECT_DIGEST_B,
                byteLength: 128_000,
                durationMs: 3_000,
                loop: true,
            },
            {
                identity: { type: 'sfx', key: 'ui-click' },
                format: 'mp3',
                path: `vn/objects/${OBJECT_DIGEST_A}.mp3`,
                sha256: OBJECT_DIGEST_A,
                byteLength: 12_800,
                durationMs: 150,
                loop: false,
            },
        ],
    };
}

function expectRuntimeError(callback: () => unknown): void {
    expect(callback).toThrow(AssetResolverError);
}

function validPointerInput() {
    return {
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId: RELEASE_ID,
        manifestPath: getAudioReleaseManifestPath(STORY_ID, RELEASE_ID, TARGET),
        manifestSha256: OBJECT_DIGEST_A,
        publishedAt: '2026-08-17T00:00:00.000Z',
    };
}

describe('runtime audio paths and pointer-key grammar', () => {
    it('builds audio object and release paths without changing visual paths', () => {
        const digest = assertSha256<'object-content'>(OBJECT_DIGEST_A);
        expect(getAudioObjectPath(digest)).toBe(`vn/objects/${digest}.mp3`);
        expect(
            getAudioReleaseManifestPath('demo_story', RELEASE_ID, {
                kind: 'production',
            })
        ).toBe(
            `vn/audio/stories/demo_story/releases/${RELEASE_ID}/runtime-manifest.json`
        );
        expect(getAudioCurrentPointerPath('demo_story', TARGET)).toBe(
            'vn/previews/gate-1/audio/stories/demo_story/current.json'
        );
    });

    it('accepts exactly the four runtime current-pointer path families', () => {
        const validKeys = [
            'vn/stories/demo_story/current.json',
            'vn/previews/gate-1/stories/demo_story/current.json',
            'vn/audio/stories/demo_story/current.json',
            'vn/previews/gate-1/audio/stories/demo_story/current.json',
        ];
        for (const key of validKeys)
            expect(isRuntimePointerKey(key)).toBe(true);
    });

    it('rejects malformed, extra-segment, and arbitrary current-pointer paths', () => {
        const invalidKeys = [
            'current.json',
            'vn/private/current.json',
            'vn/stories/Demo_story/current.json',
            'vn/stories/demo-story/current.json',
            'vn/stories/demo_story/extra/current.json',
            'vn/stories//current.json',
            'vn/previews/Gate-1/stories/demo_story/current.json',
            'vn/previews/gate-1/stories/demo_story/current.json/extra',
            'vn/previews/gate-1/audio/stories/demo_story/current.json.bak',
            'vn/audio/stories/../current.json',
        ];
        for (const key of invalidKeys)
            expect(isRuntimePointerKey(key)).toBe(false);
    });
});

describe('runtime audio manifest', () => {
    it('parses one SFX and one looping BGM with the v1 wire shape', () => {
        const manifest = parseRuntimeAudioManifest(validManifestInput());
        expect(manifest.schemaVersion).toBe(1);
        expect(manifest.assets.map(asset => asset.identity.type)).toEqual([
            'bgm',
            'sfx',
        ]);
        expect(manifest.assets[0].loop).toBe(true);
        expect(manifest.assets[1].loop).toBe(false);
    });

    it('rejects duplicate identities and reverse qualified-identity order', () => {
        const duplicate = validManifestInput();
        duplicate.assets.push({ ...duplicate.assets[1] });
        expectRuntimeError(() => parseRuntimeAudioManifest(duplicate));

        const reversed = validManifestInput();
        reversed.assets.reverse();
        expectRuntimeError(() => parseRuntimeAudioManifest(reversed));
    });

    it('rejects unsafe keys, paths, malformed digests, and path/digest mismatches', () => {
        const unsafeKey = validManifestInput();
        unsafeKey.assets[0].identity.key = '../theme';
        expectRuntimeError(() => parseRuntimeAudioManifest(unsafeKey));

        const unsafePath = validManifestInput();
        unsafePath.assets[0].path = 'vn/objects/../theme.mp3';
        expectRuntimeError(() => parseRuntimeAudioManifest(unsafePath));

        const malformedDigest = validManifestInput();
        malformedDigest.assets[0].sha256 = 'not-a-sha256';
        expectRuntimeError(() => parseRuntimeAudioManifest(malformedDigest));

        const mismatchedPath = validManifestInput();
        mismatchedPath.assets[0].path = `vn/objects/${OBJECT_DIGEST_A}.mp3`;
        expectRuntimeError(() => parseRuntimeAudioManifest(mismatchedPath));
    });

    it('rejects non-positive duration and type/loop mismatches', () => {
        for (const durationMs of [0, -1]) {
            const invalid = validManifestInput();
            invalid.assets[0].durationMs = durationMs;
            expectRuntimeError(() => parseRuntimeAudioManifest(invalid));
        }

        const sfxLooping = validManifestInput();
        sfxLooping.assets[1].loop = true;
        expectRuntimeError(() => parseRuntimeAudioManifest(sfxLooping));

        const bgmNotLooping = validManifestInput();
        bgmNotLooping.assets[0].loop = false;
        expectRuntimeError(() => parseRuntimeAudioManifest(bgmNotLooping));
    });

    it('rejects additive authoring, provider, candidate, receipt, and credential fields', () => {
        for (const key of [
            'prompt',
            'provider',
            'sourcePath',
            'candidateId',
            'receipt',
            'credential',
            'token',
            'apiKey',
            'model',
            'compilerUsagePath',
            'requestIds',
            'compilerUsagePaths',
            'generationSpecs',
            'selectionNotes',
            'candidateMetadata',
            'sourceSha256',
        ]) {
            const invalid = {
                ...validManifestInput(),
                [key]: 'must not reach runtime data',
            };
            expectRuntimeError(() => parseRuntimeAudioManifest(invalid));
        }
    });

    it('canonicalizes sorted audio release content without releaseId', () => {
        const manifest = parseRuntimeAudioManifest(validManifestInput());
        const shuffled = {
            ...manifest,
            assets: [...manifest.assets].reverse(),
        };
        expect(canonicalAudioReleaseContent(shuffled)).toBe(
            canonicalAudioReleaseContent(manifest)
        );
        expect(canonicalAudioReleaseContent(manifest)).not.toContain(
            'releaseId'
        );
    });
});

describe('runtime audio active-release pointer', () => {
    it('parses audio pointers and binds manifestPath to the audio path grammar', () => {
        const pointer = parseAudioActiveReleasePointer(
            validPointerInput(),
            TARGET,
            STORY_ID
        );
        expect(pointer.manifestPath).toBe(
            getAudioReleaseManifestPath(STORY_ID, RELEASE_ID, TARGET)
        );

        const wrongPath = {
            ...validPointerInput(),
            manifestPath: `vn/stories/${STORY_ID}/releases/${RELEASE_ID}/runtime-manifest.json`,
        };
        expectRuntimeError(() =>
            parseAudioActiveReleasePointer(wrongPath, TARGET, STORY_ID)
        );
        expectRuntimeError(() =>
            parseAudioActiveReleasePointer(
                validPointerInput(),
                TARGET,
                'other_story'
            )
        );
    });

    it('reuses structural release-id and pointer/manifest integrity helpers', () => {
        const releaseDigest = assertSha256<'release-content'>(RELEASE_DIGEST);
        expect(() =>
            assertReleaseIdMatchesContentSha256(
                { releaseId: RELEASE_ID },
                releaseDigest
            )
        ).not.toThrow();

        const pointer = parseAudioActiveReleasePointer(
            validPointerInput(),
            TARGET,
            STORY_ID
        );
        expect(() =>
            validatePointerManifestPair(
                pointer,
                { storyId: STORY_ID, releaseId: RELEASE_ID },
                pointer.manifestSha256
            )
        ).not.toThrow();
    });
});
