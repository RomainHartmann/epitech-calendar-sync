/**
 * Types for Epitech Intranet API responses
 */

/**
 * Raw event from Epitech planning API
 */
export interface EpitechRawEvent {
    scolaryear: string;
    acti_title: string;
    start: string;
    end: string;
    room: {
        code: string;
        type: string;
        seats: number;
    } | null;
    codemodule: string;
    codeinstance: string;
    codeacti: string;
    codeevent: string;
    semester: number;
    instance_location: string;
    titlemodule: string;
    prof_inst: {
        type: string;
        login: string;
        title: string;
        picture: string;
    }[] | null;
    registered: boolean;
    /** 'present' | 'registered' | 'absent' | 'N/A' | false */
    event_registered: string | false;
    /** RDV group slot if registered (format: "YYYY-MM-DD HH:MM:SS|YYYY-MM-DD HH:MM:SS") */
    rdv_group_registered: string | null;
    /** RDV individual slot if registered */
    rdv_indiv_registered: string | null;
    /** Whether user is registered to the module */
    module_registered: boolean;
    past: boolean;
    allow_register: boolean;
    allow_token: boolean;
    nb_hours: string | null;
    nb_group: number;
    nb_max_students_projet: number | null;
    /** "1" if event has individual/group slots */
    is_rdv: boolean | string;
    /** Event type code (e.g., "rdv" for defense/follow-up) */
    type_code?: string;
    /** Event type title (e.g., "Defense", "Follow-up") */
    type_title?: string;
}

/**
 * Normalized event for internal use
 */
export interface EpitechEvent {
    id: string;
    title: string;
    description: string;
    location: string;
    startDate: Date;
    endDate: Date;
    module: {
        code: string;
        instance: string;
        title: string;
    };
    activity: {
        code: string;
        title: string;
    };
    eventCode: string;
    semester: number;
    instructors: string[];
    isRegistered: boolean;
    isPast: boolean;
}

/**
 * API response for planning endpoint
 */
export interface EpitechPlanningResponse {
    events: EpitechRawEvent[];
}

/**
 * User info from Epitech API
 */
export interface EpitechUserInfo {
    login: string;
    title: string;
    firstname: string;
    lastname: string;
    promo: number;
    location: string;
    credits: number;
    gpa: {
        cycle: string;
        gpa: string;
    }[];
}

/**
 * Sync result for a single event
 */
export interface EventSyncResult {
    eventId: string;
    action: 'created' | 'updated' | 'deleted' | 'unchanged';
    success: boolean;
    error?: string;
}

/**
 * Overall sync result
 */
export interface SyncResult {
    success: boolean;
    timestamp: number;
    eventsProcessed: number;
    eventsCreated: number;
    eventsUpdated: number;
    eventsDeleted: number;
    errors: string[];
    details: EventSyncResult[];
}
