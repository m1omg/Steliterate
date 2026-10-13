# Older builds

Frozen, playable copies of earlier versions of the game, served next to the live one by GitHub
Pages (Vite copies `public/` into every build as it is).

- `2026-10-13/`: the game as of PR m1omg/Steliterate#27 (merge commit `4aaaa2a`, live script
  `index-B4EKBtSN.js`), the last state before the new version. Play it at
  https://m1omg.github.io/Steliterate/archive/2026-10-13/. It uses the storage keys of its time,
  so it opens the saves made on the main address before the new version. Its source, without Git:
  https://github.com/m1omg/Steliterate/archive/4aaaa2a996b5d4bd62587931737858d76b7f8706.zip

Built from that commit with `npm run build`, nothing changed. Never edit these files, and never
build a later copy from a tree that contains this folder (it would nest).
