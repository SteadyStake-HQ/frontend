"use client";

import { useEffect, useState } from "react";

const ARENA_URL = "https://earena.steadystake.org";

/**
 * The promo artwork — a finished 16:9 banner that carries the wordmark, the
 * tagline and its own call to action, so the card is the image and little else.
 * Replacing the file at this path is the whole update; nothing here reads its
 * contents. A plain <img> rather than next/image because `onError` below is what
 * swaps in the drawn stand-in when the file is missing, and the optimizer turns
 * a missing source into a failed request instead.
 */
const PROMO_IMAGE = "/echo-arena-promo.png";

/** Dismissal lasts for the tab, not forever — a new visit gets one more look. */
const DISMISS_KEY = "ss-echo-arena-promo-dismissed";

/** Late enough that the hero has been read before the card arrives over it. */
const APPEAR_DELAY_MS = 2600;

/** Matches the leave animation in globals.css, so the card is gone on cue. */
const LEAVE_MS = 260;

/**
 * Past this scroll offset the card can no longer sit clear of the page.
 *
 * The landing page is ~16,000px of full-width sections, so a fixed overlay
 * collides with something at nearly every offset — measured, there is no
 * position on this page where a card of any usable size stays clear once it
 * scrolls. What does hold is the page at rest: at the top, the 320x180 card at
 * `right:1.5rem, top:4.5rem` covers nothing from 1280 to 1920 wide in both the
 * healthy and the outage-banner layout. The narrowest of those starts clipping
 * the hero panel around 40px of scroll, so the card steps aside before that and
 * comes back when the page returns to the top.
 */
const SCROLL_LIMIT_PX = 16;

/**
 * The arena, drawn: a hull on a closed loop with one echo trailing it. Stands in
 * for the banner whenever the file is missing or fails to load — paired with the
 * caption below it, since without the artwork the card would otherwise say
 * nothing at all.
 */
function ArenaMark() {
  return (
    // "slice" rather than the default fit, so the mark crops to its frame the
    // same way `object-fit: cover` crops the real banner.
    <svg
      className="eap-mark"
      viewBox="0 0 240 135"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <ellipse className="eap-mark-route" cx="120" cy="67" rx="84" ry="41" />
      {/* Both darts sit on the loop's top arc, nose along it — the hull ahead,
          its echo trailing on the same line. */}
      <path className="eap-mark-echo" d="M0-7 14 0 0 7 3.5 0Z" transform="translate(88 29)" />
      <path className="eap-mark-hull" d="M0-8 16 0 0 8 4 0Z" transform="translate(152 29)" />
    </svg>
  );
}

/**
 * The Echo Arena advertisement — the game's banner, in the top-right corner, a
 * couple of seconds into the page.
 *
 * It is an aside rather than a dialog: nothing behind it is blocked, no focus is
 * trapped, and one click on the X puts it away for the rest of the tab. It sits
 * under the header rather than beside it — the header is absolutely positioned
 * and scrolls away, but at the top of the page its wallet and CTA buttons live
 * in exactly this corner, and an ad landing on them would cost a click rather
 * than earn one.
 */
export function EchoArenaPromo() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    // sessionStorage is unavailable in some privacy modes; a promo is never
    // worth a thrown exception, so a failed read simply means "not dismissed".
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* no stored preference to honour */
    }

    const timer = window.setTimeout(() => setOpen(true), APPEAR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const sync = () => setAtTop(window.scrollY <= SCROLL_LIMIT_PX);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [open]);

  const dismiss = () => {
    setLeaving(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* it stays dismissed for this page view either way */
    }
    window.setTimeout(() => setOpen(false), LEAVE_MS);
  };

  if (!open) return null;

  return (
    <aside
      className={`eap${leaving ? " eap-leaving" : ""}${atTop ? "" : " eap-stowed"}`}
      aria-label="Echo Arena promotion"
      aria-hidden={!atTop}
      inert={!atTop}
    >
      <button
        type="button"
        className="eap-close"
        onClick={dismiss}
        aria-label="Dismiss Echo Arena promotion"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <a href={ARENA_URL} target="_blank" rel="noopener noreferrer" className="eap-link">
        {artworkFailed ? (
          <>
            <ArenaMark />
            <span className="eap-fallback">
              <strong>Echo Arena</strong>
              <span>Outrun what you were — play now</span>
            </span>
          </>
        ) : (
          /* Loaded eagerly: the card only mounts when it is about to be shown
             and it is already in the viewport, so lazy buys nothing here and
             can leave the card painted blank for a beat. */
          <img
            src={PROMO_IMAGE}
            alt="Echo Arena — outrun what you were. Free to play."
            className="eap-art"
            loading="eager"
            decoding="async"
            onError={() => setArtworkFailed(true)}
          />
        )}
      </a>
    </aside>
  );
}
