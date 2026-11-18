import { CONFIG } from './config';

export interface Scroller {
  scrollTo(target: HTMLElement | number, opts?: { offset?: number; immediate?: boolean }): void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ───────────── in-page links ───────────── */
export function initAnchors(scroller: Scroller) {
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href')!.slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scroller.scrollTo(id === 'top' ? 0 : el, { offset: id === 'top' ? 0 : -76 });
    history.replaceState(null, '', `#${id}`);
    // keyboard and screen-reader users land where they asked to go
    const target = el.querySelector<HTMLElement>('h1, h2') ?? el;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}

/* ───────────── nav ───────────── */
export function initNav() {
  const nav = document.getElementById('nav')!;
  return (y: number) => nav.classList.toggle('is-solid', y > 24);
}

/* ───────────── radio chips (roving tabindex, arrow keys) ───────────── */
function initChips(group: HTMLElement, onPick: (value: string) => void) {
  const items = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const select = (b: HTMLButtonElement, focus = false) => {
    items.forEach((i) => {
      const on = i === b;
      i.setAttribute('aria-checked', String(on));
      i.tabIndex = on ? 0 : -1;
    });
    if (focus) b.focus();
    onPick(b.dataset.value ?? b.textContent!.trim());
  };
  items.forEach((b, i) => {
    b.tabIndex = i === 0 ? 0 : -1;
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      select(items[(i + dir + items.length) % items.length], true);
    });
  });
}

