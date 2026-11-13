# CrowRules Yearbooks

Multi-page yearbook publishing and school-memory platform for CrowRules Entertainment.

## Public site
Responsive HTML/CSS/JavaScript pages cover elementary, middle school, high school, college, historical archives, private access, video yearbooks, pricing, partnerships and meeting requests.

## Design
Raven-black, charcoal, antique-gold and ivory editorial system; shared navigation and footer; mobile navigation; reduced-motion support. No fabricated school partnerships or operational metrics are presented as real.

## Local preview
Open index.html in a browser or run a static server from the repository root.

## Supabase
The proposed isolated schema is in supabase/migrations/202611130001_yearbooks_core.sql. It uses yb_-prefixed objects and does not drop or alter existing CrowRules tables. Review the existing schema and policies, then test this migration in staging before applying it to the production project.

Configure the correct project URL and browser-safe anon key. Deploy Edge Functions for inquiry intake, access-code redemption, signed media URLs, notifications and audit writes. Configure private Storage buckets and test RLS with anonymous, family, school and administrator accounts. Never put a service-role key or other privileged secret in GitHub Pages JavaScript.

## Current implementation boundary
The meeting form intentionally does not transmit data yet. The private access portal is not activated. The Control Center is a setup shell and does not invent statistics or expose privileged operations. These functions require backend configuration and server-side authorization.

## Deployment
GitHub Pages hosts the public static site. Privileged operations belong in Supabase Edge Functions or another trusted server-side environment. Add custom domain and HTTPS configuration as required.