import { NextRequest, NextResponse } from "next/server";

const MORALIS_LOGO_HOST = "logo.moralis.io";
const CACHE_MAX_AGE = "31536000"; // 1 year – use Moralis URL permanently once fetched

/**
 * Proxies token logo images from Moralis (and other allowed origins) so the
 * browser can use them without 403. Fetched once and cached long-term.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only https allowed" }, { status: 400 });
  }

  const allowed =
    parsed.hostname === MORALIS_LOGO_HOST ||
    parsed.hostname === "cdn.moralis.io" ||
    parsed.hostname.endsWith(".moralis.io");
  if (!allowed) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 400 });
  }

  const apiKey = process.env.MORALIS_API_KEY ?? process.env.NEXT_PUBLIC_MORALIS_API_KEY ?? "";

  try {
    const res = await fetch(url, {
      headers: apiKey ? { "X-API-Key": apiKey } : undefined,
      cache: "force-cache",
      next: { revalidate: 86400 * 365 },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "image/webp";
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
