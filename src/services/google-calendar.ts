/**
 * Google Calendar API integration
 * Uses OAuth 2.0 via chrome.identity for authentication
 */
import { EpitechEvent } from '../types/epitech';
import { getSettings, updateNestedSetting } from '../storage/settings';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface GoogleCalendarEvent {
    id: string;
    summary: string;
    description?: string;
    location?: string;
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    extendedProperties?: {
        private?: Record<string, string>;
    };
}

interface GoogleCalendar {
    id: string;
    summary: string;
    description?: string;
    primary?: boolean;
}

interface SyncResultDetails {
    created: number;
    updated: number;
    deleted: number;
    errors: string[];
}

/**
 * Get OAuth token using chrome.identity
 */
async function getAuthToken(interactive = false): Promise<string> {
    // Use chrome.identity for OAuth
    const token = await (chrome.identity as typeof chrome.identity).getAuthToken({
        interactive,
    });

    if (!token.token) {
        throw new Error('Failed to get authentication token');
    }

    return token.token;
}

/**
 * Make authenticated request to Google Calendar API
 */
async function googleApiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = await getAuthToken();

    const response = await fetch(`${GOOGLE_CALENDAR_API}${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Token expired, try to refresh
            await chrome.identity.removeCachedAuthToken({ token });
            throw new Error('Authentication expired. Please reconnect Google Calendar.');
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(
            `Google API error: ${response.status} - ${(error as { error?: { message?: string } }).error?.message || response.statusText}`
        );
    }

    return response.json() as Promise<T>;
}

/**
 * Connect to Google Calendar (OAuth flow)
 */
export async function connectGoogleCalendar(): Promise<void> {
    // Trigger interactive OAuth flow
    const token = await getAuthToken(true);

    if (!token) {
        throw new Error('Failed to authenticate with Google');
    }

    // Find or create Epitech calendar
    const calendarId = await findOrCreateEpitechCalendar();

    // Save connection state
    await updateNestedSetting('googleCalendar', {
        connected: true,
        enabled: true,
        calendarId,
    });
}

/**
 * Disconnect from Google Calendar
 */
export async function disconnectGoogleCalendar(): Promise<void> {
    try {
        const token = await getAuthToken();
        await chrome.identity.removeCachedAuthToken({ token });
    } catch {
        // Ignore errors during disconnect
    }

    await updateNestedSetting('googleCalendar', {
        connected: false,
        calendarId: null,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
    });
}

/**
 * Find existing Epitech calendar or create new one
 */
async function findOrCreateEpitechCalendar(): Promise<string> {
    const settings = await getSettings();
    const calendarName = settings.googleCalendar.calendarName || 'Epitech';

    // List existing calendars
    const response = await googleApiRequest<{ items: GoogleCalendar[] }>(
        '/users/me/calendarList'
    );

    // Look for existing Epitech calendar
    const existing = response.items.find(
        (cal) => cal.summary === calendarName && !cal.primary
    );

    if (existing) {
        return existing.id;
    }

    // Create new calendar
    const newCalendar = await googleApiRequest<GoogleCalendar>('/calendars', {
        method: 'POST',
        body: JSON.stringify({
            summary: calendarName,
            description: 'Epitech intranet calendar - synced by Epitech Calendar Sync extension',
            timeZone: 'Europe/Paris',
        }),
    });

    return newCalendar.id;
}

/**
 * Convert EpitechEvent to Google Calendar event format
 */
function toGoogleEvent(event: EpitechEvent): Partial<GoogleCalendarEvent> {
    return {
        summary: event.title,
        description: event.description,
        location: event.location || undefined,
        start: {
            dateTime: event.startDate.toISOString(),
            timeZone: 'Europe/Paris',
        },
        end: {
            dateTime: event.endDate.toISOString(),
            timeZone: 'Europe/Paris',
        },
        extendedProperties: {
            private: {
                epitechId: event.id,
                moduleCode: event.module.code,
                activityCode: event.activity.code,
                eventCode: event.eventCode,
            },
        },
    };
}

/**
 * Get all Epitech events from Google Calendar
 */
async function getExistingEvents(calendarId: string): Promise<Map<string, GoogleCalendarEvent>> {
    const events = new Map<string, GoogleCalendarEvent>();

    let pageToken: string | undefined;
    do {
        const params = new URLSearchParams({
            maxResults: '2500',
            privateExtendedProperty: 'epitechId=epitech-',
        });
        if (pageToken) {
            params.set('pageToken', pageToken);
        }

        const response = await googleApiRequest<{
            items?: GoogleCalendarEvent[];
            nextPageToken?: string;
        }>(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);

        for (const event of response.items || []) {
            const epitechId = event.extendedProperties?.private?.epitechId;
            if (epitechId) {
                events.set(epitechId, event);
            }
        }

        pageToken = response.nextPageToken;
    } while (pageToken);

    return events;
}

/**
 * Sync events to Google Calendar
 */
export async function syncToGoogleCalendar(
    events: EpitechEvent[]
): Promise<SyncResultDetails> {
    const settings = await getSettings();
    const calendarId = settings.googleCalendar.calendarId;

    if (!calendarId) {
        throw new Error('Google Calendar not connected');
    }

    const result: SyncResultDetails = {
        created: 0,
        updated: 0,
        deleted: 0,
        errors: [],
    };

    try {
        // Get existing events
        const existingEvents = await getExistingEvents(calendarId);
        const processedIds = new Set<string>();

        // Create or update events
        for (const event of events) {
            processedIds.add(event.id);
            const googleEvent = toGoogleEvent(event);
            const existing = existingEvents.get(event.id);

            try {
                if (existing) {
                    // Update existing event
                    await googleApiRequest(
                      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.id)}`,
                      {
                        method: 'PUT',
                        body: JSON.stringify({ ...googleEvent, id: existing.id }),
                      }
                    );
                    result.updated++;
                } else {
                    // Create new event
                    await googleApiRequest(
                      `/calendars/${encodeURIComponent(calendarId)}/events`,
                      {
                        method: 'POST',
                        body: JSON.stringify(googleEvent),
                      }
                    );
                    result.created++;
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Event ${event.id}: ${errorMsg}`);
            }
        }

        // Delete events that no longer exist in Epitech
        for (const [epitechId, googleEvent] of existingEvents) {
            if (!processedIds.has(epitechId)) {
                try {
                    await googleApiRequest(
                      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEvent.id)}`,
                      { method: 'DELETE' }
                    );
                    result.deleted++;
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    result.errors.push(`Delete ${epitechId}: ${errorMsg}`);
                }
            }
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(errorMsg);
    }

    return result;
}

/**
 * Check if Google Calendar is properly connected
 */
export async function isGoogleConnected(): Promise<boolean> {
    try {
        const settings = await getSettings();
        if (!settings.googleCalendar.connected || !settings.googleCalendar.calendarId) {
            return false;
        }

        // Try to get token without interaction
        await getAuthToken(false);
        return true;
    } catch {
        return false;
    }
}
