/**
 * Microsoft Outlook Calendar API integration
 * Uses Microsoft Graph API with OAuth 2.0
 */
import browser from 'webextension-polyfill';
import { EpitechEvent } from '../types/epitech';
import { getSettings, updateNestedSetting } from '../storage/settings';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const MS_AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0';

// You need to register an app in Azure AD and get these values
const MS_CLIENT_ID = 'bf945656-1897-444b-89bf-343504cf9c63';
const MS_REDIRECT_URI = browser.identity.getRedirectURL();
const MS_SCOPES = ['Calendars.ReadWrite', 'offline_access'];

interface OutlookCalendarEvent {
    id: string;
    subject: string;
    body?: {
        contentType: string;
        content: string;
    };
    location?: {
        displayName: string;
    };
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    singleValueExtendedProperties?: Array<{
        id: string;
        value: string;
    }>;
}

interface OutlookCalendar {
    id: string;
    name: string;
    isDefaultCalendar?: boolean;
}

interface SyncResultDetails {
    created: number;
    updated: number;
    deleted: number;
    errors: string[];
}

// Extended property ID for storing Epitech event ID
const EPITECH_ID_PROP = 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name EpitechId';

/**
 * Get OAuth authorization URL
 */
function getAuthUrl(): string {
    const params = new URLSearchParams({
        client_id: MS_CLIENT_ID,
        response_type: 'token',
        redirect_uri: MS_REDIRECT_URI,
        scope: MS_SCOPES.join(' '),
        response_mode: 'fragment',
    });

    return `${MS_AUTH_ENDPOINT}/authorize?${params}`;
}

/**
 * Parse token from redirect URL
 */
function parseTokenFromUrl(url: string): string | null {
    const hash = new URL(url).hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
}

/**
 * Connect to Outlook Calendar (OAuth flow)
 */
export async function connectOutlookCalendar(): Promise<void> {
    const authUrl = getAuthUrl();

    // Launch OAuth flow
    const redirectUrl = await browser.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
    });

    const token = parseTokenFromUrl(redirectUrl);
    if (!token) {
        throw new Error('Failed to get access token from Microsoft');
    }

    // Save token
    await updateNestedSetting('outlookCalendar', {
        accessToken: token,
        tokenExpiry: Date.now() + 3600 * 1000, // Token typically expires in 1 hour
    });

    // Find or create Epitech calendar
    const calendarId = await findOrCreateEpitechCalendar();

    // Save connection state
    await updateNestedSetting('outlookCalendar', {
        connected: true,
        enabled: true,
        calendarId,
    });
}

/**
 * Disconnect from Outlook Calendar
 */
export async function disconnectOutlookCalendar(): Promise<void> {
    await updateNestedSetting('outlookCalendar', {
        connected: false,
        calendarId: null,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
    });
}

/**
 * Get valid access token
 */
async function getAccessToken(): Promise<string> {
    const settings = await getSettings();
    const { accessToken, tokenExpiry } = settings.outlookCalendar;

    if (!accessToken) {
        throw new Error('Not connected to Outlook Calendar');
    }

    // Check if token is expired
    if (tokenExpiry && Date.now() > tokenExpiry) {
        // Token expired, need to re-authenticate
        throw new Error('Outlook token expired. Please reconnect.');
    }

    return accessToken;
}

/**
 * Make authenticated request to Microsoft Graph API
 */
