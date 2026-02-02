/**
 * Date utilities for calendar operations
 */

/**
 * Parse a relative date string like '+3months' into a Date
 */
export function parseRelativeDate(relative: string, from: Date = new Date()): Date {
    const match = relative.match(/^([+-]?)(\d+)(days?|weeks?|months?|years?)$/);
    if (!match) {
        throw new Error(`Invalid relative date format: ${relative}`);
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

/**
 * Get sync period start and end dates from settings
 */
export function getSyncPeriodDates(
    start: string | 'today',
    end: string
): { startDate: Date; endDate: Date } {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let startDate: Date;
    if (start === 'today') {
        startDate = now;
    } else if (start.startsWith('+') || start.startsWith('-')) {
        startDate = parseRelativeDate(start, now);
    } else {
        startDate = new Date(start);
    }

    let endDate: Date;
    if (end.startsWith('+') || end.startsWith('-')) {
        endDate = parseRelativeDate(end, now);
    } else {
        endDate = new Date(end);
    }

    return { startDate, endDate };
}

/**
 * Parse Epitech API date string to Date object
 * Epitech dates are in format: "YYYY-MM-DD HH:MM:SS"
 */
export function parseEpitechDate(dateStr: string): Date {
    // Epitech dates are in Europe/Paris timezone
    // Parse as local time first
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);

    // Create date in local timezone
    const date = new Date(year, month - 1, day, hours, minutes, seconds);

    return date;
}

/**
 * Ensure a value is a valid Date object
 * Handles Date objects, ISO strings, and Epitech date strings
 */
export function ensureDate(value: unknown): Date {
    // Handle null/undefined
    if (value == null) {
        throw new Error('Date value is null or undefined');
    }

    // Handle Date instance
    if (value instanceof Date) {
        if (isNaN(value.getTime())) {
            throw new Error(`Invalid Date object: ${value}`);
        }
        return value;
    }

    // Handle number (timestamp)
    if (typeof value === 'number') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid timestamp: ${value}`);
        }
        return date;
    }

    // Handle string
    if (typeof value === 'string') {
        // Try ISO format first (from JSON serialization)
        let date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date;
        }

        // Try Epitech format "YYYY-MM-DD HH:MM:SS"
        date = parseEpitechDate(value);
        if (!isNaN(date.getTime())) {
            return date;
        }

        throw new Error(`Cannot parse date string: ${value}`);
    }

    // Handle object that might be a serialized Date (has toISOString or similar)
    if (typeof value === 'object') {
        // Try to convert object to string and parse
        const str = String(value);
        if (str && str !== '[object Object]') {
            const date = new Date(str);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        // Check if it has date-like properties (from JSON parse of Date)
        const obj = value as Record<string, unknown>;
        if (typeof obj.getTime === 'function') {
            const time = (obj.getTime as () => number)();
            if (!isNaN(time)) {
                return new Date(time);
            }
        }

        throw new Error(`Cannot convert object to Date: ${JSON.stringify(value)}`);
    }

    throw new Error(`Invalid date value type: ${typeof value}`);
}

/**
 * Format a Date to ICS datetime format (UTC)
 * Format: YYYYMMDDTHHMMSSZ
 */
export function toIcsDateTimeUtc(date: Date | string | number): string {
    const d = ensureDate(date);
    const pad = (n: number) => n.toString().padStart(2, '0');

    return (
        d.getUTCFullYear().toString() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        'Z'
    );
}

/**
 * Format a Date to ICS datetime format with timezone
 * Format: YYYYMMDDTHHMMSS
 */
export function toIcsDateTime(date: Date | string | number): string {
    const d = ensureDate(date);
    const pad = (n: number) => n.toString().padStart(2, '0');

    return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        'T' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
    );
}

/**
 * Format a Date to ICS date format
 * Format: YYYYMMDD
 */
export function toIcsDate(date: Date | string | number): string {
    const d = ensureDate(date);
    const pad = (n: number) => n.toString().padStart(2, '0');

    return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate())
    );
}

/**
 * Format date for display (French locale)
 */
export function formatDisplayDate(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format date for API calls (YYYY-MM-DD)
 */
export function formatApiDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Check if a date string represents today
 */
export function isToday(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return today.getTime() === date.getTime();
}

/**
 * Get timezone identifier for ICS (VTIMEZONE)
 */
export function getTimezoneVtimezone(): string {
    return [
        'BEGIN:VTIMEZONE',
        'TZID:Europe/Paris',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:+0100',
        'TZOFFSETTO:+0200',
        'TZNAME:CEST',
        'DTSTART:19700329T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
        'END:DAYLIGHT',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:+0200',
        'TZOFFSETTO:+0100',
        'TZNAME:CET',
        'DTSTART:19701025T030000',
        'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
        'END:STANDARD',
        'END:VTIMEZONE',
    ].join('\r\n');
}
