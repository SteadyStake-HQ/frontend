# Vercel deployment and auto-deploy

## Auto-deploy on git push

To have Vercel **automatically deploy** when you push to your repo:

1. In [Vercel Dashboard](https://vercel.com/dashboard), open your project (or import the repo if not yet connected).
2. Go to **Settings → Git**.
3. Under **Production Branch**, set the branch that triggers production deploys (e.g. `master` or `main`).
4. Ensure **Deploy Hooks** / **Auto-deploy** is enabled for the connected repository (usually on by default when the project is linked to GitHub/GitLab/Bitbucket).
5. If the project was imported with a different root (e.g. repo root instead of `frontend`), set **Root Directory** to `frontend` so builds use the Next.js app.
6. Push to the production branch; Vercel will build and deploy.

No code changes are required; auto-deploy is controlled in the Vercel project settings.

## Cron jobs

DCA execution is **not** performed by Vercel Cron. The **standalone backend executor** (see `backend/` and `frontend/docs/DCA_AUTOMATION.md`) owns the schedule: it re-arms its own timer after every sweep and is the only thing that signs and submits.

`vercel.json` declares one cron, a watchdog for that backend:

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/heartbeat` | `0 10 * * *` (daily, 10:00 UTC) | Calls the backend's `POST /api/run-now`. A no-op when the backend timer is healthy; recovers the schedule if the container restarted, redeployed, or slept. |

Notes:

- **`CRON_SECRET` is required.** Vercel sends it as `Authorization: Bearer <CRON_SECRET>`. The heartbeat fails closed without it — an unauthenticated caller must not be able to trigger a funds-moving sweep.
- **`SCHEDULER_API_URL` must point at the deployed backend**, or the heartbeat has nothing to call.
- **Daily is a Hobby-plan limit.** Hobby allows one run per day; Pro allows minute-level granularity, so on Pro you can tighten the schedule to e.g. `*/5 * * * *`. No Vercel cron can match the backend's own sub-minute tick, which is why this is a watchdog and not the scheduler.
- **Do not also schedule `/api/cron/execute-dca`.** That is the retired in-frontend Gelato executor; running it alongside the backend relayer would execute the same plan twice.
