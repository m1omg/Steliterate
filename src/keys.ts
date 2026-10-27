// Where this version keeps things in the browser. The new version (13 Oct; docs/plans/new-version.md)
// has storage of its own, so it never reads or overwrites the games of the build before it: that
// build stays playable at OLDER_BUILD (public/archive/), on the same origin and so with those games.
// The player: "For the new version, don't worry about saves. It will have so many changes that I
// will start from the beginning."

/** Every key this version writes starts with this. */
export const STORE = 'steliterate2.';

/** Where the build before the new version kept its games. */
export const OLD_SAVE_KEYS = ['steliterate.save.v1', 'steliterate.autosave.v1', 'steliterate.slots.v1'] as const;

/** Its settings and HUD preferences: read once as this version's starting point, never written. */
export const OLD_SETTINGS_KEY = 'steliterate.settings';
export const OLD_HUD_KEY = 'steliterate.hud';

/** The build before the new version, frozen and playable: as it was when the main address switched to the new version (27 Oct; its 13 Oct copy is at archive/2026-10-13/). */
export const OLDER_BUILD = 'https://m1omg.github.io/Steliterate/archive/2026-10-27/';

/** Whether this browser still keeps games from the build before the new version. */
export function hasOldGames(): boolean {
  try {
    return typeof localStorage !== 'undefined' && OLD_SAVE_KEYS.some((k) => {
      const v = localStorage.getItem(k);
      return !!v && v !== '[]';
    });
  } catch {
    return false;
  }
}
