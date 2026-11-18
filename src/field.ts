/**
 * The distribution field — the hero's signature visual.
 *
 * Rows of phone screens stand on a floor plane and recede to a horizon. The camera dollies
 * slowly forward (rows recycle into the fog, so it loops seamlessly). Every few seconds a wave
 * of attention ripples out from the source point, lighting screens in order of distance; between
 * waves, single signals arc out to individual phones and a few near phones show a readout.
 *
 * Canvas 2D with a hand-rolled perspective projection: ~200 phones, no DOM per phone.
 * Readout values are illustrative, not client data.
 */

type Kind = 'views' | 'likes' | 'shares' | 'follow';

interface Phone {
  col: number;
  row: number;
  x: number; // world X
  z0: number; // base depth inside the loop
  tone: number; // which screen tint
  lit: number; // 0…1 glow
  litKind: 'orange' | 'blue';
  progress: number; // little video progress bar
  // last projection
  sx: number;
  sy: number; // top of phone
  sh: number; // height in px
  sw: number;
  a: number; // alpha
  z: number;
}

interface Signal {
  to: Phone;
  born: number;
  life: number;
  lift: number;
  landed: boolean;
}

interface Chip {
  phone: Phone;
  kind: Kind;
  value: number;
  rate: number;
  born: number;
  life: number;
}

export interface FieldOptions {
  reduced: boolean;
}

const ORANGE = '255,138,61';
const BLUE = '143,176,216';
const TONES = 6;
const PHONE_RATIO = 0.47; // width / height, a modern 9:19 phone

/**
 * Pre-rendered "footage" for the screens: soft out-of-focus light, like a frame of video seen
 * from across a room. Drawn once, then scaled onto every phone with drawImage.
 */
function screenSprites(): HTMLCanvasElement[] {
  const palettes: [string, string, string][] = [
    ['#2a3550', '#8fb0d8', '#141821'],
    ['#3a2618', '#ff8a3d', '#18120e'],
    ['#22302c', '#9cc7b4', '#111715'],
    ['#2d2638', '#b9a4d8', '#15121b'],
    ['#33302a', '#e8d7b8', '#16140f'],
    ['#1f2a36', '#ffb27a', '#10141a'],
  ];
  return palettes.slice(0, TONES).map(([base, light, deep], i) => {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 204;
    const g = c.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, base);
    bg.addColorStop(1, deep);
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    // two soft light sources at different places per sprite
    const spots = [
      [0.3 + (i % 3) * 0.2, 0.32 + (i % 2) * 0.12, 70, 0.55],
      [0.75 - (i % 2) * 0.4, 0.68, 58, 0.3],
    ];
    for (const [x, y, r, a] of spots) {
      const rg = g.createRadialGradient(c.width * x, c.height * y, 0, c.width * x, c.height * y, r);
      rg.addColorStop(0, light);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = a;
      g.fillStyle = rg;
      g.fillRect(0, 0, c.width, c.height);
    }
    g.globalAlpha = 1;
    // a darker band where captions would sit, and a vignette
    const vg = g.createLinearGradient(0, c.height * 0.62, 0, c.height);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, c.width, c.height);
    // bake the rounded screen corners in, so each phone is one drawImage with no clipping
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000'; // fully opaque mask: keep everything inside the rounded rect
    g.beginPath();
    g.roundRect(0, 0, c.width, c.height, 14);
    g.fill();
    return c;
  });
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const nf = new Intl.NumberFormat('en-US');
function label(kind: Kind, v: number) {
  const n = v >= 10000 ? `${(Math.floor(v / 100) / 10).toFixed(1).replace(/\.0$/, '')}K` : nf.format(Math.round(v));
  if (kind === 'views') return `${n} views`;
  if (kind === 'likes') return `${n} likes`;
  if (kind === 'shares') return `${n} shares`;
  return 'New follower';
}

