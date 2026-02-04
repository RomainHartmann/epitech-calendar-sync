/**
 * Options Page Controller
 */
import browser from 'webextension-polyfill';
import type { ExtensionSettings, ExtensionMessage } from '../types/settings';

// DOM Elements
const syncStartEl = document.getElementById('sync-start') as HTMLSelectElement;
const syncStartCustomEl = document.getElementById('sync-start-custom') as HTMLInputElement;
const syncEndEl = document.getElementById('sync-end') as HTMLSelectElement;
const syncEndCustomEl = document.getElementById('sync-end-custom') as HTMLInputElement;
const eventPrefixEl = document.getElementById('event-prefix') as HTMLInputElement;
const autoSyncEnabledEl = document.getElementById('auto-sync-enabled') as HTMLInputElement;
const autoSyncFrequencyEl = document.getElementById('auto-sync-frequency') as HTMLSelectElement;
const autoSyncFrequencyGroupEl = document.getElementById('auto-sync-frequency-group')!;
const notificationsEnabledEl = document.getElementById('notifications-enabled') as HTMLInputElement;
const googleEnabledEl = document.getElementById('google-enabled') as HTMLInputElement;
const googleConnectionEl = document.getElementById('google-connection')!;
const googleStatusIndicatorEl = document.getElementById('google-status-indicator')!;
const googleStatusTextEl = document.getElementById('google-status-text')!;
const googleConnectBtnEl = document.getElementById('google-connect-btn') as HTMLButtonElement;
const googleCalendarNameEl = document.getElementById('google-calendar-name') as HTMLInputElement;
const googleCalendarNameGroupEl = document.getElementById('google-calendar-name-group')!;
const outlookEnabledEl = document.getElementById('outlook-enabled') as HTMLInputElement;
const outlookConnectionEl = document.getElementById('outlook-connection')!;
const outlookStatusIndicatorEl = document.getElementById('outlook-status-indicator')!;
const outlookStatusTextEl = document.getElementById('outlook-status-text')!;
const outlookConnectBtnEl = document.getElementById('outlook-connect-btn') as HTMLButtonElement;
const outlookCalendarNameEl = document.getElementById('outlook-calendar-name') as HTMLInputElement;
const outlookCalendarNameGroupEl = document.getElementById('outlook-calendar-name-group')!;
const icsEnabledEl = document.getElementById('ics-enabled') as HTMLInputElement;
const statusMessageEl = document.getElementById('status-message')!;
const saveBtnEl = document.getElementById('save-btn') as HTMLButtonElement;
const resetBtnEl = document.getElementById('reset-btn') as HTMLButtonElement;

let currentSettings: ExtensionSettings | null = null;

/**
 * Detect if running in Firefox
 */
function isFirefox(): boolean {
    return navigator.userAgent.includes('Firefox');
}

/**
 * Send message to background script
 */
async function sendMessage<T>(message: ExtensionMessage): Promise<T> {
    return browser.runtime.sendMessage(message) as Promise<T>;
}

/**
 * Load settings and populate form
 */
async function loadSettings(): Promise<void> {
    try {
        currentSettings = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
        populateForm(currentSettings);
    } catch (error) {
        console.error('Failed to load settings:', error);
        showStatus('Erreur lors du chargement des paramètres', 'error');
    }
}

/**
 * Populate form with settings
 */
