/**
 * Background Service Worker
 * Main entry point for the extension's background processes
 */
import browser from 'webextension-polyfill';
import {
    getSettings,
    saveSettings,
    getSyncStatus,
    updateSyncStatus,
} from '../storage/settings';
import { performSync, exportToIcs, checkAndSync } from './sync-manager';
import { checkAuthentication } from './epitech-api';
import {
    connectGoogleCalendar,
    disconnectGoogleCalendar,
} from '../services/google-calendar';
import {
    connectOutlookCalendar,
    disconnectOutlookCalendar,
} from '../services/outlook-calendar';
import type { ExtensionMessage, StatusResponse } from '../types/settings';

console.log('[EpitechSync] Background service worker started');

/**
 * Handle messages from popup, options, and content scripts
 */
browser.runtime.onMessage.addListener(
    (message: unknown): Promise<unknown> | undefined => {
        const msg = message as ExtensionMessage;
        console.log('[EpitechSync] Received message:', msg.type);

        switch (msg.type) {
            case 'TRIGGER_SYNC':
                return handleTriggerSync(msg.payload as { manual?: boolean } | undefined);

            case 'EXPORT_ICS':
                return handleExportIcs();

            case 'GET_STATUS':
                return handleGetStatus();

            case 'GET_SETTINGS':
                return getSettings();

            case 'UPDATE_SETTINGS':
                return handleUpdateSettings(msg.payload as Record<string, unknown>);

            case 'CONNECT_GOOGLE':
                return handleConnectGoogle();

            case 'DISCONNECT_GOOGLE':
                return handleDisconnectGoogle();

            case 'CONNECT_OUTLOOK':
                return handleConnectOutlook();

            case 'DISCONNECT_OUTLOOK':
                return handleDisconnectOutlook();

            case 'INTRANET_VISITED':
                return handleIntranetVisited();

            default:
                console.warn('[EpitechSync] Unknown message type:', msg.type);
                return Promise.resolve({ error: 'Unknown message type' });
        }
    }
);

/**
 * Handle trigger sync message
 */
async function handleTriggerSync(
    payload?: { manual?: boolean }
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
        const result = await performSync(payload?.manual ?? true);
        return { success: true, result };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMsg };
    }
}

/**
 * Handle export ICS message
 */
async function handleExportIcs(): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
        const content = await exportToIcs();
        return { success: true, content };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMsg };
    }
}

/**
 * Handle get status message
 */
async function handleGetStatus(): Promise<StatusResponse> {
    const [status, settings, authCheck] = await Promise.all([
        getSyncStatus(),
        getSettings(),
        checkAuthentication(),
    ]);

    return {
        isConnected: authCheck.authenticated,
        isSyncing: status.isSyncing,
        lastSync: settings.lastSyncTimestamp,
        lastError: status.lastError,
        settings,
    };
}

/**
 * Handle update settings message
 */
async function handleUpdateSettings(
    payload: Record<string, unknown>
): Promise<{ success: boolean }> {
    await saveSettings(payload);
    return { success: true };
}

/**
 * Handle Google Calendar connection
 */
async function handleConnectGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
        await connectGoogleCalendar();
        return { success: true };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMsg };
    }
}

/**
 * Handle Google Calendar disconnection
 */
async function handleDisconnectGoogle(): Promise<{ success: boolean }> {
    await disconnectGoogleCalendar();
    return { success: true };
}

/**
 * Handle Outlook Calendar connection
 */
async function handleConnectOutlook(): Promise<{ success: boolean; error?: string }> {
    try {
        await connectOutlookCalendar();
        return { success: true };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMsg };
    }
}

/**
 * Handle Outlook Calendar disconnection
 */
async function handleDisconnectOutlook(): Promise<{ success: boolean }> {
    await disconnectOutlookCalendar();
    return { success: true };
}

/**
 * Handle intranet visited message from content script
 */
async function handleIntranetVisited(): Promise<{ success: boolean }> {
    const authCheck = await checkAuthentication();

    if (authCheck.authenticated) {
        await updateSyncStatus({ isConnected: true });
        // Check if auto sync should run
        await checkAndSync();
    }

    return { success: true };
}

/**
 * Set up alarm for periodic sync check
 */
browser.alarms.create('syncCheck', {
    periodInMinutes: 60, // Check every hour
});

browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'syncCheck') {
        console.log('[EpitechSync] Periodic sync check triggered');
        // Only check, actual sync depends on settings
        const settings = await getSettings();
        if (settings.autoSync.enabled) {
            // We can't sync without user visiting intranet first
            // This alarm mainly serves to update status
            const authCheck = await checkAuthentication();
            await updateSyncStatus({ isConnected: authCheck.authenticated });
        }
    }
});

/**
 * Handle extension installation or update
 */
browser.runtime.onInstalled.addListener(async (details) => {
    console.log('[EpitechSync] Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
        // Open options page on first install
        await browser.tabs.create({
            url: browser.runtime.getURL('options/index.html'),
        });
    }
});
