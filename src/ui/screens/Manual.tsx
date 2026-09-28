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
      'Pace (bottom right) changes the length of the coming turns. Quick makes them shorter: more decisions while something bright is burning, but each turn collects less energy. Slow makes them longer: more energy per turn, but the universe moves on faster between decisions, and only minds that can slow their own clocks (Echoes, Coldminds) avoid paying for the extra time. Tide is the natural pace of the age. How far you can go either way grows with research (Hibernation Protocols slows, Quickening quickens); letting the Prophet of Stillness’s idea spread lets you slow one step further still.',
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
      'People need room. A world’s natural room for Kin is about 12 × its habitability × its vitality, rounded down (a third of that on a rogue or feeding world), and each planet’s panel shows it as Room for Kin. So a world below about 8% (habitability × vitality) has none, and Kin can live there only in domes. Beyond that, Kin need housing: Habitat Domes hold 3 each (up to 5), Deep Warrens 4 (up to 3), Garden Arks 4. Kin never grow past their room, and if room shrinks below them (a world dying, the Last Light) the extra die, or go into cold sleep under the Cold Sleep Lottery. So you need domes on any world that is not alive, on a living world once you want more Kin than it holds, and everywhere once the living worlds freeze. Echoes live in Substrate Cores, Coldminds in Cold Vaults, the Lattice in Lattice Foundries. Housing costs upkeep only for the share that is lived in.',
      'Living worlds die. Aster is losing its magnetic field (a Magnetic Shield slows that), and once the stars go out every living world freezes within a few turns and becomes an ice world or bare rock, unless you keep it warm with Orbital Lamps or slow it with a Core Stimulator.',
      'Conversions (in the People section): Upload turns a Kin into an Echo, Merge two Echoes into a Chorus, Cool an Echo into a Coldmind. Freeze and Thaw move Kin in and out of cold sleep. Echoes also form by themselves in free substrate (Substrate Cores), about one every five turns while your reserve stays above 15 energy; uploading is the fast way.',
    ],
  },
  {
    id: 'm-expand',
    title: 'Exploring and expanding',
    body: [
      'Stars you can see are on the map; their worlds are unknown until a probe surveys the system. Select a probe (Fleets on the rail) and pick a destination from its Nearby list, or press Move and click a star. A survey charts every world and sometimes turns up something remarkable; a world at least 50% habitable is announced. Ships are eyes too: a ship sees the stars around wherever it is (a probe three times as far as a settlement), and a ship at the edge of the map (nothing uncharted it knows of within 2,000 light-years) takes a long look from each such system and picks out the nearest stars no one has seen (a probe three, any other ship one), even across the gulfs between clusters, so exploring can always go on. Settlements (S) has a second tab, Surveyed worlds (W), listing every charted world with its habitability, room for Kin, temperature and water. Switch it to Systems for one line per star: its best world, its total room for Kin and what was found there.',
      'Settler ships, from any settlement with a Shipyard (the Expand section of the settlement panel, or Build then Ships):',
      'System Lighter: no research needed. Carries one family of Kin and a dome to another world of the same star. Its colonists come from the settlement that builds it.',
      'Seedcore (Mind Substrate): two Echoes and their substrate. Can settle almost anywhere, including the empty orbital space of a dead star.',
      'Kin Ark (Fusion Drives): two Kin and a dome, to any world except a gas giant. Lattice Spore (Autonomous Replicators) and Vault Ship (Cold Computation, Degenerate Age) carry Lattice and Coldminds.',
      'When a settler is ready, its panel lists where it can go (for Kin the most habitable worlds first, for other minds the nearest), with the natural room for Kin ("domes only" means nothing lives there) and the travel time. Launching costs energy; longer trips cost more.',
      'Trip times read like “~26t · 2.9 Myr”: turns at your current pace, then the cosmic time the flight takes. Ships never outrun light (a probe flies at 2% of it), but every turn is longer than the last, so a trip across the Coalescence needs far fewer turns than distance ÷ today’s turn length suggests. Quicken and the same flight takes more, shorter turns; slow down and it takes fewer. Choose on map (in a fleet’s panel or an idle ship’s card) sends a ship to any star you click; the banner shows the trip before you commit, and Esc cancels.',
      'Auto-explore (probes and other survey ships): the ship keeps charting on its own, always heading for the nearest star no one has surveyed and no other ship is bound for. It never takes the last of the reserve (it waits while launching would leave under 20 energy), stops asking for orders, and reports back when nothing is left to chart. Any order by hand, Hold, or Stop exploring ends it.',
      'When a ship runs out of orders, a card asks what next: the nearest unsurveyed stars for a probe, or Fortify for warships. Fortified warships defend their system at double strength and turn raiders away from the capital; Hold parks any other ship. Neither is counted as idle again until you give it new orders.',
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
      'Forecasts (bottom left, and as pins on the Chronometer) warn you of what is coming and roughly when: stars changing, worlds falling into their dead stars, galactic evaporation, the embers fading, proton decay. Click one to find it on the map; close it with the ×. The turn count under each follows the pace you have chosen (hover for the figure at the Tide).',
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
      'Mouse: drag to turn the view, right-drag or two fingers to pan, wheel or pinch to zoom (toward whatever is under the pointer). Click to select. To look inside a star system: double-click it, tap it again on a touchscreen, press Look inside, or simply zoom in on it; zoom out past the edge of a system to return to the galaxy. Click a planet to select it; double-click it (or tap it on a touchscreen) to fly there: it stays in focus as it orbits (you can still turn, pan and zoom around it) until you pick another world, double-click the star, or press the whole-system button. Every system and planet panel lists the system’s worlds: click one to go to it. Double-click a fleet (tap it twice) to follow it the same way, in the galaxy or inside a system; the fleet’s button under the map, or Follow in its panel, lets go. On the map a thin pale ring marks a surveyed system, a green ring (and a green name) one with an unsettled living world, the pulsing ring your own settlements; names in dim italics are stars seen but not yet surveyed. An idle ship’s card names the system it waits in: click the name to centre the view there, or Look inside. Pause (or P) holds every world still in its orbit. Clicking a star on the galaxy map makes it the centre the view turns around; leaving a system brings you back centred on it, and a game always opens centred on your capital. The view button (or V) switches between Natural light, Enhanced (light amplification: dark worlds, night sides and dead stars show their surfaces, and the map keeps every known star visible) and Thermal (false colour by temperature, with a scale; settlements show as warm spots). It changes only what you see.',
      'Keys: Enter ends the turn. R research, S settlements, F fleets, T threads, C charters, G signals, L the Record, K the Codex, W surveyed worlds, H home, P pause or play the orbits, Esc closes a window or clears the selection.',
    ],
  },
];