async function graphApiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = await getAccessToken();

    const response = await fetch(`${GRAPH_API}${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Authentication expired. Please reconnect Outlook Calendar.');
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(
            `Graph API error: ${response.status} - ${(error as { error?: { message?: string } }).error?.message || response.statusText}`
        );
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return response.json() as Promise<T>;
}

/**
 * Find existing Epitech calendar or create new one
 */
async function findOrCreateEpitechCalendar(): Promise<string> {
    const settings = await getSettings();
    const calendarName = settings.outlookCalendar.calendarName || 'Epitech';

    // List existing calendars
    const response = await graphApiRequest<{ value: OutlookCalendar[] }>(
        '/me/calendars'
    );

    // Look for existing Epitech calendar
    const existing = response.value.find(
        (cal) => cal.name === calendarName && !cal.isDefaultCalendar
    );

    if (existing) {
        return existing.id;
    }

    // Create new calendar
    const newCalendar = await graphApiRequest<OutlookCalendar>('/me/calendars', {
        method: 'POST',
        body: JSON.stringify({
            name: calendarName,
        }),
    });

    return newCalendar.id;
}

/**
 * Convert EpitechEvent to Outlook Calendar event format
 */
function toOutlookEvent(event: EpitechEvent): Partial<OutlookCalendarEvent> {
    return {
        subject: event.title,
        body: {
            contentType: 'text',
            content: event.description,
        },
        location: event.location
            ? {
                    displayName: event.location,
                }
            : undefined,
        start: {
            dateTime: event.startDate.toISOString().replace('Z', ''),
            timeZone: 'Europe/Paris',
        },
        end: {
            dateTime: event.endDate.toISOString().replace('Z', ''),
            timeZone: 'Europe/Paris',
        },
        singleValueExtendedProperties: [
            {
                id: EPITECH_ID_PROP,
                value: event.id,
            },
        ],
    };
}

/**
 * Get all Epitech events from Outlook Calendar
 */
async function getExistingEvents(calendarId: string): Promise<Map<string, OutlookCalendarEvent>> {
    const events = new Map<string, OutlookCalendarEvent>();

    // Query events with the Epitech ID extended property
    const filter = encodeURIComponent(
        `singleValueExtendedProperties/any(ep: ep/id eq '${EPITECH_ID_PROP}' and startswith(ep/value, 'epitech-'))`
    );
    const expand = encodeURIComponent(`singleValueExtendedProperties($filter=id eq '${EPITECH_ID_PROP}')`);

    let url = `/me/calendars/${calendarId}/events?$filter=${filter}&$expand=${expand}&$top=100`;

    while (url) {
        const response = await graphApiRequest<{
            value: OutlookCalendarEvent[];
            '@odata.nextLink'?: string;
        }>(url);

        for (const event of response.value) {
            const epitechIdProp = event.singleValueExtendedProperties?.find(
                (p) => p.id === EPITECH_ID_PROP
            );
            if (epitechIdProp) {
                events.set(epitechIdProp.value, event);
            }
        }

        // Handle pagination
        if (response['@odata.nextLink']) {
            url = response['@odata.nextLink'].replace(GRAPH_API, '');
        } else {
            break;
        }
    }

    return events;
}

/**
 * Sync events to Outlook Calendar
 */
export async function syncToOutlookCalendar(
    events: EpitechEvent[]
): Promise<SyncResultDetails> {
    const settings = await getSettings();
    const calendarId = settings.outlookCalendar.calendarId;

    if (!calendarId) {
        throw new Error('Outlook Calendar not connected');
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
            const outlookEvent = toOutlookEvent(event);
            const existing = existingEvents.get(event.id);

            try {
                if (existing) {
                    // Update existing event
                    await graphApiRequest(
                      `/me/calendars/${calendarId}/events/${existing.id}`,
                      {
                        method: 'PATCH',
                        body: JSON.stringify(outlookEvent),
                      }
                    );
                    result.updated++;
                } else {
                    // Create new event
                    await graphApiRequest(`/me/calendars/${calendarId}/events`, {
                      method: 'POST',
                      body: JSON.stringify(outlookEvent),
                    });
                    result.created++;
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push(`Event ${event.id}: ${errorMsg}`);
            }
        }

        // Delete events that no longer exist in Epitech
        for (const [epitechId, outlookEvent] of existingEvents) {
            if (!processedIds.has(epitechId)) {
                try {
                    await graphApiRequest(
                      `/me/calendars/${calendarId}/events/${outlookEvent.id}`,
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
 * Check if Outlook Calendar is properly connected
 */
export async function isOutlookConnected(): Promise<boolean> {
    try {
        const settings = await getSettings();
        if (!settings.outlookCalendar.connected || !settings.outlookCalendar.calendarId) {
            return false;
        }

        // Check if token is valid
        await getAccessToken();
        return true;
    } catch {
        return false;
    }
}
