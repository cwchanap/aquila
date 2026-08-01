import { createHash } from 'node:crypto';
import {
    assertSha256,
    type ManifestByteSha256,
    type ObjectContentSha256,
    type ReleaseContentSha256,
} from '@aquila/stories/runtime-assets';

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

export function sha256Bytes(bytes: Uint8Array): ObjectContentSha256 {
    return assertSha256<'object-content'>(sha256(bytes));
}

export function sha256ReleaseContent(text: string): ReleaseContentSha256 {
    return assertSha256<'release-content'>(sha256(text));
}

export function sha256ManifestBytes(bytes: Uint8Array): ManifestByteSha256 {
    return assertSha256<'manifest-bytes'>(sha256(bytes));
}
