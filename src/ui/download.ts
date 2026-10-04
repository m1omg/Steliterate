// Handing the player a file. Inside the claude.ai viewer the page is framed and may not
// download by itself, so it asks the viewer to save; everywhere else a plain link does it.

interface Downloads {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: string }>;
}
type Use = (name: string) => Promise<unknown>;

const use = (window as unknown as { claude?: { use?: Use } }).claude?.use;
let viewer: Downloads | null = null;
const ready: Promise<Downloads | null> = use
  ? use('downloads').then(
      (d) => (viewer = (d as Downloads | null) ?? null),
      () => null,
    )
  : Promise.resolve(null);

function viaLink(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Resolves 'saved', 'declined' or 'failed'. */
export async function offerFile(name: string, text: string, type = 'application/json'): Promise<'saved' | 'declined' | 'failed'> {
  // outside a viewer, stay inside the click so the browser allows it
  if (!use) {
    try {
      viaLink(name, text, type);
      return 'saved';
    } catch {
      return 'failed';
    }
  }
  const d = viewer ?? (await ready);
  if (d) {
    try {
      await d.save({ filename: name, data: text });
      return 'saved';
    } catch (e) {
      return (e as { code?: string } | null)?.code === 'declined' ? 'declined' : 'failed';
    }
  }
  try {
    viaLink(name, text, type);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Read a text file the player picked. */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
