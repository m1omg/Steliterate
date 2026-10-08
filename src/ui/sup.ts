// Exponents written as Unicode superscripts (10¹⁵·³ years) read badly: the game's fonts carry
// only ¹ ² ³, so the other digits came from whatever font the system falls back on, smaller than
// those and unlike the digits around them. Every superscript run the interface renders is drawn
// instead as ordinary digits of the font around it, raised and a little smaller (`.sup` in
// styles.css). The text itself is unchanged wherever it is kept or passed on (saves, the Record,
// tooltips' attributes); only what is drawn changes.

import { h, options, type ComponentChild } from 'preact';

const PLAIN: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '−' };
const ANY = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/;
/** A run of superscript digits, with the · decimal point between them. */
const RUN = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻](?:[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]|·(?=[⁰¹²³⁴⁵⁶⁷⁸⁹]))*/g;
/** Elements whose children must stay plain text. */
const PLAIN_ONLY = new Set(['option', 'textarea', 'title', 'style', 'script']);

/** A string with its superscript runs as raised digits (the same string if it has none). */
export function lift(s: string): string | ComponentChild[] {
  if (!ANY.test(s)) return s;
  const out: ComponentChild[] = [];
  let last = 0;
  for (const m of s.matchAll(RUN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(s.slice(last, at));
    out.push(h('span', { class: 'sup' }, m[0].replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => PLAIN[c])));
    last = at + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function liftChildren(c: unknown): unknown {
  if (typeof c === 'string') return lift(c);
  if (!Array.isArray(c)) return c;
  let changed = false;
  const out = c.map((x) => {
    const y = typeof x === 'string' || Array.isArray(x) ? liftChildren(x) : x;
    if (y !== x) changed = true;
    return y;
  });
  return changed ? out : c;
}

const before = options.vnode;
options.vnode = (vnode) => {
  if (typeof vnode.type === 'string' && !PLAIN_ONLY.has(vnode.type)) {
    const p = vnode.props as { children?: unknown };
    if (p.children !== undefined) p.children = liftChildren(p.children);
  }
  before?.(vnode);
};
