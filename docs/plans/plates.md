# Plan: painted plates for the events that have none

**Order** (the player, 12 Oct): when Krea has units again, first one Dark track that moves (its
prompt is in DEV-NOTES, "Music tooling"), then these plates, then a second Dark track.

The player, 12 Oct: "do the music and the event plates too", then "go to town". Krea's API had no
units left for images after the music (DEV-NOTES, "Music tooling": how to reach Krea from a
session). This is everything needed to make them when it has.

Spoiler-light, as everything the player may read: the plates below show only what each event's
own text says when it comes. Left on their age's painting on purpose, as before: the Lattice's
events (Is Anyone In There?), the Dark Era's (Forgetting, Atoms Wider Than Galaxies, The False
Vacuum, A Mind From Nowhere), the Hunger's makers (What It Was For), and the abstract ones about
minds (Drift, An Invitation to Merge).

## How

- **Model:** Nano Banana Pro (`google/nano-banana-pro`), `aspect_ratio` 16:9, `resolution` 2K,
  about 111 units each.
- **Style reference:** one graded plate of ours in `image_urls`, from the live site
  (`https://m1omg.github.io/Steliterate/art/...`), the one named for each plate below. Without
  one the result looks like a 3D render (DEV-NOTES, Codex for images).
- **Every prompt** starts "A new painting in exactly the style of the reference image (same
  painterly brushwork, grain, muted palette and mood; do not copy its composition). Scene:" and
  ends "Painterly digital painting, dark and grainy, muted <palette>, soft brushwork, cinematic
  composition. No text, no letters, no signatures."
- **Look at each one** before grading: no letters or legible script, nothing that gives anything
  away, the physics right (a comet's tail away from its sun; an honest black sky, no nebulae
  after η 14).
- **Grade:** save each as `art-src/events/<plate>.png`, add `<plate>: WARM | COLD | VIOLET |
  NEUTRAL` to `GRADE` in `tools/process-art.mjs`, run `node tools/process-art.mjs events`, then set
  `plate: '<plate>'` on the event in `src/game/data/events.ts`.
- **Checks:** the build, the playtest, the browser checks; a plate is display only (no rule, save
  or harness change).

## The plates

| Plate | Event(s) | Reference | Grade | Scene | Palette |
|---|---|---|---|---|---|
| `superflare` | Superflare | `events/comet.webp` | WARM | A tidally locked world under a dim red dwarf, from the twilight terminator: the star throws off a superflare, a white-orange blaze from its edge brighter than the whole star; the thin air glows, green and crimson auroras down to the horizon; rust-stained domes with thin teal light strips, antennas sparking, figures in heavy coats shielding their eyes; frozen ground, long hard shadows | muted reds and ochres, the flare's harsh white |
| `derelict_ark` | A Derelict Ark | `ruins.webp` | NEUTRAL | Between the stars, a vast ancient ark drifting cold and dark, its hull pitted and scarred, older than any species alive; a small probe with a teal light approaching; through a breach, racks of failing cryo berths, one faint light still burning inside | greys and umbers, one cold teal |
| `rust_in_the_belt` | Rust in the Belt | `swarm.webp` | NEUTRAL | An asteroid belt by a dim red sun: asteroids hollowed from the inside, honeycombed shells stained with rust; a haze of fine dark motes drifting away from a small survey craft's searchlight | rust, umber and soot |
| `last_flare` | The Last Flare | `events/first_night.webp` | WARM | A red dwarf at the end of its life, brightened into a fierce blue-white star; on its tidally locked world the day side glows dull orange under a veil of steam as the seas boil; on the night side people file into shelters cut into dark cliffs, teal lights at the doors | blue-white glare against burnt orange and deep shadow |
| `first_contact` | We Are Not Alone | `events/first_upload.webp` | NEUTRAL | A field of listening dishes on a frozen night-side plain under a black sky, all turned toward one faint distant cluster of stars; in a lit control room with teal screens (abstract waveforms only) a few people stand very still | night blues and greys, teal and a warm lamp |
| `embers_dim` | The Embers Dim | `events/unmoored.webp` | COLD | A small white dwarf ember, copper-grey, fading toward black in a starless dark galaxy; a ring of collector panels around it frosting over; far off, other embers going out one by one | cold greys, a last copper glow |
| `proton_detector` | The Proton Question | `events/cast_out.webp` | COLD | Deep underground, a vast cylindrical detector tank lined with thousands of photomultiplier tubes over dark still water; one single tiny flash of light in the middle; tiny technicians on a catwalk with teal lamps | dark gold tubes, black water, one point of white |
| `neutron_warm` | Not for Ever; The Stars That Would Not Cool | `events/supernova.webp` | COLD | An observation station's dish turned toward a neutron star: a tiny point holding a faint, steady violet-white glow in a dead, dark galaxy, where by rights it should have gone cold | black, steel blue, a faint violet-white point |
| `long_flow` | The Long Flow | `events/final_burst.webp` | VIOLET | Everything solid slowly flowing: an ancient ruin on a dark moon slumped into smooth, rounded lumps like old wax; boulders in a belt worn into smooth spheres; all lit faintly by a distant black hole's thin disk | violets and dark greys |
| `horizon_whispers` | Whispers at the Horizon | `events/final_burst.webp` | VIOLET | A black hole with a faint thin ring of light; at its edge a cold, frost-covered collector station with faint teal lights; in the faint glow near the horizon a structured shimmer, too regular to be noise | deep violet, black, a whisper of teal |
| `relic_archive` | An Archive of the Dead | `ruins.webp` | NEUTRAL | A library cut into the bedrock of a barren moon: vast carved halls of stone shelves and tablets covered in abstract weathered carvings (no legible letters); explorers with teal lamps, tiny in the hall | stone greys and dust, teal lamplight |
| `relic_engine` | A Cold Engine | `ruins.webp` | COLD | In a cavern under an ice sheet, an enormous ancient reactor, sealed and dark, its machinery furred with frost; explorers' lamps on the ice | ice blue and black steel |
| `relic_tomb` | A Tomb | `ruins.webp` | NEUTRAL | Rows upon rows of grave markers of a vanished people on a barren world under a black sky, one tall monument in the middle; a dim red sun low on the horizon; a rover's teal light far off | dust, bone and a dull red |
| `relic_ghosts` | Ghosts in the Archive | `ruins.webp` | COLD | Under a world's crust, machines still running: endless halls of archive stacks with faint pulsing lights, and among them thousands of pale figures of light, frozen mid-gesture, paused mid-sentence | cold blue-grey, faint white figures |
| `last_star` | Light in the Halo | `events/new_star.webp` | COLD | In the dark halo of a dead galaxy, a new star burning a soft warm orange-white (4,200 K), the last there will ever be; around it faint dark filaments of unseen matter, outlined only where its light bends; far below, the dead galaxy's embers | black, cold greys, one warm orange-white light |

`neutron_warm` serves both of its events, as `white_fire` serves White Fire and A Helium Giant.
In 1,504 units (the player's figure) there is room for about 13 of these after nothing else.
