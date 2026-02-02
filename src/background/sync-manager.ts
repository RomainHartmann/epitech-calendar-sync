/**
 * Sync Manager - Orchestrates synchronization with calendar services
 */
import browser from 'webextension-polyfill';
import { SyncResult } from '../types/epitech';
import {
    getSettings,
    updateSyncStatus,
    cacheEvents,
    markSyncCompleted,
} from '../storage/settings';
import { getEventsForSync, checkAuthentication } from './epitech-api';
import { syncToGoogleCalendar } from '../services/google-calendar';
import { syncToOutlookCalendar } from '../services/outlook-calendar';
import { generateIcsContent } from '../services/ics-generator';

// Track sync state
let isSyncing = false;

/**
 * Perform full synchronization
 */
export async function performSync(manual = false): Promise<SyncResult> {
    if (isSyncing) {
        return {
            success: false,
            timestamp: Date.now(),
            eventsProcessed: 0,
            eventsCreated: 0,
            eventsUpdated: 0,
            eventsDeleted: 0,
            errors: ['Sync already in progress'],
            details: [],
        };
    }

    isSyncing = true;
    await updateSyncStatus({ isSyncing: true, lastError: null });

    const result: SyncResult = {
        success: true,
        timestamp: Date.now(),
        eventsProcessed: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        errors: [],
        details: [],
    };

    try {
        // Check authentication first
        const authCheck = await checkAuthentication();
        if (!authCheck.authenticated) {
            throw new Error('Not authenticated to Epitech intranet. Please visit intra.epitech.eu and log in.');
        }

        await updateSyncStatus({ isConnected: true });

        // Fetch events from Epitech
        console.log('[EpitechSync] Fetching events from Epitech...');
        const events = await getEventsForSync();
        result.eventsProcessed = events.length;
        console.log(`[EpitechSync] Fetched ${events.length} events`);

        // Cache events for ICS generation
        await cacheEvents(events);

        // Get settings
        const settings = await getSettings();

        // Sync to Google Calendar if enabled
        if (settings.googleCalendar.enabled && settings.googleCalendar.connected) {
            try {
                console.log('[EpitechSync] Syncing to Google Calendar...');
                const googleResult = await syncToGoogleCalendar(events);
                result.eventsCreated += googleResult.created;
                result.eventsUpdated += googleResult.updated;
                result.eventsDeleted += googleResult.deleted;
                if (googleResult.errors.length > 0) {
                    result.errors.push(...googleResult.errors.map((e) => `Google: ${e}`));
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Google Calendar sync failed: ${errorMsg}`);
            }
        }

        // Sync to Outlook Calendar if enabled
        if (settings.outlookCalendar.enabled && settings.outlookCalendar.connected) {
            try {
                console.log('[EpitechSync] Syncing to Outlook Calendar...');
                const outlookResult = await syncToOutlookCalendar(events);
                result.eventsCreated += outlookResult.created;
                result.eventsUpdated += outlookResult.updated;
                result.eventsDeleted += outlookResult.deleted;
                if (outlookResult.errors.length > 0) {
                    result.errors.push(...outlookResult.errors.map((e) => `Outlook: ${e}`));
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Outlook Calendar sync failed: ${errorMsg}`);
            }
        }

        // Mark sync as completed
        await markSyncCompleted();
        result.success = result.errors.length === 0;

        // Show notification if enabled
        if (settings.notificationsEnabled && manual) {
            await showNotification(result);
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.success = false;
        result.errors.push(errorMsg);
        await updateSyncStatus({ lastError: errorMsg });

        // Show error notification
        const settings = await getSettings();
        if (settings.notificationsEnabled) {
            await browser.notifications.create({
                type: 'basic',
                iconUrl: browser.runtime.getURL('icons/icon128.png'),
                title: 'Epitech Calendar Sync - Error',
                message: errorMsg,
            });
        }
    } finally {
        isSyncing = false;
        await updateSyncStatus({ isSyncing: false });
    }

    return result;
}

/**
 * Export events as ICS file
 */
export async function exportToIcs(): Promise<string> {
    // Try to get cached events first
    const { getCachedEvents } = await import('../storage/settings');
    let events = await getCachedEvents();

    // If no cached events, fetch fresh
    if (!events || events.length === 0) {
        const authCheck = await checkAuthentication();
        if (!authCheck.authenticated) {
            throw new Error('Not authenticated to Epitech intranet');
        }
        events = await getEventsForSync();
        await cacheEvents(events);
    }

    return generateIcsContent(events);
}

/**
 * Download ICS file
 */
export async function downloadIcsFile(): Promise<void> {
    const icsContent = await exportToIcs();
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const filename = `epitech-calendar-${new Date().toISOString().split('T')[0]}.ics`;

    await browser.downloads.download({
        url,
        filename,
        saveAs: true,
    });

    // Clean up the blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Check if sync should run and trigger if needed
 */
export async function checkAndSync(): Promise<void> {
    const { shouldAutoSync } = await import('../storage/settings');

    if (await shouldAutoSync()) {
        console.log('[EpitechSync] Auto sync triggered');
        await performSync(false);
    } else {
        console.log('[EpitechSync] Auto sync skipped (not needed or disabled)');
    }
}

/**
 * Show sync result notification
 */
async function showNotification(result: SyncResult): Promise<void> {
    const title = result.success
        ? 'Epitech Calendar Sync - Success'
        : 'Epitech Calendar Sync - Completed with errors';

    const message = result.success
        ? `Synced ${result.eventsProcessed} events. Created: ${result.eventsCreated}, Updated: ${result.eventsUpdated}, Deleted: ${result.eventsDeleted}`
        : `Synced with ${result.errors.length} error(s). ${result.errors[0]}`;

    await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon128.png'),
        title,
        message,
    });
}

/**
 * Get current sync state
 */
export function isSyncInProgress(): boolean {
    return isSyncing;
}
