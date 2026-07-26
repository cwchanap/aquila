export async function sha256Hex(bytes: BufferSource): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

export function utf8Bytes(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}
