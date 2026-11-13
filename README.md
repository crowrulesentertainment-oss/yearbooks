# CrowRules Yearbooks

Multi-page yearbook publishing and school-memory platform for CrowRules Entertainment.

## Public site
Responsive HTML/CSS/JavaScript pages cover elementary, middle school, high school, college, historical archives, private access, video yearbooks, pricing, partnerships and meeting requests.

## Design
Raven-black, charcoal, antique-gold and ivory editorial system; photorealistic raven hero photography; shared navigation and footer; mobile navigation; reduced-motion support. No fabricated school partnerships or operational metrics are presented as real.

## Local preview
Open index.html in a browser or run a static server from the repository root.

## Existing administration
The existing admin/index.html and its Universal Admin authentication integration have been preserved. It currently manages existing CrowRules tables such as school_profiles, cr_yearbook_projects, cr_yearbook_sections and cr_yearbook_submissions. It has not been silently migrated to the new yb_ schema. Review and reconcile these existing tables before extending the Control Center.

## Supabase
The proposed isolated schema is in supabase/migrations/202611130001_yearbooks_core.sql. It uses yb_-prefixed objects and does not drop or alter existing CrowRules tables. Review the existing schema and policies, then test this migration in staging before applying it to the production project.

Configure the correct project URL and browser-safe anon key. Deploy Edge Functions for inquiry intake, access-code redemption, signed media URLs, notifications and audit writes. Configure private Storage buckets and test RLS with anonymous, family, school and administrator accounts. Never put a service-role key or other privileged secret in GitHub Pages JavaScript.

## Current implementation boundary
The meeting form intentionally does not transmit data yet. The private access portal is not activated. The existing admin is preserved, but new yearbook tables are not yet wired into its workspaces. These functions require backend configuration, schema reconciliation and server-side authorization.

## Deployment
GitHub Pages hosts the public static site. Privileged operations belong in Supabase Edge Functions or another trusted server-side environment. Add custom domain and HTTPS configuration as required.