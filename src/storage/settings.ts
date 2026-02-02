/**
 * Storage management for extension settings
 */
import browser from 'webextension-polyfill';
import { ExtensionSettings, DEFAULT_SETTINGS, SyncStatus } from '../types/settings';
import { EpitechEvent } from '../types/epitech';

/**
 * Serialized event for storage (dates as ISO strings)
 */
interface SerializedEpitechEvent extends Omit<EpitechEvent, 'startDate' | 'endDate'> {
    startDate: string;
    endDate: string;
}

const SETTINGS_KEY = 'epitech_calendar_settings';
const SYNC_STATUS_KEY = 'epitech_sync_status';
const CACHED_EVENTS_KEY = 'epitech_cached_events';

/**
 * Get current settings from storage
 */
export async function getSettings(): Promise<ExtensionSettings> {
    const result = await browser.storage.local.get(SETTINGS_KEY);
    const stored = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;

    if (!stored) {
        return { ...DEFAULT_SETTINGS };
    }

    // Merge with defaults to handle any missing fields from updates
    return {
        ...DEFAULT_SETTINGS,
        ...stored,
        syncPeriod: {
            ...DEFAULT_SETTINGS.syncPeriod,
            ...stored.syncPeriod,
        },
        autoSync: {
            ...DEFAULT_SETTINGS.autoSync,
            ...stored.autoSync,
        },
        googleCalendar: {
            ...DEFAULT_SETTINGS.googleCalendar,
            ...stored.googleCalendar,
        },
        outlookCalendar: {
            ...DEFAULT_SETTINGS.outlookCalendar,
            ...stored.outlookCalendar,
        },
        icsExport: {
            ...DEFAULT_SETTINGS.icsExport,
            ...stored.icsExport,
        },
    };
}

/**
 * Save settings to storage
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await browser.storage.local.set({ [SETTINGS_KEY]: updated });
}

/**
 * Update specific nested setting
 */
export async function updateNestedSetting<K extends keyof ExtensionSettings>(
    key: K,
    value: Partial<ExtensionSettings[K]>
): Promise<void> {
    const current = await getSettings();
    const currentNested = current[key];

    if (typeof currentNested === 'object' && currentNested !== null) {
        await saveSettings({
            [key]: { ...currentNested, ...value },
        } as Partial<ExtensionSettings>);
    } else {
        await saveSettings({ [key]: value } as Partial<ExtensionSettings>);
    }
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
    const result = await browser.storage.local.get(SYNC_STATUS_KEY);
    const stored = result[SYNC_STATUS_KEY] as SyncStatus | undefined;
    return stored ?? {
        isConnected: false,
        isSyncing: false,
        lastSync: null,
        lastError: null,
    };
}

/**
 * Update sync status
 */
export async function updateSyncStatus(status: Partial<SyncStatus>): Promise<void> {
    const current = await getSyncStatus();
    await browser.storage.local.set({
        [SYNC_STATUS_KEY]: { ...current, ...status },
    });
}

/**
 * Cache events for ICS generation
 * Converts Date objects to ISO strings for storage
 */
export async function cacheEvents(events: EpitechEvent[]): Promise<void> {
    // Serialize dates to ISO strings for storage
    const serialized: SerializedEpitechEvent[] = events.map((event) => ({
        ...event,
        startDate: event.startDate instanceof Date
            ? event.startDate.toISOString()
            : String(event.startDate),
        endDate: event.endDate instanceof Date
            ? event.endDate.toISOString()
            : String(event.endDate),
    }));
    await browser.storage.local.set({ [CACHED_EVENTS_KEY]: serialized });
}

/**
 * Get cached events
 * Converts ISO strings back to Date objects
 */
export async function getCachedEvents(): Promise<EpitechEvent[] | null> {
    const result = await browser.storage.local.get(CACHED_EVENTS_KEY);
    const cached = result[CACHED_EVENTS_KEY] as SerializedEpitechEvent[] | undefined;

    if (!cached) {
        return null;
    }

    // Deserialize ISO strings back to Date objects
    return cached.map((event) => ({
        ...event,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
    }));
}

/**
 * Clear all extension data
 */
export async function clearAllData(): Promise<void> {
    await browser.storage.local.clear();
}

/**
 * Check if should sync based on frequency settings
 */
export async function shouldAutoSync(): Promise<boolean> {
    const settings = await getSettings();

    if (!settings.autoSync.enabled) {
        return false;
    }

    if (settings.autoSync.frequency === 'every_visit') {
        return true;
    }

    if (settings.autoSync.frequency === 'once_daily') {
        const today = new Date().toISOString().split('T')[0];
        return settings.lastSyncDate !== today;
    }

    return false;
}

/**
 * Mark sync as completed today
 */
export async function markSyncCompleted(): Promise<void> {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    await saveSettings({
        lastSyncTimestamp: now,
        lastSyncDate: today,
    });
    await updateSyncStatus({
        lastSync: now,
        lastError: null,
    });
}
