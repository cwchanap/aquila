# Art bible, Shinjuku platform, train carriage and Jishui station (acts 1-6)

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

## Acts 4-6

After the act 3 choice the story splits: in branch 1a Li Jie gets off at Jishui and the art moves to the platform and the waiting room; in branch 1b he stays aboard, the doors lock and the train runs on along the coast to 幽冥之都. The carriage, seating plan and window views above still hold inside the train.

### Who is where

- **Act 4, both branches:** the 15 passengers left after Ling Mo, in their own seats. His far corner seat stays empty (b1a_act4_lingmo_gone).
- **Branch 1a, from act 5 on:** on the platform, Li Jie, Emi, Yamamoto, Saito and the four students. Still aboard when the doors close, the Ito couple, Nakamura and the Kobayashi family; the train then leaves them out of the art for good. In act 6 the students head for the forest and Saito runs after them, while Li Jie, Emi and Yamamoto stay at the waiting room.
- **Branch 1b, from act 5 on:** aboard, Li Jie, the Ito couple, Nakamura and the Kobayashi family, in their own seats. Everyone else got off while Li Jie was in the front cars, so the near half of the carriage is empty.

### Continuity details

These are settled from the story text and hold in every image, acts 1-6:

- **Emi's shoes:** plain white canvas sneakers (act 1 describes 白色帆布鞋). Her portrait stops at the waist, so name them in any prompt that shows her feet.
- **Yamamoto's bag:** a dark messenger bag on his shoulder. He grabs it when he rallies the carriage in act 5 and carries it on the platform; in act 6 he leaves it in the waiting room and picks it up again before he follows the students.
- **Lanterns:** unlit in act 3 (the text has no light outside the train) and glowing faintly from b1a_act4_lijie_stands on, when the text has them lighting the platform. The act 3 images reused at the start of act 4 still show them unlit, before Li Jie looks out.
- **Expressions:** the portraits smile, so any prompt that passes Li Jie's or Emi's portrait states the wanted expression and says "not smiling" unless the beat is a happy one.
- **Branch 1b seating after the station:** the Kobayashi family sits at the far end of the right bench, nearest the end wall, and Nakamura sits alone a few seats nearer the door (b1b_act5_half_empty, b1b_act5_relief).
- **Poles:** the image model often moves or drops a single pole. When one is wrong, remove it in an edit and paint the pole back by hand at the seat-front seam (b1a_act4_lingmo_gone and b1b_act5_ito_explain were done this way).

### Jishui station (branch 1a)

The station is on the forest (left) side of the train. Seen from the platform: the station house along the far side with the forest right behind it, and the track and the black sea with the two moons on the other side. Every platform shot that faces the station house keeps the railway behind the camera, so it shows no train, no track and no moon. A shot that faces the sea (b1a_act5_train_gone) shows the empty track and the moons over the water, and no station house.

- **Platform reference** (`_reference/jishui_platform.png`, empty): eye level from the platform's track edge. The long single-storey station house runs along the back: tiled roof with deep eaves, plank walls, glassless windows, a wide open doorway onto the benches inside, the timetable board, paper lanterns under the eaves, and the 寂海 sign on two posts. The dirt path leaves the platform's far end on the right into the forest, and the left end has none. This holds for every shot, act 3 included: the sign points right to 幽冥之都, and the map in the waiting room shows the forest path branching off toward 幽冥之都.
- **Waiting-room reference** (`_reference/jishui_waiting_room.png`, empty): a long low room with plank walls, cobwebbed roof beams and rows of slatted benches all facing one way. The front-wall windows look out onto the platform, the empty track and the black sea, with no moon in them. A torn parchment map of paths and forest hangs on the far end wall, and a barred ticket window sits in the corner. There are no lamps inside; moonlight falls in through the windows in pale shafts.
- **Sign:** 寂海 large, with ← 永恆之森 ｜ 幽冥之都 → beneath. It is readable only in the act 6 close-up (b1a_act6_sign). The image model kept writing the variant 恒, so 恆 there was retouched by hand to match the story text.

### 幽冥之都 (branch 1b, act 6)

