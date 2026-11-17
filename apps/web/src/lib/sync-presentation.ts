import type { Translations } from '@aquila/stories';
import type { StorySyncState } from './story-progress-view.svelte';

export type CloudSyncStatus = Exclude<StorySyncState, 'idle'> | 'syncing';
export type SyncTone = 'ok' | 'pending' | 'warn';

export const SYNC_DOT_CLASSES: Record<SyncTone, string> = {
    ok: 'bg-emerald-300/80',
    pending: 'bg-cyan-300/70 motion-safe:animate-pulse',
    warn: 'bg-amber-300/80',
};

export interface ProgressSyncCardEntry {
    icon: 'check' | 'syncing' | 'off';
    iconBoxClass: string;
    dotClass: string;
    body: string;
    chip: string;
}

export function progressSyncPresentation(
    t: Translations['progress']
): Record<CloudSyncStatus, ProgressSyncCardEntry> {
    return {
        synced: {
            icon: 'check',
            iconBoxClass: 'bg-emerald-400/25 text-emerald-200',
            dotClass: SYNC_DOT_CLASSES.ok,
            body: t.cloudSaveSynced,
            chip: t.saveStatusSynced,
        },
        syncing: {
            icon: 'syncing',
            iconBoxClass: 'bg-cyan-400/20 text-cyan-100',
            dotClass: SYNC_DOT_CLASSES.pending,
            body: t.cloudSaveSyncing,
            chip: t.saveStatusSyncing,
        },
        failed: {
            icon: 'off',
            iconBoxClass: 'bg-amber-400/25 text-amber-100',
            dotClass: SYNC_DOT_CLASSES.warn,
            body: t.cloudSaveFailed,
            chip: t.saveStatusNotSynced,
        },
        'local-failed': {
            icon: 'off',
            iconBoxClass: 'bg-amber-400/25 text-amber-100',
            dotClass: SYNC_DOT_CLASSES.warn,
            body: t.cloudSaveLocalReadFailed,
            chip: t.saveStatusNotSynced,
        },
        'local-save-failed': {
            icon: 'off',
            iconBoxClass: 'bg-amber-400/25 text-amber-100',
            dotClass: SYNC_DOT_CLASSES.warn,
            body: t.cloudSaveLocalSaveFailed,
            chip: t.saveStatusAccountSaved,
        },
    };
}

export interface StorySelectSyncEntry {
    dotClass: string;
    label: string;
}

export function storySelectSyncPresentation(
    t: Translations['stories']
): Record<CloudSyncStatus, StorySelectSyncEntry> {
    return {
        synced: { dotClass: SYNC_DOT_CLASSES.ok, label: t.syncSynced },
        syncing: { dotClass: SYNC_DOT_CLASSES.pending, label: t.syncSyncing },
        failed: { dotClass: SYNC_DOT_CLASSES.warn, label: t.syncFailed },
        'local-failed': {
            dotClass: SYNC_DOT_CLASSES.warn,
            label: t.syncLocalFailed,
        },
        'local-save-failed': {
            dotClass: SYNC_DOT_CLASSES.warn,
            label: t.syncLocalSaveFailed,
        },
    };
}
