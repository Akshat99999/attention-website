import { initFlow } from './flow';

/**
 * Section visuals. Each one draws a fact from the copy — nothing decorative, nothing invented:
 *  - flow:     content you already record → many short clips → a large number of accounts on 4 platforms
 *  - reach:    reach on one platform, none anywhere else
 *  - matrix:   3,000+ short videos a month (one dot each)
 *  - accounts: the 15 accounts behind the first-month case
 *  - clock:    6 months, plus up to 3 more free
 */

function onceVisible(node: Element, fn: () => void, threshold = 0.35) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { threshold },
  );
  io.observe(node);
}

/* ───────── reach by platform ───────── */
function reach() {
  const fig = document.querySelector<HTMLElement>('.reach');
  if (!fig) return;
  onceVisible(fig, () => fig.querySelector<HTMLElement>('li.is-on')?.style.setProperty('--fill', '92%'));
}

/* ───────── 3,000 videos, one dot each ───────── */
function matrix(reduced: boolean) {
  const canvas = document.getElementById('matrix') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const COLS = 75;
  const ROWS = 40; // 3,000 dots
  let shown = reduced ? COLS * ROWS : 0;
  let w = 0;
  let h = 0;
  let dpr = 1;

  const size = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw();
  };
  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / COLS;
    const cy = h / ROWS;
    const rad = Math.max(0.9, Math.min(cx, cy) * 0.32);
    const head = Math.floor(shown);
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      const on = i < head;
      const fresh = on && head - i < COLS * 1.5 && head < COLS * ROWS;
      ctx.fillStyle = fresh ? '#ff8a3d' : on ? 'rgba(242,241,238,0.62)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.arc(cx * (c + 0.5), cy * (r + 0.5), rad, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  size();
  new ResizeObserver(size).observe(canvas);
  if (reduced) return;
  onceVisible(canvas, () => {
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 2600);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      shown = eased * COLS * ROWS;
      draw();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ───────── the 15 accounts ───────── */
function accounts(reduced: boolean) {
  const box = document.getElementById('accounts');
  if (!box) return;
  for (let i = 0; i < 15; i++) {
    const s = document.createElement('span');
    s.style.transitionDelay = reduced ? '0s' : `${i * 70}ms`;
    box.appendChild(s);
  }
  onceVisible(box, () => box.classList.add('is-on'));
}

/* ───────── the guarantee clock ───────── */
function clock() {
  const c = document.querySelector<HTMLElement>('.clock');
  if (!c) return;
  onceVisible(c, () => c.querySelectorAll<HTMLElement>('.clock__track i').forEach((i) => i.style.setProperty('--p', '1')));
}

/* ───────── the process signal: travel the full width of the track ───────── */
function track() {
  const t = document.querySelector<HTMLElement>('.track');
  if (!t) return;
  const set = () => t.style.setProperty('--track-w', `${t.getBoundingClientRect().width}px`);
  set();
  new ResizeObserver(set).observe(t);
}

export function initVisuals(reduced: boolean) {
  initFlow(reduced);
  reach();
  matrix(reduced);
  accounts(reduced);
  clock();
  track();
}