A colossal ancient station, far larger than any normal one. Towering square stone pillars hold up a vast roof, and the dark stone walls are carved with symbols and totems that cannot be read. The platform is made of huge worn stone blocks. It has no lamps: only cold violet moonlight from the open side lights it. A huge stone sign board reads 幽冥之都. It is on the left side of the train like Jishui, so the right windows still show the sea and the two moons. b1b_act6_yomi_arrival fixes its look; pass it as a reference for any later shot there.

### Shot list, branch 1a

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| b1a_act4_frozen_families | Nobody dares move at the open door | B, medium, seated eye level from near the far end | the Kobayashi family and the Ito couple in front; the rest small and soft toward the open door |
| b1a_act4_lingmo_gone | Ling Mo's corner is empty | close detail, three-quarter | his empty far corner seat |
| b1a_act4_lijie_stands | Li Jie stands up | A, low angle from seat height, open door in the left foreground | Li Jie standing beside Emi, Yamamoto in the aisle, Saito at his pole; the students, Nakamura, Ito couple and Kobayashi family in their seats |
| b1a_act4_turned_on | Saito and the others turn on him | over Li Jie's shoulder, down the carriage | Li Jie from behind; Saito, Nakamura, Ito couple, students, Kobayashi family |
| b1a_act4_platform_alone | Li Jie alone on the platform | wide, railway behind the camera | Li Jie |
| b1a_act4_door_call | Yamamoto calls to him from the door | over the shoulders of the crowd at the open door | Yamamoto, Saito, Nakamura, the students at the door, Emi in her seat; Li Jie outside |
| b1a_act4_emi_steps_out | Emi steps down | low and close behind Emi in the doorway | Emi stepping out, Saito and Yamamoto reaching after her; Li Jie outside |
| b1a_act4_platform_pair | Emi on the platform with Li Jie | medium two-shot, side-on | Emi, Li Jie |
| b1a_act5_emi_resolve | Emi explains why she followed | close-up, slightly high | Emi |
| b1a_act5_rally | Yamamoto rallies the carriage | C, three-quarter toward the right bench | Yamamoto standing; Saito, the four students, Nakamura |
| b1a_act5_followers | Yamamoto and the students step out | three-quarter wide, slightly high, from the track edge | Yamamoto and the students stepping out toward Li Jie and Emi |
| b1a_act5_left_behind | Saito dashes for the door | B, seated eye level beside Nakamura | Saito running for the door; Nakamura and the Ito couple staying |
| b1a_act5_doors_close | The doors shut behind the group | medium-wide from the platform edge, train behind the camera | the eight on the platform |
| b1a_act5_gloating | The stayers gloat as the train pulls out | C, straight across to the left wall | Ito couple hugging, Nakamura jeering at the window, the Kobayashis cut off in the foreground; the eight small on the platform outside |
| b1a_act5_train_gone | The train is gone | wide, from behind the group, facing the sea | the eight, backs to camera, the empty track, the moons over the sea |
| b1a_act6_blame | The students blame Li Jie | medium-wide, station house behind | the students, Saito, Yamamoto, Li Jie, Emi |
| b1a_act6_sign | Li Jie reads the sign | close, over his shoulder | Li Jie, the sign |
| b1a_act6_waiting_room | The map in the waiting room | medium, three-quarter onto the map wall | Li Jie with his phone torch, Yamamoto, Emi |
| b1a_act6_through_window | The argument outside, watched through the window | inside, behind Li Jie and Emi at a front window | Li Jie, Emi; outside Yamamoto and Saito arguing with the four students on the platform |

Shown again with a `reuse` bg block in branch 1a: act3_s4 and act3_door_argument while the act 4 argument picks back up, lijie_stands while he answers them, platform_alone while he looks around, platform_pair from Emi's arrival on the platform (through the in-train reaction to her leaving) into the start of act 5, emi_resolve and train_gone as act 5 ends, train_gone again to open act 6, blame when Li Jie proposes the waiting room, and waiting_room when Yamamoto comes back in.

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

## Portraits

Portraits are generated on a plain backdrop and then cut out to a transparent PNG (1024x1536 RGBA) with `rembg` using the `birefnet-general` model. `isnet-anime` left dark clothing and grey cardigans semi-transparent, so don't use it.
