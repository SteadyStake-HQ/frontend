# SteadyStake – SEO & promotion (steadystake.org)

## What’s already done in the repo

- **Domain**: All metadata, sitemap, and `robots.txt` use **https://steadystake.org** (no more steadystake.com).
- **SEO**: Title, description, and keywords include “SteadyStake” and “steadystake.org”. Canonical URL and Open Graph/Twitter use the live domain.
- **Sitemap**: `https://steadystake.org/sitemap.xml` lists homepage and dashboard.
- **Structured data**: Organization JSON-LD in layout and footer so Google can show your brand and links correctly.

---

## 1. Get Google to index you (so “steadystake” shows in search)

### A. Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console).
2. Add property: **URL prefix** → `https://steadystake.org`.
3. Verify ownership (e.g. HTML tag or DNS).  
   - If you use the HTML tag, add it in `app/layout.tsx` under `metadata`:
   - Uncomment and set: `verification: { google: "YOUR_CODE_FROM_CONSOLE" }`.
4. After verification, submit the sitemap: **Sitemaps** → add `https://steadystake.org/sitemap.xml`.
5. Use **URL Inspection** to request indexing for `https://steadystake.org` (and other important URLs).

### B. Give it a few days

- Indexing often takes a few days to a couple of weeks.  
- After that, searching **steadystake** or **steadystake.org** should start showing your site.

---

## 2. Promote the site (so more people find you)

- **Base / crypto communities**  
  - Post in Base-focused Discord/Slack/Telegram (e.g. Base Discord, Base Telegram).  
  - Share in “DeFi on Base” or “Base builders” channels; focus on DCA and simple onboarding.

- **Social**  
  - Use your existing Discord and Telegram and link to **https://steadystake.org** and the Notion whitepaper.  
  - If you add Twitter/X, use handle and bio to say “SteadyStake – Automated crypto savings on Base | steadystake.org”.

- **Content**  
  - Short “How to DCA on Base with SteadyStake” (blog or Notion) with the brand name and link.  
  - One or two “What is SteadyStake?” / “Why DCA on Base?” posts; link to steadystake.org in every post.

- **Listings**  
  - Add SteadyStake to Base ecosystem / DeFi lists (e.g. Base official ecosystem page, DefiLlama, or other Base app lists) with URL **https://steadystake.org**.

- **Backlinks**  
  - Get linked from at least one Base/crypto site (e.g. “Tools on Base”, “DeFi on Base” roundups). Even a single quality backlink helps both SEO and discovery.

---

## 3. Quick checklist

- [ ] Add and verify `https://steadystake.org` in Google Search Console.  
- [ ] Submit sitemap: `https://steadystake.org/sitemap.xml`.  
- [ ] (Optional) Add Google verification meta tag in `app/layout.tsx` if you use HTML method.  
- [ ] Share steadystake.org in Base / crypto communities and in your Discord/Telegram.  
- [ ] Add SteadyStake to at least one Base ecosystem or DeFi listing with the correct URL.

Once Search Console is set up and the sitemap is submitted, Google will crawl steadystake.org and “steadystake” searches should start showing your site over time.
