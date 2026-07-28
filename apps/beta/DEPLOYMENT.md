# Velvet BETA deployment

- Cloudflare Worker: `velvet-beta`
- Production branch: `v1-lived-demo`
- Build: `npm run build:beta`
- Deploy: `npx wrangler deploy`
- Runtime: Cloudflare Workers with Static Assets
- Authentication: Supabase Paris through server-side Worker routes

This file also validates the first production deployment after the Cloudflare
build token was configured on 2026-07-28.