function icon(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'views') {
    ctx.moveTo(2.5, 1.5);
    ctx.lineTo(10, 6);
    ctx.lineTo(2.5, 10.5);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'likes') {
    ctx.moveTo(6, 10.5);
    ctx.bezierCurveTo(-1.5, 5.5, 2, 0.5, 6, 3.6);
    ctx.bezierCurveTo(10, 0.5, 13.5, 5.5, 6, 10.5);
    ctx.fill();
  } else if (kind === 'shares') {
    ctx.moveTo(1.5, 10);
    ctx.quadraticCurveTo(2.5, 4.5, 9.5, 4.5);
    ctx.moveTo(7, 1.8);
    ctx.lineTo(10, 4.5);
    ctx.lineTo(7, 7.2);
    ctx.stroke();
  } else {
    ctx.arc(5, 4, 2.2, 0, Math.PI * 2);
    ctx.moveTo(1, 11);
    ctx.quadraticCurveTo(5, 5.5, 9, 11);
    ctx.moveTo(10.5, 3);
    ctx.lineTo(10.5, 7);
    ctx.moveTo(8.5, 5);
    ctx.lineTo(12.5, 5);
    ctx.stroke();
  }
  ctx.restore();
}

export class DistributionField {
  private ctx: CanvasRenderingContext2D;
  private phones: Phone[] = [];
  private signals: Signal[] = [];
  private chips: Chip[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private compact = false;
  private t = 0;
  private travel = 0; // camera distance travelled
  private scroll = 0; // 0…1 through the hero
  private scrollEased = 0;
  private nextSignal = 1.2;
  private nextWave = 2.2;
  private waveAt = -99;
  private raf = 0;
  private last = 0;
  private inView = true;
  private rand = mulberry(11);
  private screens = screenSprites();

  // world layout
  private cols = 15;
  private rows = 14;
  private sx = 1.25; // column spacing
  private sz = 1.55; // row spacing
  private zNear = 1.7;
  private loopLen = 0;
  private builtW = 0;
  private builtDpr = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: FieldOptions,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.build();
    // the canvas fills the hero, which can change height without the window resizing (fonts, reflow)
    new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => this.resize());
    }).observe(canvas);
    new IntersectionObserver(([e]) => (this.inView = e.isIntersecting), { rootMargin: '80px' }).observe(canvas);
  }
  private resizeRaf = 0;
  private paused = false;

  /** Visitor-controlled pause (WCAG 2.2.2). */
  setPaused(p: boolean) {
    this.paused = p;
  }

  /** One extra frame, e.g. once web fonts arrive for the still (reduced-motion) frame. */
  redraw() {
    this.frame(0);
  }

  private measure() {
    const r = this.canvas.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), dpr: Math.min(window.devicePixelRatio || 1, this.compactFor(r.width) ? 1.5 : 1.75) };
  }
  private compactFor(w: number) {
    return w < 760;
  }

  /** Height-only changes (mobile toolbars) keep every phone in place. */
  private resize() {
    const m = this.measure();
    if (m.w === this.builtW && m.dpr === this.builtDpr) {
      this.h = m.h;
      this.canvas.height = Math.round(m.h * this.dpr);
      this.frame(0);
      return;
    }
    this.build();
  }

  private build() {
    const m = this.measure();
    this.w = m.w;
    this.h = m.h;
    this.dpr = m.dpr;
    this.builtW = m.w;
    this.builtDpr = m.dpr;
    this.compact = this.compactFor(m.w);
    this.canvas.width = Math.round(m.w * m.dpr);
    this.canvas.height = Math.round(m.h * m.dpr);
    this.cols = this.compact ? 11 : 15;
    this.rows = this.compact ? 12 : 14;
    this.loopLen = this.rows * this.sz;
    this.rand = mulberry(11);
    this.phones = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = (c - (this.cols - 1) / 2) * this.sx + (r % 2 ? this.sx / 2 : 0) + (this.rand() - 0.5) * 0.25;
        this.phones.push({
          col: c,
          row: r,
          x,
          z0: r * this.sz + (this.rand() - 0.5) * 0.3,
          tone: Math.floor(this.rand() * TONES),
          lit: 0,
          litKind: 'blue',
          progress: this.rand(),
          sx: 0,
          sy: 0,
          sh: 0,
          sw: 0,
          a: 0,
          z: 0,
        });
      }
    }
    this.signals = [];
    this.chips = [];
    if (this.opts.reduced) {
      this.project();
      this.seedStill();
    }
    this.frame(0);
  }

  setScroll(progress: number) {
    this.scroll = Math.min(1, Math.max(0, progress));
  }

  start() {
    if (this.opts.reduced) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (document.hidden || !this.inView || this.paused) {
        this.last = now;
        return;
      }
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /* ───────── camera + projection ───────── */

  private cam() {
    const t = this.t;
    const s = this.scrollEased;
    return {
      // vanishing point sits right of centre on wide screens, leaving the copy side calm
      vpX: this.compact ? this.w * 0.5 : this.w * 0.66,
      horizon: (this.compact ? this.h * 0.6 : this.h * 0.33) - s * this.h * 0.12,
      unit: this.compact ? this.h * 0.3 : this.h * 0.74,
      camX: Math.sin(t * 0.045) * 0.7,
      camH: 1.9 + Math.sin(t * 0.06) * 0.08 + s * 0.9,
    };
  }

  private project() {
    const c = this.cam();
    const span = this.loopLen;
    for (const p of this.phones) {
      let z = (p.z0 - this.travel) % span;
      if (z < 0) z += span;
      z += this.zNear;
      p.z = z;
      const k = c.unit / z;
      const base = c.horizon + c.camH * k;
      p.sh = 1.0 * k;
      p.sw = PHONE_RATIO * k;
      p.sx = c.vpX + (p.x - c.camX) * k;
      p.sy = base - p.sh;
      // fog in the distance, fade out as they pass the camera
      const far = 1 - smooth(this.zNear + span * 0.55, this.zNear + span * 0.97, z);
      const near = smooth(this.zNear, this.zNear + 0.6, z);
      // keep the headline side quiet on wide screens
      const side = this.compact ? 1 : 0.08 + 0.92 * smooth(this.w * 0.42, this.w * 0.64, p.sx);
      p.a = far * near * side;
    }
  }

  /* ───────── events ───────── */

  private source() {
    const c = this.cam();
    return { x: c.vpX - c.camX * 2, y: c.horizon };
  }

  private visibleNear(minH: number) {
    return this.phones.filter((p) => p.a > 0.55 && p.sh > minH && p.sx > (this.compact ? 30 : this.w * 0.5) && p.sx < this.w - 40 && p.sy > 90 && p.sy + p.sh < this.h - 20);
  }

  private fireSignal(now: number) {
    const life = 1.6 + this.rand() * 0.6;
    // only targets that will still be in view when the signal arrives (the camera keeps moving)
    const minZ = this.zNear + 0.6 + 0.38 * (life + 0.6);
    const pool = this.phones.filter((p) => p.a > 0.35 && p.sh > 26 && p.z > minZ);
    if (!pool.length) return;
    const to = pool[Math.floor(this.rand() * pool.length)];
    this.signals.push({ to, born: now, life, lift: 0.25 + this.rand() * 0.25, landed: false });
  }

  private land(p: Phone, now: number) {
    p.lit = 1;
    p.litKind = this.rand() > 0.72 ? 'orange' : 'blue';
    if (this.chips.length >= (this.compact ? 2 : 3)) return;
    if (p.sh < (this.compact ? 60 : 78) || p.a < 0.6) return;
    if (p.sx < (this.compact ? 30 : this.w * 0.5) || p.sy < 110) return;
    if (this.chips.some((c) => Math.hypot(c.phone.sx - p.sx, c.phone.sy - p.sy) < 160)) return;
    const r = this.rand();
    const kind: Kind = r < 0.45 ? 'views' : r < 0.7 ? 'likes' : r < 0.87 ? 'shares' : 'follow';
    const starts = { views: [1200, 8400, 12500, 3400], likes: [340, 86, 1100], shares: [128, 42], follow: [0] }[kind];
    this.chips.push({
      phone: p,
      kind,
      value: starts[Math.floor(this.rand() * starts.length)],
      rate: kind === 'views' ? 40 + this.rand() * 80 : kind === 'likes' ? 2 + this.rand() * 5 : kind === 'shares' ? 0.6 : 0,
      born: now,
      life: 3.6,
    });
  }

  private seedStill() {
    const pool = this.visibleNear(this.compact ? 60 : 80).sort((a, b) => b.sh - a.sh);
    pool.slice(0, 5).forEach((p, i) => {
      p.lit = 0.9;
      p.litKind = i === 0 ? 'orange' : 'blue';
    });
    if (pool[0]) this.chips.push({ phone: pool[0], kind: 'views', value: 12500, rate: 0, born: 0, life: Infinity });
  }

  /* ───────── frame ───────── */

  private frame(dt: number) {
    const ctx = this.ctx;
    this.t += dt;
    const now = this.t;
    this.scrollEased += (this.scroll - this.scrollEased) * Math.min(1, dt * 4 || 1);
    this.travel += dt * 0.38; // steady dolly — constant speed reads as calm, not busy
    this.project();

    if (!this.opts.reduced) {
      this.nextSignal -= dt;
      if (this.nextSignal <= 0) {
        this.fireSignal(now);
        this.nextSignal = 0.7 + this.rand() * 0.5;
      }
      this.nextWave -= dt;
      if (this.nextWave <= 0) {
        this.waveAt = now;
        this.nextWave = 7;
      }
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const c = this.cam();
    const src = this.source();

    // ── light: a warm glow where content enters, fading into a cool haze along the horizon
    const g1 = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, this.w * 0.5);
    g1.addColorStop(0, `rgba(${ORANGE},0.13)`);
    g1.addColorStop(0.35, `rgba(${ORANGE},0.035)`);
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, this.w, this.h);
    const g2 = ctx.createLinearGradient(0, c.horizon - this.h * 0.3, 0, c.horizon);
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(1, `rgba(${BLUE},0.05)`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, this.w, c.horizon);
    // horizon line: brightest at the source, fading out to both sides
    const hl = ctx.createLinearGradient(src.x - this.w * 0.45, 0, src.x + this.w * 0.45, 0);
    hl.addColorStop(0, 'rgba(0,0,0,0)');
    hl.addColorStop(0.5, `rgba(${ORANGE},0.55)`);
    hl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(src.x - this.w * 0.45, c.horizon, this.w * 0.9, 1);

    // ── the floor: rows and lanes converging on the horizon, for depth
    ctx.lineWidth = 1;
    const lanes = this.compact ? 9 : 13;
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    for (let i = -lanes; i <= lanes; i++) {
      const X = i * this.sx * 1.4 - c.camX;
      const zA = this.zNear;
      const zB = this.zNear + this.loopLen * 0.7;
      ctx.moveTo(c.vpX + (X * c.unit) / zA, c.horizon + (c.camH * c.unit) / zA);
      ctx.lineTo(c.vpX + (X * c.unit) / zB, c.horizon + (c.camH * c.unit) / zB);
    }
    ctx.stroke();
    for (let r = 0; r < this.rows; r++) {
      let z = (r * this.sz + this.sz * 0.5 - this.travel) % this.loopLen;
      if (z < 0) z += this.loopLen;
      z += this.zNear;
      const y = c.horizon + (c.camH * c.unit) / z;
      const a = 0.045 * (1 - smooth(this.zNear + this.loopLen * 0.4, this.zNear + this.loopLen, z)) * smooth(this.zNear, this.zNear + 1, z);
      if (a < 0.003) continue;
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.moveTo(this.compact ? 0 : this.w * 0.3, y);
      ctx.lineTo(this.w, y);
      ctx.stroke();
    }

    // ── the wave: phones light in order of distance from the source
    const waveAge = now - this.waveAt;
    const waveFront = waveAge * 7.5; // world units per second
    if (waveAge < 4) {
      for (const p of this.phones) {
        const d = Math.hypot(p.x - c.camX * 0.3, p.z - this.zNear);
        if (Math.abs(d - waveFront) < 0.25 && p.lit < 0.6) {
          p.lit = 0.75;
          p.litKind = 'orange';
        }
      }
    }

    // ── phones, far to near (in-place sort: the order is almost unchanged frame to frame)
    this.phones.sort((a, b) => b.z - a.z);
    for (const p of this.phones) {
      if (p.a < 0.01 || p.sy > this.h || p.sx + p.sw < 0 || p.sx - p.sw > this.w) continue;
      const x = p.sx - p.sw / 2;
      const y = p.sy;
      const w = p.sw;
      const h = p.sh;
      const r = Math.max(1.5, w * 0.2);
      ctx.globalAlpha = p.a;
      // body
      rr(ctx, x, y, w, h, r);
      ctx.fillStyle = '#0e0e10';
      ctx.fill();
      ctx.lineWidth = h > 90 ? 1.2 : 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.08 * smooth(40, 160, h)})`;
      ctx.stroke();
      // screen: the footage dims with distance, brightens when the screen lights up
      const pad = Math.max(1, w * 0.055);
      const sx0 = x + pad;
      const sy0 = y + pad;
      const sw0 = w - pad * 2;
      const sh0 = h - pad * 2;
      ctx.globalAlpha = p.a * (0.35 + 0.3 * smooth(30, 140, h) + 0.35 * p.lit);
      ctx.drawImage(this.screens[p.tone], sx0, sy0, sw0, sh0);
      ctx.globalAlpha = p.a;
      rr(ctx, sx0, sy0, sw0, sh0, Math.max(1, r - pad));
      if (p.lit > 0.01) {
        const col = p.litKind === 'orange' ? ORANGE : BLUE;
        ctx.fillStyle = `rgba(${col},${0.22 * p.lit})`;
        ctx.fill();
        // soft spill onto the floor beneath the phone
        if (h > 50) {
          const gl = ctx.createRadialGradient(p.sx, y + h, 0, p.sx, y + h, w * 1.1);
          gl.addColorStop(0, `rgba(${col},${0.16 * p.lit * p.a})`);
          gl.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(p.sx - w * 1.2, y + h - w * 0.4, w * 2.4, w * 0.8);
        }
        if (!this.opts.reduced) p.lit = Math.max(0, p.lit - dt * 0.45);
      }
      // detail on nearer phones: play glyph and a progress bar
      if (h > 46) {
        const d = smooth(46, 120, h);
        const cx = p.sx;
        const cy = y + h * 0.46;
        const s = w * 0.13;
        ctx.globalAlpha = p.a * (0.35 + 0.4 * p.lit) * d;
        ctx.fillStyle = '#f2f1ee';
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.6, cy - s);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx - s * 0.6, cy + s);
        ctx.closePath();
        ctx.fill();
        const bx = x + pad * 2;
        const bw = w - pad * 4;
        const by = y + h - pad * 2.6;
        ctx.globalAlpha = p.a * 0.25 * d;
        ctx.fillRect(bx, by, bw, Math.max(1, h * 0.012));
        ctx.globalAlpha = p.a * 0.7 * d;
        ctx.fillStyle = p.lit > 0.2 ? `rgb(${p.litKind === 'orange' ? ORANGE : BLUE})` : '#a2a2a7';
        ctx.fillRect(bx, by, bw * p.progress, Math.max(1, h * 0.012));
        if (!this.opts.reduced) p.progress = (p.progress + dt * 0.04) % 1;
      }
    }
    ctx.globalAlpha = 1;

    // ── signals arcing from the source out to individual screens
    this.signals = this.signals.filter((s) => now - s.born < s.life + 0.5);
    ctx.lineCap = 'round';
    for (const s of this.signals) {
      const age = now - s.born;
      const k = easeInOut(Math.min(1, age / s.life));
      const fade = 1 - smooth(s.life, s.life + 0.5, age);
      const tx = s.to.sx;
      const ty = s.to.sy + s.to.sh * 0.3;
      const mx = (src.x + tx) / 2;
      const my = Math.min(src.y, ty) - Math.abs(tx - src.x) * s.lift - 30;
      const pt = (u: number) => ({
        x: (1 - u) * (1 - u) * src.x + 2 * (1 - u) * u * mx + u * u * tx,
        y: (1 - u) * (1 - u) * src.y + 2 * (1 - u) * u * my + u * u * ty,
      });
      // trail: the last stretch behind the head, fading to nothing
      const steps = 22;
      for (let i = 0; i < steps; i++) {
        const u0 = Math.max(0, k - 0.32 + (i / steps) * 0.32);
        const u1 = Math.max(0, k - 0.32 + ((i + 1) / steps) * 0.32);
        if (u1 <= 0) continue;
        const a = pt(u0);
        const b = pt(u1);
        ctx.globalAlpha = (i / steps) * 0.5 * fade * Math.min(1, s.to.a + 0.3);
        ctx.strokeStyle = `rgb(${BLUE})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      if (k < 1) {
        const hd = pt(k);
        ctx.globalAlpha = fade * Math.min(1, s.to.a + 0.3);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hd.x, hd.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (!s.landed) {
        s.landed = true;
        this.land(s.to, now);
      }
    }

    // ── the source: where your content enters the field, sitting on the horizon
    const pulse = this.opts.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now * 2.2);
    ctx.globalAlpha = 1;
    const gs = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, 18);
    gs.addColorStop(0, `rgba(${ORANGE},${0.4 + 0.2 * pulse})`);
    gs.addColorStop(1, `rgba(${ORANGE},0)`);
    ctx.fillStyle = gs;
    ctx.fillRect(src.x - 18, src.y - 18, 36, 36);
    ctx.fillStyle = '#ffd2b0';
    ctx.beginPath();
    ctx.arc(src.x, src.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // as a wave leaves the source, the horizon flares briefly
    if (waveAge < 1.6) {
      const k = 1 - waveAge / 1.6;
      const fl = ctx.createLinearGradient(src.x - this.w * 0.3, 0, src.x + this.w * 0.3, 0);
      fl.addColorStop(0, 'rgba(0,0,0,0)');
      fl.addColorStop(0.5, `rgba(${ORANGE},${0.5 * k})`);
      fl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fl;
      ctx.fillRect(src.x - this.w * 0.3, c.horizon - 1, this.w * 0.6, 3);
    }

    // ── readouts on a few near phones
    // a readout fades with its phone rather than vanishing when the phone wraps or fades
    this.chips = this.chips.filter((ch) => now - ch.born < ch.life && ch.phone.a > 0.02);
    ctx.font = `500 ${this.compact ? 11 : 12}px "Geist Variable", ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (const ch of this.chips) {
      const age = now - ch.born;
      if (ch.rate && !this.opts.reduced) ch.value += ch.rate * dt;
      const a =
        (this.opts.reduced ? 1 : smooth(0, 0.4, age) * (1 - smooth(ch.life - 0.6, ch.life, age))) *
        smooth(0.2, 0.55, ch.phone.a) *
        smooth(40, 90, ch.phone.sy);
      if (a < 0.01) continue;
      const text = label(ch.kind, ch.value);
      const tw = ctx.measureText(text).width + 34;
      const hgt = 28;
      const p = ch.phone;
      const rise = this.opts.reduced ? 0 : 8 * easeOut(age / 0.7);
      let x = p.sx - tw / 2;
      x = Math.max(12, Math.min(this.w - tw - 12, x));
      const y = p.sy - hgt - 12 - rise;
      ctx.globalAlpha = a;
      rr(ctx, x, y, tw, hgt, 9);
      ctx.fillStyle = 'rgba(20,20,23,0.94)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
      icon(ctx, ch.kind, x + 11, y + hgt / 2 - 6, ch.kind === 'likes' || ch.kind === 'follow' ? `rgb(${ORANGE})` : `rgb(${BLUE})`);
      ctx.fillStyle = '#f2f1ee';
      ctx.fillText(text, x + 28, y + hgt / 2 + 0.5);
    }
    ctx.globalAlpha = 1;
  }
}
