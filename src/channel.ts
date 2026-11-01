// Which address this build is played at. The work branch is built twice from one codebase (Pages
// workflow): the main address and /next/. What is still a preview is offered at /next/ only (1 Nov,
// the player: "For the next and only for the next version, not for the main one"): so far, a game
// begun in the Twilight Interregnum. Its games are kept apart there too (save.ts).

function preview(): boolean {
  try {
    if (typeof location === 'undefined') return false;
    // `?main`: as the main address would be, for the checks, which run on a local server
    if (new URLSearchParams(location.search).has('main')) return false;
    return /\/next\//.test(location.pathname) || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/** True at the /next/ address (and on a local server, for the checks): previews are offered. */
export const PREVIEW: boolean = preview();
