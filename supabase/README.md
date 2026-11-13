# Supabase setup notes

## Important: inspect before applying
The CrowRules Supabase project already contains application tables and Row Level Security policies. The Yearbooks migration is isolated under the yb_ prefix, but it has not been applied by this repository change. Review the current schema, dependencies, grants and RLS policies in a staging project first. Do not reset the project or revoke existing policies as a shortcut.

## Proposed Yearbooks schema
Apply migrations in order only after review. The initial migration creates schools, school memberships, yearbooks, sections, media metadata, access groups, access memberships, hashed access-code records, inquiries, consent records and audit logs.

## Existing admin compatibility
The preserved admin/index.html currently queries school_profiles, cr_yearbook_projects, cr_yearbook_sections and cr_yearbook_submissions, and uses the existing CrowRules Universal Admin authentication helper. These are not automatically interchangeable with the new yb_ tables. Plan a deliberate migration or compatibility layer before changing the admin queries.

## Required server-side functions
- Inquiry intake: validate and rate-limit requests, create a reference number, store the inquiry and send an acknowledgment.
- Invitation redemption: verify a hash server-side, enforce expiration and usage limits, then grant an authenticated membership.
- Private media delivery: verify the user's access and return short-lived signed URLs.
- Notifications: send staff alerts without exposing provider credentials.
- Audit writes: record privileged changes from trusted server-side code.

## Storage
Use private buckets for yearbook scans, student photography, raw footage and private video assets. Only explicitly approved public assets belong in public buckets. Add object-level Storage policies and verify that signed URLs expire as expected.

## Security test matrix
Test anonymous visitors, unrelated authenticated users, family members, teachers/editors, school administrators and CrowRules administrators. Verify public content, school-wide access, class-specific access, revocation, expired membership, withdrawn consent and private file access. Do not treat hiding a link or disabling a button as authorization.

## Launch blockers
Do not accept student media or personal information until school authorization, guardian consent where required, retention, removal, ownership, accessibility, privacy notices and applicable legal obligations have been reviewed.