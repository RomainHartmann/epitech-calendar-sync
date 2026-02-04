/**
 * Epitech Intranet API client
 * Uses the authenticated session when the user is logged in
 */
import {
    EpitechRawEvent,
    EpitechEvent,
    EpitechUserInfo,
} from '../types/epitech';
import { parseEpitechDate, formatApiDate } from '../utils/date';
import { getSettings } from '../storage/settings';

const INTRA_BASE_URL = 'https://intra.epitech.eu';

/**
 * Fetch planning events from Epitech intranet
 */
export async function fetchPlanningEvents(
    startDate: Date,
    endDate: Date
): Promise<EpitechRawEvent[]> {
    const start = formatApiDate(startDate);
    const end = formatApiDate(endDate);

    const url = `${INTRA_BASE_URL}/planning/load?format=json&start=${start}&end=${end}`;

    const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Not authenticated. Please log in to the Epitech intranet.');
        }
        throw new Error(`Failed to fetch planning: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // The API returns an array directly
    if (!Array.isArray(data)) {
        throw new Error('Unexpected API response format');
    }

    return data as EpitechRawEvent[];
}

/**
 * Check if user is authenticated by fetching user info
 */
export async function checkAuthentication(): Promise<{ authenticated: boolean; user?: EpitechUserInfo }> {
    try {
        const response = await fetch(`${INTRA_BASE_URL}/user/?format=json`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            return { authenticated: false };
        }

        const user = await response.json() as EpitechUserInfo;
        return { authenticated: true, user };
    } catch {
        return { authenticated: false };
    }
}

/**
 * Format room code for display
 * "FR/PAR/KB2-Pasteur/Bureau-APE" → "KB2 Pasteur: Bureau APE"
 */
function formatRoomCode(code: string): string {
    // Split by /
    const parts = code.split('/');

    // Remove country and city prefix (FR/PAR/)
    // Keep the building and room parts
    const relevantParts = parts.slice(2);

    if (relevantParts.length === 0) {
        return code;
    }

    // Format building (first part): "KB2-Pasteur" → "KB2 Pasteur"
    const building = relevantParts[0].replace(/-/g, ' ');

    // Format room (remaining parts): "Bureau-APE" → "Bureau APE"
    const room = relevantParts.slice(1).map(p => p.replace(/-/g, ' ')).join(' ');

    if (room) {
        return `${building}: ${room}`;
    }

    return building;
}

/**
 * Clean activity title by removing unnecessary tags
 */
function cleanActivityTitle(title: string): string {
    return title.replace(/\s*\[OBLIGATOIRE\]\s*/gi, ' ').trim();
}

/**
 * Format duration from minutes
 */
function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
        return `${hours}h${mins.toString().padStart(2, '0')}`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else {
        return `${mins}min`;
    }
}

/**
 * Get the real time slot for an event
 * For RDV events (defenses, follow-ups), use the personal slot if available
 */
function getRealTimeSlot(raw: EpitechRawEvent): { start: Date; end: Date; isPersonalSlot: boolean | null; duration: string | null } {
    // Check if it's an RDV event (defense, follow-up, etc.)
    // is_rdv can be "1", "0", true, false, or 1, 0
    const isRdvEvent = raw.is_rdv === '1' || raw.is_rdv === true || raw.is_rdv === 1;

    if (isRdvEvent) {
        // Priority to individual slot, then group slot
        const slot = raw.rdv_indiv_registered || raw.rdv_group_registered;

        if (slot) {
            const [realStart, realEnd] = slot.split('|');
            const startDate = parseEpitechDate(realStart);
            const endDate = parseEpitechDate(realEnd);
            // Calculate real duration from slot
            const durationMs = endDate.getTime() - startDate.getTime();
            const durationMin = Math.round(durationMs / 60000);

            return {
                start: startDate,
                end: endDate,
                isPersonalSlot: true,
                duration: formatDuration(durationMin),
            };
        }

        // RDV event but no slot reserved yet
        return {
            start: parseEpitechDate(raw.start),
            end: parseEpitechDate(raw.end),
            isPersonalSlot: false,
            duration: raw.nb_hours,
        };
    }

    // Regular event (courses, exams, kick-offs, etc.)
    return {
        start: parseEpitechDate(raw.start),
        end: parseEpitechDate(raw.end),
        isPersonalSlot: null,
        duration: raw.nb_hours,
    };
}

/**
 * Transform raw Epitech event to normalized format
 */
export function transformEvent(raw: EpitechRawEvent, prefix: string): EpitechEvent {
    // Generate unique ID for the event
    const id = `epitech-${raw.codeacti}-${raw.codeevent}`;

    // Clean activity title (remove [OBLIGATOIRE] tag)
    const activityTitle = cleanActivityTitle(raw.acti_title);

    // Get real time slot (personal slot for RDV events)
    const timeSlot = getRealTimeSlot(raw);

    // Check registration status (can be string "registered" or boolean)
    const isRegistered = raw.event_registered === 'registered' ||
        raw.event_registered === 'present' ||
        raw.event_registered === 'absent' ||
        raw.registered === true;

    // Build description with details
    const descriptionParts: string[] = [];
    descriptionParts.push(`Module: ${raw.titlemodule}`);
    descriptionParts.push(`Activity: ${activityTitle}`);

    if (raw.prof_inst && raw.prof_inst.length > 0) {
        const instructors = raw.prof_inst.map((p) => p.title || p.login).join(', ');
        descriptionParts.push(`Instructor(s): ${instructors}`);
    }

    if (timeSlot.duration) {
        descriptionParts.push(`Duration: ${timeSlot.duration}`);
    }

    // Add slot status for RDV events
    if (timeSlot.isPersonalSlot === true) {
        descriptionParts.push('Slot: Personal slot reserved');
    } else if (timeSlot.isPersonalSlot === false) {
        descriptionParts.push('Slot: NOT RESERVED - Book your slot!');
    }

    descriptionParts.push(`Registered: ${isRegistered ? 'Yes' : 'No'}`);
    descriptionParts.push('');

    // Build intra link
    const intraLink = `https://intra.epitech.eu/module/${raw.scolaryear}/${raw.codemodule}/${raw.codeinstance}/${raw.codeacti}`;
    descriptionParts.push(`Intra: ${intraLink}`);

    // Build location
    let location = '';
    if (raw.room) {
        location = formatRoomCode(raw.room.code);
    } else if (raw.instance_location) {
        location = raw.instance_location;
    }

    // Build title (add warning if slot not reserved)
    let title = `${prefix}${activityTitle}`;
    if (timeSlot.isPersonalSlot === false) {
        title = `${prefix}[CRÉNEAU NON RÉSERVÉ] ${activityTitle}`;
    }

    return {
        id,
        title,
        description: descriptionParts.join('\n'),
        location,
        startDate: timeSlot.start,
        endDate: timeSlot.end,
        module: {
            code: raw.codemodule,
            instance: raw.codeinstance,
            title: raw.titlemodule,
        },
        activity: {
            code: raw.codeacti,
            title: activityTitle,
        },
        eventCode: raw.codeevent,
        semester: raw.semester,
        instructors: raw.prof_inst?.map((p) => p.title || p.login) || [],
        isRegistered,
        isPast: raw.past,
    };
}

