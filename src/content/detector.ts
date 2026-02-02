/**
 * Content Script - Detects when user visits Epitech intranet
 * Triggers auto-sync if enabled
 */
import browser from 'webextension-polyfill';

console.log('[EpitechSync] Content script loaded on Epitech intranet');

/**
 * Check if user appears to be logged in
 * Looks for indicators of an authenticated session
 */
function isUserLoggedIn(): boolean {
    // Check for common indicators of being logged in
    // The intranet typically shows user info when authenticated

    // Check if there's a logout link
    const logoutLink = document.querySelector('a[href*="logout"]');
    if (logoutLink) return true;

    // Check for user profile elements
    const userProfile = document.querySelector('.user-info, .profile, [class*="user"]');
    if (userProfile) return true;

    // Check if we're on the login page
    const loginForm = document.querySelector('form[action*="login"], #login-form, .login-form');
    if (loginForm) return false;

    // Check URL - if we got past login redirect, we're likely authenticated
    if (window.location.pathname !== '/' && !window.location.pathname.includes('login')) {
        return true;
    }

    // Default to assuming logged in if on the intranet domain
    return true;
}

/**
 * Notify background script of intranet visit
 */
async function notifyBackgroundScript(): Promise<void> {
    try {
        await browser.runtime.sendMessage({
            type: 'INTRANET_VISITED',
            payload: {
                url: window.location.href,
                isLoggedIn: isUserLoggedIn(),
                timestamp: Date.now(),
            },
        });
        console.log('[EpitechSync] Background notified of intranet visit');
    } catch (error) {
        console.error('[EpitechSync] Failed to notify background:', error);
    }
}

/**
 * Wait for page to be fully loaded
 */
function onPageReady(callback: () => void): void {
    if (document.readyState === 'complete') {
        callback();
    } else {
        window.addEventListener('load', callback);
    }
}

/**
 * Initialize content script
 */
function init(): void {
    onPageReady(() => {
        // Small delay to ensure all page elements are rendered
        setTimeout(() => {
            if (isUserLoggedIn()) {
                notifyBackgroundScript();
            } else {
                console.log('[EpitechSync] User not logged in, skipping sync notification');
            }
        }, 500);
    });
}

// Run initialization
init();
