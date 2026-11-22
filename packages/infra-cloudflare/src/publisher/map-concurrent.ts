/**
 * Maps `items` with at most `limit` calls in flight. Results keep the input
 * order, so callers stay deterministic. After the first failure no further
 * item is started and that error is rethrown once the running calls settle.
 */
export async function mapConcurrent<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    let failure: { error: unknown } | undefined;
    const worker = async (): Promise<void> => {
        while (failure === undefined && next < items.length) {
            const index = next++;
            try {
                results[index] = await fn(items[index] as T, index);
            } catch (error) {
                failure ??= { error };
            }
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, worker)
    );
    if (failure !== undefined) throw failure.error;
    return results;
}
