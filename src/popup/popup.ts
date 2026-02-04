/**
 * Popup UI Controller
 */
import browser from 'webextension-polyfill';
import type { StatusResponse, ExtensionMessage } from '../types/settings';
import { formatDisplayDate } from '../utils/date';

// DOM Elements
const connectionStatusEl = document.getElementById('connection-status')!;
const lastSyncEl = document.getElementById('last-sync')!;
const syncProgressEl = document.getElementById('sync-progress')!;
const errorMessageEl = document.getElementById('error-message')!;
const syncBtn = document.getElementById('sync-btn') as HTMLButtonElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const autoSyncToggle = document.getElementById('auto-sync-toggle') as HTMLInputElement;
const googleStatusEl = document.getElementById('google-status')!;
const outlookStatusEl = document.getElementById('outlook-status')!;
const optionsLinkEl = document.getElementById('options-link')!;

/**
 * Send message to background script
 */
async function sendMessage<T>(message: ExtensionMessage): Promise<T> {
    return browser.runtime.sendMessage(message) as Promise<T>;
}

/**
 * Update UI with current status
 */
async function updateStatus(): Promise<void> {
    try {
        const response = await sendMessage<StatusResponse>({ type: 'GET_STATUS' });

        // Update connection status
        const statusDot = connectionStatusEl.querySelector('.status-dot')!;
        const statusText = connectionStatusEl.querySelector('.status-text')!;

        if (response.isSyncing) {
            statusDot.className = 'status-dot syncing';
            statusText.textContent = 'Synchronisation...';
        } else if (response.isConnected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connecté';
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Déconnecté';
        }

        // Update last sync time
        if (response.lastSync) {
            lastSyncEl.textContent = formatDisplayDate(response.lastSync);
        } else {
            lastSyncEl.textContent = 'Jamais';
        }

        // Update button states
        syncBtn.disabled = !response.isConnected || response.isSyncing;
        exportBtn.disabled = !response.isConnected || response.isSyncing;

        // Update auto sync toggle
        autoSyncToggle.checked = response.settings.autoSync.enabled;

        // Update services status
        updateServiceStatus(
            googleStatusEl,
            response.settings.googleCalendar.enabled,
            response.settings.googleCalendar.connected
        );
        updateServiceStatus(
            outlookStatusEl,
            response.settings.outlookCalendar.enabled,
            response.settings.outlookCalendar.connected
        );

        // Show/hide sync progress
        if (response.isSyncing) {
            syncProgressEl.classList.remove('hidden');
        } else {
            syncProgressEl.classList.add('hidden');
        }

        // Show error if any
        if (response.lastError) {
            showError(response.lastError);
        } else {
            hideError();
        }
    } catch (error) {
        console.error('Failed to get status:', error);
        showError('Erreur de communication avec l\'extension');
    }
}

/**
 * Update service status display
 */
function updateServiceStatus(
    element: HTMLElement,
    enabled: boolean,
    connected: boolean
): void {
    if (connected) {
        element.textContent = 'Connecté';
        element.classList.add('connected');
    } else if (enabled) {
        element.textContent = 'Non connecté';
        element.classList.remove('connected');
    } else {
        element.textContent = 'Non configuré';
        element.classList.remove('connected');
    }
}

/**
 * Show error message
 */
function showError(message: string): void {
    errorMessageEl.textContent = message;
    errorMessageEl.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError(): void {
    errorMessageEl.classList.add('hidden');
}

/**
 * Handle sync button click
 */
async function handleSync(): Promise<void> {
    syncBtn.disabled = true;
    exportBtn.disabled = true;
    syncProgressEl.classList.remove('hidden');
    hideError();

    try {
        const response = await sendMessage<{ success: boolean; error?: string }>({
            type: 'TRIGGER_SYNC',
            payload: { manual: true },
        });

        if (!response.success && response.error) {
            showError(response.error);
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        showError(errorMsg);
    } finally {
        await updateStatus();
    }
}

/**
 * Handle export button click
 */
async function handleExport(): Promise<void> {
    exportBtn.disabled = true;
    hideError();

    try {
        const response = await sendMessage<{ success: boolean; content?: string; error?: string }>({
            type: 'EXPORT_ICS',
        });

        if (response.success && response.content) {
            // Create download
            const blob = new Blob([response.content], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const filename = `epitech-calendar-${new Date().toISOString().split('T')[0]}.ics`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (response.error) {
            showError(response.error);
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        showError(errorMsg);
    } finally {
        exportBtn.disabled = false;
    }
}

/**
 * Handle auto sync toggle change
 */
async function handleAutoSyncToggle(): Promise<void> {
    try {
        await sendMessage({
            type: 'UPDATE_SETTINGS',
            payload: {
                autoSync: {
                    enabled: autoSyncToggle.checked,
                },
            },
        });
    } catch (error) {
        console.error('Failed to update auto sync setting:', error);
        // Revert toggle
        autoSyncToggle.checked = !autoSyncToggle.checked;
    }
}

/**
 * Handle options link click
 */
function handleOptionsClick(e: Event): void {
    e.preventDefault();
    browser.runtime.openOptionsPage();
}

/**
 * Check if running on Firefox
 */
function isFirefox(): boolean {
    return navigator.userAgent.includes('Firefox');
}

/**
 * Hide unsupported features on Firefox
 */
function hideFirefoxUnsupportedFeatures(): void {
    if (isFirefox()) {
        const servicesSection = document.getElementById('services-section');
        if (servicesSection) {
            servicesSection.style.display = 'none';
        }
    }
}

/**
 * Initialize popup
 */
async function init(): Promise<void> {
    // Hide Chrome-only features on Firefox
    hideFirefoxUnsupportedFeatures();

    // Add event listeners
    syncBtn.addEventListener('click', handleSync);
    exportBtn.addEventListener('click', handleExport);
    autoSyncToggle.addEventListener('change', handleAutoSyncToggle);
    optionsLinkEl.addEventListener('click', handleOptionsClick);

    // Load initial status
    await updateStatus();

    // Listen for status updates
    browser.runtime.onMessage.addListener((message: unknown) => {
        const msg = message as ExtensionMessage;
        if (msg.type === 'SYNC_COMPLETE' || msg.type === 'SYNC_ERROR') {
            updateStatus();
        }
    });

    // Refresh status periodically
    setInterval(updateStatus, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