function populateForm(settings: ExtensionSettings): void {
    // Sync period
    if (settings.syncPeriod.start === 'today') {
        syncStartEl.value = 'today';
        syncStartCustomEl.classList.add('hidden');
    } else if (settings.syncPeriod.start.match(/^[+-]\d+/)) {
        const match = settings.syncPeriod.start.match(/^-(\d+)(week|month)s?$/);
        if (match) {
            syncStartEl.value = settings.syncPeriod.start;
        } else {
            syncStartEl.value = 'custom';
            syncStartCustomEl.value = settings.syncPeriod.start;
            syncStartCustomEl.classList.remove('hidden');
        }
    } else {
        syncStartEl.value = 'custom';
        syncStartCustomEl.value = settings.syncPeriod.start;
        syncStartCustomEl.classList.remove('hidden');
    }

    if (settings.syncPeriod.end.match(/^\+\d+months?$/)) {
        syncEndEl.value = settings.syncPeriod.end;
    } else {
        syncEndEl.value = 'custom';
        syncEndCustomEl.value = settings.syncPeriod.end;
        syncEndCustomEl.classList.remove('hidden');
    }

    // Event prefix
    eventPrefixEl.value = settings.eventPrefix;

    // Auto sync
    autoSyncEnabledEl.checked = settings.autoSync.enabled;
    autoSyncFrequencyEl.value = settings.autoSync.frequency;
    autoSyncFrequencyGroupEl.classList.toggle('hidden', !settings.autoSync.enabled);

    // Notifications
    notificationsEnabledEl.checked = settings.notificationsEnabled;

    // Google Calendar
    googleEnabledEl.checked = settings.googleCalendar.enabled;
    googleCalendarNameEl.value = settings.googleCalendar.calendarName;
    updateGoogleStatus(settings.googleCalendar.connected);
    googleConnectionEl.classList.toggle('hidden', !settings.googleCalendar.enabled);
    googleCalendarNameGroupEl.classList.toggle('hidden', !settings.googleCalendar.enabled);

    // Outlook Calendar
    outlookEnabledEl.checked = settings.outlookCalendar.enabled;
    outlookCalendarNameEl.value = settings.outlookCalendar.calendarName;
    updateOutlookStatus(settings.outlookCalendar.connected);
    outlookConnectionEl.classList.toggle('hidden', !settings.outlookCalendar.enabled);
    outlookCalendarNameGroupEl.classList.toggle('hidden', !settings.outlookCalendar.enabled);

    // ICS Export
    icsEnabledEl.checked = settings.icsExport.enabled;
}

/**
 * Update Google Calendar connection status
 */
function updateGoogleStatus(connected: boolean): void {
    if (connected) {
        googleStatusIndicatorEl.classList.add('connected');
        googleStatusTextEl.textContent = 'Connecté';
        googleConnectBtnEl.textContent = 'Déconnecter';
        googleConnectBtnEl.classList.add('disconnect');
    } else {
        googleStatusIndicatorEl.classList.remove('connected');
        googleStatusTextEl.textContent = 'Non connecté';
        googleConnectBtnEl.textContent = 'Connecter';
        googleConnectBtnEl.classList.remove('disconnect');
    }
}

/**
 * Update Outlook Calendar connection status
 */
function updateOutlookStatus(connected: boolean): void {
    if (connected) {
        outlookStatusIndicatorEl.classList.add('connected');
        outlookStatusTextEl.textContent = 'Connecté';
        outlookConnectBtnEl.textContent = 'Déconnecter';
        outlookConnectBtnEl.classList.add('disconnect');
    } else {
        outlookStatusIndicatorEl.classList.remove('connected');
        outlookStatusTextEl.textContent = 'Non connecté';
        outlookConnectBtnEl.textContent = 'Connecter';
        outlookConnectBtnEl.classList.remove('disconnect');
    }
}

/**
 * Collect settings from form
 */
function collectSettings(): Partial<ExtensionSettings> {
    const settings: Partial<ExtensionSettings> = {};

    // Sync period
    let syncStart: string;
    if (syncStartEl.value === 'custom') {
        syncStart = syncStartCustomEl.value;
    } else {
        syncStart = syncStartEl.value;
    }

    let syncEnd: string;
    if (syncEndEl.value === 'custom') {
        syncEnd = syncEndCustomEl.value;
    } else {
        syncEnd = syncEndEl.value;
    }

    settings.syncPeriod = { start: syncStart as 'today' | string, end: syncEnd };

    // Event prefix
    settings.eventPrefix = eventPrefixEl.value;

    // Auto sync
    settings.autoSync = {
        enabled: autoSyncEnabledEl.checked,
        frequency: autoSyncFrequencyEl.value as 'every_visit' | 'once_daily' | 'manual',
    };

    // Notifications
    settings.notificationsEnabled = notificationsEnabledEl.checked;

    // Google Calendar (only non-auth fields)
    settings.googleCalendar = {
        ...(currentSettings?.googleCalendar || {}),
        enabled: googleEnabledEl.checked,
        calendarName: googleCalendarNameEl.value || 'Epitech',
    } as ExtensionSettings['googleCalendar'];

    // Outlook Calendar (only non-auth fields)
    settings.outlookCalendar = {
        ...(currentSettings?.outlookCalendar || {}),
        enabled: outlookEnabledEl.checked,
        calendarName: outlookCalendarNameEl.value || 'Epitech',
    } as ExtensionSettings['outlookCalendar'];

    // ICS Export
    settings.icsExport = {
        enabled: icsEnabledEl.checked,
        autoDownload: false,
    };

    return settings;
}

