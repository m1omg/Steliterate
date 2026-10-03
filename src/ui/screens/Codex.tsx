// The Codex: how the end of the universe works, and how the game models it. Sources are cited
// where the physics is real; speculation is labelled.

export interface CodexEntry {
  id: string;
  title: string;
  body: string[];
}

export const CODEX: CodexEntry[] = [
  {
    id: 'coalescence',
    title: 'The Coalescence',
    body: [
      'Your galaxy is the merged remains of dozens of older galaxies. Over trillions of years every galaxy in a small group falls together into one giant elliptical. It is the expected fate of our own Local Group, whose merger product astronomers nickname Milkomeda.',
      'The provinces of the Coalescence are what is left of those ancestral galaxies: their stars still keep the chemistry and orbits of where they came from. Tidal streams are ancestors still being torn apart. The halo holds ancient globular clusters crowded with white dwarfs and neutron stars.',
      'Beyond it there is almost nothing. Accelerating expansion carried every other galaxy group past the cosmic event horizon long ago (Krauss & Scherrer 2007). Their light can never reach you again. One or two stray clusters drift in the void; past them, nothing at all.',
    ],
  },
  {
    id: 'time',
    title: 'The Tide and your pace',
    body: [
      'There is no fixed turn length. Each age has a Tide, a natural turn length that grows every turn: decades at first, then aeons, then spans so long they can only be written as a power of ten. In the Dark Era the power itself grows.',
      'η (eta), the cosmological decade, is log₁₀ of the universe’s age in years. You begin at η ≈ 13.95, a few hundred billion years before the last ordinary stars fade (η = 14). The last galaxy-sized black holes evaporate around η = 100.',
      'You can quicken (shorter turns, more decisions while a short-lived source lasts, less energy per turn) or slow down (longer turns, more energy per turn, but the universe moves on faster between your choices). Neither is always right. A merger star that burns for a hundred million years is a long summer to a mind running at human speed, and a flash of lightning to a Coldmind.',
    ],
  },
  {
    id: 'tempo',
    title: 'Threads and tempo',
    body: [
      'Your civilization is made of Threads: the Kin (the original people), Echoes (uploads), the Chorus (merged minds), the Lattice (self-maintaining processes) and Coldminds (minds held near absolute zero).',
      'Each kind of mind lives at its own clock. When a turn is much longer than a Thread’s clock, that Thread has to stay awake through the whole span, and its upkeep climbs: this is tempo strain. When a turn is much shorter than a slow mind’s clock, it idles and produces little.',
      'Freeman Dyson (1979) argued that a mind which keeps slowing its thinking, and hibernates between bursts, could have an unlimited number of thoughts on a finite energy budget. Krauss & Starkman (2000) disputed it: with accelerating expansion, and quantum limits on memory, eternal thought is probably impossible. The game lets you try.',
    ],
  },
  {
    id: 'dusk',
    title: 'I. The Long Dusk',
    body: [
      'At the end of the Stelliferous Era only red dwarfs are left burning. Stars below about a quarter of the Sun’s mass never become red giants. At the end of their lives they heat up and shrink into blue dwarfs, then fade into white dwarfs (Adams & Laughlin 1997; Adams, Laughlin & Graves 2004).',
      'Your homeworld is a tidally locked planet in the habitable zone of such a star. Its core is freezing, its magnetic field failing, and the stellar wind is stripping its air.',
    ],
  },
  {
    id: 'degenerate',
    title: 'II. The Degenerate Age',
    body: [
      'After the Last Light, the galaxy is made of stellar corpses: white dwarfs, neutron stars, brown dwarfs and black holes.',
      'Embers: white dwarfs capture dark matter particles, which annihilate inside them and keep them warm. Adams & Laughlin estimate a few trillionths of the Sun’s luminosity (about 10¹⁵ W) and a temperature of around 63 K, for as long as the halo lasts (to roughly η 25). In the game the Unlit, the dark-matter minds, have something to say about that.',
      'Collision stars: when two brown dwarfs collide they can merge into a red dwarf that burns for trillions of years. About a hundred such stars shine in a galaxy at any time from η 15 until the galaxy itself evaporates (around η 19 to 21): brown dwarfs meet only while it holds together.',
      'Merger stars: two white dwarfs that spiral together can ignite as a short-lived, very bright helium-burning star, or explode as a type Ia supernova.',
      'Galactic evaporation: close encounters slowly fling most remnants out of the galaxy (η 19–20). Some fall into the central black hole instead.',
    ],
  },
  {
    id: 'fates',
    title: 'Planetary fates',
    body: [
      'Most planets end up as rogues. A star passes within about 1 AU of any given system roughly once every 10¹⁵ years, and each close pass can tear planets loose.',
      'A close-in planet that survives long enough spirals into its dead star through gravitational-wave orbital decay. An Earth mass at 0.02 AU takes about 5×10¹⁶ years; at 0.1 AU about 3×10¹⁹; a Jupiter mass far less. At the tidal limit it is torn into a debris disk that slowly feeds the white or black dwarf.',
      'How much heat that makes is uncertain. These estimates, which disagree with each other, come from speculative notes supplied by the game’s co-designer, not from peer-reviewed work. A slow feed might hold an Earth-mass world’s dwarf at 50–110 K for 10¹⁴–10¹⁵ years. A rare fast plunge might rekindle a dwarf to glow for billions of years. The game treats this as genuine model uncertainty: the forecast gives both models, and you find out which one was right when it happens.',
    ],
  },
  {
    id: 'decay',
    title: 'Proton decay',
    body: [
      'Many grand unified theories predict that protons decay, with a half-life above about 10³⁴ years; no decay has ever been observed. If they do, the white dwarfs and neutron stars dissolve between η 30 and 40. Each dissolving white dwarf glows at around 400 W: the last matter-based power in the universe.',
      'If protons are stable, matter stays. Over about 10¹⁵⁰⁰ years cold fusion by quantum tunnelling turns everything into iron (Dyson 1979), and much later the iron stars tunnel into black holes.',
      'You choose at the start whether protons decay, are stable, or remain unknown until your scientists find out.',
    ],
  },
  {
    id: 'blackhole',
    title: 'III. The Black Hole Age',
    body: [
      'Once matter is gone or locked away, black holes are the last sources. They lose mass through Hawking radiation, slowly at first and then faster: a black hole of mass M lasts about 2×10⁶⁷ (M / M☉)³ years, ending in a bright final burst.',
      'A spinning black hole also stores rotational energy that can in principle be tapped (the Penrose process). In the game it is a finite reservoir.',
      'Around η 85, electrons and positrons can pair into positronium atoms larger than today’s observable universe.',
    ],
  },
  {
    id: 'dark',
    title: 'IV. The Dark Era',
    body: [
      'After the last galaxy-sized black hole evaporates (around η 100) there is only thin radiation and the occasional positronium atom, which decays around η 141.',
      'Far beyond: the vacuum might decay (one Standard Model estimate is near 10¹⁶¹ years, but uncertain by more than a thousand orders of magnitude). If protons are stable, iron stars tunnel into black holes between 10^(10²⁶) and 10^(10⁷⁶) years. A de Sitter horizon returns to any previous state after roughly 10^(10¹²²) years (Poincaré recurrence).',
      'Roger Penrose’s conformal cyclic cosmology suggests the end of one universe might be the start of another. It is speculative; the game’s Aeon Seed is built on it.',
    ],
  },
  {
    id: 'hunger',
    title: 'The Hunger and free energy',
    body: [
      'The Hunger is a set of self-replicating harvesters built by a civilization that died long ago. They have no mind and no malice. They follow heat and matter, eat, and multiply, like weather.',
      'Galactic free energy is the share of the Coalescence’s usable energy still left. Every source and deposit yields less as it falls. The Hunger spends it, and so do you whenever you do something unsustainable: stellar lifting, overdrive, consuming the dead. It does not move the cosmic clock; black holes still evaporate on schedule. What disappears early is what anyone can do with the time.',
      'You can fight the swarms, hide from them (Blackout), lure them away with decoy beacons, or learn their makers’ command language and take control of them. Or you can become like them.',
    ],
  },
  {
    id: 'sources',
    title: 'Sources',
    body: [
      'F. C. Adams & G. Laughlin, “A dying universe: the long-term fate and evolution of astrophysical objects”, Reviews of Modern Physics 69, 337 (1997).',
      'F. C. Adams, G. Laughlin & G. J. M. Graves, “Red dwarfs and the end of the main sequence”, RevMexAA (2004).',
      'F. J. Dyson, “Time without end: physics and biology in an open universe”, Reviews of Modern Physics 51, 447 (1979).',
      'L. M. Krauss & G. D. Starkman, “Life, the universe, and nothing”, ApJ 531, 22 (2000).',
      'L. M. Krauss & R. J. Scherrer, “The return of a static universe and the end of cosmology”, GRG 39, 1545 (2007).',
      'R. Penrose, Cycles of Time (2010). Speculative.',
      'D. N. Page & M. R. McKee, positronium formation and decay in the far future (1981).',
      'Planet inspiral and accretion figures: estimates from the co-designer’s speculation notes (not peer-reviewed; they disagree with each other, which the game keeps).',
    ],
  },
];
