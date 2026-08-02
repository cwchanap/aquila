import { createHash } from 'node:crypto';
import {
    getCurrentPointerPath,
    parseActiveReleasePointer,
} from '@aquila/stories/runtime-assets';
import { R2DeliveryStore } from './stores/r2-delivery-store';

const [label, previewId] = process.argv.slice(2);
if (!label || !previewId || !process.env.STORY_ID) {
    throw new Error('capture arguments missing');
}

const storyId = process.env.STORY_ID;
const store = await R2DeliveryStore.createFromEnvironment();
const snapshot = async (
    target: { kind: 'production' } | { kind: 'preview'; previewId: string }
) => {
    const key = getCurrentPointerPath(storyId, target);
    const value = await store.readPointer(key);
    if (!value.exists) return { key, exists: false as const };
    const pointer = parseActiveReleasePointer(
        JSON.parse(new TextDecoder().decode(value.bytes)),
        target,
        storyId
    );
    return {
        key,
        exists: true as const,
        etag: value.etag,
        sha256: createHash('sha256').update(value.bytes).digest('hex'),
        releaseId: pointer.releaseId,
        publishedAt: pointer.publishedAt,
    };
};
try {
    const prefix = `vn/previews/${previewId}/stories/${storyId}/`;
    const previewKeys: Array<{ key: string; etag: string }> = [];
    for await (const item of store.list(prefix)) {
        previewKeys.push({ key: item.key, etag: item.etag });
    }
    previewKeys.sort((left, right) => left.key.localeCompare(right.key));
    const evidence = {
        schemaVersion: 1,
        label,
        storyId,
        previewId,
        productionPointer: await snapshot({ kind: 'production' }),
        previewPointer: await snapshot({ kind: 'preview', previewId }),
        previewKeys,
    };
    await Bun.write(
        `.tmp/evidence/${label}.json`,
        `${JSON.stringify(evidence, null, 2)}\n`
    );
} finally {
    await store.close();
}
