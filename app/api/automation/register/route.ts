import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const AUTOMATION_USERS_KEY = "dca:automation:users";

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
    const member = `${chainId}:${userAddress.toLowerCase()}`;
    await kv.sadd(AUTOMATION_USERS_KEY, member);
    return NextResponse.json({ ok: true, registered: member });
  } catch (e) {
    console.error("[automation/register]", e);
    return NextResponse.json(
      { error: "Registration failed (check Vercel KV / storage)", ok: false },
      { status: 503 }
    );
  }
}
