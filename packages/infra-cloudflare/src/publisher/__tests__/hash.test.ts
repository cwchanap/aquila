import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    sha256Bytes,
    sha256ManifestBytes,
    sha256ReleaseContent,
} from '../hash';

describe('publisher hash helpers', () => {
    it('returns the exact SHA-256 for object bytes', () => {
        const bytes = Uint8Array.from([1, 2, 3]);
        expect(sha256Bytes(bytes)).toBe(
            createHash('sha256').update(bytes).digest('hex')
        );
    });

    it('brands release content and manifest bytes through separate helpers', () => {
        expect(sha256ReleaseContent('release')).toMatch(/^[0-9a-f]{64}$/);
        expect(
            sha256ManifestBytes(new TextEncoder().encode('manifest'))
        ).toMatch(/^[0-9a-f]{64}$/);
    });
});
