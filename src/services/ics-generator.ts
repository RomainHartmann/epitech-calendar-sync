/**
 * ICS (iCalendar) file generator
 * Generates RFC 5545 compliant .ics files
 */
import { EpitechEvent } from '../types/epitech';
import { toIcsDateTime, getTimezoneVtimezone, ensureDate } from '../utils/date';

/**
 * Escape special characters for ICS format
 */
function escapeIcsText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/**
 * Fold long lines according to RFC 5545
 * Lines should be max 75 octets, folded with CRLF followed by space
 */
function foldLine(line: string): string {
    const maxLength = 75;
    if (line.length <= maxLength) {
        return line;
    }

    const lines: string[] = [];
    let remaining = line;

    // First line can be full length
    lines.push(remaining.substring(0, maxLength));
    remaining = remaining.substring(maxLength);

    // Continuation lines start with space, so max content is 74
    while (remaining.length > 0) {
        lines.push(' ' + remaining.substring(0, maxLength - 1));
        remaining = remaining.substring(maxLength - 1);
    }

    return lines.join('\r\n');
}

/**
 * Generate UID for an event
 * Format: epitech-{codeacti}-{codeevent}@epitech.eu
 */
function generateUid(event: EpitechEvent): string {
    return `${event.id}@epitech.eu`;
}

/**
 * Generate a single VEVENT component
 */
function generateVEvent(event: EpitechEvent): string {
    const lines: string[] = [];

    lines.push('BEGIN:VEVENT');

    // UID - unique identifier
    lines.push(`UID:${generateUid(event)}`);

    // Timestamps
    const now = new Date();
    lines.push(`DTSTAMP:${toIcsDateTime(now)}`);

    // Start and end times with timezone
    lines.push(`DTSTART;TZID=Europe/Paris:${toIcsDateTime(event.startDate)}`);
    lines.push(`DTEND;TZID=Europe/Paris:${toIcsDateTime(event.endDate)}`);

    // Summary (title)
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);

    // Description
    if (event.description) {
        lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }

    // Location
    if (event.location) {
        lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }

    // Categories
    lines.push(`CATEGORIES:EPITECH,${escapeIcsText(event.module.title)}`);

    // Status - confirmed for registered events
    lines.push(`STATUS:${event.isRegistered ? 'CONFIRMED' : 'TENTATIVE'}`);

    // Transparency
    lines.push('TRANSP:OPAQUE');

    // Sequence number (for updates)
    lines.push('SEQUENCE:0');

    lines.push('END:VEVENT');

    return lines.map(foldLine).join('\r\n');
}

/**
 * Generate complete ICS calendar content
 */
export function generateIcsContent(events: EpitechEvent[]): string {
    const lines: string[] = [];

    // Calendar header
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//Epitech Calendar Sync//EN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');
    lines.push('X-WR-CALNAME:Epitech Calendar');
    lines.push('X-WR-TIMEZONE:Europe/Paris');

    // Timezone definition
    lines.push(getTimezoneVtimezone());

    // Events
    for (const event of events) {
        lines.push(generateVEvent(event));
    }

    // Calendar footer
    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
}

/**
 * Create a downloadable blob URL for ICS content
 */
export function createIcsDownloadUrl(content: string): string {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    return URL.createObjectURL(blob);
}

/**
 * Generate ICS content for a specific date range
 */
export function generateIcsForDateRange(
    events: EpitechEvent[],
    startDate: Date,
    endDate: Date
): string {
    const filteredEvents = events.filter((event) => {
        const eventStart = ensureDate(event.startDate as unknown as Date | string);
        return eventStart >= startDate && eventStart <= endDate;
    });

    return generateIcsContent(filteredEvents);
}
