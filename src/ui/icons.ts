// Original instrument-inspired glyphs. Inner markup for a 24 × 24 SVG.
export type IconName =
  | 'energy'
  | 'matter'
  | 'insight'
  | 'accord'
  | 'industry'
  | 'reserve'
  | 'continuity'
  | 'kin'
  | 'echoes'
  | 'chorus'
  | 'lattice'
  | 'coldminds'
  | 'red_dwarf'
  | 'white_dwarf'
  | 'brown_dwarf'
  | 'neutron_star'
  | 'black_hole'
  | 'planet'
  | 'asteroids'
  | 'gas_giant'
  | 'galaxy'
  | 'system'
  | 'research'
  | 'threads'
  | 'doctrines'
  | 'diplomacy'
  | 'log'
  | 'settings'
  | 'end_turn'
  | 'sleep'
  | 'wake'
  | 'fleet'
  | 'colony'
  | 'survey'
  | 'colonize'
  | 'attack'
  | 'move'
  | 'close'
  | 'warning'
  | 'clock'
  | 'music'
  | 'sound'
  | 'save'
  | 'load'
  | 'cryo'
  | 'upload'
  | 'merge'
  | 'seed'
  | 'shield'
  | 'dyson'
  | 'accretion'
  | 'relic'
  | 'focus'
  | 'queue'
  | 'plus'
  | 'minus'
  | 'arrow_right'
  | 'check'
  | 'lock'
  | 'info';

