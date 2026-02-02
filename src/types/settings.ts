/**
 * Types for extension settings and configuration
 */

/**
 * Sync period configuration
 */
export interface SyncPeriod {
    /** Start date - ISO string or 'today' */
    start: string | 'today';
    /** End date - ISO string or relative like '+3months' */
    end: string;
}

/**
 * Google Calendar service settings
 */
export interface GoogleCalendarSettings {
    enabled: boolean;
    connected: boolean;
    calendarId: string | null;
    calendarName: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null;
}

/**
 * Outlook Calendar service settings
 */
export interface OutlookCalendarSettings {
    enabled: boolean;
    connected: boolean;
    calendarId: string | null;
    calendarName: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null;
}

/**
 * ICS export settings
 */
export interface IcsExportSettings {
    enabled: boolean;
    autoDownload: boolean;
}

/**
 * Auto sync frequency options
 */
export type AutoSyncFrequency = 'every_visit' | 'once_daily' | 'manual';

/**
 * Main extension settings
 */
export interface ExtensionSettings {
    /** Prefix for event titles (e.g., "EPITECH - ") */
    eventPrefix: string;

    /** Period to sync */
    syncPeriod: SyncPeriod;

    /** Auto sync configuration */
    autoSync: {
        enabled: boolean;
        frequency: AutoSyncFrequency;
    };

    /** Enable notifications */
    notificationsEnabled: boolean;

    /** Google Calendar settings */
    googleCalendar: GoogleCalendarSettings;

    /** Outlook Calendar settings */
    outlookCalendar: OutlookCalendarSettings;

    /** ICS export settings */
    icsExport: IcsExportSettings;

    /** Last successful sync timestamp */
    lastSyncTimestamp: number | null;

    /** Last sync date (for once_daily check) */
    lastSyncDate: string | null;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
    eventPrefix: 'EPITECH - ',
    syncPeriod: {
        start: 'today',
        end: '+12months',
    },
    autoSync: {
        enabled: false,
        frequency: 'once_daily',
    },
    notificationsEnabled: true,
    googleCalendar: {
        enabled: false,
        connected: false,
        calendarId: null,
        calendarName: 'Epitech',
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
    },
    outlookCalendar: {
        enabled: false,
        connected: false,
        calendarId: null,
        calendarName: 'Epitech',
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
    },
    icsExport: {
        enabled: true,
        autoDownload: false,
    },
    lastSyncTimestamp: null,
    lastSyncDate: null,
};

/**
 * Sync status for UI display
 */
export interface SyncStatus {
    isConnected: boolean;
    isSyncing: boolean;
    lastSync: number | null;
    lastError: string | null;
}

/**
 * Message types for communication between extension components
 */
export type MessageType =
    | 'TRIGGER_SYNC'
    | 'EXPORT_ICS'
    | 'GET_STATUS'
    | 'GET_SETTINGS'
    | 'UPDATE_SETTINGS'
    | 'CONNECT_GOOGLE'
    | 'DISCONNECT_GOOGLE'
    | 'CONNECT_OUTLOOK'
    | 'DISCONNECT_OUTLOOK'
    | 'INTRANET_VISITED'
    | 'SYNC_COMPLETE'
    | 'SYNC_ERROR';

/**
 * Base message structure
 */
export interface ExtensionMessage {
    type: MessageType;
    payload?: unknown;
}

/**
 * Trigger sync message
 */
export interface TriggerSyncMessage extends ExtensionMessage {
    type: 'TRIGGER_SYNC';
    payload?: {
        manual?: boolean;
    };
}

/**
 * Export ICS message
 */
export interface ExportIcsMessage extends ExtensionMessage {
    type: 'EXPORT_ICS';
}

/**
 * Get status response
 */
export interface StatusResponse {
    isConnected: boolean;
    isSyncing: boolean;
    lastSync: number | null;
    lastError: string | null;
    settings: ExtensionSettings;
}
