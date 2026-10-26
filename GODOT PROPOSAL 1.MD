# Godot proposal 1: Steliterate as a desktop game, with better graphics

**Status:** a proposal (26 Oct 2026), not approved yet. Nothing is implemented.

## Context

The player asked me to check the whole project, then say what converting it to Godot would bring
and which ways of improving it that would open. After the first answer they made the goal plain:
"It runs well on mobile devices rn, forget about those, what I have in mind is turning it into a
full desktop game with better graphics than it has now."

So phones, tablets and the web drop out of the comparison. This proposal answers the question for
that goal and lays out the route. Its first piece shows the new look on the player's own PC before
the rest is committed to.

What I read:
- both handovers: `main`'s of 13 Oct, and `next`'s of 26 Oct, the current one;
- CLAUDE.md, SESSION-NOTES, DEV-NOTES, DESIGN, the CHANGELOG to 26 Oct, and the plans;
- the outline of `docs/REPLICATE.md`.

I surveyed the code of both versions, and checked Godot against its own pages:
- **4.7.2** is the latest stable release (18 Aug 2026);
- **4.8** is in beta, since 15 Oct.

I also checked the session container: it has no GPU, but Godot's .NET build, the .NET SDK and
Mesa's software Vulkan can all be fetched. So screenshots can be rendered there, slowly.

## The short answer

- **Yes:** for a full desktop game with better graphics, Godot is a good fit, and the right engine
  for this project.
  - Desktop-only removes the drawbacks of the first answer: the web build's limits, and no C#.
  - Its desktop renderer (Forward+) gives what the look lacks today: real lights and shadows,
    volumetric glow, particle systems in the hundreds of thousands, HDR output, and a modern
    image pipeline.
  - Its MIT licence suits a GPL-3.0 game; Unity's and Unreal's terms don't mix with the GPL.
  - Its scenes and scripts are text, which suits how this game is built.
- **The costs stay real:**
  - the interface, the 3D views and the films are rebuilt;
  - the simulation is ported to C#;
  - the checks are rebuilt;
  - it takes weeks of sessions.
- **The route:** a staged port.
  1. The look first: a piece the player runs on their PC.
  2. The simulation in C#, proven game for game against today's TypeScript, so seeds, saves and
     the balance record survive.
  3. The interface and the sound.
  4. The films.
  5. The desktop features.
- **The cheaper alternative,** said plainly: wrap today's game as a desktop app (Electron) and
  improve the graphics within three.js. There is no rewrite, but there are fewer built-in effects,
  more is built by hand, and there is no editor. It is the fallback if the first piece
  disappoints.

## Better graphics: what Godot would make possible

These stay within the game's art direction: honest black skies, light sources carrying their own
coronae, bloom only on what is brighter than white, no haze and no lens dirt.

**The galaxy map**
- **Stars as light, not dots:** each star in its true colour and brightness, in HDR, so the few
  bright ones glow and the dim ones barely show.
- **Depth:** many thousands of unresolved stars behind them as GPU particles, with parallax as the
  camera moves.
- **The galaxy's own light** as a faint glowing volume in the Coalescence's shape (core, remnants,
  streams, clusters), fading age by age. Volumetric fog with emission does this: it is starlight,
  not gas.
- **The Heart's black hole** bending the starlight behind it.
- **The Hunger's swarms** as murmurations of thousands of motes, steered by fields (GPU particles
  with attractors).
- **Fleets** as 3D ships with engine glow, not flat sprites.

**A system**
- **Stars:**
  - granulated surfaces with limb darkening, flare loops and real coronae;
  - white dwarfs as hard points of light;
  - neutron stars with sweeping beams;
  - new stars and supernovae as HDR flashes with expanding shells.
- **Worlds:**
  - relief on the surface;
  - air that scatters light (coloured skies along the terminator, the backlit ring), and clouds;
  - glinting seas, ice, lava glowing at night and steam veils;
  - city lights as thin neon strips on the night side.
- **Real shadows,** with the star as a light that casts them: moons eclipsing worlds, rings
  shadowing their planet.
- **Black holes:**
  - the stars behind them lensed, and the photon ring;
  - a volumetric disk, brighter on the side coming toward us (Doppler beaming);
  - only as bright as the game says the disk is in each age.
- **Works in 3D:**
  - habitats;
  - Dyson swarms of tens of thousands of collectors;
  - rubble rings of thousands of rocks, and worlds breaking up;
  - the field lattices after matter as glowing filaments.

**The image**
- **The grade:** HDR glow, AgX tone mapping, each age's grade as a colour lookup table, and grain,
  vignette and edge fringes as a custom effect (a CompositorEffect).
- **Sharp thin orbits:** SMAA, TAA or FSR2.
- **HDR monitors** (Windows, macOS, Linux under Wayland, since 4.7): flares and new stars truly
  bright against real black. That makes the game's theme, the light going out, visible on the
  screen itself.
