import { NextRequest, NextResponse } from "next/server";

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Hobby's ceiling. The sweep itself is not bounded by this — see the abort note below — so there
 * is nothing to gain from raising it on Pro.
 */
export const maxDuration = 60;

/**
 * How long to hold the connection open before letting go of the sweep.
 *
 * Deliberately under maxDuration: being killed mid-flight by the platform gives us no response to
 * log, while aborting ourselves does. The backend's own manual-run path waits up to 60s for an
 * in-flight scheduled run to clear (MANUAL_RUN_MAX_WAIT_MS), so a full fleet scan routinely
 * outlives any serverless budget. That is expected, not an error.
 */
const TRIGGER_TIMEOUT_MS = 45_000;

/**
 * GET /api/cron/heartbeat
 *
 * An external watchdog for the standalone backend scheduler, invoked by Vercel Cron.
 *
 * The backend (backend/, on Railway) drives Auto DCA itself: SchedulerService re-arms a timer after
 * every sweep, so under normal operation this route is a no-op that finds nothing due. It exists
 * for the case where that timer is *not* running — the container was restarted, redeployed, or
 * slept — because nothing else would notice. POST /api/run-now both executes what is due and, on
 * the way through, causes the scheduler to re-arm.
 *
 * This is not the legacy in-frontend executor. It relays to the backend relayer, which is the only
 * thing that signs and submits; see app/api/cron/execute-dca for the retired Gelato path, which
 * remains unscheduled on purpose. Running both would execute the same schedule twice.
 */
export async function GET(request: NextRequest) {
  /**
   * Fails closed. Vercel attaches `Bearer $CRON_SECRET` to cron invocations, so with the variable
   * unset this endpoint would otherwise let anyone on the internet trigger a real, funds-moving
   * execution sweep. The legacy execute-dca route fails open here; that is a bug not worth copying.
   */
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/heartbeat] CRON_SECRET is not set; refusing to trigger a sweep.");
    return NextResponse.json(
      { ok: false, error: "Cron heartbeat is disabled: set CRON_SECRET." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!SCHEDULER_API_URL) {
    return NextResponse.json(
      { ok: false, error: "Backend scheduler is unavailable." },
      { status: 503 },
    );
  }

  const target = `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/run-now`;
  const startedAt = Date.now();

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TRIGGER_TIMEOUT_MS),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(`[cron/heartbeat] backend returned ${response.status}`, data);
      return NextResponse.json(
        { ok: false, error: "Backend scheduler rejected the run.", status: response.status },
        { status: 502 },
      );
    }

    console.log(
      `[cron/heartbeat] sweep finished in ${Date.now() - startedAt}ms, executed=${data?.executed ?? 0}`,
    );
    return NextResponse.json({ ok: true, triggered: true, completed: true, result: data });
  } catch (error) {
    /**
     * A timeout here means the sweep is still running on the backend, not that it failed: the POST
     * was delivered and aborting the client connection does not unwind the handler. Reporting that
     * as an error would make a healthy long sweep look like an outage in the Vercel cron log.
     */
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.log(`[cron/heartbeat] sweep still running after ${TRIGGER_TIMEOUT_MS}ms; left to finish.`);
      return NextResponse.json({ ok: true, triggered: true, completed: false });
    }

    console.error("[cron/heartbeat]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to reach the backend scheduler." },
      { status: 503 },
    );
  }
}
