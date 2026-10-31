# Art bible, train carriage (acts 1-3)

The train carries exactly 16 passengers, the cast on the character sheet. No extras anywhere inside the train. A scene shows only the people its beat needs; nobody has to appear in every background.

## Carriage (identical in every in-train scene)

A single Chuo Line commuter carriage: continuous side-facing bench seats along both walls in dark navy patterned fabric, split into seat groups by silver stanchion poles; silver overhead grab rails with white hanging hand straps; flat white LED ceiling lights; large rectangular windows above the benches; sliding doors with yellow edging at both ends of each side; both end walls have the same plain grey connecting door with a small window; no advertisements, no text. Lighting and what shows through the windows change per scene, the carriage does not.

## Seating plan

It is a near-empty last train, so the passengers sit group by group with empty seats between the groups. Inside a group people sit side by side. Directions below are seen from the door end looking down the carriage (angle A).

- **Left bench, near to far:** Emi in the end seat against the partition, Li Jie beside her; a few empty seats; Yamamoto alone; a few empty seats; Ito Makoto and Ito Nana; several empty seats; Ling Mo alone in the far corner, always.
- **Right bench, near to far:** Saito Ren alone in the end seat by the door; a couple of empty seats; the four university students (Kenta, Asuka, Misaki, Takumi); a few empty seats; Nakamura alone; a few empty seats; the Kobayashi family (Yudai, Hina, Tomoko, Shota).

Anyone shown standing stands near their own seat, unless the beat needs them elsewhere (Yamamoto at the window in act3_s3).

## Camera angles and framing

Vary both the camera position and the distance from scene to scene; never run the same framing twice in a row. The empty reference images under `packages/assets/media/train_adventure/backgrounds/_reference/` fix the carriage design: pass the closest one first, then the portraits of the people in the shot.

- **A, down the length** (`carriage_master.png`): camera at the door end looking toward the far end.
- **B, reverse** (`carriage_reverse.png`): camera at the far end looking back. The right bench is on the left of the frame, near to far: Shota, Tomoko, Hina, Yudai; Nakamura; Takumi, Misaki, Asuka, Kenta; Saito. The left bench is on the right of the frame, near to far: Ling Mo; Ito Nana, Ito Makoto; Yamamoto; Li Jie, Emi.
- **C, across the aisle** (`carriage_side.png`): camera facing one bench straight on. Facing the left bench, left to right: Emi, Li Jie; Yamamoto; Ito Makoto, Ito Nana; Ling Mo. Facing the right bench, left to right: Shota, Tomoko, Hina, Yudai; Nakamura; Takumi, Misaki, Asuka, Kenta; Saito.
- **Free framings** (use `carriage_master.png` for the design): three-quarter diagonal along a bench, low angle from seat height, high angle from the ceiling, over-the-shoulder, close-up and detail insert. Seat positions still follow the plan above.

## Shot list

| Background | Beat | Framing | Who is in view |
| --- | --- | --- | --- |
| act1_s0 | Shinjuku platform | wide, platform | Li Jie, students, Saito, Emi, Ling Mo |
| act1_s1 | Boarding, doors close | A, wide, eye level | everyone, spread out in their groups |
| act2_s0 | City lights, quiet ride | three-quarter diagonal, medium | Emi, Li Jie (Yamamoto far off) |
| act2_s1 | Into the tunnel | close-up, side view against the black window | Li Jie (Emi at the edge) |
| act2_s2 | No signal, Saito explains | low angle, medium | Saito standing, students seated |
| act2_s3 | Ito couple argue | C, medium, straight on | Ito couple, Ling Mo in the corner |
| act2_s4 | Boy cries, Nakamura agitated | three-quarter close-up | mother, boy, girl (father, Nakamura blurred) |
| act2_s5 | Emi's spiral drawing | over-the-shoulder insert | Emi's sketchbook and hand |
| act2_s6 | Blue-black glow ahead | B, extreme wide | everyone, in their groups |
| act3_s0 | Sea and two moons | from behind, medium-wide | students at the windows |
| act3_s1 | Panic | high angle, tilted wide | everyone, in their groups |
| act3_s2 | Emi terrified | close-up | Emi (Li Jie blurred in front) |
| act3_s3 | Jishui station | over Yamamoto's shoulder | Yamamoto, the station through the window |
| act3_s4 | The door opens, nobody moves | straight on at the open door | Saito, Yamamoto |

There is no exterior shot: an outside view of the train never matched the interior, so the station is seen through the windows and the open door.

## Window views

- Acts 1-2: Tokyo night city on both sides, then the black tunnel (windows act as mirrors), then the blue-black glow.
- Act 3 onward: dark forest through the left windows, black sea with two violet crescent moons (one large, one small) through the right windows. Jishui station's platform is on the sea (right) side; its weathered sign reads 寂海.

## Portraits

Portraits are generated on a plain backdrop and then cut out to a transparent PNG (1024x1536 RGBA) with `rembg` using the `birefnet-general` model. `isnet-anime` left dark clothing and grey cardigans semi-transparent, so don't use it.
