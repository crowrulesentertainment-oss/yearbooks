# Supabase implementation notes

## Active project
Project ref: `cevylpnoexugwgygvtgu`

## Universal CrowRules membership
The existing `membership_sites` row for `yearbooks` is active and points to this GitHub Pages site. Existing global membership plans already include Yearbooks entitlements for CROW, CROWNER, CREATOR and FOUNDER. The frontend uses the shared Supabase Auth storage key used by Universal CrowRules Admin, and calls the existing `membership-status` Edge Function.

## Video data
The active migration creates:
- `cr_yearbook_video_catalog`: public-safe metadata for published video yearbooks.
- `cr_yearbook_video_assets`: private video storage object metadata, editable by CrowRules administrators.
- `cr_yearbook_access_grants`: per-member, per-project access grants.

The migration also creates private passcode hash and rate-limit tables under the `private` schema, a redemption RPC, and a private `cr-yearbook-videos` Storage bucket.

## Passcode and playback
The initial shared viewing code is stored as a bcrypt hash in `private.cr_yearbook_access_codes`. Do not place the code in JavaScript, HTML, GitHub docs or client configuration. The `cr_yearbook_redeem_access` RPC requires an active/trialing Universal CrowRules membership, a published project, and enforces five attempts per 15 minutes per member account.

The `cr-yearbook-video-playback` Edge Function requires a valid user JWT, rechecks membership and a non-revoked grant, then returns four-hour signed URLs for approved video assets.

## Storage and admin
The bucket is private. Only active CrowRules administrators may directly manage its objects. Viewer playback goes through the signed URL Edge Function. The existing Universal Admin session and `private.cr_universal_admin_check()` are reused.

## Important production safeguards
The shared passcode is a convenience layer, not a substitute for individual authorization, school approval or consent. Rotate it if it is exposed. Confirm consent, filming opt-outs, media rights, captions, retention and deletion procedures before uploading real student content.


## Meeting request intake
The public meeting form invokes `cr-yearbook-meeting-request` with no JWT requirement. The Edge Function validates adult contact fields, checks a honeypot, rate-limits by hashed IP, and inserts the inquiry using the server-side secret key. The browser receives only a reference code. The meeting request table is RLS-protected and admin-readable only.
