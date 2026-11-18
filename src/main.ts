import '@fontsource-variable/geist';
import './styles.css';

import Lenis from 'lenis';
import { heroEntrance, scrollMotion, gsap, ScrollTrigger } from './motion';
import { initAnchors, initNav, initBooker, initMisc, type Scroller } from './ui';
import { DistributionField } from './field';
import { initVisuals } from './visuals';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Content is hidden only until these run, so they go first. If the inline fail-safe already
// revealed everything (very slow load), don't hide it again just to animate it back in.
const failSafeFired = !document.documentElement.classList.contains('js');
heroEntrance(reduced || failSafeFired);
scrollMotion(reduced || failSafeFired);
(window as unknown as { __axReady: boolean }).__axReady = true;

/* ───────────── smooth scroll (not for reduced motion) ───────────── */
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scroller: Scroller = {
  scrollTo(target, opts = {}) {
    if (lenis) return lenis.scrollTo(target, { offset: opts.offset ?? 0, immediate: opts.immediate, duration: 1.3 });
    const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY + (opts.offset ?? 0);
    window.scrollTo({ top: y });
  },
};

/* ───────────── UI ───────────── */
const navUpdate = initNav();
initAnchors(scroller);
initBooker();
initMisc();
initVisuals(reduced);

/* ───────────── hero distribution field ───────────── */
const hero = document.querySelector<HTMLElement>('.hero')!;
const field = new DistributionField(document.getElementById('field') as HTMLCanvasElement, { reduced });
field.start();
if (reduced) document.fonts?.ready.then(() => field.redraw()); // the still frame's readout uses Geist

/* pause / play for everything that loops on its own (WCAG 2.2.2) */
const pauseBtn = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
if (pauseBtn) {
  if (reduced) pauseBtn.hidden = true;
  pauseBtn.addEventListener('click', () => {
    const paused = pauseBtn.getAttribute('aria-pressed') !== 'true';
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.querySelector('span')!.textContent = paused ? 'Play animation' : 'Pause animation';
    field.setPaused(paused);
    document.documentElement.classList.toggle('motion-paused', paused);
    const flow = document.getElementById('flow') as SVGSVGElement | null;
    if (flow) (paused ? flow.pauseAnimations() : flow.unpauseAnimations());
  });
}
if (import.meta.env.DEV) {
  // devtools handles: step the field frame by frame, jump the page without smoothing
  Object.assign(window, { __field: field, __lenis: lenis });
}

const onScroll = () => {
  const y = window.scrollY;
  navUpdate(y);
  field.setScroll(y / Math.max(1, hero.offsetHeight));
};
if (lenis) lenis.on('scroll', onScroll);
else window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// fonts change line lengths, so let ScrollTrigger re-measure once they arrive
document.fonts?.ready.then(() => ScrollTrigger.refresh());

if (location.hash.length > 1) {
  const el = document.getElementById(location.hash.slice(1));
  if (el) requestAnimationFrame(() => scroller.scrollTo(el, { offset: -76, immediate: true }));
}