/**
 * Check if user is registered/participant to a specific event
 */
function isUserRegisteredToEvent(event: EpitechRawEvent): boolean {
    // Check event_registered field
    const eventRegistered = event.event_registered;
    if (
        eventRegistered === 'present' ||
        eventRegistered === 'registered' ||
        eventRegistered === 'absent'
    ) {
        return true;
    }

    // Check RDV registrations
    if (event.rdv_group_registered !== null || event.rdv_indiv_registered !== null) {
        return true;
    }

    return false;
}

/**
 * Fetch and transform all events for the configured period
 * Only includes events where the user is registered
 */
export async function getEventsForSync(): Promise<EpitechEvent[]> {
    const settings = await getSettings();
    const { startDate, endDate } = getDateRange(settings.syncPeriod);

    const rawEvents = await fetchPlanningEvents(startDate, endDate);

    // Filter only events where user is registered
    const registeredEvents = rawEvents.filter(isUserRegisteredToEvent);

    console.log(`[EpitechSync] Filtered ${registeredEvents.length} registered events from ${rawEvents.length} total`);

    return registeredEvents.map((event) => transformEvent(event, settings.eventPrefix));
}

/**
 * Get date range from sync period settings
 */
function getDateRange(syncPeriod: { start: string | 'today'; end: string }): {
    startDate: Date;
    endDate: Date;
} {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let startDate: Date;
    if (syncPeriod.start === 'today') {
        startDate = now;
    } else if (syncPeriod.start.match(/^[+-]\d+/)) {
        startDate = parseRelativeDateSimple(syncPeriod.start, now);
    } else {
        startDate = new Date(syncPeriod.start);
    }

    let endDate: Date;
    if (syncPeriod.end.match(/^[+-]\d+/)) {
        endDate = parseRelativeDateSimple(syncPeriod.end, now);
    } else {
        endDate = new Date(syncPeriod.end);
    }

    return { startDate, endDate };
}

/**
 * Simple relative date parser
 */
function parseRelativeDateSimple(relative: string, from: Date): Date {
    const match = relative.match(/^([+-]?)(\d+)(days?|weeks?|months?|years?)$/);
    if (!match) {
        return from;
    }

    const [, sign, amount, unit] = match;
    const value = parseInt(amount, 10) * (sign === '-' ? -1 : 1);
    const result = new Date(from);

    switch (unit.replace(/s$/, '')) {
        case 'day':
            result.setDate(result.getDate() + value);
            break;
        case 'week':
            result.setDate(result.getDate() + value * 7);
            break;
        case 'month':
            result.setMonth(result.getMonth() + value);
            break;
        case 'year':
            result.setFullYear(result.getFullYear() + value);
            break;
    }

    return result;
}
