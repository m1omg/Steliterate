// Playing with the keyboard, and with a screen magnifier that follows the keyboard's focus (the
// player's friend has low vision, 9 Oct): rows that act like buttons, panels that scroll whole
// when a bigger page leaves them little room, and windows that take focus and give it back.

import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { uiFactor } from './Tip';
import { applyUiScale, engine, settings } from './store';

/** The magnifier mode is on (Settings: one column, bigger sizes, stronger contrast, focus that follows). */
export const lowVision = () => !!settings.value.lowVision;

/** The magnifier mode's look for the page, from the settings: its class and side, its size, the map's helpers. */
export function applyLowVision() {
  const st = settings.value;
  const root = document.documentElement.classList;
  root.toggle('lv', !!st.lowVision);
  root.toggle('lv-left', !!st.lowVision && st.lvSide === 'left');
  applyUiScale(st.uiScale);
  engine()?.setLowVision(!!st.lowVision);
}

/**
 * Focus a title (not a control: it takes focus only this way, and shows no ring), scrolling it into
 * view. A screen magnifier that follows focus goes there. False if it cannot take focus (inert
 * behind a window, or gone).
 */
export function focusTitle(el: Element | null | undefined): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus();
  return document.activeElement === el;
}

/** In the magnifier mode, the prompt or the guide waiting under a window that closes takes focus first. */
const WAITING = '.hud .research-prompt .rp-title, .hud .tutorial .tut-title';

/**
 * What makes a clickable row a button: Enter or Space presses it from the keyboard. A mouse click
 * leaves no focus on it, as on plain text, so the next Enter still ends the turn and never presses
 * the row again.
 */
export function pressable(run: () => void, disabled = false) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-disabled': disabled || undefined,
    onClick: () => {
      if (!disabled) run();
    },
    onMouseDown: (e: MouseEvent) => {
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) run();
    },
  };
}

type Ref = { current: HTMLElement | null };

/**
 * A panel whose head stays put while its body scrolls, scrolling whole instead (head and all) when
 * the body would get too little room: under 150 px of the interface, and back above 190. A page
 * made bigger by the system or the browser left a settlement's Build list one row high.
 */
export function useWholeScroll(ref: Ref, head: string, body: string): boolean {
  const [whole, setWhole] = useState(false);
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current;
      const h = el?.querySelector(head);
      const b = el?.querySelector(body);
      if (!el || !h || !b) return;
      // only while there is more than the panel shows
      const over = whole ? el.scrollHeight > el.clientHeight + 1 : b.scrollHeight > b.clientHeight + 1;
      if (!over) return;
      const room = (el.getBoundingClientRect().height - h.getBoundingClientRect().height) / uiFactor();
      if (!whole && room < 150) setWhole(true);
      else if (whole && room > 190) setWhole(false);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });
  return whole;
}

/**
 * A window takes focus as it opens, on its title (so a stray Enter presses nothing in it), and
 * gives it back as it closes. A screen magnifier follows focus, so the window comes into view.
 */
export function useFocusOnOpen(ref: Ref, key?: unknown) {
  // what had focus as the window first rendered: a moment later the HUD behind it is inert, and
  // the browser takes focus from it
  const [before] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    return () => {
      // a frame later, once the HUD is no longer inert
      requestAnimationFrame(() => {
        const now = document.activeElement;
        if (now && now !== document.body && now.isConnected) return;
        if (lowVision() && focusTitle(document.querySelector(WAITING))) return;
        if (before && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
      });
    };
  }, [key]);
}

/** Focus rings only after the Tab key is used, until the mouse is again. */
export function trackKeyboard() {
  const root = document.documentElement;
  window.addEventListener('keydown', (e) => e.key === 'Tab' && root.classList.add('kbd'), true);
  window.addEventListener('pointerdown', () => root.classList.remove('kbd'), true);
}

/** In the magnifier mode, focus a prompt's (or the guide's) title as it appears, when nothing covers it. */
export function useFocusPrompt(ref: Ref, key: unknown) {
  useEffect(() => {
    if (lowVision() && key != null) focusTitle(ref.current);
  }, [key]);
}
