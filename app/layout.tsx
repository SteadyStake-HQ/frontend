import type { Metadata } from "next";
import Script from "next/script";
import { Carter_One, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const themeInitScript = `(function(){var t=localStorage.getItem("theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var s=t||(d?"dark":"light");document.documentElement.classList.add(s);})()`;

const apolloScript = `function initApollo(){var n=Math.random().toString(36).substring(7),o=document.createElement("script");o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,o.async=!0,o.defer=!0,o.onload=function(){window.trackingFunctions.onLoad({appId:"69919453d957ce001554f86"})},document.head.appendChild(o)}initApollo();`;

const apolloInboundScript = `(function initApolloInbound() {
  var TIMEOUT_MS = 15000;
  var timeoutId;
  var style = document.createElement('style');
  style.id = 'apollo-form-prehide-css';
  style.textContent = 'form:has(input[type="email" i]),form:has(input[name="email" i]),.hs-form-iframe{position:relative!important}form:has(input[type="email" i])::before,form:has(input[name="email" i])::before,.hs-form-iframe::before{content:"";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;width:50px;height:50px;margin:auto;border:2.5px solid #e1e1e1;border-top:2.5px solid #9ea3a6;border-radius:50%;animation:spin 1s linear infinite;background-color:transparent;pointer-events:auto;z-index:999999;opacity:1}form:has(input[type="email" i]) *,form:has(input[name="email" i]) *,.hs-form-iframe *{opacity:0!important;user-select:none!important;pointer-events:none!important}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}';
  (document.head || document.documentElement).appendChild(style);
  function cleanup() {
    var styleEl = document.getElementById('apollo-form-prehide-css');
    if (styleEl) styleEl.remove();
    if (timeoutId) clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(function() {
    console.warn('[Apollo] Form enrichment timeout after 5s - revealing forms. Check network and console for errors.');
    cleanup();
  }, TIMEOUT_MS);
  var nocache = Math.random().toString(36).substring(7);
  var script = document.createElement('script');
  script.src = 'https://assets.apollo.io/js/apollo-inbound.js?nocache=' + nocache;
  script.defer = true;
  script.onerror = function() {
    console.error('[Apollo] Failed to load form enrichment script');
    cleanup();
  };
  script.onload = function() {
    try {
      if (!window.ApolloInbound || !window.ApolloInbound.formEnrichment) {
        console.error('[Apollo] Form enrichment object unavailable after script load');
        cleanup();
        return;
      }
      window.ApolloInbound.formEnrichment.init({
        appId: '699199065804aa000dd35376',
        onReady: function() { cleanup(); },
        onError: function(err) {
          console.error('[Apollo] Form enrichment init error:', err);
          cleanup();
        }
      });
    } catch (err) {
      console.error('[Apollo] Error initializing form enrichment:', err);
      cleanup();
    }
  };
  document.head.appendChild(script);
})();`;

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const carterOne = Carter_One({
  variable: "--font-carter-one",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const SITE_URL = "https://steadystake.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SteadyStake – Non-Custodial DCA Across Chains",
    template: "%s | SteadyStake",
  },
  description:
    "SteadyStake: multi-chain non-custodial DCA. Set a plan, fund DCA + Gas Tank, we execute on schedule. Live on BNB Chain, Base, Polygon, Kava. Prepaid gas, your keys. steadystake.org",
  keywords: [
    "SteadyStake",
    "steadystake",
    "steadystake.org",
    "DCA",
    "crypto savings",
    "multi-chain",
    "non-custodial",
    "Gas Tank",
    "BNB Chain",
    "Base",
    "Polygon",
    "Kava",
    "automated investing",
    "dollar cost averaging",
    "DeFi",
  ],
  authors: [{ name: "SteadyStake", url: SITE_URL }],
  creator: "SteadyStake",
  publisher: "SteadyStake",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "SteadyStake",
    title: "SteadyStake – Non-Custodial DCA Across Chains",
    description:
      "Multi-chain non-custodial DCA. Fund your plan + Gas Tank, we execute on schedule. BNB Chain, Base, Polygon, Kava. steadystake.org",
    images: [
      {
        url: "/Logo.jpeg",
        width: 1200,
        height: 630,
        alt: "SteadyStake - Automated Crypto Savings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SteadyStake – Non-Custodial DCA Across Chains",
    description:
      "Multi-chain non-custodial DCA. Fund DCA + Gas Tank, we execute on schedule. BNB Chain, Base, Polygon, Kava. steadystake.org",
    images: ["/Logo.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "4xNlIgZqZ6lQmAMECD3wnzJuOfkixD8xE-cdpmdYk2k",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shouldLoadApollo = process.env.NODE_ENV === "production";

  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${carterOne.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta
          name="talentapp:project_verification"
          content="0f3b5f6f338c481a11bf8de044b49e6e0ef17e189c0212cdd2e6a5e824973533f318779263c15828954f9e98c3318118762172dbfa3ad9a9bf9eb5091d806892"
        ></meta>
      </head>
      <body className="font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {shouldLoadApollo ? (
          <>
            <Script id="apollo-tracker" strategy="beforeInteractive">
              {apolloScript}
            </Script>
            <Script id="apollo-inbound" strategy="beforeInteractive">
              {apolloInboundScript}
            </Script>
          </>
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
