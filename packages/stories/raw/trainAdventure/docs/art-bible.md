# Art bible, Shinjuku platform, train carriage, Jishui station, 幽冥之都, 迷霧之森, the cabin in the fog, the second fork and the left-hand trail (acts 1-14)

The train carries exactly 16 passengers, the cast on the character sheet. No extras anywhere inside the train. A scene shows only the people its beat needs; nobody has to appear in every background. Ling Mo is gone from act 4 on in both branches; who else stays aboard depends on the branch (see Acts 4-6 below).

## Shinjuku platform (act 1)

Act 1 opens on the platform before the train arrives. Every platform shot uses this set, matching act1_s0:

A late-night Chuo Line platform at Shinjuku, 23:50: an elevated platform under a steel canopy roof with exposed lattice girders and long rows of white fluorescent tubes; a row of square brushed-steel pillars; a glossy light-grey tiled floor that reflects the lights; a yellow tactile strip along the platform edge; the tracks run into a black tunnel mouth at the far end, with small red and white signal lights in the dark; a black departure board hangs from the canopy, its lines shown only as glowing amber bars with no readable characters; silver metal benches against a low back wall topped by a steel railing; beyond it the Tokyo night city, office towers with lit windows. Cold white light, no advertisements, no text.

- **Reference** (`platform_master.png`, empty): eye level, looking down the platform toward the tunnel. Benches and railing on the left, the yellow strip and the tracks on the right, the departure board at the upper middle, the tunnel mouth at the far right end.
- **Where people stand**, seen from the reference angle: Li Jie behind the yellow line in the foreground; the four students in a loose circle mid-platform near the yellow line (Kenta, Asuka, Misaki, Takumi), with Saito standing alone a few metres further down the platform toward the tunnel, clear of their circle until he cuts in (act1_platform_saito); Emi alone at the end of a bench against the back wall on the left; Ling Mo leaning in the shadow of the pillar just beyond Emi's bench.
- **Commuters**: unlike the train, the platform has a scattered late-night crowd. Keep it to a few people, small, far off and out of focus, with no visible faces, never in front of the cast.
- **No train body.** As with the carriage exterior, the arriving train is shown only as headlights in the tunnel mouth.

## Carriage (identical in every in-train scene)

A single Chuo Line commuter carriage: continuous side-facing bench seats along both walls in dark navy patterned fabric, split into seat groups by silver stanchion poles: each seven-seat section has exactly two, rising from the front lip of the seats between the 2nd and 3rd seats and between the 5th and 6th seats counted from either partition (2-3-2, as in act3_s0), plus the grab bar on each partition; no pole stands out in the aisle, behind the seats against the windows or in front of the glass, and this count wins over the empty reference images, which show extra poles; silver overhead grab rails with white hanging hand straps; flat white LED ceiling lights; large rectangular windows above the benches; the benches come in seven-seat sections (`carriage_side.png`), each ending in a curved grey partition panel, with a sliding door with yellow edging between sections and at each end, so no seat ever stands in front of a door and every doorway is clear floor; both end walls have the same plain grey connecting door with a small window; no advertisements, no text. Lighting and what shows through the windows change per scene, the carriage does not.

## Seating plan

It is a near-empty last train, so the passengers sit group by group with empty seats between the groups. Inside a group people sit side by side. Directions below are seen from the door end looking down the carriage (angle A).

- **Left bench, near to far:** Emi in the end seat against the partition, Li Jie beside her; a few empty seats; Yamamoto alone; a few empty seats; Ito Makoto and Ito Nana; several empty seats; Ling Mo alone in the far corner, always.
- **Right bench, near to far:** Saito Ren alone in the end seat by the door; a couple of empty seats; the four university students (Kenta, Asuka, Misaki, Takumi); a few empty seats; Nakamura alone; a few empty seats; the Kobayashi family (Yudai, Hina, Tomoko, Shota).

The "end seat" is the first seat of the nearest section, against the partition beside the door at the door end, so Emi and Saito sit directly across the aisle from each other. Anyone shown standing stands near their own seat, unless the beat needs them elsewhere (Yamamoto at the window in act3_s3 and by the door in act3_s4). Emi and Li Jie sit side by side but are strangers in acts 1-3: he only glances at her, never leans in, and she never looks back at him.

## Camera angles and framing

Vary both the camera position and the distance from scene to scene; never run the same framing twice in a row. The empty reference images under `packages/assets/media/train_adventure/backgrounds/_reference/` fix the platform and carriage design: pass the closest one first, then the portraits of the people in the shot (the four students as one sheet, left to right Kenta, Asuka, Misaki, Takumi, so a crowded shot stays within about five images).

- **A, down the length** (`carriage_master.png`): camera at the door end looking toward the far end.
- **B, reverse** (`carriage_reverse.png`): camera at the far end looking back. The right bench is on the left of the frame, near to far: Shota, Tomoko, Hina, Yudai; Nakamura; Takumi, Misaki, Asuka, Kenta; Saito. The left bench is on the right of the frame, near to far: Ling Mo; Ito Nana, Ito Makoto; Yamamoto; Li Jie, Emi.
- **C, across the aisle** (`carriage_side.png`): camera facing one bench straight on. Facing the left bench, left to right: Emi, Li Jie; Yamamoto; Ito Makoto, Ito Nana; Ling Mo. Facing the right bench, left to right: Shota, Tomoko, Hina, Yudai; Nakamura; Takumi, Misaki, Asuka, Kenta; Saito. So facing the left bench the door end is on the left of the frame, and facing the right bench it is on the right; prompts that get this backwards come out with the seating order reversed.
- **Free framings** (use `carriage_master.png` for the design): three-quarter diagonal along a bench, low angle from seat height, high angle from the ceiling, over-the-shoulder, close-up and detail insert. Seat positions still follow the plan above.

## Shot list

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| act1_s0 | Shinjuku platform; again while Saito fakes scrolling | wide, over Li Jie's shoulder | Li Jie, students, Saito standing apart from them, Emi, Ling Mo |
| act1_platform_students | Students mock the beer bar; again when they shut Saito out | medium, three-quarter, eye level | the four students |
| act1_platform_saito | Saito cuts in | medium-wide from the track side | Saito, the four students |
| act1_platform_emi | Li Jie notices Emi | medium close-up, low side angle | Emi |
| act1_platform_lingmo | The man in the pillar's shadow | long-lens medium, low angle | Ling Mo (commuters blurred) |
| act1_platform_arrival | The last train arrives, from the first glimmer in the tunnel through boarding (held over the doors opening, since the train body is never shown) | low, down the tracks | headlights in the tunnel mouth, no train body |
| act1_s1 | Boarding, doors close | A, wide, eye level, near doors clear | everyone, spread out in their groups |
| act2_s0 | City lights, quiet ride | three-quarter diagonal, medium | Emi, Li Jie (Yamamoto far off) |
| act2_s1 | Into the tunnel | close-up, side view against the black window | Li Jie (Emi at the edge) |
| act2_s2 | No signal, Saito explains | low angle, medium | Saito standing, students seated |
| act2_yamamoto | Yamamoto: thirty years on this line | three-quarter medium along the left bench | Yamamoto (Ito couple blurred, further along) |
| act2_s3 | Ito couple argue | C, medium, straight on | Ito couple, Ling Mo in the corner |
| act2_s4 | Boy cries, Nakamura agitated | three-quarter close-up | the Kobayashi family (Nakamura blurred, further along) |
| act2_intercom | Nakamura demands someone press the emergency button | low angle from seat height, medium-wide across the aisle; a shouting match, nobody touches the button or each other | Nakamura, Yamamoto (Kobayashi family blurred) |
| act2_s5 | Emi's spiral drawing | over-the-shoulder insert | Emi's sketchbook and hand |
| act2_s6 | Blue-black glow ahead | B, extreme wide | everyone, in their groups |
| act3_s0 | Sea and two moons | from behind, medium, straight on to the right windows | the four students on their knees at the windows, Saito frozen in his end seat |
| act3_s1 | Saito's hologram, no signal, panic | high angle, tilted wide | everyone, in their groups |
| act3_s2 | Emi terrified | medium, across the aisle at seated eye level | Emi staring at the sea, Li Jie in the next seat glancing at her |
| act3_s3 | Jishui station | over Yamamoto's shoulder at a left window | Yamamoto, the station through the window |
| act3_s4 | The door opens, nobody moves | straight on at the open left door at the door end | Emi, Li Jie, Yamamoto |
| act3_door_argument | Argument at the open door | three-quarter wide toward the same open left door | Yamamoto, Ito Makoto, Nakamura, the four students (Emi and Li Jie in their seats beside the door) |

