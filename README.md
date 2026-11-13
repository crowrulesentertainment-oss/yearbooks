# CrowRules Yearbooks

**CrowRules Yearbooks is a video-only production division of CrowRules Entertainment.** It creates cinematic video yearbooks for elementary schools, middle schools, high schools, colleges and universities, plus authorized historical video archives.

There are no printed yearbooks or printed products.

## Public website

The static multi-page website includes school-level pages, video yearbook productions, historical video archives, production options and pricing, meeting requests, and a private viewing portal.

## Design

Raven-black, charcoal, antique-gold and ivory editorial system; photorealistic raven hero photography; responsive navigation; reduced-motion support.

## Universal CrowRules membership

The site uses the existing CrowRules Supabase project and the same Universal CrowRules Auth storage key as other divisions. Yearbooks is enabled in the existing `membership_sites` registry. It uses the current global CROW, CROWNER, CREATOR and FOUNDER membership plans and existing Yearbooks entitlements. It does not create a second member directory or login system.

## Private video viewing

- Published video catalog metadata is readable publicly.
- Video files are stored in the private `cr-yearbook-videos` Storage bucket.
- A shared viewing code is stored as a bcrypt hash in the private schema, never in browser JavaScript.
- The authenticated member redeems the code for a specific published project.
- Redemption is rate-limited by account.
- Playback is issued by the authenticated `cr-yearbook-video-playback` Edge Function as a four-hour signed URL.
- Revoking a grant prevents future playback URL issuance.

The current shared code is intended as a temporary convenience, not strong identity verification. Schools should distribute it only to authorized viewers and rotate it if it is disclosed beyond the intended audience.

## Supabase migration

The active migration is `supabase/migrations/202611130002_video_yearbooks_universal_membership.sql`. It was applied to the existing CrowRules Supabase project `cevylpnoexugwgygvtgu`.

The migration is additive. It preserves existing CrowRules tables and records, and reuses the existing `school_profiles`, `cr_yearbook_projects`, `cr_yearbook_sections`, `cr_yearbook_submissions`, `members`, `membership_sites`, `membership_plans` and `membership_entitlements` systems.

## Control Center

The existing `admin/index.html` and Universal Admin integration are preserved. The Control Center now includes Video Catalog, Video Assets and Viewing Access Grants workspaces in addition to the existing school and production records.

Video asset records reference paths inside the private bucket. Uploads must be performed by an authorized administrator. Do not expose Supabase secret or service-role keys in GitHub Pages code.

## Meeting requests

The public meeting form submits to the `cr-yearbook-meeting-request` Edge Function. Requests are validated, rate-limited and stored in `cr_yearbook_meeting_requests`; only Universal Admin users can view and manage them in the Control Center. The form does not accept student records or media uploads.

## Production requirements

Before publishing real student videos, confirm school authorization, guardian consent where required, filming opt-outs, music and likeness rights, accessibility captions, retention and deletion terms, and school-approved access lists. The current passcode is an additional gate, not a replacement for consent or school authorization.
