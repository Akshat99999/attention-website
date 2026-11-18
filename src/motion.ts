import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const nf = new Intl.NumberFormat('en-US');

/** The one orchestrated moment: the headline rises line by line, then the rest settles in. */
export function heroEntrance(reduced: boolean) {
  const lines = gsap.utils.toArray<HTMLElement>('.hero__title .ln > span');
  const rest = gsap.utils.toArray<HTMLElement>('[data-hero]');
  if (reduced) {
    gsap.set(lines, { yPercent: 0, y: 0 });
    gsap.set(rest, { opacity: 1 });
    return;
  }
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.fromTo(lines, { yPercent: 105, y: 0 }, { yPercent: 0, duration: 1.3, stagger: 0.1 }, 0.25).fromTo(
    rest,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 },
    0.85,
  );
}

function reveals() {
  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
  gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((list) => {
    gsap.to(list.children, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: list, start: 'top 85%', once: true },
    });
  });
}

/** Proof numbers count up once, ending on exactly the figure in the copy. */
function counters() {
  gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix ?? '';
    // the real figure stays in the DOM until the count starts (find-in-page, print, reader mode)
    const final = el.textContent!;
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          v: target,
          duration: 1.8,
          ease: 'power3.out',
          onUpdate: () => (el.textContent = `${nf.format(Math.round(obj.v))}${suffix}`),
          onComplete: () => (el.textContent = final),
        }),
    });
  });
}

export function scrollMotion(reduced: boolean) {
  if (reduced) {
    gsap.set('[data-reveal], [data-stagger] > *', { opacity: 1, y: 0 });
    return;
  }
  reveals();
  counters();
}

export { gsap, ScrollTrigger };