/* ───────────── posting ───────────── */
class NotConnectedError extends Error {}
async function post(endpoint: string, payload: Record<string, string>) {
  if (!endpoint) {
    // Development: pretend it sent so the flow can be reviewed. Production: never fake success.
    if (import.meta.env.DEV) {
      await new Promise((r) => setTimeout(r, 600));
      return;
    }
    throw new NotConnectedError();
  }
  // A "simple" request (no custom headers) so webhook services like Make or Zapier
  // receive it without needing to answer a CORS preflight. The body is JSON text.
  const res = await fetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/* ───────────── book a strategy call: 4 questions, then a time ───────────── */
const TIMES = ['09:00', '09:30', '10:30', '11:00', '13:00', '14:00', '15:30', '16:30'];

export function initBooker() {
  const form = document.getElementById('booker') as HTMLFormElement;
  const done = document.getElementById('booker-done')!;
  const stepLabel = document.getElementById('booker-step')!;
  const stage1 = form.querySelector<HTMLFieldSetElement>('[data-stage="1"]')!;
  const stage2 = form.querySelector<HTMLFieldSetElement>('[data-stage="2"]')!;
  const status = document.getElementById('booker-status')!;
  const daysEl = document.getElementById('days')!;
  const timesEl = document.getElementById('times')!;
  const bottleneck = form.querySelector<HTMLInputElement>('#q-bottleneck')!;
  const answers: Record<string, string> = {};

  /** Error text lives in #<id>-err; invalid state goes on the radiogroup itself. */
  const setErr = (id: string, msg: string, group?: Element | null) => {
    document.getElementById(`${id}-err`)!.textContent = msg;
    if (!group) return;
    if (msg) group.setAttribute('aria-invalid', 'true');
    else group.removeAttribute('aria-invalid');
  };

  form.querySelectorAll<HTMLElement>('.chips').forEach((g) => {
    const name = g.dataset.name!;
    initChips(g, (v) => {
      answers[name] = v;
      setErr(name, '', g);
    });
  });

  const required: [string, string][] = [
    ['role', 'Choose your role.'],
    ['output', 'Choose your current content output.'],
    ['budget', 'Choose a budget range.'],
  ];

  function next() {
    let first: HTMLElement | null = null;
    for (const [name, msg] of required) {
      const g = form.querySelector<HTMLElement>(`[data-name="${name}"]`)!;
      if (!answers[name]) {
        setErr(name, msg, g);
        first ??= g.querySelector<HTMLElement>('[role="radio"]');
      }
    }
    if (first) return first.focus();
    if (CONFIG.bookingUrl) {
      // hand off to the scheduling tool with the answers added to its link
      const url = new URL(CONFIG.bookingUrl);
      Object.entries(answers).forEach(([k, v]) => url.searchParams.set(k, v));
      if (bottleneck.value.trim()) url.searchParams.set('bottleneck', bottleneck.value.trim());
      window.open(url.toString(), '_blank', 'noopener');
      return;
    }
    buildSlotsOnce();
    stage1.hidden = true;
    stage2.hidden = false;
    stepLabel.textContent = 'Step 2 of 2';
    stage2.querySelector<HTMLElement>('input')?.focus();
  }
  form.querySelector('[data-next]')!.addEventListener('click', next);

  form.querySelector('[data-back]')!.addEventListener('click', () => {
    stage2.hidden = true;
    stage1.hidden = false;
    stepLabel.textContent = 'Step 1 of 2';
    (stage1.querySelector<HTMLElement>('[aria-checked="true"]') ?? stage1.querySelector<HTMLElement>('[role="radio"]'))?.focus();
  });

  /* time slots — built once, so going Back and Continue keeps the chosen day and time */
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('tz')!.textContent = tz ? `· ${tz.replace(/_/g, ' ')}` : '';
  let day: Date | null = null;
  let time: string | null = null;
  let built = false;
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  const longFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  function buildSlotsOnce() {
    if (built) return;
    built = true;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    let added = 0;
    while (added < 10) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const date = new Date(d);
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.dataset.value = date.toISOString();
      b.innerHTML = `<small>${dayFmt.format(date)}</small> ${dateFmt.format(date)}`;
      daysEl.appendChild(b);
      added++;
    }
    TIMES.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.textContent = t;
      timesEl.appendChild(b);
    });
    initChips(daysEl, (v) => {
      day = new Date(v);
      setErr('day', '', daysEl);
    });
    initChips(timesEl, (v) => {
      time = v;
      setErr('time', '', timesEl);
    });
  }

  const nameI = form.querySelector<HTMLInputElement>('#b-name')!;
  const emailI = form.querySelector<HTMLInputElement>('#b-email')!;
  const check = (input: HTMLInputElement, msg: string, isEmail = false) => {
    const v = input.value.trim();
    const err = !v ? msg : isEmail && !EMAIL_RE.test(v) ? 'Enter an email address like name@company.com.' : '';
    if (err) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${input.id}-err`);
    } else input.removeAttribute('aria-invalid');
    document.getElementById(`${input.id}-err`)!.textContent = err;
    return !err;
  };
  nameI.addEventListener('input', () => nameI.hasAttribute('aria-invalid') && check(nameI, 'Enter your name.'));
  emailI.addEventListener('input', () => emailI.hasAttribute('aria-invalid') && check(emailI, 'Enter your work email.', true));

  let busy = false;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Enter inside step 1 moves on, like Continue
    if (stage2.hidden) return next();
    if (busy) return;
    status.textContent = '';
    const okName = check(nameI, 'Enter your name.');
    const okEmail = check(emailI, 'Enter your work email.', true);
    if (!day) setErr('day', 'Choose a day for your call.', daysEl);
    if (!time) setErr('time', 'Choose a time for your call.', timesEl);
    if (!okName) return nameI.focus();
    if (!okEmail) return emailI.focus();
    if (!day) return daysEl.querySelector<HTMLElement>('[role="radio"]')?.focus();
    if (!time) return timesEl.querySelector<HTMLElement>('[role="radio"]')?.focus();

    // keep the button focusable while sending (a disabled button would drop focus)
    busy = true;
    const label = submitBtn.textContent;
    submitBtn.setAttribute('aria-disabled', 'true');
    submitBtn.textContent = 'Booking…';
    const [hh, mm] = time.split(':').map(Number);
    const start = new Date(day);
    start.setHours(hh, mm, 0, 0);
    try {
      await post(CONFIG.bookingEndpoint, {
        ...answers,
        bottleneck: bottleneck.value.trim(),
        name: nameI.value.trim(),
        email: emailI.value.trim(),
        start: start.toISOString(),
        timezone: tz,
      });
      const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
      document.getElementById('booker-when')!.textContent = `${longFmt.format(start)}, ${timeFmt.format(start)}`;
      document.getElementById('booker-email')!.textContent = emailI.value.trim();
      form.hidden = true;
      done.hidden = false;
      done.focus();
    } catch (err) {
      status.textContent =
        err instanceof NotConnectedError
          ? 'Online booking isn’t available right now. Please try again later.'
          : 'That booking didn’t go through. Check your connection and try again.';
      status.setAttribute('tabindex', '-1');
      status.focus();
    } finally {
      busy = false;
      submitBtn.removeAttribute('aria-disabled');
      submitBtn.textContent = label;
    }
  });
}

export function initMisc() {
  const y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());
}
