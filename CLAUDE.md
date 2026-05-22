# saasmail

Self-hosted email server on Cloudflare Workers. See README.md for full documentation.

## Development

- Use `yarn` for all dependency commands (not npm)
- Backend: Hono + Zod OpenAPI routes in `worker/src/routers/`
- Frontend: React + Tailwind in `src/`
- Database: Drizzle ORM with D1 in `worker/src/db/`
- Run `yarn tsc --noEmit` to type-check before committing
- Run `yarn test` for tests

## Deployments / instances

This repo deploys to **two independent production instances** in the Red Leg Dev
Cloudflare account. Each has its own gitignored `wrangler.jsonc`-style config and
its own D1 / R2 / Queue resources — they share no data.

| Instance | Config file | Worker | UI host | Purpose |
| --- | --- | --- | --- | --- |
| Esferas | `wrangler.jsonc` (default) | `saasmail` | `mail.esferas.io` | Support inbox |
| Red Leg Dev | `wrangler.redleg.jsonc` | `saasmail-redleg` | `mail.redleg.dev` | Outbound for Matt's apps |

The `yarn` scripts target the **default** config (`wrangler.jsonc`) and hardcode
`saasmail-db`. For the Red Leg Dev instance, pass `-c wrangler.redleg.jsonc`
explicitly and run the underlying tools directly:

```bash
# Esferas instance — the yarn scripts work as-is
yarn deploy
yarn db:migrate:prod

# Red Leg Dev instance — explicit config
./node_modules/.bin/vite build && wrangler deploy --minify -c wrangler.redleg.jsonc
wrangler d1 migrations apply saasmail-redleg-db --remote -c wrangler.redleg.jsonc
wrangler secret put <NAME> -c wrangler.redleg.jsonc
```

Note: this repo's committed `yarn.lock` is **Yarn Classic v1**. If your global
`yarn` is Berry (v4), it can't run the package scripts — either use
`npx yarn@1 ...` or invoke the binaries directly from `./node_modules/.bin/`.

## Skills

- `/saasmail-onboarding` — Interactive setup wizard for deploying a new saasmail instance
