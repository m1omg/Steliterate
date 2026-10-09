// A browser's own page translation (Chrome's is Google Translate) swaps each text node it
// translates for <font> elements holding the translation. Preact keeps the text node it made and
// goes on updating it out of the page, so under translation the turn count, the figures and the
// tooltips froze at their first value (a player's friend reads the game translated into Czech).
// Once a translation shows up, each text node and the <font> standing in for it are kept paired:
// an update puts the text node back in its place (and the translator translates it again), and a
// move or a removal acts on the stand-in. Untranslated, nothing here runs but one observer.

const parentOf = Object.getOwnPropertyDescriptor(Node.prototype, 'parentNode')!.get!;
const nextOf = Object.getOwnPropertyDescriptor(Node.prototype, 'nextSibling')!.get!;
const textData = Object.getOwnPropertyDescriptor(CharacterData.prototype, 'data')!;
const nativeInsert = Node.prototype.insertBefore;
const nativeRemove = Node.prototype.removeChild;
const nativeReplace = Node.prototype.replaceChild;

/** A text node the translator took out → the <font> it put in its place, and back. */
const standIn = new WeakMap<Node, Node>();
const standsFor = new WeakMap<Node, Node>();
let observer: MutationObserver | null = null;
let armed = false;

const isFont = (n: Node | null): boolean => !!n && n.nodeType === 1 && (n as Element).tagName === 'FONT';

/** Pair each text node taken out with the <font> put in its place (in one replace, or just before it). */
function note(records: MutationRecord[]) {
  for (const r of records) {
    for (const t of r.removedNodes) {
      if (t.nodeType !== 3 || parentOf.call(t)) continue;
      let f: Node | null = null;
      for (const a of r.addedNodes) if (isFont(a)) f = a;
      if (!f && isFont(r.previousSibling)) f = r.previousSibling;
      if (!f || standsFor.has(f)) continue;
      standIn.set(t, f);
      standsFor.set(f, t);
    }
  }
}

/** The <font> standing in for a text node out of the page, while it is in the page itself. */
function stand(t: Node): Node | null {
  if (parentOf.call(t)) return null;
  if (observer) note(observer.takeRecords());
  const f = standIn.get(t);
  if (!f) return null;
  if (parentOf.call(f)) return f;
  unpair(t, f);
  return null;
}

function unpair(t: Node, f: Node) {
  standIn.delete(t);
  standsFor.delete(f);
}

function arm() {
  armed = true;
  // where Preact looks for its text node, it finds the stand-in's place
  Object.defineProperty(Text.prototype, 'parentNode', {
    configurable: true,
    get(this: Text) {
      const p = parentOf.call(this);
      if (p) return p;
      const f = stand(this);
      return f ? parentOf.call(f) : null;
    },
  });
  Object.defineProperty(Text.prototype, 'nextSibling', {
    configurable: true,
    get(this: Text) {
      if (parentOf.call(this)) return nextOf.call(this);
      const f = stand(this);
      return f ? nextOf.call(f) : null;
    },
  });
  // an update puts the text node back where its stand-in is, for the translator to translate again
  Object.defineProperty(Text.prototype, 'data', {
    configurable: true,
    get(this: Text) {
      return textData.get!.call(this);
    },
    set(this: Text, v: string) {
      const f = stand(this);
      if (f) {
        nativeReplace.call(parentOf.call(f)!, this, f);
        unpair(this, f);
      }
      textData.set!.call(this, v);
    },
  });
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    // a text node moved: its stand-in goes, and the text node goes where it is put
    if (node.nodeType === 3) {
      const f = stand(node);
      if (f) {
        nativeRemove.call(parentOf.call(f)!, f);
        unpair(node, f);
      }
    }
    if (ref && ref.nodeType === 3) {
      const f = stand(ref);
      if (f && parentOf.call(f) === this) ref = f;
    }
    return nativeInsert.call(this, node, ref) as T;
  };
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.nodeType === 3) {
      const f = stand(child);
      if (f && parentOf.call(f) === this) {
        nativeRemove.call(this, f);
        unpair(child, f);
        return child;
      }
    }
    return nativeRemove.call(this, child) as T;
  };
}

/** Watch the interface for a page translation, and pair its text from the first one on. */
export function guardTranslation(root: Node) {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((records) => {
    if (!armed) {
      if (!records.some((r) => Array.prototype.some.call(r.addedNodes, isFont))) return;
      arm();
    }
    note(records);
  });
  observer.observe(root, { childList: true, subtree: true });
}
