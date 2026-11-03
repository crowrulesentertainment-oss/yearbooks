# CrowRules Yearbooks — Website Starter

A responsive, cinematic, video-first multi-page website concept for CrowRules Entertainment.

## Included
- Homepage and brand experience
- Schools directory with search/filter
- All-grade coverage (K–12, college and university)
- Video yearbook library (public/private access labels)
- Digital archives
- Pricing guide
- How it works
- About and contact pages
- School coordinator portal concept
- Admin control-room concept
- Shared responsive CSS and JavaScript

## Run locally
Open `index.html` in a browser, or serve the folder with any static web server.

## Important implementation notes
This is a front-end starter/demo. Forms, authentication, uploads, school records, video playback, payments, and admin actions are illustrative UI only. They are not connected to Supabase or a video hosting provider.

Before publishing:
1. Replace sample schools and sample yearbook entries with verified participating schools and authorized content.
2. Connect Supabase Auth and database using the Supabase JS v2 client. Never expose a service-role key.
3. Configure Row Level Security for school coordinators, administrators, and approved viewers.
4. Use a dedicated video platform/CDN for transcoding, adaptive streaming, signed/private playback, and access control.
5. Obtain school authorization and appropriate parent/guardian consent before collecting or publishing identifiable student footage.
6. Add captions, accessibility review, retention rules, consent revocation, and video takedown workflows.
7. Have legal counsel review FERPA, COPPA, Washington student privacy requirements, contracts, and data retention.

## Suggested production roles
- `super_admin`: CrowRules platform administration
- `school_admin`: manages one participating school
- `coordinator`: submits footage and reviews productions
- `viewer`: authorized family/community viewer

## Suggested next technical steps
- Create Supabase tables: `schools`, `school_members`, `academic_years`, `grade_collections`, `videos`, `video_access_grants`, `production_projects`, `consent_records`, `archive_items`, `inquiries`.
- Add RLS policies scoped by school membership and video visibility.
- Store video metadata in Supabase; store actual video files with a streaming provider.
- Use signed playback URLs for private content and explicit public publication approval for public content.
