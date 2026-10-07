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
      'Black dwarfs: a white dwarf that no dark matter warms has only its own heat left. This late it keeps that heat in its electrons and is the same temperature right through, while its surface radiates as T⁴, so it cools as T ≈ K·t⁻½: a few millikelvin as the age opens, about ten microkelvin by η 20, colder every age after. The game calls it a black dwarf from η 16.7; it was black long before. An ember joins them as the halo runs out, its warmth fading from η 22. Neutron stars cool the same way once the dark matter stops warming them (from about 900 K), brown dwarfs from a few kelvin, and the cores of worlds, whose warmth runs out after the Last Light (really it went long before; the game keeps it through the Dusk). Nothing ends up colder than the sky itself: the cosmic horizon glows at about 2×10⁻³⁰ K. Black holes glow at their Hawking temperature, a few hundredths of a microkelvin for one of a few Suns.',
      'Usable energy goes as T⁴: a body a thousand times colder gives a million million times less. Collectors get nothing from a cold dwarf unless something warms it: a world falling in, or its own protons decaying, if they do (a white dwarf would hold near 0.05 K, a neutron star near 1.5 K), or, if curvature radiation is real, space unmaking a neutron star (a few hundredths of a microkelvin). The cold has one gift: erasing a bit of information costs at least kT ln 2 (Landauer), so the colder the sky, the cheaper a thought. Under a dark sky, a star with no light left to give, Coldminds and Cold Vaults keep for half.',
      'Collision stars: when two brown dwarfs collide they can merge into a red dwarf that burns for trillions of years. About a hundred such stars shine in a galaxy at any time from η 15 until the galaxy itself evaporates (around η 19 to 21): brown dwarfs meet only while it holds together.',
      'Merger stars: two white dwarfs that spiral together can ignite as a short-lived, very bright helium-burning star, or explode as a type Ia supernova. Its ultraviolet boils away the closest worlds; a heavier one then swells into a giant some 25 times the Sun’s size, swallowing whatever orbits inside it.',
      'Galactic evaporation: close encounters slowly fling most remnants out of the galaxy (η 19–20). Some fall into the central black hole instead. An ember flung out leaves behind the dark matter that warmed it: it dims over about a tenfold of years as it climbs away, then goes out (in the game from the moment it is cast out; really its orbit widens, and the dimming begins, a little before).',
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
    title: 'The fate of matter',
    body: [
      'Is ordinary matter for ever? Physics has not settled it, and the game keeps three answers. You choose one at the start, or leave it unknown: then the universe has drawn one (protons decay half the time, each of the others a quarter), and you learn which from the Proton Question or, near η 30, from the neutron stars.',
      'Protons decay. Many grand unified theories predict it, with a half-life above about 10³⁴ years; no decay has ever been seen. If they do, the decay keeps every dead star faintly warm (a white dwarf near 0.05 K on some 400 W, a neutron star near 1.5 K), and between η 37.5 and 39 it dissolves them, and every world, into light and a thin haze of electrons and positrons: the Great Decay.',
      'Matter is stable. Then it stays, cold and dark. Over about 10¹⁵⁰⁰ years cold fusion by quantum tunnelling turns it all into iron, and much later the iron stars tunnel into black holes (Dyson 1979).',
      'Curvature radiation. Falcke, Wondrak & van Suijlekom (2024) argue that space curved tightly around any dense body turns a little of its mass into particles, as it does at a black hole’s horizon; the denser the body, the faster. A neutron star lasts about 3×10⁶⁸ years, the densest white dwarf some 10⁷⁸, a typical one nearer 10⁸², the Moon a few times 10⁸⁹. A neutron star shrinks until, at about a tenth of a Sun, it can no longer hold together, and bursts. A white dwarf grows less dense as it shrinks, so the game has it fade away instead (η 78.5 to 85, the heaviest first); brown dwarfs go near η 87, and the last worlds by η 89.5, the Great Evaporation. The glow is faint: a neutron star holds at a few hundredths of a microkelvin, on some 10⁻²⁹ W, much like the Hawking glow of a stellar black hole, and, like it, worth gathering only to minds as slow as the age. The idea is new, unconfirmed and disputed: not everyone agrees that a body without a horizon radiates at all.',
      'Each age is named for the warmest thing in it: the last stars, then the dead stars, then the black holes, then nothing warmer than the sky. The Degenerate Age ends when the neutron stars, the last things warm of their own accord, fall below the faint glow of the black holes. If matter is stable that happens near η 30, the Last Warmth; if protons decay, their warmth holds the neutron stars up until the Great Decay at η 39; under curvature radiation they glow until they burst, near η 68. Whatever happens to matter, the Black Hole Age lasts until the last hole evaporates, near η 100.',
      'Where the game bends it: decay warmth would show in the neutron stars as soon as the dark matter stopped warming them, about η 25, and curvature warmth near η 29; the game keeps the question open until the Proton Question or the neutron stars at η 30 settle it.',
    ],
  },
  {
    id: 'flow',
    title: 'The Long Flow',
    body: [
      'Freeman Dyson (1979) worked out that a solid is a liquid on a long enough time scale, even at the absolute zero. Now and then an atom tunnels out of its place, through the barrier its neighbours make; the time for it goes as e^S × 10⁻¹⁴ seconds, with S ≈ 27·√A for an atom of mass number A. For iron that is about 10⁶⁵ years. On longer times every rock and every machine creeps, and a body of any size, a world or a stone in a belt, slowly runs into a smooth sphere.',
      'It is happening now, far too slowly to see (today heat makes things creep far faster). What decides whether it matters is how fast you think: from η 65 a turn lasts some 10⁶⁶ years, so whatever no one tends flows within one of our turns. Kin, the Lattice (it mends itself) and any mind that thinks faster than once in 10⁶⁵ years keep a settlement whole. Minds that think more slowly see their own vaults flow between two thoughts: they keep watchers awake, at half again their upkeep. A settlement where no one is awake, only sleepers or no one, loses a structure a turn, the cheapest first and the Cryo Halls last, with their sleepers. A sleeping civilization, ours or another, must wake its watchers to mend. Ruins no one is digging run into smooth lumps, and what they held is lost.',
      'It comes only if matter lasts that long: if it is stable, or under curvature radiation until the Great Evaporation. Structures of leptonic substrate are not made of atoms, and do not flow.',
      'Where the game bends it: the formula is crude, and lighter atoms go much sooner by it (carbon after some 10¹⁹ years, oxygen 10²⁵, silicon 10⁴⁰), so most rock would flow long before iron does. The game takes one date, iron’s, the stuff of machines and the last of the common solids to go.',
    ],
  },
  {
    id: 'blackhole',
    title: 'III. The Black Hole Age',
    body: [
      'Once matter is gone or locked away, black holes are the last sources. They lose mass through Hawking radiation, slowly at first and then faster: a black hole of mass M lasts about 2×10⁶⁷ (M / M☉)³ years, ending in a bright final burst. Until near the end a stellar hole radiates less than a billion-billion-billionth of a watt, so its last second, about 2×10²² joules (its last year, nearly 10²⁵), dwarfs everything it gave before: a prize for whoever catches it close in. Spread over the distance its worlds orbit it harms nothing: a world 1 AU out gets under a tenth of a joule on each square metre, what Earth gets from the Sun in a twentieth of a millisecond. As the hole shrinks, its hold on what circles it fades, and its worlds drift free.',
      'A spinning black hole also stores rotational energy that can in principle be tapped (the Penrose process). In the game it is a finite reservoir.',
      'Around η 85, if protons decayed or space unmade matter, electrons and positrons can pair into positronium atoms larger than today’s observable universe.',
    ],
  },
  {
    id: 'dark',
    title: 'IV. The Dark Era',
    body: [
      'After the last galaxy-sized black hole evaporates (around η 100) there is only thin radiation and, unless matter was stable, the occasional positronium atom, which decays around η 141. If it was, the dead stars and worlds are still there, as cold as the sky.',
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
      'H. Falcke, M. F. Wondrak & W. D. van Suijlekom, “An upper limit to the lifetime of stellar remnants from gravitational pair production”, arXiv:2410.14734 (2024). Theoretical and disputed.',
      'Planet inspiral and accretion figures: estimates from the co-designer’s speculation notes (not peer-reviewed; they disagree with each other, which the game keeps).',
    ],
  },
];
