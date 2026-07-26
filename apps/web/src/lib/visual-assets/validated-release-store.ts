export const VALIDATED_RELEASES_KEY =
    'aquila:visual-assets:validated-releases:v1';

export class ValidatedReleaseStore {
    constructor(private readonly storage: Storage | null) {}

    loadRaw(): unknown[] {
        try {
            const raw = this.storage?.getItem(VALIDATED_RELEASES_KEY);
            if (!raw) return [];
            const parsed: unknown = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    replace(records: readonly unknown[]): boolean {
        try {
            this.storage?.setItem(
                VALIDATED_RELEASES_KEY,
                JSON.stringify(records)
            );
            return this.storage !== null;
        } catch {
            return false;
        }
    }

    clear(): void {
        try {
            this.storage?.removeItem(VALIDATED_RELEASES_KEY);
        } catch {
            return;
        }
    }
}
