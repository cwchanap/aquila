import { describe, expect, it } from 'vitest';
import {
    readAssetSourceConfigFromEnv,
    resolveAssetSource,
} from '../asset-source-config';

const ORIGIN = 'http://localhost:5090';
const REMOTE = 'https://assets.aquila.cwchanap.dev/';

describe('readAssetSourceConfigFromEnv', () => {
    it('treats empty and whitespace-only values as unset', () => {
        expect(
            readAssetSourceConfigFromEnv({
                PUBLIC_ASSET_BASE_URL: '',
                PUBLIC_ASSET_ENVIRONMENT: '   ',
                PUBLIC_ASSET_PREVIEW_ID: '',
            })
        ).toEqual({});
    });

    it('trims surrounding whitespace', () => {
        expect(
            readAssetSourceConfigFromEnv({
                PUBLIC_ASSET_BASE_URL: ` ${REMOTE} `,
                PUBLIC_ASSET_ENVIRONMENT: 'production',
            })
        ).toEqual({ baseUrl: REMOTE, environment: 'production' });
    });
});

const STORY = 'the_seventh_mirror';

describe('resolveAssetSource', () => {
    it('falls back to local fixtures when nothing is configured', () => {
        expect(resolveAssetSource(STORY, ORIGIN, {})).toEqual({
            environment: 'local',
            storyId: STORY,
            baseUrl: 'http://localhost:5090/assets/',
            target: { kind: 'preview', previewId: 'hpa-228-local' },
        });
    });

    it('builds a production source', () => {
        expect(
            resolveAssetSource(STORY, ORIGIN, {
                baseUrl: REMOTE,
                environment: 'production',
            })
        ).toEqual({
            environment: 'production',
            storyId: STORY,
            baseUrl: REMOTE,
            target: { kind: 'production' },
        });
    });

    it('builds a preview source', () => {
        expect(
            resolveAssetSource(STORY, ORIGIN, {
                baseUrl: REMOTE,
                environment: 'preview',
                previewId: 'hpa-229',
            })
        ).toEqual({
            environment: 'preview',
            storyId: STORY,
            baseUrl: REMOTE,
            target: { kind: 'preview', previewId: 'hpa-229' },
        });
    });

    it('allows an explicit local base url over http', () => {
        expect(
            resolveAssetSource(STORY, ORIGIN, {
                baseUrl: 'http://127.0.0.1:8788/',
                environment: 'local',
            }).baseUrl
        ).toBe('http://127.0.0.1:8788/');
    });

    it.each([
        [{ baseUrl: REMOTE }, /incomplete/i],
        [{ environment: 'production' }, /incomplete/i],
        [{ baseUrl: REMOTE, environment: 'staging' }, /unknown environment/i],
        [{ baseUrl: REMOTE, environment: 'preview' }, /requires a preview id/i],
        [
            { baseUrl: REMOTE, environment: 'preview', previewId: 'HPA-229' },
            /invalid preview id/i,
        ],
        [
            {
                baseUrl: REMOTE,
                environment: 'production',
                previewId: 'hpa-229',
            },
            /preview id is meaningless/i,
        ],
        [
            { baseUrl: 'http://insecure.example/', environment: 'production' },
            /must be https/i,
        ],
    ])('throws for %j', (config, message) => {
        expect(() => resolveAssetSource(STORY, ORIGIN, config)).toThrow(
            message
        );
    });
});
