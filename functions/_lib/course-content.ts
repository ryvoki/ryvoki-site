/**
 * The Mythic course. Videos are filled in by Ryvoki as they are recorded: set `video` to a YouTube (unlisted) or
 * Cloudflare Stream embed URL. Reading and homework are shown to students regardless, so the course works from day one.
 */

export interface Lesson {
  id: string;
  module: number;
  title: string;
  minutes: number;
  video: string | null;
  summary: string;
  reading: string;        // HTML
  keyPoints: string[];
  homework: { title: string; steps: string[]; target: string };
  platformNotes?: { pc?: string; mobile?: string };
}

export interface Module {
  number: number;
  title: string;
  tagline: string;
  image: string;
}

export const MODULES: Module[] = [
  { number: 0, title: "Setup & Foundations", tagline: "Make the game feel right before you try to get good at it.", image: "/assets/img/course/module-00.png" },
  { number: 1, title: "Aim", tagline: "Crosshair placement, tracking, recoil, and a routine that sticks.", image: "/assets/img/course/module-01.png" },
  { number: 2, title: "Movement", tagline: "Stop dying in the open. Peek, slide, reposition on purpose.", image: "/assets/img/course/module-02.png" },
  { number: 3, title: "Game Sense", tagline: "Zone, rotations, sound, and knowing which fights are free.", image: "/assets/img/course/module-03.png" },
  { number: 4, title: "Loadouts & Loot", tagline: "Kits that win at your rank and a loot path that doesn't get you killed.", image: "/assets/img/course/module-04.png" },
  { number: 5, title: "Ranked Strategy", tagline: "How RP actually works and how to play for it.", image: "/assets/img/course/module-05.png" },
  { number: 6, title: "Mental Game & Review", tagline: "Consistency, tilt, and reviewing your own games like a coach.", image: "/assets/img/course/module-06.png" },
  { number: 7, title: "The Mythic Push", tagline: "Putting it together for the final climb, then your 1-on-1.", image: "/assets/img/course/module-07.png" },
];

