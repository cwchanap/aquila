export class PrefetchQueue {
    private active = 0;
    private readonly pending: Array<() => void> = [];
    private readonly limit: number;

    constructor(limit = 2) {
        this.limit = Math.max(1, limit);
    }

    async run<T>(work: () => Promise<T>): Promise<T> {
        if (this.active >= this.limit) {
            await new Promise<void>(resolve => this.pending.push(resolve));
        } else {
            this.active += 1;
        }
        try {
            return await work();
        } finally {
            const next = this.pending.shift();
            if (next) next();
            else this.active -= 1;
        }
    }
}