The new backgrounds are named on their fence (` ```bg platform_students ` keys `act1_platform_students`) so the original 14 `s<N>` keys never renumber. Shown again with a `reuse` bg block: act1_platform_students when the students go back to their own talk, act1_s0 while Saito fakes scrolling and again during the arrival announcement, act1_s1 in act 2 while the students plan tomorrow, then act2_s0 for Li Jie's next thought, and act3_s4 once the door argument dies down.

There is no exterior shot: an outside view of the train never matched the interior, so the station is seen through the windows and the open door.

## Window views

- Acts 1-2: Tokyo night city on both sides, then the black tunnel (windows act as mirrors), then the blue-black glow.
- Act 3 onward: dark forest through the left windows, black sea with two violet crescent moons (one large, one small) through the right windows. Jishui station's platform is on the forest (left) side, so the doors open on the left: a short platform of cracked grey-white stone slabs with moss; along its far side a real single-storey wooden station house (the waiting room of acts 4-6: plank walls with cracks and mould, glassless windows, a dark open doorway, rows of benches inside, a timetable board by the door, a few old paper lanterns under the eaves, unlit in act 3 and glowing faintly from act 4 on); a weathered wooden sign reading 寂海 with a worn line of small text beneath (act 6 reads it as ← 永恆之森 | 幽冥之都 →; keep it unreadable in act 3); the dark forest right behind, and a dirt path from the platform's right-hand end, seen facing the station house, into the trees (act 4 walks it; the left-hand end has no path). The sea and the two moons show only through the right windows; the left windows and the open door show no moon.

## Acts 4-14

After the act 3 choice the story splits: in branch 1a Li Jie gets off at Jishui and the art moves to the platform and the waiting room; in branch 1b he stays aboard, the doors lock and the train runs on along the coast to 幽冥之都, where he gets off in acts 7-8. The carriage, seating plan and window views above still hold inside the train.

### Who is where

- **Act 4, both branches:** the 15 passengers left after Ling Mo, in their own seats. His far corner seat stays empty (b1a_act4_lingmo_gone).
- **Branch 1a, from act 5 on:** on the platform, Li Jie, Emi, Yamamoto, Saito and the four students. Still aboard when the doors close, the Ito couple, Nakamura and the Kobayashi family; the train then leaves them out of the art for good. In act 6 the students head for the forest and Saito runs after them, while Li Jie, Emi and Yamamoto stay at the waiting room.
- **Branch 1b, from act 5 on:** aboard, Li Jie, the Ito couple, Nakamura and the Kobayashi family, in their own seats. Everyone else got off while Li Jie was in the front cars, so the near half of the carriage is empty.
- **Branch 1b, act 7:** Li Jie alone on the 幽冥之都 platform and in the station building. Still aboard, with the door open, the Ito couple, Nakamura and the Kobayashi family, fighting (b1b_act7_carriage_fight). Hina and Shota run out to him at the end of the act.
- **Branch 1a/2a, acts 7-8:** Li Jie stays to search the waiting room and Emi stays with him. Yamamoto, his messenger bag on his shoulder, leaves for the forest at the start of act 7 (b1a_b2a_act7_yamamoto_leaves) and is not seen again in these acts. From then on only Li Jie and Emi are in the picture: in the waiting room, on the platform's right-hand end where the dirt path starts, and in 迷霧之森 up to the four-way fork.
- **Branch 1a/2a/3a, acts 9-11:** only Li Jie and Emi. They take the main path from the fork, find the cabin at the side of the path, sleep there, and walk on in the morning until Li Jie steps on the broken glasses (Saito's, act 12).
- **Branch 1a/2a/3a act 12, branch 4a acts 13-14:** only Li Jie and Emi. They search around Saito's glasses, find a scrape with a little blood on a trunk, and from then on each carries one of the two kitchen knives Emi took from the cabin. At a second fork (act 12) Emi's hunch picks the left-hand trail (act 13). They walk it for hours, rest once under a dry tree, then talk their way along it (act 14) until the fog thins into a silver-blue glow and they step out of it on act 14's last line. The village that glow belongs to is act 15's reveal and is never drawn in acts 12-14.
- **Branch 1b, act 8:** the train leaves with Yudai, the Ito couple and Nakamura aboard; it is shown only from inside (b1b_act8_train_leaving) and as two red tail lights going away down the track (b1b_act8_mother_fallen), never as a train body. Tomoko, Hina, Shota and Li Jie stay on the platform.

### Continuity details

These are settled from the story text and hold in every image, acts 1-8:

- **Emi's shoes:** plain white canvas sneakers (act 1 describes 白色帆布鞋). Her portrait stops at the waist, so name them in any prompt that shows her feet.
- **Yamamoto's bag:** a dark messenger bag on his shoulder. He grabs it when he rallies the carriage in act 5 and carries it on the platform; in act 6 he leaves it in the waiting room and picks it up again before he follows the students.
- **Lanterns:** unlit in act 3 (the text has no light outside the train) and glowing faintly from b1a_act4_lijie_stands on, when the text has them lighting the platform. The act 3 images reused at the start of act 4 still show them unlit, before Li Jie looks out.
- **Expressions:** the portraits smile, so any prompt that passes Li Jie's or Emi's portrait states the wanted expression and says "not smiling" unless the beat is a happy one.
- **Branch 1b seating after the station:** the Kobayashi family sits at the far end of the right bench, nearest the end wall, and Nakamura sits alone a few seats nearer the door (b1b_act5_half_empty, b1b_act5_relief).
- **Moon order:** the large crescent is always left of the small one in the frame, whichever way the camera faces. Prompts say "the large one on the left"; the model swaps them otherwise.
- **Glasses:** only Saito wears glasses. Edits tend to add them to Nakamura and Yamamoto, so prompts say "no glasses" for both. A close-up crop of the face, edited at 4x and pasted back, removed them where a full-frame edit would not (b1a_act4_lijie_stands, b1a_act4_door_call).
- **Jishui timetable board:** faded and unreadable in every wide shot. Only the act 4 insert (b1a_act4_timetable) reads. It must look like a real station timetable (Hapadona, 2026-11-21: not a signboard, and the exact time rather than "twenty years"): a tall board with the header 時刻表, one destination 幽冥之都, a ruled departure table scoured blank except one row: 下一班列車 | 2045年9月15日 | 23:50, twenty years to the minute after Li Jie boarded the last train at Shinjuku (2025年9月15日 23:50). Route 1b's Yomi timetable (b1b_act7_timetable) gives the same year.
- **Station sign glyphs:** the model garbles 寂海 at small sizes. act3_s3 reads correctly; the signs in act3_s4, act3_door_argument and b1a_act4_door_call were retouched by hand with its glyphs.
- **Poles:** the image model often moves or drops a single pole. When one is wrong, remove it in an edit and paint the pole back by hand at the seat-front seam (b1a_act4_lingmo_gone and b1b_act5_ito_explain were done this way).
- **Li Jie's sword (branch 1b):** from b1b_act7_sword on he carries a long straight sword, its blade pitted red-brown with rust and dull, a plain crossguard, the grip wrapped in rotting cloth strips. In act 8 he plants its point on the stones while he listens. The station map is folded in his pocket and never shown again.
- **The waiting-room map (branch 1a/2a):** it hangs on the far end wall until Li Jie tears it down in act 7 (b1a_b2a_act7_map_taken); a paler patch of wood shows where it was. From then on it is folded in his pocket, and he unfolds it at the fork in act 8. It keeps the look it has on the wall in b1a_act6_waiting_room: yellowed parchment, torn edges, faint brown ink paths and little drawn trees, labels too small and faded to read.
- **Li Jie's phone torch (branch 1a/2a):** on in the waiting room in act 7 until he takes the map down, off on the platform and on the first stretch of forest path, and on again from act 8's "霧越來越濃了" (b1a_b2a_act8_torch_fog) to the end of the act.
- **Li Jie's phone torch (branch 1a/2a/3a):** still on along the main path in act 9 and again outdoors in act 11; off inside the cabin, which the oil lamps light. Prompts say "smartphone ... small white LED torch" and hold it at chest height; held low it comes out as a flashlight.
- **Emi's bag:** the cream canvas shoulder bag she has carried since act 1 (it shows in every 1a/2a shot) is the 背包 she packs food into in act 11.
- **Emi's earphones off the train (branch 1a, from b1a_act4_platform_pair on):** off. Her white wired earphones are her look on the train (up to and including b1a_act4_emi_steps_out), but once she is on the Jishui platform, in the waiting room, in the fog and in the cabin she does not wear them, in her ears or around her neck (Hapadona, 2026-11-17: "it looks weird", even though the story never says so). They stay packed in her bag through the night in the cabin too. Her portrait shows them, so every prompt says "no earphones".
- **Emi's sketchbook off the train (branch 1a, from b1a_act5_followers on):** not in her hands. It stays put away in her shoulder bag (Hapadona, 2026-11-17); her hands are empty, clasped, on her bag strap or busy with what the beat needs. The exceptions are where the text has her clutch it right after she gets off: b1a_act4_platform_pair (act 4, 緊緊抓著自己的素描本), b1a_act5_emi_resolve (act 5 opening), b1a_act5_names (book held to her chest with both arms) and b1a_act5_handshake right after it (book in her left arm, right hand given). It stays in the bag through the night in the cabin too: the bedside table in b1a_b2a_b3a_act10_emi_sleeps holds only the oil lamp. Her portrait holds it, so every prompt says it is put away out of sight.
- **Emi's clothes in the cabin (acts 10-11):** from act 10's "十幾分鐘後，恵美從浴室出來" she wears a long white cotton robe, hair wet, through the night. In act 11 she is back in her beige dress (act 16 calls her own clothes dirty when she changes into an elf robe there).
- **Li Jie's backpack in the cabin:** set down against the wall by the front door from bed_offer on, back on his shoulder for leaving_prep.
- **The broken glasses (act 11):** a thin silver wire frame like Saito's glasses on his portrait, bent and twisted, one temple arm bent, both lenses smashed. Act 12's text now matches: 銀色細框 / 銀框眼鏡 (zh) and 銀の細いフレーム / 銀縁の眼鏡 (ja), changed 2026-11-17 with Hapadona's OK.
- **Kitchen knives (branch 1a/2a/3a, from b1a_b2a_b3a_act12_knives on):** two ordinary home kitchen knives, polished steel blade and plain wooden handle, nothing ornate. Emi takes them from her bag in act 12 and hands one to Li Jie handle first. After that each carries one low at the side with the blade pointing down, never raised and never pointed at anyone. They are out of frame in the shots where the two sit under the dry tree (act 13 rest, emi_tears, promise), because the text never says what they do with them.
- **Hands and torch (acts 12-14):** Li Jie holds the phone, torch on, in one hand and the knife in the other; before he takes the knife (realisation) the broken glasses are in the hand that is not holding the phone. The prompts ask for phone left, knife right, but the renderer does not hold to it: the act 11 shots and about two thirds of acts 12-14 (knives, emi_left, fork2, real_smile, music, tired_talk, light_ahead, stunned) show the phone in his right hand and the knife in his left, while decision, ramen and blank show the reverse (self review, 2026-11-21). Do not re-roll a shot just for this, and do not mirror one, which also swaps who stands on which side. For act 15 onward keep the act 11 look (phone in his right hand, knife in his left) where the prompt can say it plainly. The torch stays on all through acts 12-14, also while they sit: it lies glowing on the leaves beside him in act 13 rest. In close shots it hangs low and lights the ground.
- **The blood on the trunk (act 12):** a long pale scrape about a metre up, bark split open beside it, ending in one small half-dried dark red smear. Nothing graphic: no spatter, no wound, no body.
- **Silver-blue light (act 14 into act 15):** from b1a_b2a_b3a_b4a_act14_light_ahead the palette moves from violet-black and grey-white to a pale silver-blue glow (act 15 calls it a light between moonlight and firefly light). The mist is a thin haze and the trunks stand farther off. Nothing inside the glow is drawn: no village, valley, buildings or elves until act 15.
- **Tomoko's injury (branch 1b, act 8):** she falls on the platform as the doors close: her long skirt is torn at one knee, the knee scraped and bleeding with a line of blood down her shin, and there is dust and blood on her cardigan, in every act 8 shot.

### Jishui station (branch 1a)

The station is on the forest (left) side of the train. Seen from the platform: the station house along the far side with the forest right behind it, and the track and the black sea with the two moons on the other side. The line runs along the top of a high sea cliff, not a beach: past the track a strip of grass ends at the cliff edge, the sea lies far below. Facing the sea, the cliff shows on the left, as a sheer dark rock face under the forest where the track curves away, with surf on the rocks at its foot (act 5 hears 海浪拍打礁石). To the right is open sea out to a straight horizon, with no further cliffs. Hapadona asked for the cliff on b1a_act5_train_gone, then for the right-hand cliffs to go and the left one to read more clearly. Every platform shot that faces the station house keeps the railway behind the camera, so it shows no train, no track and no moon. A shot that faces the sea (b1a_act5_train_gone) shows the empty track and the moons over the water, and no station house.

- **Platform reference** (`_reference/jishui_platform.png`, empty): eye level from the platform's track edge. The long single-storey station house runs along the back: tiled roof with deep eaves, plank walls, glassless windows, a wide open doorway onto the benches inside, the timetable board, paper lanterns under the eaves, and the 寂海 sign on two posts. The dirt path leaves the platform's far end on the right into the forest, and the left end has none. This holds for every shot, act 3 included: the sign points right to 幽冥之都, and the map in the waiting room shows the forest path branching off toward 幽冥之都.
- **Waiting-room reference** (`_reference/jishui_waiting_room.png`, empty): a long room with plank walls, a high open roof of cobwebbed wooden trusses and rows of slatted benches all facing one way. Its proportions match b1a_act6_through_window: the end wall, the map and the barred ticket window are the same size relative to the benches in both (Hapadona flagged the mismatch). The front-wall windows look out onto the platform, the empty track, the grassy cliff edge and the black sea far below, with the dark cliff face under the forest to one side and no moon in them. A torn parchment map (the waiting-room map below) hangs on the far end wall, and a barred ticket window sits in the corner. There are no lamps inside; moonlight falls in through the windows in pale shafts.
- **Waiting-room map** (`_reference/jishui_map.png`, the whole sheet flat and straight on): Hapadona flagged that the map was drawn wrong and differently in every shot (2026-11-21), so every shot that shows it passes this reference. What the story says (act 6, 2a acts 7-8, 3a acts 9-12, 2b/3a acts 9 and 11): a large yellowed parchment, nearly peeling off the innermost wall; plain 漢字 in a slightly old-fashioned hand that Li Jie reads easily and Yamamoto sees as squiggles; Li Jie points to the station (這裡...是「寂海車站」); one clear main path runs from the station WEST into the area labelled 迷霧之森; about halfway through the forest it puts out one smaller branch labelled toward 幽冥之都; a few faint trails near the edges run off the torn paper toward unlabelled places; it shows only paths and no building in the forest (2b/3a act 11), so the cabin is not on it. At the four-way fork, straight on is the main path and the right-hand trail is the branch by the map's directions (2a act 8), so walking west the branch turns north; the second fork (3a act 12) and the act 13 trail are not on it. The design, north up: down the right (east) edge a coastline with the sea hatched beyond it and the railway just inside it; beside the railway a little below the middle the one building, a tiny station house labelled 寂海車站; the forest of little inked trees, labelled 迷霧之森, covers the rest; the bold main path leaves the station and runs left across the whole sheet and off the torn left edge; halfway across, exactly one thinner branch leaves it upward (north) to the top edge, where 幽冥之都 is written with a small arrow pointing off the sheet; two or three faint broken dotted trails near the torn top-left and bottom-left edges touch nothing; a small compass rose top right marked 北. Its only writing is 寂海車站, 迷霧之森, 幽冥之都 and 北, readable only in the act 6 insert (b1a_act6_map); in every other shot it is too small or too dark to read. It hangs north-up on the far end wall until Li Jie tears it down and folds it up (2a act 7), so from act 8 on it is creased.
- **Sign:** 寂海 large, with ← 永恆之森 ｜ 幽冥之都 → beneath. It is readable only in the act 6 close-up (b1a_act6_sign). The image model kept writing the variant 恒, so 恆 there was retouched by hand to match the story text.

### 幽冥之都 (branch 1b, acts 6-8)

A large, ancient, abandoned station: "much bigger" than the last stop (act 6), but still a railway station of human scale and open to the night, not a temple or a giant hall. Hapadona flagged the first version, which made it one colossal building. A long, wide open-air platform of huge worn stone blocks under a thick layer of dust, with no footprints but Li Jie's (act 7), runs under a heavy stone canopy on a row of tall square pillars, about two storeys high and carved with symbols and totem faces (act 6: 高聳的石柱支撐著巨大的屋頂). Behind it stands the main station building (車站的主建築, act 7), a long two-storey building of dark stone carved with unreadable symbols and totems, with tall grimy arched windows upstairs and steps up to an arched entrance in the middle. A smaller ruined outbuilding with a caved-in roof and a rusted railing sits at its left end (破敗不堪的建築, 鏽跡斑斑的設施, act 7), and the forest stands behind everything like a black wall (act 8). It has no lamps: only cold violet moonlight lights it. Like Jishui, the line runs along the top of a high sea cliff (act 6 has the train following the coast, and Hapadona asked for it): across the track a strip of bare rock and grass ends at the cliff edge, and the sea lies far below (act 8: 遠處,黑色的海洋). The station is on the left side of the train, so the right windows show the cliff edge, the sea below and the two moons. The two references below fix its look; pass them for every later shot there.

As at Jishui, every platform shot that faces the station keeps the railway behind the camera, so the train is never seen from outside. Facing the sea, the track runs off to the LEFT, the way the train leaves for 亡者峽谷, with the sea and the moons beyond it; looking along the track that way, the sea is on the right and the forest stands like a black wall on the left (act 8's last image).

- **Sign:** the board from act 6, a huge slab of dark weathered wood in a carved border, hanging from the canopy beams in the middle of the platform (月台中央, act 7), in front of the station building. 幽冥之都 in four large characters in a sharp, knife-cut ancient style, and along its bottom edge ← 寂海 ｜ 亡者峽谷 →, with 亡者峽谷 to the right like 幽冥之都 on the Jishui sign. The act 6 text calls it 巨大的站牌 and act 7 calls it black wood, so it is no longer described as stone.
- **Timetable:** a smaller dark wooden board (同樣是用黑木雕刻而成, act 7) on the pillar beside the sign, three lines of unknown glyphs ending in 2005, —— and 2045 (b1b_act7_timetable).
- **Station building:** broad stone steps under the sign lead up to a tall arched entrance in the middle of its front. Inside is the waiting hall, the one space the text calls huge (極其寬闊,天花板高得幾乎看不見頂端): a ceiling lost in darkness, grimy arched windows high up letting in violet shafts of moonlight, cobwebs, a long stone counter with an open ledger, and a row of rusted iron turnstiles, one of them smashed open. The stationmaster's office (where the map hangs behind cracked glass) is in one corner, and the guard room (where the sword leans behind a kicked-open locker) sits beside a passage to the exit sealed with an iron grille.
- **Map:** a rough route map of the land near the station only (the forest's interior is left undrawn, 1b act 9). North is up. The railway runs straight up the map with the coast and sea to its right (east), and the station sits in the centre on the land side. Following the track north leads into the ravine of 亡者峽谷, the train's next stop (act 8); a footpath through woodland beside the track reaches the same ravine (act 9). A crossroads just outside the station (act 9) starts the paths south into the misty 迷霧之森 and west over rugged hills to 銀月湖, a lake in a valley a short way off (act 9). The track south, toward 寂海, is unlabelled.
- **References:** `_reference/yomi_platform.png` (empty, from the platform's track edge facing the station: the canopy and pillars, the sign, the timetable, the station building with its steps and entrance, the ruined outbuilding and the forest behind) and `_reference/yomi_platform_sea.png` (empty, from beside the station building looking across to the track side: the pillars along the edge, the track curving away left along the cliff top into the forest, the sheer cliff face and surf below on the left, the sea far below and the two moons).

### 迷霧之森 (branch 1a/2a, act 8 on)

The forest the dirt path from Jishui's platform runs into (act 8: 奇形怪狀的樹木高聳入雲). Every forest prompt starts with this sentence:

the 迷霧之森 (Misty Forest) inland from Jishui station: a narrow path of dark packed earth strewn with dead leaves winds between colossal, strangely twisted ancient trees, their gnarled black trunks and contorted branches rising up out of sight, thick roots breaking through the ground, ferns and moss at their feet; a dense canopy hides the sky and the two moons; only thin threads of eerie violet moonlight slip through gaps in the leaves into drifting white mist; no lamps, no buildings, no signposts, no fences.

- **Fog:** act 8 thickens it on purpose, shot by shot: a thin haze at the forest's edge (forest_entry), a white wall a few metres off once Li Jie needs the torch (torch_fog), then only the path at their feet (lost_shout, hurrying). At the fork it is still thick (霧氣雖然依舊濃厚): the clearing and the first few metres of each way show, then everything turns to white, with no distant trees.
- **The map at the fork** (b1a_b2a_act8_map_check) is the waiting-room map (`_reference/jishui_map.png`), now creased from folding: the main path running left from the station with exactly one branch, upward to 幽冥之都, plus a few faint trails that run off the torn edges and join nothing. The four-way fork is not on it; that mismatch is the point of the scene.
- **No moon** shows anywhere under the canopy, and the sea and the station are never in view.
- **The four-way fork** (act 8, again at the start of act 9): seen from the path they arrive on, the main path goes straight on, the widest and most obvious; two narrower trails of about the same size leave on the left, a little apart; one narrower trail leaves on the right. All four vanish into fog within a few metres. There is no signpost or marker. By the map, the right-hand trail is the branch to 幽冥之都 and straight on is the main path deeper into the forest; the two left-hand trails are not on the map.
- **References:** `_reference/mist_forest_path.png` (empty, the path through the trees in thin mist) and `_reference/mist_forest_crossroads.png` (empty, the fork from the path they arrive on). Pass the path reference for every shot on the path and the fork reference for every shot at the fork.

### 霧中小屋, the cabin in the fog (branch 1a/2a/3a, acts 9-11)

Along the main path from the four-way fork the fog is at its thickest (act 9: 能見度甚至不足三公尺) and the light is an even grey with no day or night. The cabin stands on the right-hand side of the path as they walk deeper in, its front door facing the path. Every outside prompt starts with this sentence:

a small, old cabin of dark weathered timber standing alone at the side of the forest path deep in 迷霧之森: a single storey of thick dark planks covered in green moss, a low pitched roof of dark wooden shingles furred with moss, a short stone chimney at one end with no smoke, one plain plank front door facing the path with a single flat stone step before it, and one small square window of old glass on each side of the door, both dark and dim so nothing inside can be seen; colossal twisted black trees close around it under a dense canopy that hides the sky; no fence, no sign, no lamp outside, no other buildings.

Inside it is warm, dry and spotless (act 10). Every inside prompt starts with this sentence, which fixes the layout seen from the front door:

inside the cabin in 迷霧之森: one small square room of thick, smooth, dark wooden planks, spotlessly clean and dry, with not a speck of dust or a cobweb anywhere, under a low ceiling of dark beams; no electric light: four small brass oil lamps hanging on hooks on the walls give a soft, warm orange glow. Seen from the front door: along the left wall a wooden double bed made up with neat white sheets, a pillow and a folded blanket, its head in the far-left corner beside a small wooden bedside table; in the middle of the far wall a small square window of old glass showing only grey-white fog, and under it a small square wooden table with two plain wooden stools; in the far-right corner a simple little kitchen: a low wood-burning stove of stone and clay with a small iron pot, a plank counter, open shelves of plain clay bowls and plates, and a wooden cupboard; in the right wall a closed plank door to the washroom; a wide plank floor; nothing else, no decorations, no text.

- **References:** `_reference/mist_cabin_exterior.png` (empty, the cabin from the path in thick fog, made from `mist_forest_path.png`) and `_reference/mist_cabin_interior.png` (empty, the room from just inside the front door, made from the exterior reference). Pass the exterior for shots outside the cabin, the interior for shots inside it, and `mist_forest_path.png` for shots on the path away from the cabin.
- **Lamps:** turned low from emi_sleeps through the night (act 10); bright again for breakfast in act 11.
- **The washroom** is shown only once, as a close-up of Li Jie's face under the water (act10_shower).

### The second fork and the left-hand trail (branch 1a/2a/3a act 12, 4a acts 13-14)

The glasses lie on the main path, and past them the forest is the 迷霧之森 above: the same twisted trees, the same thick fog with no day or night, the torch on. In act 12 the trees stand a little taller and closer. Every forest prompt in acts 12-14 uses the 迷霧之森 sentence, except the fork and the trail below, which replace it.

- **The second fork** (act 12): not the four-way fork of act 8. In a small clearing the main path splits into exactly three ways ahead of them: the wider main path straight on, one narrower trail to the left and one narrower trail to the right (act 12: 兩條明顯的支線, 一條通往左邊, 一條通往右邊). All are the same plain dark earth and vanish into fog within a few metres, with no signpost, marker or light. It is not on the map (it is the 地圖上沒有的岔路口). Every fork shot starts with this sentence:

the 迷霧之森 (Misty Forest) inland from Jishui station: the main path of dark packed earth strewn with dead leaves winds between colossal, strangely twisted ancient trees, their gnarled black trunks and contorted branches rising up out of sight, thick roots breaking through the ground, ferns and moss at their feet; a dense canopy hides the sky and the two moons; only thin threads of eerie violet moonlight slip through gaps in the leaves into drifting white mist; no lamps, no buildings, no fences. The path reaches a second fork in a small clearing, and ahead of the camera the way splits into exactly three: the wider main path straight on, one narrower trail leaving to the left and one narrower trail leaving to the right, all three of the same plain dark earth, each vanishing into the thick white fog within a few metres. There is no signpost, no marker and no light anywhere. The fog is thick: the clearing and the first few metres of each way show, then everything turns to white, with no distant trees.

- **The left-hand trail** (acts 13-14): much narrower and rougher than the main path, barely a person wide and half overgrown with ferns and creeping roots, with no side turnings. It is the one Emi's hunch picks, and it runs for hours without a landmark (act 13: 數次停下腳步, 大聲呼喊). Every trail shot starts with this sentence:

the 迷霧之森 (Misty Forest) inland from Jishui station, on the left-hand trail: a much narrower, rougher trail of dark packed earth strewn with dead leaves, barely a person wide and half overgrown with ferns and creeping roots, winds between colossal, strangely twisted ancient trees, their gnarled black trunks and contorted branches rising up out of sight, thick roots breaking through the ground, moss at their feet; a dense canopy hides the sky and the two moons; only thin threads of eerie violet moonlight slip through gaps in the leaves into drifting white mist; no lamps, no buildings, no signposts, no fences, no side turnings. The fog is thick all around, grey-white beyond a few metres.

- **The dry tree** (act 13 rest): one enormous gnarled ancient tree beside the trail, its bark pale and dry and the leaf litter under it dry, in contrast to the damp black trees around it (act 13: 一棵相對乾燥的樹), with a wide hollow between two huge roots. The three rest shots show the same tree.
- **The end of the trail** (act 14, from light_ahead): the sentence above loses "thick fog" and gains a pale haze, then the silver-blue glow (see Continuity details).
- **References:** no new empty reference. `_reference/mist_forest_crossroads.png` fixes the clearing and the fog for the fork, and `_reference/mist_forest_path.png` fixes the trees and the ground for every other shot, with the trail narrower and rougher than the reference path.

### Shot list, branch 1a

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| b1a_act4_frozen_families | Nobody dares move at the open door | B, medium, seated eye level from near the far end | the Kobayashi family and the Ito couple in front; the rest small and soft toward the open door |
| b1a_act4_students_fear | The students ask if they will die here | C, medium close, straight across to the right bench | the four students huddled, Takumi, Misaki, Asuka, Kenta left to right |
| b1a_act4_lingmo_gone | Ling Mo's corner is empty | close detail, three-quarter | his empty far corner seat |
| b1a_act4_lijie_stands | Li Jie stands up | A, low angle from seat height, open door in the left foreground | Li Jie standing beside Emi, Yamamoto in the aisle, Saito at his pole; the students, Nakamura, Ito couple and Kobayashi family in their seats |
| b1a_act4_turned_on | Saito and the others turn on him | over Li Jie's shoulder, down the carriage | Li Jie from behind; Saito, Nakamura, Ito couple, students, Kobayashi family |
| b1a_act4_platform_alone | Li Jie alone on the platform | wide, railway behind the camera | Li Jie |
| b1a_act4_timetable | 下一班列車：2045年9月15日 23:50 | detail insert, straight on to the timetable board (時刻表, one destination 幽冥之都, one legible row) beside the doorway | Li Jie's fingertips only |
| b1a_act4_door_call | Yamamoto calls to him from the door | over the shoulders of the crowd at the open door | Yamamoto, Saito, Nakamura, the students at the door, Emi in her seat; Li Jie outside |
| b1a_act4_emi_steps_out | Emi steps down | low and close behind Emi in the doorway | Emi stepping out, Saito and Yamamoto reaching after her; Li Jie outside |
| b1a_act4_platform_pair | Emi on the platform with Li Jie | medium two-shot, side-on | Emi, Li Jie |
| b1a_act5_emi_resolve | Emi explains why she followed | close-up, slightly high | Emi |
| b1a_act5_names | Li Jie asks her name, she answers | over-the-shoulder medium shot from behind Li Jie's left shoulder toward the station house (emi_resolve's direction, wider) | Li Jie (back, profile), Emi |
| b1a_act5_handshake | Names and a handshake | medium close two-shot, slightly low three-quarter, the other side from platform_pair | Li Jie, Emi |
| b1a_act5_rally | Yamamoto rallies the carriage | C, three-quarter toward the right bench | Yamamoto standing; Saito, the four students, Nakamura |
| b1a_act5_followers | Yamamoto and the students step out | three-quarter wide, slightly high, from the track edge | Yamamoto and the students stepping out toward Li Jie and Emi |
| b1a_act5_left_behind | Saito dashes for the door | B, seated eye level beside Nakamura | Saito running for the door; Nakamura and the Ito couple staying |
| b1a_act5_doors_close | The doors shut behind the group | medium-wide from the platform edge, train behind the camera | the eight on the platform |
| b1a_act5_gloating | The stayers gloat as the train pulls out | C, straight across to the left wall | Ito couple hugging, Nakamura jeering at the window, the Kobayashis cut off in the foreground; the eight small on the platform outside |
| b1a_act5_train_gone | The train is gone | wide, from behind the group, facing the sea | the eight, backs to camera, the empty track, the moons over the sea |
| b1a_act6_blame | The students blame Li Jie | medium-wide, station house behind | the students, Saito, Yamamoto, Li Jie, Emi |
| b1a_act6_sign | Li Jie reads the sign | close, over his shoulder | Li Jie, the sign |
| b1a_act6_to_waiting_room | Li Jie, Yamamoto and Emi head for the waiting room | medium-wide from behind them, toward the doorway | Emi, Li Jie, Yamamoto from behind; the students and Saito arguing far left |
| b1a_act6_waiting_room | The map in the waiting room | medium, three-quarter onto the map wall | Li Jie with his phone torch, Yamamoto, Emi |
| b1a_act6_map | Li Jie explains the map | detail insert, straight on to the map, torch beam, his finger on 寂海車站, labels readable | Li Jie's hand only |
| b1a_act6_through_window | The argument outside, watched through the window | inside, behind Li Jie and Emi at a front window | Li Jie, Emi; outside Yamamoto and Saito arguing with the four students on the platform |

Shown again with a `reuse` bg block in branch 1a: act3_s4 while Li Jie makes up his mind at the start of act 4, lijie_stands while he answers them, platform_alone after the door call, platform_pair from Emi's arrival on the platform (through the in-train reaction to her leaving) into the start of act 5, emi_resolve and train_gone as act 5 ends, train_gone again to open act 6, and act 7's b1a_b2a_act7_yamamoto_leaves when Yamamoto comes back in for his bag at the end of act 6. A reuse is only for a moment that is still on screen: the 2026-11-21 review replaced the reuses where the picture showed an earlier moment (students_fear, handshake, to_waiting_room) and added the timetable and map inserts.

### Shot list, branch 1b

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| b1b_act4_empty_car | The empty front cars | A, standing eye level, another carriage of the same train | Li Jie walking; litter on the floor |
| b1b_act4_figure | A figure walks into the forest | through a left window from inside | the platform's far end, the path, a tiny figure |
| b1b_act4_doors_locked | Every door slams shut | close, side-on at a left door | Li Jie at the locked door; the figure through its window |
| b1b_act5_half_empty | Most of the passengers are gone | A, wide | Ito couple, Nakamura, Kobayashi family |
| b1b_act5_ito_explain | The Itos explain who got off | three-quarter medium onto the left bench | Ito couple, Li Jie standing |
| b1b_act5_relief | Relief that the train is moving | C, three-quarter toward the far end of the right bench | Kobayashi family, Nakamura |
| b1b_act5_lijie_sea | Li Jie alone with his doubts | medium, three-quarter along the left bench | Li Jie by the partition, the sea through the far windows |
| b1b_act6_yomi_arrival | The 幽冥之都 sign | from behind the passengers crowded at the left windows | everyone aboard, the station and its sign |
| b1b_act6_breakdown | The doors open and everyone breaks down | B, standing eye level, open door at the door end | everyone aboard; Li Jie apart by the door |
| b1b_act6_lijie_steps_out | Li Jie steps out alone | low, close behind him in the doorway | Li Jie; Ito Makoto calling after him |

Shown again in branch 1b: act3_s4 while nobody moves, b1a_act4_lijie_stands (from branch 1a) when he stands, empty_car on the walk back and into act 5, half_empty, relief and lijie_sea through act 6 until the station appears, and lijie_sea again for his last thought before he stands.

### Shot list, branch 1b, acts 7-8

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| b1b_act7_carriage_fight | The fight in the carriage behind him | C, three-quarter toward the far end of the right bench, seated eye level | Kobayashi family, Nakamura, Ito Makoto standing in the aisle |
| b1b_act7_platform | Li Jie looks over the empty platform | wide and low from the track edge, railway behind the camera | Li Jie from behind, his footprints in the dust |
| b1b_act7_sign | The 幽冥之都 sign and its directions | low, close over his shoulder | Li Jie, the sign |
| b1b_act7_timetable | 2005, ——, 2045 | detail insert | the timetable board |
| b1b_act7_hall | The waiting hall | extreme wide, low, from the entrance | Li Jie small, from behind |
| b1b_act7_broken_gate | The smashed ticket gate | medium, three-quarter | Li Jie |
| b1b_act7_office | The stationmaster's office | from the doorway, over his shoulder | Li Jie, the glass frame on the far wall |
| b1b_act7_map | The map under the glass | detail insert | the map, his hand |
| b1b_act7_sword | He finds the sword | medium, slightly low, three-quarter | Li Jie holding the sword, the kicked-open locker |
| b1b_act7_kids_plead | Hina and Shota beg him to come | medium, side-on, low, station wall behind | Li Jie, Hina, Shota |
| b1b_act8_train_leaving | The train pulls out with the father pounding on the glass | inside, close behind Yudai at the closed left door | Yudai; through the glass Tomoko on the platform, Li Jie and the children far off |
| b1b_act8_mother_fallen | Tomoko reaches after the train | low, behind her at the track edge, looking down the track | Tomoko; two red tail lights going away |
| b1b_act8_family_embrace | The children run to their mother | medium, eye level with them, the sea behind | Tomoko, Hina, Shota |
| b1b_act8_hina_explains | Hina tells Li Jie what happened | over Li Jie's shoulder, sword planted | Li Jie from behind, Hina, Tomoko holding Shota |
| b1b_act8_long_shadows | The crying echoes over the platform | high, extreme wide | the family huddled, Li Jie apart |
| b1b_act8_lijie_counts | Li Jie works out the halving | close-up, slightly low, white knuckles on the sword | Li Jie |
| b1b_act8_mother_resolve | We are going to find your father | medium, low, side-on | Tomoko crouched, pointing down the track; Hina, Shota |
| b1b_act8_family_ready | She takes their hands and thanks him | low three-quarter from beside Li Jie | Li Jie in profile, Tomoko, Hina, Shota |
| b1b_act8_final_wide | Two moons, the sea, the forest, the rails into the dark | extreme wide from high above the platform's end | the four, tiny |

Shown again in acts 7-8: b1b_act6_lijie_steps_out as act 7 opens, platform when he looks round and heads for the building, kids_plead as act 8 opens, family_embrace while Tomoko explains, long_shadows when he clenches his fist and thinks of the dead stations, carriage_fight when he remembers the faces in the carriage, and lijie_counts for "幸好我下來了" and again while he weighs the choice.

### Shot list, branch 1a/2a, acts 7-8

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| b1a_b2a_act7_yamamoto_leaves | Li Jie stays to search, Emi stays with him, Yamamoto goes | medium-wide inside the waiting room toward the map wall, open doorway in the left foreground | Yamamoto in the doorway with his bag; Li Jie and Emi by the map |
| b1a_b2a_act7_alone | Only the two of them are left | high, extreme wide from the roof beams | Li Jie and Emi small at the map, torch on |
| b1a_b2a_act7_emi_uneasy | "只剩下我們兩個人了...好黑...好冷" | medium two-shot, side-on, at the map wall | Li Jie turned to her; Emi glancing at the dark platform |
| b1a_b2a_act7_emi_calm | Her fear sounds like an act | close-up over Li Jie's shoulder | Emi frightened in the brows, calm in the eyes |
| b1a_b2a_act7_map_taken | He tears the map off the wall | medium, slightly low, three-quarter at the end wall | Li Jie with the map; Emi watching behind him |
| b1a_b2a_act7_forest_path | They step onto the dirt path into the forest | wide, from behind them at the platform's right-hand end, facing the forest | Li Jie and Emi from behind, long shadows ahead |
| b1a_b2a_act8_forest_entry | Into 迷霧之森, thin mist | wide, low, on the path | Li Jie and Emi small, walking toward the camera |
| b1a_b2a_act8_torch_fog | The fog thickens, phone torch on | medium, side-on | Li Jie with the torch, Emi close behind |
| b1a_b2a_act8_lost_shout | They have lost the others and shout | close-medium, low, three-quarter front | Li Jie shouting, Emi calling too |
| b1a_b2a_act8_hurrying | Half-running through the thickest fog | medium-wide, from behind and above | Li Jie and Emi from behind |
| b1a_b2a_act8_crossroads | The four-way fork | wide, from behind them at the junction | Li Jie and Emi from behind, small |
| b1a_b2a_act8_map_check | The map shows only one branch | close, over Li Jie's shoulder | the map in his hands, the fork out of focus |
| b1a_b2a_act8_emi_suggests | "清水，妳怎麼看？" | medium two-shot, side-on | Li Jie with the map, Emi looking toward the main path |
| b1a_b2a_act8_main_path | Following her gaze down the main path | point of view, down the main path | no people |

Shown again with a `reuse` bg block: crossroads for the last lines of act 8, while Li Jie looks over the four ways with Emi beside him (act 9 opens on the same beat).

### Shot list, branch 1a/2a/3a, acts 9-11

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| b1a_b2a_b3a_act9_into_fog | They take the main path and the fog swallows them | wide, from the path they arrived on, down the main path | Li Jie and Emi tiny, from behind, half gone in the fog |
| b1a_b2a_b3a_act9_strange_calm | Her fear has gone, an odd calm | close, side-on, walking | Emi calm in front, Li Jie glancing at her |
| b1a_b2a_b3a_act9_talking | "妳是做什麼的？" | medium two-shot from the front, walking | Li Jie talking, Emi answering |
| b1a_b2a_b3a_act9_side_by_side | Talk of the night before, a small flame in the fog | extreme wide from high in the branches | the two tiny on the path |
| b1a_b2a_b3a_act9_watch | Five hours gone, exhaustion | close-medium, three-quarter front | Li Jie checking his wristwatch, Emi dragging behind |
| b1a_b2a_b3a_act9_emi_points | "你看前面！" | medium, from behind between them | Emi gripping his sleeve and pointing; a dark outline in the fog |
| b1a_b2a_b3a_act9_cabin | The cabin in the fog | wide, three-quarter onto its front | the cabin; the two small from behind |
| b1a_b2a_b3a_act9_approach | "我們過去看看" | medium two-shot, side-on, cabin soft behind | Li Jie offering his arm, Emi leaning on it |
| b1a_b2a_b3a_act10_room | He opens the door: a warm, lamplit room | over Li Jie's shoulder from the threshold | Li Jie in the doorway, Emi behind him |
| b1a_b2a_b3a_act10_emi_unfazed | She takes it all as normal | medium two-shot, reverse toward the door | Emi calm, Li Jie frowning at her |
| b1a_b2a_b3a_act10_bed_offer | Shower first, the bed is yours | three-quarter medium-wide | Li Jie pointing to the washroom, Emi fiddling with her hem by the bed |
| b1a_b2a_b3a_act10_robe | She comes out in a white robe | medium, knees up, at the washroom door | Emi in the robe, Li Jie leaning on the wall |
| b1a_b2a_b3a_act10_emi_sleeps | She curls up and sleeps | close-medium at mattress height | Emi asleep |
| b1a_b2a_b3a_act10_shower | His thoughts under the cold water | tight close-up, collarbones up | Li Jie |
| b1a_b2a_b3a_act10_floor | He sleeps on the floor | low, side-on from the middle of the room | Emi asleep on the bed, Li Jie curled on his side on the floor beside it |
| b1a_b2a_b3a_act10_wake | He wakes in the night | close-up at floor level | Li Jie |
| b1a_b2a_b3a_act10_empty_bed | The bed is empty and made | his point of view from the floor | no people |
| b1a_b2a_b3a_act11_wake_porridge | Morning, porridge on the stove | low, from behind him on the floor | Li Jie sitting up, Emi at the stove |
| b1a_b2a_b3a_act11_breakfast | Breakfast; "妳去哪了？" | medium two-shot, side-on at the table | Li Jie, Emi |
| b1a_b2a_b3a_act11_flinch | Her hands shake and she dodges | his point of view, close-up | Emi |
| b1a_b2a_b3a_act11_leaving_prep | She packs food, he searches the room | medium-wide toward the kitchen | Emi at the cupboard, Li Jie at the shelf |
| b1a_b2a_b3a_act11_back_on_path | Back on the path, small talk | medium-wide, looking back at the cabin | the two walking toward the camera |
| b1a_b2a_b3a_act11_stops | A crack underfoot | low, side-on at ground level | Li Jie stopped mid-stride, Emi behind |
| b1a_b2a_b3a_act11_glasses | Crushed glasses in the mud | detail insert | the glasses, his shoe |
| b1a_b2a_b3a_act11_frame_held | He picks up the twisted frame | close, slightly low, three-quarter front | Li Jie crouching with the frame, Emi behind |

Shown again with a `reuse` bg block: b1a_b2a_act8_crossroads for the first four lines of act 9, act10_emi_sleeps when Li Jie comes out of the washroom, and act11_breakfast while they finish eating in silence.

### Shot list, branch 1a/2a/3a act 12 and 4a acts 13-14

Line numbers count every `**X**：` line in the act from 1.

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| b1a_b2a_b3a_act12_realisation (L4) | "這是眼鏡男的!" | medium two-shot, side-on, eye level | Li Jie with the broken glasses, Emi pale beside him |
| b1a_b2a_b3a_act12_search (L7) | They search the roots and leaf litter | wide, very low among the roots | Li Jie and Emi small, bent over |
| b1a_b2a_b3a_act12_blood_mark (L10) | The scrape and the blood on the trunk | close, chest height, at the trunk | the scrape, Li Jie's hand with the phone, Emi soft and frightened behind |
| b1a_b2a_b3a_act12_knives (L14) | Emi hands him a kitchen knife | medium close two-shot, slightly low, three-quarter front | Emi offering the knife handle first, Li Jie reaching for it |
| b1a_b2a_b3a_act12_nerves (L17) | An hour of searching, unseen noises | medium-wide, from behind and the side | Li Jie and Emi close together, both listening |
| b1a_b2a_b3a_act12_fork2 (L22) | The second fork, three ways | wide, high three-quarter from behind | Li Jie and Emi small, from behind |
| b1a_b2a_b3a_act12_emi_left (L27) | Emi tugs his sleeve: "我們走左邊" | medium two-shot, side-on | Li Jie puzzled, Emi's fingers on his cuff |
| b1a_b2a_b3a_act12_decision (L33) | He weighs the three ways | tight close-up, slightly low | Li Jie, jaw tight, the knife at the frame edge |
| b1a_b2a_b3a_b4a_act13_left_trail (L6) | The left trail, calling into the fog | wide, from behind and the side, slightly low | Li Jie shouting with the torch raised, Emi calling |
| b1a_b2a_b3a_b4a_act13_turn_back (L10) | "我們可能走錯了" / "不會的" | over-the-shoulder medium close-up | Emi calm and steady, Li Jie's shoulder soft in front |
| b1a_b2a_b3a_b4a_act13_flat_reply (L18) | Silence, then her flat "希望他們都沒事吧" | medium, side-on, moving alongside | Li Jie worried, Emi blank and distant |
| b1a_b2a_b3a_b4a_act13_rest (L24) | The rest under the dry tree | medium-wide, slightly low, from the front | Li Jie and Emi seated against the trunk, the food and the flask |
| b1a_b2a_b3a_b4a_act13_emi_tears (L32) | Her parents in Osaka, her eyes redden | close-up at seated eye level | Emi; Li Jie's shoulder soft at the edge |
| b1a_b2a_b3a_b4a_act13_promise (L42) | "我答應妳" | medium two-shot, low and side-on | Li Jie serious, Emi with wet eyes |
| b1a_b2a_b3a_b4a_act14_far_look (L1) | "等他的傷好了以後", the boyfriend | medium close-up, side-on, slightly low | Emi gazing into the fog, Li Jie soft in the foreground |
| b1a_b2a_b3a_b4a_act14_music (L8) | What music she likes | medium, low, long lens from behind | both walking away, heads turned toward each other |
| b1a_b2a_b3a_b4a_act14_real_smile (L12) | Her first real smile | close two-shot, from the front | Li Jie delighted, Emi smiling shyly |
| b1a_b2a_b3a_b4a_act14_books (L15) | Books, hobbies, long walk | wide, long lens from far ahead, low | both small, walking toward the camera |
| b1a_b2a_b3a_b4a_act14_tired_talk (L23) | His work, "會累的話...就休息一下吧" | over-the-shoulder medium close-up | Li Jie weary in focus, Emi's hair and shoulder soft |
| b1a_b2a_b3a_b4a_act14_blank (L29) | She has never heard of the film | close-up, slightly high, three-quarter front | Emi bewildered, Li Jie soft behind, a veil of mist between them |
| b1a_b2a_b3a_b4a_act14_ramen (L33) | Ramen, the old izakaya | medium, slightly high, three-quarter from the front | Emi eager, Li Jie laughing |
| b1a_b2a_b3a_b4a_act14_light_ahead (L43) | The fog thins, light and the sound of water | wide, from behind at eye level | Li Jie stopped with an arm out, Emi lifting her face to the glow |
| b1a_b2a_b3a_b4a_act14_stunned (L47) | They step out of the last mist and freeze | extreme wide, low, from behind | both tiny against a blaze of silver-blue light |

Shown again with a `reuse` bg block: act 11's frame_held for the first three lines of act 12 (he is still examining the glasses), act 12's decision for the first three lines of act 13 (the text repeats the same beat), act 12's fork2 when he says "好。我們走左邊。" and they thank each other, and act 13's rest after he pats her shoulder while they talk about gifts and her mother's daifuku (L36-L41).

## Portraits

Portraits are generated on a plain backdrop and then cut out to a transparent PNG (1024x1536 RGBA) with `rembg` using the `birefnet-general` model. `isnet-anime` left dark clothing and grey cardigans semi-transparent, so don't use it.
