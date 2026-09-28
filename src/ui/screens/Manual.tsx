import type { CodexEntry } from './Codex';

// The manual: how to play, as opposed to how the universe ends. Plain instructions, in the
// order a new player needs them.

export const MANUAL: CodexEntry[] = [
  {
    id: 'm-start',
    title: 'Getting started',
    body: [
      'Your people live on Aster, a tidally locked world around a red dwarf that is running down. Its core is cooling and its air is being stripped away. The goal is simple to say: keep your people alive for as long as the universe allows, and decide what alive means.',
      'Your first turns: choose a research project (the first button on the left rail). Click Aster and queue something to build. Send your two survey probes to nearby stars. Then press End Turn, or Enter.',
      'Every button explains itself if you hover over it. The chips above End Turn list anything still waiting for you; click one to go there.',
    ],
  },
  {
    id: 'm-time',
    title: 'Turns, time and pace',
    body: [
      'Every turn covers more time than the last. The first turn of the Dusk is 40 years; by its end a turn is about a trillion years. The Chronometer across the top shows where you are in the remaining life of the universe, with the milestones and your forecasts marked on it.',
      'Pace (bottom right) changes the length of the coming turns. Quick makes them shorter: more decisions while something bright is burning, but each turn collects less energy. Slow makes them longer: more energy per turn, but the universe moves on faster between decisions, and only minds that can slow their own clocks (Echoes, Coldminds) avoid paying for the extra time. Tide is the natural pace of the age.',
      'Sleep makes the whole civilization dormant: upkeep falls to a tenth, energy still comes in, nothing is built or learned. Long Sleep (after Hibernation Protocols) ends several turns on its own and stops for any decision.',
      'Fleets fly below the speed of light, but because every turn is longer than the last, even a trip across the galaxy takes only a few turns once the turns are long.',
    ],
  },
  {
    id: 'm-energy',
    title: 'Energy',
    body: [
      'Energy is the master resource. The big number is your reserve; the small one beside it is what the next turn will add or cost. Hover over it for the breakdown by settlement.',
      'Income comes from collectors (solar arrays, orbital collectors, the Dyson swarm; later ember collectors, accretion engines, Penrose harvesters and Hawking collectors), from geothermal taps, fusion, and from each settlement’s Hearth, a small power core that runs on whatever is local.',
      'Upkeep comes from people (Kin are by far the most expensive), from some structures, and from research: while a project is running, the labs draw a little power. If the reserve empties, settlements start to starve: people die and resolve falls. If the reserve is full, extra energy is wasted; build Energy Vaults or spend it.',
      'When energy is short: pause research, sleep for a few turns, cool Echoes into Coldminds, or put Kin into cold sleep.',
    ],
  },
  {
    id: 'm-settlements',
    title: 'Settlements',
    body: [
      'Click a settlement (on the map, or in the Settlements list on the rail) to open its panel. Overview shows its yields, people, world and structures. Build shows its queue and what it can build; Rush finishes the first item at once for matter and energy, and people resent it.',
      'Focus shifts a settlement’s effort toward energy, industry, insight or accord. Overdrive (after the Overdrive Protocols charter) runs the Hearth hot for much more energy, at a cost in damage and attention from the Hunger.',
      'People need room. Kin can live on a living world up to its natural capacity, and anywhere in Habitat Domes and Deep Warrens. Echoes live in Substrate Cores, Coldminds in Cold Vaults, the Lattice in Lattice Foundries. Housing costs upkeep only for the share that is lived in.',
      'Living worlds die. Aster is losing its magnetic field (a Magnetic Shield slows that), and once the stars go out every living world freezes within a few turns and becomes an ice world or bare rock, unless you keep it warm with Orbital Lamps or slow it with a Core Stimulator.',
      'Conversions (in the People section): Upload turns a Kin into an Echo, Merge two Echoes into a Chorus, Cool an Echo into a Coldmind. Freeze and Thaw move Kin in and out of cold sleep.',
    ],
  },
  {
    id: 'm-expand',
    title: 'Exploring and expanding',
    body: [
      'Stars you can see are on the map; their worlds are unknown until a probe surveys the system. Select a probe (Fleets on the rail) and pick a destination from its Nearby list, or press Move and click a star. A survey charts every world and sometimes turns up something remarkable.',
      'Settler ships, from any settlement with a Shipyard (the Expand section of the settlement panel, or Build then Ships):',
      'System Lighter: no research needed. Carries one family of Kin and a dome to another world of the same star. Its colonists come from the settlement that builds it.',
      'Seedcore (Mind Substrate): two Echoes and their substrate. Can settle almost anywhere, including the empty orbital space of a dead star.',
      'Kin Ark (Fusion Drives): two Kin and a dome, to any world except a gas giant. Lattice Spore (Autonomous Replicators) and Vault Ship (Cold Computation, Degenerate Age) carry Lattice and Coldminds.',
      'When a settler is ready, its panel lists where it can go, nearest first, with the natural room for Kin ("domes only" means nothing lives there) and the travel time. Launching costs energy; longer trips cost more.',
      'Think ahead: after the Last Light the useful places are white dwarfs warmed by dark matter (for ember collectors) and black holes (for accretion and, later, Penrose and Hawking harvesting).',
    ],
  },
  {
    id: 'm-research',
    title: 'Research and Great Works',
    body: [
      'Research is organised by field and by age. Pick any project whose requirements you have; later ages’ projects open as you reach them. Some are marked speculative: the science behind them is uncertain.',
      'Insight that overflows a finished project, or comes from discoveries and relics, is stored and goes into whatever you choose next; if the store already covers a project, it is worked out the moment you choose it. With a great deal stored (more than the dearest open project would need), the scholars spend only the excess, filling in the cheapest open projects on their own, up to three a turn; they never take up the Hunger’s ways or a deliberate choice such as Halo Siphons. When a project finishes, a prompt suggests what to do next. You can also pause research: the labs stop drawing power, and half of each turn’s insight is kept for later.',
      'Great Works are the projects that can end the game in something other than silence. Each belongs to an age, needs a technology and a condition (for example, enough Echoes and Coldminds). Once begun, half of your insight goes into the Work.',
    ],
  },
  {
    id: 'm-society',
    title: 'Threads, resolve and Charters',
    body: [
      'Your civilization is made of Threads: Kin (biological people, including any other living species who join you), Echoes (uploaded minds), the Chorus (merged minds), the Lattice (self-maintaining machines that ask for nothing) and Coldminds (minds near absolute zero). Each has its own costs, output and clock.',
      'Every Thread but the Lattice has a standing and a demand, shown in the Threads screen. Meeting demands raises standing; ignoring them lowers it. Resolve is the will to go on: everything you produce scales with it, and if it stays at zero the civilization gives up. Dissent slows work, and a Thread with very low standing may fork away and leave.',
      'Charters are permanent laws bought with accord. Every Thread approves or disapproves of each one. Some are dark: they feed on the dead and the weak, and they bring you closer to the Hunger.',
    ],
  },
  {
    id: 'm-minds',
    title: 'Other minds and the Hunger',
    body: [
      'Messages travel at the speed of light, so news from far away is old when it arrives. The Signals screen holds messages that need an answer, your fellow survivors, and any other minds you have found.',
      'Survivors may ask for aid, offer trades or joint works, send refugees, or raid you. You can help them, take them in, or take their stars from them.',
      'The Slow Ones think on clocks of millions of years; you can only talk to them when your own clock comes close to theirs. The Unlit answer moved masses with moved masses: read their pattern and answer it with a gesture.',
      'The Hunger is a mindless swarm of harvesters. Light and heat draw it. Defend with Defense Grids and warships, hide under the Blackout charter, lure it with decoy beacons, or learn the Command Language and tame it. Taking its ways as your own raises Taint.',
    ],
  },
  {
    id: 'm-crossings',
    title: 'Forecasts and Crossings',
    body: [
      'Forecasts (bottom left, and as pins on the Chronometer) warn you of what is coming and roughly when: stars changing, worlds falling into their dead stars, galactic evaporation, the embers fading, proton decay. Click one to find it on the map; close it with the ×.',
      'The Last Light (end of the Dusk): every star becomes a white dwarf. Prepare starless power (ember collectors, fusion, geothermal), fill your reserve, put Kin into cold sleep.',
      'The Great Decay (end of the Degenerate Age, only if protons decay): every planet and dead star dissolves. Only minds on Leptonic Substrate survive, and they move to the black holes. Research Leptonic Computation and build it in time; Penrose harvesters at black holes will keep you going afterwards.',
      'The Last Horizon (end of the Black Hole Age): the last great black holes evaporate. What is left is your reserve and your Continuity.',
    ],
  },
  {
    id: 'm-endings',
    title: 'Endings',
    body: [
      'Victories come from the Great Works: The Long Thought (Echoes and Coldminds), One Voice (the Chorus), The Quiet Lattice (the Lattice), The Aeon Seed (at the Heart, with the Slow Ones), The Last Garden (living Kin, if protons are stable).',
      'Recurrence: simply still exist when the calendar reaches 10^(10^122) years. The Hunger: become it.',
      'Defeat: Silence (no one left), The Will Fails (resolve at zero for too long), The Fade (Continuity lost in the Dark Era).',
    ],
  },
  {
    id: 'm-controls',
    title: 'Controls',
    body: [
      'Mouse: drag to turn the view, right-drag or two fingers to pan, wheel or pinch to zoom (toward whatever is under the pointer). Click to select. To look inside a star system: double-click it, tap it again on a touchscreen, press Look inside, or simply zoom in on it; zoom out past the edge of a system to return to the galaxy. Click a planet to fly to it: it stays in focus as it orbits (you can still turn, pan and zoom around it) until you pick another world, click the star, or press the whole-system button. Pause (or P) holds every world still in its orbit.',
      'Keys: Enter ends the turn. R research, S settlements, F fleets, T threads, C charters, G signals, L the Record, K the Codex, H home, P pause or play the orbits, Esc closes a window or clears the selection.',
    ],
  },
];
