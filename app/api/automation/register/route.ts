import { NextRequest, NextResponse } from "next/server";
import { addAutomationUser, isSupabaseConfigured } from "@/lib/automation-users";

export const runtime = "nodejs";

/**
 * POST /api/automation/register
 * Body: { chainId: number, userAddress: string }
 * Registers a user for DCA automation (so the cron will check their schedules).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chainId = Number(body?.chainId);
    const userAddress = typeof body?.userAddress === "string" ? body.userAddress.trim() : "";
    if (!Number.isInteger(chainId) || chainId <= 0 || !userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: "Invalid chainId or userAddress" }, { status: 400 });
    }
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Registration store not configured (set SUPABASE_DB_URL)", ok: false },
        { status: 503 },
      );
    }
    const registered = await addAutomationUser(chainId, userAddress);
    return NextResponse.json({ ok: true, registered });
  } catch (e) {
    console.error("[automation/register]", e);
    return NextResponse.json(
      { error: "Registration failed (check Supabase / SUPABASE_DB_URL)", ok: false },
      { status: 503 }
    );
  }
}