/**
 * Save settings
 */
async function saveSettings(): Promise<void> {
    const settings = collectSettings();

    try {
        await sendMessage({ type: 'UPDATE_SETTINGS', payload: settings });
        showStatus('Paramètres enregistrés', 'success');
        // Reload to get merged settings
        await loadSettings();
    } catch (error) {
        console.error('Failed to save settings:', error);
        showStatus('Erreur lors de l\'enregistrement', 'error');
    }
}

/**
 * Reset settings to defaults
 */
async function resetSettings(): Promise<void> {
    if (!confirm('Voulez-vous vraiment réinitialiser tous les paramètres ?')) {
        return;
    }

    try {
        // Import default settings
        const { DEFAULT_SETTINGS } = await import('../types/settings');
        await sendMessage({ type: 'UPDATE_SETTINGS', payload: DEFAULT_SETTINGS });
        showStatus('Paramètres réinitialisés', 'success');
        await loadSettings();
    } catch (error) {
        console.error('Failed to reset settings:', error);
        showStatus('Erreur lors de la réinitialisation', 'error');
    }
}

/**
 * Show status message
 */
function showStatus(message: string, type: 'success' | 'error'): void {
    statusMessageEl.textContent = message;
    statusMessageEl.className = `status-message ${type}`;
    statusMessageEl.classList.remove('hidden');

    setTimeout(() => {
        statusMessageEl.classList.add('hidden');
    }, 3000);
}

/**
 * Handle Google connect/disconnect
 */
async function handleGoogleConnect(): Promise<void> {
    const isConnected = currentSettings?.googleCalendar.connected;

    try {
        if (isConnected) {
            await sendMessage({ type: 'DISCONNECT_GOOGLE' });
            showStatus('Google Calendar déconnecté', 'success');
        } else {
            await sendMessage({ type: 'CONNECT_GOOGLE' });
            showStatus('Google Calendar connecté', 'success');
        }
        await loadSettings();
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        showStatus(errorMsg, 'error');
    }
}

/**
 * Handle Outlook connect/disconnect
 */
async function handleOutlookConnect(): Promise<void> {
    const isConnected = currentSettings?.outlookCalendar.connected;

    try {
        if (isConnected) {
            await sendMessage({ type: 'DISCONNECT_OUTLOOK' });
            showStatus('Outlook Calendar déconnecté', 'success');
        } else {
            await sendMessage({ type: 'CONNECT_OUTLOOK' });
            showStatus('Outlook Calendar connecté', 'success');
        }
        await loadSettings();
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        showStatus(errorMsg, 'error');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
    // Sync period custom date toggles
    syncStartEl.addEventListener('change', () => {
        syncStartCustomEl.classList.toggle('hidden', syncStartEl.value !== 'custom');
    });

    syncEndEl.addEventListener('change', () => {
        syncEndCustomEl.classList.toggle('hidden', syncEndEl.value !== 'custom');
    });

    // Auto sync toggle
    autoSyncEnabledEl.addEventListener('change', () => {
        autoSyncFrequencyGroupEl.classList.toggle('hidden', !autoSyncEnabledEl.checked);
    });

    // Google Calendar toggle
    googleEnabledEl.addEventListener('change', () => {
        googleConnectionEl.classList.toggle('hidden', !googleEnabledEl.checked);
        googleCalendarNameGroupEl.classList.toggle('hidden', !googleEnabledEl.checked);
    });

    // Outlook Calendar toggle
    outlookEnabledEl.addEventListener('change', () => {
        outlookConnectionEl.classList.toggle('hidden', !outlookEnabledEl.checked);
        outlookCalendarNameGroupEl.classList.toggle('hidden', !outlookEnabledEl.checked);
    });

    // Connect buttons
    googleConnectBtnEl.addEventListener('click', handleGoogleConnect);
    outlookConnectBtnEl.addEventListener('click', handleOutlookConnect);

    // Save and reset buttons
    saveBtnEl.addEventListener('click', saveSettings);
    resetBtnEl.addEventListener('click', resetSettings);
}

/**
 * Hide unsupported features on Firefox
 */
function hideFirefoxUnsupportedFeatures(): void {
    if (isFirefox()) {
        const elementsToHide = ['google-section', 'outlook-section', 'auto-sync-section'];
        elementsToHide.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
            }
        });
    }
}

/**
 * Initialize options page
 */
async function init(): Promise<void> {
    hideFirefoxUnsupportedFeatures();
    setupEventListeners();
    await loadSettings();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
