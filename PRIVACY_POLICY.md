# Privacy Policy — Epitech Calendar Sync

**Last updated:** February 11, 2026

Epitech Calendar Sync is an open-source browser extension that synchronizes calendar events from the Epitech intranet to Google Calendar, Microsoft Outlook, or an ICS file. This privacy policy explains what data the extension accesses and how it is handled.

## Data Collected

The extension accesses the following data **solely to perform calendar synchronization**:

- **Epitech intranet calendar events** — event title, date/time, location, module name, activity name, instructor name, and registration status.
- **Epitech user profile** — login and name, used only to identify which events belong to you.
- **OAuth tokens** — for Google Calendar and/or Microsoft Outlook, used to authenticate API requests on your behalf.

## How Data Is Used

- Calendar events retrieved from the Epitech intranet are sent to Google Calendar and/or Microsoft Outlook **only if you explicitly connect those services**.
- Events can also be exported locally as an ICS file, with no data transmitted to any external service.
- Event data may be cached in the browser's local storage to support ICS export functionality.

## Data Storage

- All data is stored **locally in your browser** (using the browser extension storage API).
- **No data is sent to, stored on, or processed by any server operated by the extension developer.**
- Google Calendar tokens are managed by the Chrome browser's built-in identity system.
- Outlook tokens are stored in the extension's local storage and expire after a short period.

## Third-Party Services

The extension communicates directly with the following services using their official APIs:

| Service | Purpose | Data shared |
|---------|---------|-------------|
| Epitech intranet (`intra.epitech.eu`) | Retrieve calendar events | Your existing browser session |
| Google Calendar API (`googleapis.com`) | Create/update/delete events | Event details (title, time, location, description) |
| Microsoft Graph API (`graph.microsoft.com`) | Create/update/delete events | Event details (title, time, location, description) |

Each service is governed by its own privacy policy:
- [Google Privacy Policy](https://policies.google.com/privacy)
- [Microsoft Privacy Policy](https://privacy.microsoft.com/privacystatement)

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Save your settings and cached events locally |
| `identity` | Authenticate with Google Calendar via OAuth |
| `notifications` | Show sync status notifications |
| `alarms` | Schedule periodic background sync |
| Host access to `intra.epitech.eu` | Read your calendar events |
| Host access to `googleapis.com` | Sync events to Google Calendar |
| Host access to `graph.microsoft.com` | Sync events to Outlook |

## Data Sharing

**The extension does not sell, transfer, or share your data with any third party** beyond the calendar services you explicitly connect.

## Data Retention and Deletion

- Cached event data is stored only in your browser's local storage.
- Disconnecting a calendar service removes the associated token from local storage.
- Uninstalling the extension removes all locally stored data.
- Events previously synced to Google Calendar or Outlook remain in those services until you delete them.

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect personal information from children.

## Changes to This Policy

Updates to this privacy policy will be reflected in this document with an updated date. Continued use of the extension after changes constitutes acceptance.

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/RomainHartmann/epitech-calendar-sync/issues).

## Open Source

This extension is open source under the MIT License. You can review the complete source code on [GitHub](https://github.com/RomainHartmann/epitech-calendar-sync).
