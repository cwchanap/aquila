declare const Bun: {
    write(path: string, data: string | Uint8Array): Promise<unknown>;
};
