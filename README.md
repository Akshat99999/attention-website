# AttentionX — landing page

Single page, one job: get the right visitor to book a strategy call. Vite + TypeScript, GSAP + Lenis for motion, Canvas 2D and SVG for the visuals. No framework, no external media.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

## Where the copy comes from

- **Structure, brand, proof, guarantee, CTA** — *Landing Page Strategy — The Site Project*: AttentionX, the section order, one CTA phrase ("Book a strategy call"), the proof figures (250 million+ views and 400,000+ new followers for an NDA client; about 13–14 million views in the first month at 15 accounts), the 100M-in-6-months guarantee, 3,000+ videos a month, 25+ partner accounts, 2–3 new clients per 5-week cycle.
- **Wording where a section matches** — *Website Copy — Personal Branding Agency (First Draft)*: the hero headline, problem items, "Why this works" items, FAQ answers, "What happens on the call", the booking confirmation.
- Content neither document supplies (a founder story, a method name, an entry-plan description, more case studies, contact details, legal links) is **left out**, not shown as a placeholder. Add it when it exists.

## Before going live

1. **Booking** — in `src/config.ts` set either `bookingEndpoint` (a POST URL for the answers, name, email and slot) or `bookingUrl` (a Calendly / Cal.com link the visitor is sent to after the four questions). With neither, `npm run dev` fakes success for review and a production build says booking isn't available.
2. **Fonts** — headings use General Sans from Fontshare's CDN (free licence). To self-host, put the woff2 files in `public/fonts` and replace the `<link>` in `index.html`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | All copy and section structure |
| `src/styles.css` | Design tokens and type scale at the top, then each section |
| `src/field.ts` | Hero: a perspective field of phone screens, waves of attention and signals from a source on the horizon |
| `src/flow.ts` | "Who we are": recording → clips → accounts on four platforms (horizontal on desktop, vertical on phones) |
| `src/visuals.ts` | Reach-by-platform bars, the 3,000-dot month, the 15 accounts, the guarantee timeline |
| `src/motion.ts` | Hero entrance, scroll reveals, proof counters |
| `src/ui.ts` | Nav, in-page links, the two-step booking form |

## Behaviour

- Readout values in the hero field ("12.5K views", "340 likes"…) are illustrative; the hero says so.
- Reduced motion: no smooth scroll, no entrance animation, a single still frame of the field, diagrams shown complete.
- The hero field stops drawing when it is off screen or the tab is hidden.
