import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex, utf8Bytes } from '../hash';

describe('sha256Hex', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('hashes exact UTF-8 bytes', async () => {
        vi.stubGlobal('crypto', webcrypto);

        expect(await sha256Hex(new TextEncoder().encode('aquila'))).toBe(
            '982f367a2aeea5dcf50985a9d2e907fe521f04653d00bfb6c021599b989e0ba8'
        );
    });

    it('encodes text as UTF-8 bytes', () => {
        expect(utf8Bytes('Aquila')).toEqual(
            new Uint8Array([65, 113, 117, 105, 108, 97])
        );
    });
});