export const ICONS: Record<IconName, string> = {
  energy: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"7\"/><path fill=\"none\" d=\"M12 3v3m0 12v3M3 12h3m12 0h3M14 7l-5 6h6l-5 4\"/>",
  matter: "<path fill=\"none\" d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9Z M4 7.5l8 4.5 8-4.5M12 12v9\"/><circle cx=\"12\" cy=\"7\" r=\"1\" fill=\"currentColor\"/>",
  insight: "<path fill=\"none\" d=\"M3 15a9 9 0 0 1 18 0M6 15a6 6 0 0 1 12 0M12 8V3M12 15l5-5M9 20h6\"/><circle fill=\"none\" cx=\"12\" cy=\"15\" r=\"2\"/>",
  accord: "<path fill=\"none\" d=\"M9 5a7 7 0 0 0 0 14M15 5a7 7 0 0 1 0 14M6 12h12M12 9v6\"/><circle fill=\"none\" cx=\"12\" cy=\"4\" r=\"1\"/>",
  industry: "<path fill=\"none\" d=\"M5 8l7-4 7 4v8l-7 4-7-4ZM5 8l7 4 7-4M12 12v8M3 12h4m10 0h4\"/><circle cx=\"12\" cy=\"8\" r=\"1\" fill=\"currentColor\"/>",
  reserve: "<ellipse fill=\"none\" cx=\"12\" cy=\"6\" rx=\"7\" ry=\"3\"/><path fill=\"none\" d=\"M5 6v12c0 4 14 4 14 0V6M5 12c0 4 14 4 14 0M9 17h6\"/>",
  continuity: "<path fill=\"none\" d=\"M12 6C3 2 3 18 8 18c4 0 4-12 8-12C21 6 21 22 12 18\"/><path fill=\"none\" d=\"M9 3l3 3-4 1m8 10-4 1 3 3\"/>",
  kin: "<path fill=\"none\" d=\"M12 3C3 7 3 17 12 21c9-4 9-14 0-18ZM12 21v-8l-4-3m4 3 4-3\"/><circle fill=\"none\" cx=\"12\" cy=\"8\" r=\"2\"/>",
  echoes: "<circle cx=\"6\" cy=\"12\" r=\"1.3\" fill=\"currentColor\"/><path fill=\"none\" d=\"M10 8a6 6 0 0 1 0 8M13 5a10 10 0 0 1 0 14M16 3a13 13 0 0 1 0 18\"/>",
  chorus: "<circle fill=\"none\" cx=\"9\" cy=\"14\" r=\"6\"/><circle fill=\"none\" cx=\"15\" cy=\"14\" r=\"6\"/><circle fill=\"none\" cx=\"12\" cy=\"9\" r=\"6\"/>",
  lattice: "<path fill=\"none\" d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9ZM4 7.5h16M4 16.5h16M12 3 4 16.5m8-13 8 13.5M4 7.5 12 21l8-13.5\"/>",
  coldminds: "<path fill=\"none\" d=\"M12 3v5m0 8v5M4 7l4 3m8 4 4 3M4 17l4-3m8-4 4-3M9 4l3 2 3-2M9 20l3-2 3 2\"/><path fill=\"none\" d=\"M12 8l4 2v4l-4 2-4-2v-4Z\"/>",
  red_dwarf: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"5\"/><path fill=\"none\" d=\"M7 4a9 9 0 0 1 10 0M7 20a9 9 0 0 0 10 0M3 12h2m14 0h2\"/><path fill=\"none\" opacity=\"0.5\" d=\"M9 13a3 3 0 0 0 4 2\"/>",
  white_dwarf: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"3\"/><path fill=\"none\" d=\"M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2\"/>",
  brown_dwarf: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"6\"/><path fill=\"none\" d=\"M7 10h10M7 14h6\"/><path fill=\"none\" opacity=\"0.5\" d=\"M4 8a9 9 0 0 0 0 8m16-8a9 9 0 0 1 0 8\"/>",
  neutron_star: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"3\"/><ellipse fill=\"none\" cx=\"12\" cy=\"12\" rx=\"9\" ry=\"5\"/><path fill=\"none\" d=\"M11 9 9 3m4 12 2 6M7 3h4m2 18h4\"/>",
  black_hole: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"4\"/><path fill=\"none\" d=\"M8 8.5C3 10 3 17 12 17S21 10 16 8.5M6 8a7 7 0 0 1 13 4M5 15a8 8 0 0 0 13 3\"/><path fill=\"none\" opacity=\"0.5\" d=\"M3 12h3m12 0h3\"/>",
  planet: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"8\"/><path fill=\"none\" d=\"M14 4a12 12 0 0 0 0 16M3 7l3-1m12 12 3-1\"/>",
  asteroids: "<path fill=\"none\" d=\"m7 4 5 1 1 5-4 3-5-3ZM17 12l4 3-2 5-5-1-1-4ZM5 17l3-1 2 4-4 1Z\"/><path fill=\"none\" opacity=\"0.5\" d=\"m17 4 2 3M3 14h2\"/>",
  gas_giant: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"7\"/><path fill=\"none\" d=\"M6 9h12M6 15h12M5 11C3 14 3 19 13 15S21 6 18 7\"/>",
  galaxy: "<ellipse fill=\"none\" cx=\"12\" cy=\"12\" rx=\"3\" ry=\"2\"/><path fill=\"none\" d=\"M15 12C21 7 16 3 9 6S3 17 9 18M9 12c-6 5-1 9 6 6S21 7 15 6\"/>",
  system: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"2.5\"/><ellipse fill=\"none\" cx=\"12\" cy=\"12\" rx=\"9\" ry=\"6\"/><path fill=\"none\" d=\"M12 3v3m0 12v3\"/><circle cx=\"20\" cy=\"9\" r=\"1.4\" fill=\"currentColor\"/>",
  research: "<path fill=\"none\" d=\"M5 20 15 4l5 3L10 21M12 9l5 3M4 8a8 8 0 0 1 5-4M4 12H2.8M15 17h6m-3-3v6\"/>",
  threads: "<path fill=\"none\" d=\"M5 3v4c0 5 14 5 14 10v4M12 3v18M19 3v4c0 5-14 5-14 10v4\"/><circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"3\"/>",
  doctrines: "<path fill=\"none\" d=\"M6 3h12v18l-6-3-6 3ZM9 8l3-3 3 3-3 3ZM9 14h6\"/>",
  diplomacy: "<path fill=\"none\" d=\"M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14M3 12h6m6 0h6M9 12l3-3 3 3-3 3Z\"/><path fill=\"none\" opacity=\"0.5\" d=\"M9 4h6m-6 16h6\"/>",
  log: "<path fill=\"none\" d=\"M7 3h12v18H7M4 6h5m-5 6h5m-5 6h5M12 7h4m-4 5h4m-4 5h2\"/>",
  settings: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"7\"/><circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"2\"/><path fill=\"none\" d=\"M12 3v3m0 12v3M3 12h3m12 0h3M7 7l3 3m4 4 3 3\"/><circle cx=\"17\" cy=\"7\" r=\"1.2\" fill=\"currentColor\"/>",
  end_turn: "<path fill=\"none\" d=\"M7 5a8 8 0 1 0 10 0M12 3v9l4 3M4 4l3 1-1 3\"/><path fill=\"none\" d=\"M18 19h3v-3\"/>",
  sleep: "<path fill=\"none\" d=\"M15 4a8 8 0 1 0 5 12 7 7 0 0 1-5-12ZM4 4h4m-2-1v2M17 7h4m-2-2v4\"/>",
  wake: "<path fill=\"none\" d=\"M3 17h18M6 17a6 6 0 0 1 12 0M12 3v5M4 8l3 3m10 0 3-3M8 21h8\"/><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"currentColor\"/>",
  fleet: "<path fill=\"none\" d=\"m12 3 4 10-4-2-4 2ZM6 12l3 8-3-2-3 2ZM18 12l3 8-3-2-3 2Z\"/>",
  colony: "<path fill=\"none\" d=\"M4 17a8 8 0 0 1 16 0M3 17h18M7 21h10M9 17v-6h6v6M12 3v3m-2-2h4\"/>",
  survey: "<path fill=\"none\" d=\"M4 20 12 4l8 16M7 14a9 9 0 0 0 10 0M12 4v7M4 6l2 2m12 0 2-2\"/><circle fill=\"none\" cx=\"12\" cy=\"4\" r=\"1\"/>",
  colonize: "<path fill=\"none\" d=\"M4 20a8 8 0 0 1 16 0M12 17V3l7 3-7 3M3 20h18M5 6v4M3 8h4\"/>",
  attack: "<path fill=\"none\" d=\"M4 20 18 6M11 6h7v7M5 10a8 8 0 0 1 5-5m4 14a8 8 0 0 0 5-5M4 15l5 5\"/>",
  move: "<path fill=\"none\" d=\"M4 18C8 18 6 7 12 7h8M16 3l4 4-4 4\"/><circle fill=\"none\" cx=\"4\" cy=\"18\" r=\"1.5\"/><path fill=\"none\" opacity=\"0.5\" d=\"M12 16h7m-3-3 3 3-3 3\"/>",
  close: "<path fill=\"none\" d=\"m7 7 10 10M7 17 17 7M3 8V3h5m8 18h5v-5\"/>",
  warning: "<path fill=\"none\" d=\"m12 3 9 17H3ZM12 9v5\"/><circle cx=\"12\" cy=\"17\" r=\"1\" fill=\"currentColor\"/>",
  clock: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"8\"/><path fill=\"none\" d=\"M12 4v2m8 6h-2m-6 8v-2m-8-6h2M12 8v4l4 2\"/>",
  music: "<path fill=\"none\" d=\"M9 17V6l10-3v11M9 9l10-3\"/><ellipse fill=\"none\" cx=\"6\" cy=\"18\" rx=\"3\" ry=\"2\"/><ellipse fill=\"none\" cx=\"16\" cy=\"15\" rx=\"3\" ry=\"2\"/><path fill=\"none\" opacity=\"0.5\" d=\"M13 21h6\"/>",
  sound: "<path fill=\"none\" d=\"M3 10h4l5-5v14l-5-5H3ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14\"/>",
  save: "<path fill=\"none\" d=\"M4 6V3h16v3M4 15v6h16v-6M12 6v10m-4-4 4 4 4-4M8 18h8\"/>",
  load: "<path fill=\"none\" d=\"M4 6V3h16v3M4 15v6h16v-6M12 16V6m-4 4 4-4 4 4M8 18h8\"/>",
  cryo: "<rect fill=\"none\" x=\"6\" y=\"3\" width=\"12\" height=\"18\" rx=\"6\"/><path fill=\"none\" d=\"M12 7v10M8 9l8 6m-8 0 8-6M3 9v6m18-6v6\"/><circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"2\"/>",
  upload: "<path fill=\"none\" d=\"M4 8a8 5 0 0 1 16 0M7 8a5 2 0 0 1 10 0M12 18V9m-3 3 3-3 3 3\"/><circle fill=\"none\" cx=\"12\" cy=\"19\" r=\"2\"/>",
  merge: "<path fill=\"none\" d=\"M4 4v4c0 4 8 3 8 8m8-12v4c0 4-8 3-8 8M12 16v5M9 18l3 3 3-3\"/><circle fill=\"none\" cx=\"4\" cy=\"4\" r=\"1.3\"/><circle fill=\"none\" cx=\"20\" cy=\"4\" r=\"1.3\"/>",
  seed: "<path fill=\"none\" d=\"M12 21V11M12 15C3 16 3 7 3 7s9-1 9 8ZM12 11c0-8 9-8 9-8s0 9-9 8M8 21h8\"/>",
  shield: "<path fill=\"none\" d=\"m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7ZM12 7v10M8 10h8\"/><circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"6\" opacity=\"0.5\"/>",
  dyson: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"2\"/><path fill=\"none\" d=\"M8 4 12 3l4 1m4 4 1 4-1 4m-4 4-4 1-4-1m-4-4-1-4 1-4M7 7l3 3m4 4 3 3m0-10-3 3m-4 4-3 3\"/><ellipse fill=\"none\" cx=\"12\" cy=\"12\" rx=\"5\" ry=\"9\"/>",
  accretion: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"3\"/><path fill=\"none\" d=\"M3 13c0-9 17-12 17-4 0 4-7 9-12 7M21 12c0 8-15 12-17 5M5 13l3 3-4 1\"/><circle cx=\"19\" cy=\"5\" r=\"1\" fill=\"currentColor\"/>",
  relic: "<path fill=\"none\" d=\"m12 3 6 7-2 10H8L6 10ZM12 3v7l4 10M6 10h12M3 6v3m18 6v3\"/><circle fill=\"none\" cx=\"12\" cy=\"13\" r=\"2\"/>",
  focus: "<path fill=\"none\" d=\"M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M12 6v3m0 6v3M6 12h3m6 0h3\"/><circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"3\"/>",
  queue: "<path fill=\"none\" d=\"M6 6v12M11 6h10M11 12h7m-7 6h4\"/><circle fill=\"none\" cx=\"6\" cy=\"6\" r=\"2\"/><circle cx=\"6\" cy=\"12\" r=\"1\" fill=\"currentColor\"/><circle cx=\"6\" cy=\"18\" r=\"1\" fill=\"currentColor\"/>",
  plus: "<path fill=\"none\" d=\"M12 5v14M5 12h14M3 7V3h4m10 18h4v-4\"/>",
  minus: "<path fill=\"none\" d=\"M5 12h14M3 7V3h4m10 18h4v-4\"/>",
  arrow_right: "<path fill=\"none\" d=\"M3 12h17m-6-6 6 6-6 6M4 8v8\"/>",
  check: "<path fill=\"none\" d=\"m5 12 5 5L20 6M3 7V3h4m10 18h4v-4\"/>",
  lock: "<path fill=\"none\" d=\"M7 10V8a5 5 0 0 1 10 0v2M5 10h14v10H5ZM12 14v3\"/><path fill=\"none\" opacity=\"0.5\" d=\"M9 20v1m6-1v1\"/>",
  info: "<circle fill=\"none\" cx=\"12\" cy=\"12\" r=\"8\"/><path fill=\"none\" d=\"M12 11v6m-2 0h4M3 12h2m14 0h2\"/><circle cx=\"12\" cy=\"7.5\" r=\"1\" fill=\"currentColor\"/>",
};
