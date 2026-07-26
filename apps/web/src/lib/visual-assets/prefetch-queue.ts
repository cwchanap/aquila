export class PrefetchQueue {
    private active = 0;
    private readonly pending: Array<() => void> = [];

    constructor(private readonly limit = 2) {}

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