- **Any screen:** 4K and ultrawide.
- **No stutter:** shaders are compiled ahead (the shader baker, 4.5), so nothing stutters the
  first time it is seen.

**Cinematics**
- The films and the survey reveal become real-time 3D in the game's own galaxy, with camera rails
  and depth of field.
- Movie Maker records them, and trailers, at a fixed frame rate with their sound.

**The interface**
- The worn-instrument look drawn by shaders (grime, scratches, phosphor glow).
- Native chamfered panels (a StyleBoxFlat with corner detail 1).
- Crisp at any size.

## Other ways a desktop game could grow

- **Desktop settings:** resolution, window mode, frame cap and quality tiers; key rebinding;
  controllers and the Steam Deck.
- **Steam,** if wanted: achievements for each age and ending, and cloud saves, through GodotSteam.
  Steam's SDK is proprietary, so the GPL-3.0 game would need a linking exception from its owner.
- **Saves as files,** with the web game's saves imported through Export all saves.
- **Sound:** adaptive music (AudioStreamInteractive: each age's rotation, the Canon as overture),
  and buses carrying the bitcrush and the reverb.
- **Slovak:** the planned translation on gettext, with Slovak plurals and context.
- **Accessibility:**
  - screen readers through AccessKit (experimental on desktop since 4.5);
  - keyboard and controller focus;
  - interface sizes;
  - the magnifier mode rebuilt.
- **Bigger games:** the other civilizations' turns on worker threads, and larger galaxies.
- **Mods:** resource packs loaded at run time.
- **The editor:** the player, or an artist, can shape looks, layouts and films by eye.

## The route I recommend

**Architecture**
- **Engine:** Godot 4.7.2 with .NET (C#); move to 4.8 once it is stable (it needs .NET 10).
- **The simulation as a plain C# library,** with no Godot inside it:
  - the game uses it;
  - the harness and the tests run it with `dotnet` on every core, as `tools/sim.ts` and the unit
    checks run the TypeScript today.
  - TypeScript to C# is a close port.
- **Proven against the TypeScript by a differential harness:** both run the same seeds and their
  states are compared turn by turn. The port is done when 900 games match game for game, or every
  difference left is understood.
  - To match, the C# carries V8's maths routines (fdlibm-derived, BSD-licensed) and JavaScript's
    rounding and number printing (the Record stores printed numbers).
  - It also needs an insertion-ordered map. JavaScript objects keep insertion order even after
    deletes; .NET's `Dictionary` does not promise it.
  - It keeps the same two `localeCompare` tie-breaks.
  - Then seeds stay sacred, the balance record continues, and saves move between the two.
- **Presentation in Godot (C#):** the views, the interface, the sound, the films.
- **The new version is what gets ported:** it is the game going forward. The work branch starts
  from `next`.
- **Considered and not chosen:**
  - **GDScript for the simulation:** about 4× slower than C# by Godot's own docs, the harness
    would take hours, and matching V8's maths is harder.
  - **Keeping the TypeScript inside Godot through GodotJS** (V8 embedded): its own page calls it
    "essentially usable but still under testing", and it means custom engine builds. It is a
    fallback if the port stalls.
  - **A Node process beside Godot:** the interface calls into 41 simulation modules, which would
    all have to cross between two processes.

**Phases**
0. **Groundwork:**
   - a setup script for each fresh container (Godot .NET, the .NET SDK, Mesa's software Vulkan);
   - the `desktop/` Godot project, and the `desktop/sim/` library;
   - a GitHub Actions workflow building Windows and Linux versions for download.
   - The music and art stay where they are and are copied in at build time, never duplicated in
     Git.
1. **The look.** It reads saves the TypeScript game writes (one seed at each age):
   - the galaxy map, with the same camera controls;
   - one system view: a red dwarf's worlds of several kinds, a white dwarf, a black hole;
   - the image pipeline.

   Screenshots are rendered in the container, and a Windows build goes to the player. Their
   verdict on their PC sets the art direction, and decides whether to go on.
2. **The simulation in C#:**
   - generation first (900 seeds' galaxies identical);
   - then the turn, the autoplayer and the harness;
   - the unit checks ported, and every save version importable.
3. **The interface and the sound:**
   - the HUD, the panels and windows, the Codex and Manual, the events and the guide;
   - the keyboard, the magnifier mode, the interface sizes and the tooltips;
   - the recordings and adaptive music; the synth pre-rendered or generated.
4. **Films and the survey reveal** as 3D cinematics; trailers through Movie Maker.
5. **Desktop features:**
   - settings, rebinding and controllers;
   - the Slovak translation and mods;
   - Steam if wanted;
   - Windows, Linux and macOS builds.

**What stays as it is:**
- **During the port:** the web game (today's, and `/next/`) is unchanged and live, with its saves,
  and the friend keeps using it. A rule changed meanwhile is changed in both.
- **Afterwards:** the player decides whether the web game is frozen or kept in step.

## Costs and risks

1. **The presentation is rebuilt:**
   - the interface, 0.66 MB with 266 tooltips;
   - the views, 0.23 MB with their shaders (the shader maths carries over: Godot's shader language
     is close to GLSL);
   - the films, 0.40 MB;
   - the synth.

   This is the largest part of the work. The 42,000 words of text are reused as they are.
2. **The checks:**
   - the 92 unit checks are ported to C# tests;
   - the 67 browser checks become Godot scene tests (GdUnit4), rebuilt phase by phase;
   - the 30/144 Hz parity check runs again through Godot's fixed frame rate;
   - the differential harness becomes the backbone.
3. **The container:** every session runs the setup script first, and screenshots render in
   software, slowly. So the real look and the frame rate can only be judged on the player's PC:
   expect more rounds of "here is a build, how does it look and run?".
4. **Weak machines:** the 2017 MacBook Air would likely need the Compatibility renderer, a lower
   tier without the volumetric and compute effects.
5. **Time:** weeks of sessions, with the Slovak translation, the music and the open offers slowed
   meanwhile.

## The cheaper alternative, for comparison

Today's game in an Electron window (its own Chromium) is a desktop app, ready for Steam, in a few
sessions.
- **Graphics:** improved inside three.js through its WebGPU renderer: compute particles, its node
  materials, its post effects.
- **It keeps everything:** one codebase, the checks, the seeds, the saves, the web version.
- **But:**
  - all 740 lines of custom shaders are rewritten in three.js's node language;
  - volumetrics, particle systems, lights and shadows are built by hand;
  - there is no editor.

I would choose this route if phase 1 shows Godot's look isn't worth the rewrite.

## First steps, once approved

1. Start the work branch from `origin/next`. Nothing goes into `main` or `next` until the player
   says, and the live games don't change.
2. Add a dated entry to SESSION-NOTES: the decision, in the player's words.
3. Phase 0:
   - `tools/desktop/setup.sh`;
   - the `desktop/` Godot .NET project and the `desktop/sim/` library skeleton (the state's types
     and the save reader);
   - `.github/workflows/desktop.yml`, building Windows and Linux on pushes to the work branch.
4. Begin phase 1:
   - a TypeScript script writes the slice's saves;
   - the galaxy map renders in Godot from them;
   - screenshots go to the player as soon as it does, then a system view follows.

   The rest of phase 1 may take another session or two.
5. Commit and push to the work branch as each step works.

## How the first piece is checked

- `dotnet build` and Godot's headless import and build are clean, with no script errors.
- The slice draws the same galaxy as the web game from the same save: star positions, kinds and
  colours, shown side by side with the web game's map.
- The camera eases the same at 30 and 144 frames a second (Godot's `--fixed-fps`).
- The Actions workflow produces a Windows build that starts; the player runs it on their PC and
  says how it looks and runs.
- The web game is untouched: `git diff origin/next --stat` lists only `desktop/`, `tools/desktop/`,
  `docs/` and `.github/workflows/desktop.yml`, and the Pages workflow doesn't run on the branch.

## Sources

- Godot download archive (versions and dates): https://godotengine.org/download/archive/
- Godot 4.8 beta 1 (.NET 10, AO, contact shadows): https://godotengine.org/article/dev-snapshot-godot-4-8-beta-1/
- Godot 4.7 release (HDR output): https://godotengine.org/releases/4.7/
- Godot 4.6 release (glow before tonemapping, AgX): https://godotengine.org/releases/4.6/
- Godot 4.5 release (shader baker, SMAA, screen readers): https://godotengine.org/releases/4.5/
- Volumetric fog, Forward+ only: https://docs.godotengine.org/en/4.7/tutorials/3d/volumetric_fog.html
- Particle attractors: https://docs.godotengine.org/en/stable/classes/class_gpuparticlesattractorvectorfield3d.html
- CompositorEffect: https://docs.godotengine.org/en/stable/classes/class_compositoreffect.html
- Movie Maker: https://docs.godotengine.org/en/stable/tutorials/animation/creating_movies.html
- StyleBoxFlat (chamfered corners): https://docs.godotengine.org/en/stable/classes/class_styleboxflat.html
- AudioStreamInteractive: https://docs.godotengine.org/en/stable/classes/class_audiostreaminteractive.html
- Godot's maths uses the platform's C library: https://github.com/godotengine/godot/blob/master/core/math/math_funcs.h
- GDScript and C# speed: https://forum.godotengine.org/t/state-of-gdscript-vs-c-performance-in-godot-4-0/5875
- GodotJS ("essentially usable but still under testing"): https://godotjs.github.io/
- .NET's OrderedDictionary: https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ordereddictionary-2
- three.js and WebGPU: https://www.utsubo.com/blog/webgpu-threejs-migration-guide
