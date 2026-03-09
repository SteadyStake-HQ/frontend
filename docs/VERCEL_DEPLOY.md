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

## Cron jobs (removed)

DCA execution is **no longer** triggered by Vercel Cron. The `vercel.json` crons entry has been removed. Use the **standalone backend executor** (see `backend/` and `frontend/docs/DCA_AUTOMATION.md`) to run DCA executions on a schedule (e.g. every 5 minutes) and deduct gas from users’ gas tank balances.