export const LESSONS: Lesson[] = [
  // ---------------------------------------------------------------- Module 0
  {
    id: "0-1", module: 0, title: "How this course works and what 'Mythic' really takes", minutes: 8, video: null,
    summary: "The plan, the promise, and the one habit that separates people who climb from people who grind.",
    reading: `
<p>Most players who are stuck are not stuck because of one big thing. They are stuck because five small things each cost them one fight a game. This course fixes those small things in order, from the ones that pay off fastest to the ones that only matter once the basics are automatic.</p>
<p>Here is the deal. Every lesson has three parts: a short video, a reading you can skim in two minutes, and homework. The homework is the course. Watching videos changes nothing; doing the drills in real ranked games is what moves your rank. Your plan on the dashboard tells you how many lessons a week to do based on how often you said you'd train. Stick to that pace and you'll finish on the date it shows.</p>
<h3>The one habit</h3>
<p>After every ranked game, before you queue again, answer one question: <strong>what got me killed?</strong> Not "the enemy had a better gun". Something you controlled: "I peeked with no cover", "I pushed a fight while a third squad was audible", "I stopped moving to reload". One sentence. That's it. Players who do this improve two to three times faster than players who queue instantly, because they stop repeating the same death.</p>
<h3>What Mythic actually takes</h3>
<p>You don't need insane aim. You need to lose fewer <em>free</em> fights, take fewer <em>bad</em> fights, and survive longer in games where you are not the best player in the lobby. Placement RP rewards survival heavily; a game where you place top 3 with two kills is worth more than a ten-kill game where you die in the first zone collapse. The whole course is built around that math.</p>`,
    keyPoints: ["Do the homework inside real ranked games, not just in training mode.", "One sentence after every death: what did I control?", "Placement pays. Survival is a skill you can train."],
    homework: { title: "Start your death log", steps: ["Play 5 ranked games.", "After each one, write one sentence: what got me killed and what I controlled about it.", "Keep it in your phone notes or a Discord DM to yourself. You'll use this for the whole course."], target: "5 games, 5 sentences" },
  },
  {
    id: "0-2", module: 0, title: "Settings that stop fighting you", minutes: 12, video: null,
    summary: "Sensitivity, ADS, FPS, and the settings that quietly make you miss.",
    reading: `
<p>Before any aim practice, your settings need to stop working against you. Two rules: <strong>lock it, then leave it</strong>. Changing sensitivity every week guarantees you never build muscle memory.</p>
<h3>Frame rate first</h3>
<p>Set the highest stable frame rate your device holds without heating up and stuttering after twenty minutes. A locked 60 that never dips beats a 90 that drops to 40 in fights. Lower graphics quality is fine; visibility settings that make enemies pop matter more than shadows.</p>
<h3>Sensitivity</h3>
<p>Find a general sensitivity where a 180-degree turn is one comfortable full swipe or mouse movement with no lift. Then set ADS sensitivity slightly lower than hip so tracking at range is smooth. Test it with the tracking drill in Module 1 for three days before you judge it. If you overshoot targets, go down a notch. If you can't keep up with strafing enemies, go up a notch. Then stop touching it.</p>
<h3>Layout and gyro</h3>
<p>On touch: your fire button should sit where your thumb rests naturally with no reach, and slide/crouch and jump must be reachable without lifting your aiming finger. Three or four fingers is a real advantage for aiming while moving; if you're on two, this course still works, but plan to learn a third finger over the next few weeks. If your device has gyro, use it for fine tracking with a low gyro sensitivity; it is the closest thing to a mouse you have.</p>
<h3>Audio</h3>
<p>Headphones, not speakers. Turn music off and voice chat down so footsteps and gunfire direction are the loudest things you hear. Module 3 leans hard on sound.</p>`,
    keyPoints: ["Stable FPS over high FPS.", "Set sensitivity once, test for three days, then leave it.", "Headphones on, music off. Sound is information."],
    homework: { title: "Lock your setup", steps: ["Set FPS to the highest stable value and lower graphics until it never dips.", "Set a general sensitivity where a 180 is one comfortable movement. Set ADS a little lower.", "Play 3 games without changing anything. Note in your log whether you overshoot or undershoot."], target: "3 games, settings unchanged" },
    platformNotes: { pc: "Uncap FPS only if your monitor refresh rate can use it. Turn off mouse acceleration in Windows. Use raw input if the option exists.", mobile: "Turn on performance mode if your phone has it and close background apps. A cheap phone stand or grips help more than you'd think." },
  },
  // ---------------------------------------------------------------- Module 1
  {
    id: "1-1", module: 1, title: "Crosshair placement: win the fight before it starts", minutes: 10, video: null,
    summary: "Where your crosshair sits while nothing is happening decides most fights.",
    reading: `
<p>Watch a Mythic player and a Gold player walk through the same building. The Mythic player's crosshair is always at head height, resting on the next corner an enemy could appear from. The Gold player's crosshair is on the floor, the sky, or the middle of a wall. When an enemy appears, one of them needs to move the crosshair 2 centimetres, the other needs 20. That is the whole difference in most fights.</p>
<h3>The rule</h3>
<p><strong>Head height, on the corner, at the distance you expect the enemy.</strong> Pre-aim every doorway, every rock edge, every ridgeline as you approach it. When you clear a corner, your crosshair should already be where a head would be.</p>
<h3>Common mistakes</h3>
<ul>
<li>Looking at the ground while looting or moving. Loot with your crosshair up; glance down only for a second.</li>
<li>Aiming at the wall right next to the corner instead of the space an enemy would step into.</li>
<li>Crosshair at chest height. Headshot damage is the fastest way to win a fight you'd otherwise lose on raw aim.</li>
</ul>
<h3>Why it beats aim training</h3>
<p>Aim trainers improve reaction speed by a few percent over months. Crosshair placement removes the need to react at all. Do this lesson's homework properly and most players win noticeably more close fights within a week.</p>`,
    keyPoints: ["Crosshair at head height on the next corner, always.", "Loot and move with your crosshair up.", "Placement removes the reaction; that's why it beats raw aim."],
    homework: { title: "Corner discipline", steps: ["Play 5 games where your only goal is crosshair placement. Kills don't matter.", "Every corner, pre-aim head height before you peek it.", "After each game, note how many fights you won because you were already on target."], target: "5 games focused only on placement" },
  },
  {
    id: "1-2", module: 1, title: "Tracking, flicking and recoil: the 15-minute routine", minutes: 14, video: null,
    summary: "The only aim routine you need, and how to know it's working.",
    reading: `
<p>There are three aim skills in Blood Strike: <strong>tracking</strong> (staying on a moving target), <strong>flicking</strong> (snapping to a target you weren't on), and <strong>recoil control</strong> (keeping a spray on target). Most damage in this game is tracking and recoil, so that's where the routine spends its time.</p>
<h3>The routine (15 minutes, training mode or a private match)</h3>
<ol>
<li><strong>Tracking, 6 minutes.</strong> Follow a moving bot or a teammate strafing side to side at 15 to 25 metres. Hip and ADS. Your crosshair stays on the upper chest the whole time; smooth, not jerky.</li>
<li><strong>Recoil, 5 minutes.</strong> Spray your main gun at a wall at 20 metres, then at 35. Learn the pull pattern for the first 10 to 15 bullets. Pull down and slightly against the drift until the spray forms a tight group.</li>
<li><strong>Flicks, 4 minutes.</strong> Look away, snap to a target, tap fire, look away. Speed comes from confidence, not tension. Relax your hand.</li>
</ol>
<h3>How to know it's working</h3>
<p>Don't measure by feel. Measure by fights: are you winning more of the fights where you shoot first? Are you finishing sprays instead of panicking and stopping? Those two numbers in your death log are your progress bar.</p>
<h3>The mistake everyone makes</h3>
<p>Aiming faster than they can aim accurately. Slow down until every shot lands, then let speed come back naturally. Accuracy first, speed second, always.</p>`,
    keyPoints: ["15 minutes: tracking, recoil, flicks, in that order.", "Accuracy first, speed comes back on its own.", "Measure progress by fights won, not by feel."],
    homework: { title: "The routine, daily", steps: ["Do the 15-minute routine before your first ranked game on every training day this week.", "Use the same gun you use in ranked.", "In ranked, note every fight where you stopped shooting early or missed a spray. That's what next week's routine works on."], target: "Routine on every training day for one week" },
    platformNotes: { mobile: "Do the tracking drill with gyro if you have it. Keep the phone steady with your grips or stand; gyro is a fine-adjust tool, not a big-swing tool.", pc: "Add a 3-minute warm-up in an aim trainer if you like, but the in-game routine is what transfers." },
  },
  // ---------------------------------------------------------------- Module 2
  {
    id: "2-1", module: 2, title: "Cover, peeking and never standing still", minutes: 11, video: null,
    summary: "Most deaths are position errors dressed up as aim errors.",
    reading: `
<p>Go back through your death log. Count how many deaths happened while you were standing still, in the open, or reloading in the open. For most players below Master it is more than half. That is a movement problem, and movement problems are the fastest to fix because they are decisions, not reflexes.</p>
<h3>Three rules</h3>
<ol>
<li><strong>Never stop.</strong> Reload behind cover. Heal behind cover. Loot in short bursts. If you must stand still, you must be behind something.</li>
<li><strong>Peek, don't hold.</strong> Step out, shoot, step back. Holding an angle is for the player with the better position. If that's not you, re-peek from a slightly different spot so their crosshair placement is wasted.</li>
<li><strong>Cover between every move.</strong> Before you leave cover, know the next piece of cover and how long it takes to reach. If it's more than a slide away, wait or find another route.</li>
</ol>
<h3>Slides and jumps</h3>
<p>Slide into cover, not out of it. Jump-shots and slide-shots make you harder to hit at close range, but they also make <em>you</em> miss; use them to cross gaps and to break a bad fight, not for every duel. At range, strafing left-right while ADS is the movement that wins.</p>
<h3>Repositioning during a fight</h3>
<p>If a fight lasts more than one exchange, move. The enemy has your position memorised. A ten-metre shift to a new angle resets the fight in your favour, especially against players who hold angles.</p>`,
    keyPoints: ["Reload and heal behind cover, every time.", "Peek and re-peek from new spots; don't hold angles you don't own.", "Know your next cover before you leave this one."],
    homework: { title: "Zero open-field deaths", steps: ["Play 5 games. Goal: no deaths while standing still or in the open.", "Every reload and every heal happens behind cover.", "Count the open-field deaths in your log. Under 1 per game is the target."], target: "Under 1 open-field death per game" },
  },
  {
    id: "2-2", module: 2, title: "Fighting in buildings and on high ground", minutes: 12, video: null,
    summary: "Where to stand inside, how to take a building, and why high ground keeps winning.",
    reading: `
<p>Buildings are where most mid-game fights happen and where most rank is lost. Two situations: you're inside and they're coming, or they're inside and you want in.</p>
<h3>Holding a building</h3>
<p>Don't sit on the door. Sit off-angle where anyone entering has to turn to find you, with your crosshair on the entry at head height (Module 1). Stairs are your best friend: whoever is at the top wins almost every stair fight. Use a throwable to punish anyone stacking at the door.</p>
<h3>Taking a building</h3>
<p>Never enter through the door they're watching. Use a second entrance, break a window, or take the roof. Throw something first: a grenade or flash makes them move, and moving targets make noise. If you don't have a throwable, don't take the building, take the position that lets you shoot whoever leaves.</p>
<h3>High ground</h3>
<p>Height gives you head-only peeks, better cover, and sight lines the enemy can't match. In the late game, being higher than the zone edge you're rotating toward is worth more than any gun. If someone is above you, don't fight them; leave the line of sight and re-engage from elsewhere.</p>`,
    keyPoints: ["Off-angle inside, never on the door.", "Enter through the entrance they aren't watching, and throw first.", "Below someone? Leave, don't fight."],
    homework: { title: "Building rules", steps: ["In 5 games, take at least two buildings using a second entrance or a throwable first.", "Never fight upward. Every time you're below someone, disengage and note it.", "Log how the building fights went compared to last week."], target: "5 games, no fights taken from below" },
  },
  // ---------------------------------------------------------------- Module 3
  {
    id: "3-1", module: 3, title: "Zone, rotations and being early", minutes: 13, video: null,
    summary: "The players who survive are the ones who are already where the zone is going.",
    reading: `
<p>Late rotations are the single biggest source of avoidable deaths in ranked. You rotate late, you cross open ground while everyone who rotated early is already set up looking at the exact ground you're crossing. It looks like you got outgunned. You didn't. You were late.</p>
<h3>The timing rule</h3>
<p>Move when the next zone is revealed, not when the current one starts closing. Use the closing time to pick your route through cover, arrive early, and take the position that everyone else will be running into.</p>
<h3>Route choice</h3>
<ul>
<li>Edge of zone first, then centre. The edge lets you keep the outside safe and only watch inward.</li>
<li>Cover to cover, never the straight line. Straight lines through open ground are where third parties farm kills.</li>
<li>Vehicles for distance, never for the last 200 metres. Ditch it early and walk in quietly.</li>
</ul>
<h3>Reading the zone</h3>
<p>Ask: where will the next zone force people to walk? Set up looking at that with cover behind you. You stop being the one who gets caught crossing and start being the one who catches.</p>`,
    keyPoints: ["Move when the next zone appears, not when the current one closes.", "Edge first, then inward. Cover to cover.", "Set up where people will be forced to walk."],
    homework: { title: "Early every time", steps: ["5 games. Start every rotation the moment the next zone shows.", "Take the edge-of-zone position and watch inward.", "Log every death caused by being late. Zero is the target."], target: "Zero late-rotation deaths in 5 games" },
  },
  {
    id: "3-2", module: 3, title: "Sound, third parties and free fights", minutes: 11, video: null,
    summary: "Turn audio into a map, and stop losing your fights to the squad you didn't see.",
    reading: `
<p>Every gunfight makes noise, and every fight you hear is information: at least one squad is busy, and at least one squad is about to be weak. Mythic players treat gunfire like a menu. Golds treat it like a dinner bell and run in with no plan.</p>
<h3>Sound as a map</h3>
<p>Footsteps tell you distance and direction. Gunfire tells you how many squads and roughly how the fight is going (one gun stops firing: someone just died or is reloading). Vehicles tell you a squad is rotating. With headphones on and music off (Module 0), you can build a picture of the area without ever seeing anyone.</p>
<h3>The third-party rule</h3>
<p>Only enter a fight you heard if you can arrive when it <em>ends</em>, from a side neither squad is watching, and with an exit behind you. If you arrive during the fight, you become the third target for two squads. If you can't get there in time, hold position and let them come to you damaged.</p>
<h3>Free fights</h3>
<p>A free fight is one where you have height, cover, numbers, or surprise, and they have none of those. Take free fights every time; they're how you build kills without risk. Anything else, ask: what do I gain if I win, and where am I if I lose?</p>`,
    keyPoints: ["Gunfire is information: who's busy, who's about to be weak.", "Arrive when the fight ends, from an unwatched side, with an exit.", "Take every free fight. Question every other one."],
    homework: { title: "Third-party discipline", steps: ["5 games. Never enter a fight you heard until at least one side has clearly won.", "Before each fight, say out loud what you gain if you win and where you are if you lose.", "Count fights taken with an advantage vs without. Aim for 3 to 1."], target: "3 advantaged fights for every 1 coin-flip" },
  },
  // ---------------------------------------------------------------- Module 4
  {
    id: "4-1", module: 4, title: "Loadouts that win at your rank", minutes: 10, video: null,
    summary: "Pick a kit for what you're bad at, not for what looks strong on a tier list.",
    reading: `
<p>Tier lists change every patch. Your weaknesses don't. Build your kit around covering them.</p>
<h3>Two-gun rule</h3>
<p>One gun for close range that forgives movement (an SMG or fast-handling rifle), one for mid range that rewards the tracking you're training (a controllable AR or a marksman rifle). If your aim confidence is under 6, choose forgiving weapons: high magazine size, low recoil, fast ADS. Damage per bullet matters less than bullets that hit.</p>
<h3>Attachments in order of importance</h3>
<ol>
<li>Recoil control (grip, barrel, compensator). Makes Module 1's routine pay off.</li>
<li>ADS speed. Faster ADS wins more close peeks than more damage does.</li>
<li>Magazine size. Reloading in a fight is a death sentence at low ranks.</li>
<li>Scope last. Use the lowest magnification you can track with.</li>
</ol>
<h3>Strikers and abilities</h3>
<p>Choose one striker and learn it fully. Mobility or information abilities are safer than pure damage for climbing, because they get you out of the bad fights this course keeps telling you to avoid. Switching strikers every session resets your learning.</p>
<p><em>Ryvoki fills in his current recommended kits per rank in the video for this lesson, since those change with patches.</em></p>`,
    keyPoints: ["Two guns: forgiving close, controllable mid.", "Attachments: recoil, ADS speed, magazine, then scope.", "One striker, learned fully. Mobility beats damage for climbing."],
    homework: { title: "Commit to a kit", steps: ["Pick your two guns and one striker and use only them for 5 games.", "Set attachments in the priority order above.", "Log which fights you lost because of the kit vs because of a mistake. Almost all will be mistakes, which is the point."], target: "5 games on one fixed kit" },
  },
  {
    id: "4-2", module: 4, title: "Loot paths and the first two minutes", minutes: 9, video: null,
    summary: "Where you land and how you loot decides whether you're in the game at all.",
    reading: `
<p>Dying in the first two minutes is not bad luck. It is a landing choice. For climbing, your drop should give you a full kit in ninety seconds with at most one squad nearby, and a clear route toward the centre of the map.</p>
<h3>Pick two drops, not one</h3>
<p>One for when the plane path lets you land uncontested, one fallback for when it doesn't. Know both well enough to loot them with your eyes up (Module 1). Hot-dropping is for content, not for RP.</p>
<h3>Loot order</h3>
<ol>
<li>Any gun and ammo. Seconds matter.</li>
<li>Armour and a helmet. The first fight is won by whoever has plates.</li>
<li>Heals. Enough to fight twice.</li>
<li>Your preferred guns and attachments. Now you're allowed to be picky.</li>
</ol>
<h3>Leave on time</h3>
<p>Full kit, out. Looting past that is how you end up last to rotate (Module 3). If a squad lands near you and you have armour and a gun first, that's a free fight. If you don't, leave quietly and let them loot into your crosshair later.</p>`,
    keyPoints: ["Two drops: a main and a fallback. Never hot-drop for RP.", "Gun, armour, heals, then preferences.", "Full kit means leave. Over-looting makes you late."],
    homework: { title: "Ninety-second kit", steps: ["Choose your two drops and use only them for 5 games.", "Time yourself: full kit and moving within two minutes.", "Log any early death and what you'd change about the landing."], target: "0 early deaths in 5 games" },
  },
  // ---------------------------------------------------------------- Module 5
  {
    id: "5-1", module: 5, title: "How RP works and how to play for it", minutes: 12, video: null,
    summary: "The scoring rewards survival. Play the game the scoring rewards.",
    reading: `
<p>Ranked points come from two things: how long you survive (placement) and what you do on the way (kills, assists, damage). The exact numbers shift by season, but the shape never changes: <strong>placement is the floor, kills are the bonus</strong>. A player who consistently places top 5 with two kills climbs faster than a player who alternates 8-kill games with early deaths.</p>
<h3>The maths in plain words</h3>
<p>An early death costs you the entry fee and gives you almost nothing back. A quiet top-5 more than pays the fee. So the first goal of every ranked game is <em>don't be in the bottom half</em>. Once you're past the halfway point, fights start being worth taking, because even a loss now has placement RP behind it.</p>
<h3>The game plan by phase</h3>
<ul>
<li><strong>Drop and loot (0 to 3 min):</strong> uncontested drop, full kit, leave. No fights unless free.</li>
<li><strong>Mid game:</strong> rotate early, take free fights only, farm safe kills off third parties.</li>
<li><strong>Top 10:</strong> position over everything. High ground, cover, edge of zone.</li>
<li><strong>Top 3:</strong> now you fight. You've banked the placement; the kills are pure profit.</li>
</ul>
<h3>Solo, duo, squad</h3>
<p>Solo rewards patience most. Squads reward communication and playing together; a squad that stays within thirty metres of each other wins most engagements by numbers alone. If you queue with randoms, be the one who calls the rotation early. Someone has to.</p>`,
    keyPoints: ["Placement is the floor, kills are the bonus.", "First goal every game: don't finish in the bottom half.", "Top 3 is when you fight. Before that, fight only when it's free."],
    homework: { title: "Placement-first week", steps: ["10 ranked games played by phase: loot, rotate early, free fights only, fight in top 3.", "Track your placement each game. Target: average top 8.", "Note your RP at the start and end of the week."], target: "Average top-8 placement across 10 games" },
  },
  {
    id: "5-2", module: 5, title: "Endgame: the last three zones", minutes: 11, video: null,
    summary: "Where games are won. Slow down, get high, let them come.",
    reading: `
<p>By the last three zones, everyone alive can shoot. What separates the winner is position and patience. Your goals in order: be high, be on the edge with the outside safe, have cover in the direction the zone will push people, and have heals in hand.</p>
<h3>Don't be first to move</h3>
<p>When the zone closes, the squads at the far edge have to cross. Let them. The player who moves first through open ground in the final circles is almost always the one who dies. If you must move, move with the zone edge at your back and use the moment other squads are fighting.</p>
<h3>Use everything</h3>
<p>Throwables are for the endgame. Force a squad out of cover with a grenade; a smoke buys a rotation; a flash breaks a hold. Most players die with a full inventory of tools. Ability cooldowns should be ready going into the final circles; don't waste them on a mid-game rotation.</p>
<h3>The final fight</h3>
<p>Play for the last squad to be damaged. If two squads are left besides you, wait. If one is left, make them come to you: hold high ground and cover, and only push when they're healing or reloading (you'll hear it, Module 3).</p>`,
    keyPoints: ["High, edge, cover facing where the zone pushes people, heals ready.", "Never be the first to cross open ground in the final circles.", "Throwables and abilities are endgame tools. Have them ready."],
    homework: { title: "Endgame patience", steps: ["In every game you reach top 10, do not move first. Let a squad cross before you commit.", "Enter the last three zones with at least two throwables and abilities off cooldown.", "Log each top-10 game: did you move first, and did it get you killed?"], target: "3 top-3 finishes this week" },
  },
  // ---------------------------------------------------------------- Module 6
  {
    id: "6-1", module: 6, title: "Consistency: the routine that stops the terrible games", minutes: 9, video: null,
    summary: "Good players are not more talented on their good days. They have fewer bad days.",
    reading: `
<p>You know the pattern: three great games, then a run of deaths that undoes all of it. That run is almost never about skill. It's warm-up, tilt, fatigue, or queuing when you shouldn't. Fix the routine and the bad games mostly disappear.</p>
<h3>Before you queue</h3>
<ol>
<li>15-minute aim routine (Module 1). No exceptions on ranked days.</li>
<li>One unranked or casual game to wake up your movement.</li>
<li>Read the last three lines of your death log. You're about to make the same mistake again; don't.</li>
</ol>
<h3>The two-loss rule</h3>
<p>Two early deaths in a row, you stop. Ten minutes off, water, walk. Your third game after two bad ones is statistically the worst game you'll play all day. Climbing is mostly about not giving RP back.</p>
<h3>Session length</h3>
<p>Ranked in blocks of three to five games. After a block, a short break. Long sessions feel productive and cost RP at the end. If you only have thirty minutes, do the routine and two games, not zero routine and four games.</p>`,
    keyPoints: ["Routine, then one warm-up game, then ranked.", "Two early deaths in a row: stop for ten minutes.", "Blocks of 3 to 5 games. Long sessions give RP back."],
    homework: { title: "Routine week", steps: ["Every ranked session this week starts with the routine and a warm-up game.", "Apply the two-loss rule strictly.", "Log your RP change per session. Watch the bad sessions shrink."], target: "No session with a net RP loss" },
  },
  {
    id: "6-2", module: 6, title: "Review your own games like a coach", minutes: 12, video: null,
    summary: "A ten-minute review method that finds the leak you're blind to.",
    reading: `
<p>Nobody sees their own mistakes in real time. Recording and reviewing is how you see them afterwards. You don't need to review every game. One game a week, done properly, is enough.</p>
<h3>Record</h3>
<p>Use the built-in screen recorder on your device or any free capture tool on PC. Record a full ranked game where you died in a way that annoyed you. Annoying deaths are the useful ones.</p>
<h3>The ten-minute method</h3>
<ol>
<li>Skip to thirty seconds before each death.</li>
<li>Pause every five seconds and ask: what does the enemy know about me right now? Where is my crosshair? Where is my cover?</li>
<li>Find the first moment the death became likely. It is usually 10 to 20 seconds before the actual death, and it's usually a position or a decision, not the gunfight.</li>
<li>Write one sentence: the fix for that moment.</li>
</ol>
<h3>Bring it to the 1-on-1</h3>
<p>When you finish the course you'll book a call with Ryvoki. Bring a recorded game and your death log. He'll do this review with you live and give you a personal fix-list. Students who bring footage get three times more out of that call.</p>`,
    keyPoints: ["Review one annoying game a week, not every game.", "The death starts 10 to 20 seconds before the death.", "Bring a recording to your 1-on-1."],
    homework: { title: "First self-review", steps: ["Record one ranked game this week.", "Do the ten-minute review on every death in it.", "Write the fix for each. Keep the recording; you'll use it on the call."], target: "One full game reviewed, fixes written" },
  },
  // ---------------------------------------------------------------- Module 7
  {
    id: "7-1", module: 7, title: "The Mythic push plan", minutes: 10, video: null,
    summary: "Putting all of it together for the climb, one rank at a time.",
    reading: `
<p>Everything before this was skills. This is the campaign. Climbing works in blocks: pick the next rank, play placement-first until you're there, then bank it and repeat. Don't think about Mythic while you're in Platinum. Think about Diamond.</p>
<h3>Your weekly climb block</h3>
<ul>
<li><strong>Training days:</strong> routine, warm-up, 3 to 5 ranked games by phase, two-loss rule, death log.</li>
<li><strong>Review day:</strong> one recorded game, ten-minute method, update your fix list.</li>
<li><strong>Off day:</strong> at least one a week. Rank goes up more on rested days.</li>
</ul>
<h3>When you plateau</h3>
<p>Every player stalls somewhere. When your RP flatlines for a week, go back to the module that matches your most common death in the log. Nine times out of ten it's rotation timing or fight selection, not aim. Redo that lesson's homework for a week.</p>
<h3>The last stretch</h3>
<p>Legend to Mythic is about consistency, not highlights. Your average placement matters more than your best game. Play the phases, take free fights, and let the maths do the rest.</p>
<h3>Then book the call</h3>
<p>Once every lesson is ticked off, the dashboard unlocks the 1-on-1 booking. Bring your death log and one recording. That call is where the personal plan happens.</p>`,
    keyPoints: ["Climb one rank at a time. Bank it, repeat.", "Plateau? Go back to the module that matches your most common death.", "Finish the lessons, book the call, bring footage."],
    homework: { title: "Book your 1-on-1", steps: ["Make sure every lesson above is marked complete.", "Have your death log and one recorded game ready.", "Use the booking form on the dashboard. Ryvoki confirms a time on Discord."], target: "Call booked" },
  },
];

export const LESSON_COUNT = LESSONS.length;

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find(lesson => lesson.id === id);
}

export function lessonSummaries() {
  return LESSONS.map(({ id, module, title, minutes, summary, video }) => ({ id, module, title, minutes, summary, hasVideo: Boolean(video) }));
}
