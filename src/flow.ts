/**
 * "Who we are" diagram: content you already record → many short clips → a large number of
 * accounts on Instagram, Facebook, YouTube and TikTok. Left-to-right on wide screens,
 * top-to-bottom on phones, so it stays legible at every size.
 */

const SVG = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

type Pt = { x: number; y: number };
const PLATFORMS = ['Instagram', 'Facebook', 'YouTube', 'TikTok'];
const CW = 26;
const CH = 46;

function recording(g: SVGGElement, x: number, y: number, w: number, h: number) {
  g.appendChild(el('rect', { x, y, width: w, height: h, rx: 14, fill: '#18181b', stroke: 'rgba(255,255,255,0.16)' }));
  g.appendChild(el('path', { d: `M${x + w / 2 - 10} ${y + h * 0.3} l26 16 -26 16z`, fill: '#ff8a3d' }));
  g.appendChild(el('rect', { x: x + 20, y: y + h - 20, width: w - 40, height: 3, rx: 1.5, fill: 'rgba(255,255,255,0.12)' }));
  g.appendChild(el('rect', { x: x + 20, y: y + h - 20, width: (w - 40) * 0.62, height: 3, rx: 1.5, fill: 'rgba(255,138,61,0.8)' }));
  for (let i = 1; i < 7; i++) {
    g.appendChild(el('rect', { x: x + 20 + ((w - 40) / 7) * i, y: y + h - 26, width: 1, height: 15, fill: 'rgba(255,255,255,0.3)' }));
  }
}

function clip(g: SVGGElement, x: number, y: number) {
  g.appendChild(el('rect', { x, y, width: CW, height: CH, rx: 5, fill: '#18181b', stroke: 'rgba(255,255,255,0.18)' }));
  g.appendChild(el('path', { d: `M${x + 10} ${y + 17} l8 6 -8 6z`, fill: 'rgba(255,255,255,0.45)' }));
}

function label(g: SVGGElement, text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end', size = 13) {
  const t = el('text', { x, y, 'text-anchor': anchor, fill: '#808087', 'font-size': size, 'font-family': 'Geist Variable, sans-serif' });
  t.textContent = text;
  g.appendChild(t);
}

function build(svg: SVGSVGElement, vertical: boolean) {
  svg.innerHTML = '';
  const g = el('g', {});
  const lines = el('g', { fill: 'none', 'stroke-linecap': 'round' });
  g.appendChild(lines);
  svg.appendChild(g);
  const clips: Pt[] = [];
  const accounts: Pt[] = [];
  let from: Pt;

  if (!vertical) {
    svg.setAttribute('viewBox', '0 0 1200 380');
    recording(g, 20, 140, 250, 100);
    from = { x: 270, y: 190 };
    for (let col = 0; col < 2; col++) {
      for (let i = 0; i < 6; i++) {
        const x = 520 + col * 52 + (i % 2 ? 6 : 0);
        const y = 30 + i * 56 + col * 26;
        clips.push({ x: x + CW / 2, y: y + CH / 2 });
        clip(g, x, y);
      }
    }
    PLATFORMS.forEach((name, pi) => {
      const top = 22 + pi * 88;
      label(g, name, 1180, top + 12, 'end');
      for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) accounts.push({ x: 900 + c * 26 + (r ? 13 : 0), y: top + 32 + r * 22 });
    });
  } else {
    svg.setAttribute('viewBox', '0 0 400 820');
    label(g, 'Content you already record', 200, 18, 'middle', 14);
    recording(g, 75, 34, 250, 96);
    from = { x: 200, y: 130 };
    label(g, 'Many short clips', 200, 262, 'middle', 14);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        const x = 44 + i * 56 + (row ? 14 : 0);
        const y = 282 + row * 60;
        clips.push({ x: x + CW / 2, y: y + CH / 2 });
        clip(g, x, y);
      }
    }
    label(g, 'A large number of accounts', 200, 520, 'middle', 14);
    PLATFORMS.forEach((name, pi) => {
      const top = 548 + pi * 66;
      label(g, name, 24, top + 24, 'start', 13);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) accounts.push({ x: 158 + c * 28 + (r ? 14 : 0), y: top + 10 + r * 22 });
    });
  }

  accounts.forEach((a) => g.appendChild(el('circle', { cx: a.x, cy: a.y, r: 6, fill: '#18181b', stroke: 'rgba(143,176,216,0.55)' })));

  const paths: SVGPathElement[] = [];
  clips.forEach((c) => {
    const d = vertical
      ? `M${from.x} ${from.y} C${from.x} ${from.y + 70}, ${c.x} ${c.y - 90}, ${c.x} ${c.y - CH / 2}`
      : `M${from.x} ${from.y} C${from.x + 120} ${from.y}, ${c.x - 140} ${c.y}, ${c.x - CW / 2} ${c.y}`;
    const p = el('path', { d, stroke: 'rgba(255,138,61,0.38)', 'stroke-width': 1 });
    lines.appendChild(p);
    paths.push(p);
  });
  accounts.forEach((a, i) => {
    const c = clips[i % clips.length];
    const d = vertical
      ? `M${c.x} ${c.y + CH / 2} C${c.x} ${c.y + 120}, ${a.x} ${a.y - 120}, ${a.x} ${a.y - 6}`
      : `M${c.x + CW / 2} ${c.y} C${c.x + 160} ${c.y}, ${a.x - 160} ${a.y}, ${a.x - 6} ${a.y}`;
    const p = el('path', { d, stroke: 'rgba(143,176,216,0.15)', 'stroke-width': 1 });
    lines.appendChild(p);
    paths.push(p);
  });
  return { g, paths, clipCount: clips.length };
}

export function initFlow(reduced: boolean) {
  const svg = document.getElementById('flow') as SVGSVGElement | null;
  if (!svg) return;
  const fig = svg.closest('figure')!;
  let vertical = fig.clientWidth < 620;
  let shown = false;
  let parts = build(svg, vertical);

  const hideLines = () => {
    if (reduced || shown) return;
    parts.paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.transition = `stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1) ${i < parts.clipCount ? i * 40 : 500 + (i - parts.clipCount) * 12}ms`;
    });
  };
  const travellers = () => {
    if (reduced) return;
    const n = parts.clipCount;
    [0, 3, 7, 10, n + 4, n + 17, n + 30, n + 45, n + 58].forEach((idx, i) => {
      const path = parts.paths[idx];
      if (!path) return;
      const id = `fp${idx}`;
      path.id = id;
      const dot = el('circle', { r: 2.2, fill: idx < n ? '#ff8a3d' : '#8fb0d8' });
      const anim = el('animateMotion', { dur: `${2.6 + (i % 3) * 0.6}s`, repeatCount: 'indefinite', begin: `${i * 0.45}s` });
      const mp = el('mpath', { href: `#${id}` });
      anim.appendChild(mp);
      dot.appendChild(anim);
      parts.g.appendChild(dot);
    });
  };
  hideLines();

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      shown = true;
      parts.paths.forEach((p) => (p.style.strokeDashoffset = '0'));
      window.setTimeout(travellers, reduced ? 0 : 1600);
    },
    { threshold: 0.3 },
  );
  io.observe(svg);

  // swap orientation when the layout crosses the phone breakpoint
  new ResizeObserver(() => {
    const v = fig.clientWidth < 620;
    if (v === vertical) return;
    vertical = v;
    parts = build(svg, vertical);
    if (shown) travellers();
    else hideLines();
  }).observe(fig);
}
