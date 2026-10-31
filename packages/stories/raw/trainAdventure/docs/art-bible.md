# Art bible, train carriage (acts 1-3)

The train carries exactly 16 passengers, the cast on the character sheet. No extras anywhere inside the train. A scene shows only the people its beat needs; nobody has to appear in every background.

## Carriage (identical in every in-train scene)

A single Chuo Line commuter carriage: continuous side-facing bench seats along both walls in dark navy patterned fabric, split into seat groups by silver stanchion poles; silver overhead grab rails with white hanging hand straps; flat white LED ceiling lights; large rectangular windows above the benches; sliding doors with yellow edging at both ends of each side; both end walls have the same plain grey connecting door with a small window; no advertisements, no text. Lighting and what shows through the windows change per scene, the carriage does not.

## Seating plan

It is a near-empty last train, so the passengers sit group by group with empty seats between the groups. Inside a group people sit side by side. Directions below are seen from the door end looking down the carriage (angle A).

- **Left bench, near to far:** Emi in the end seat against the partition, Li Jie beside her; a few empty seats; Yamamoto alone; a few empty seats; Ito Makoto and Ito Nana; several empty seats; Ling Mo alone in the far corner, always.
- **Right bench, near to far:** Saito Ren alone in the end seat by the door; a couple of empty seats; the four university students (Kenta, Asuka, Misaki, Takumi); a few empty seats; Nakamura alone; a few empty seats; the Kobayashi family (Yudai, Hina, Tomoko, Shota).

Anyone shown standing stands near their own seat, unless the beat needs them elsewhere (Yamamoto at the window in act3_s3).

## Camera angles

Each angle has an empty reference image under `packages/assets/media/train_adventure/backgrounds/_reference/`. Pass the matching reference first, then the portraits of the people in the shot.

- **A, down the length** (`carriage_master.png`): camera at the door end looking toward the far end. Wide shots that show the whole carriage.
- **B, reverse wide** (`carriage_reverse.png`): camera at the far end looking back. The right bench is on the left of the frame, near to far: Shota, Tomoko, Hina, Yudai; Nakamura; Takumi, Misaki, Asuka, Kenta; Saito. The left bench is on the right of the frame, near to far: Ling Mo; Ito Nana, Ito Makoto; Yamamoto; Li Jie, Emi.
- **C, across the aisle** (`carriage_side.png`): camera in the aisle facing one bench straight on, framed on one or two groups. Facing the left bench, left to right: Emi, Li Jie; Yamamoto; Ito Makoto, Ito Nana; Ling Mo. Facing the right bench, left to right: Shota, Tomoko, Hina, Yudai; Nakamura; Takumi, Misaki, Asuka, Kenta; Saito.

## Shot list

| Background | Beat | Angle | Who is in view |
| --- | --- | --- | --- |
| act1_s0 | Shinjuku platform | platform | Li Jie, students, Saito, Emi, Ling Mo |
| act1_s1 | Boarding, doors close | A | everyone, spread out in their groups |
| act2_s0 | City lights, quiet ride | C left, near | Emi, Li Jie |
| act2_s1 | Into the tunnel | A | everyone, dozing in their groups |
| act2_s2 | No signal, Saito explains | C right, middle | students, Saito standing |
| act2_s3 | Ito couple argue | C left, far | Ito couple, Ling Mo in the corner |
| act2_s4 | Boy cries, Nakamura agitated | C right, far | Kobayashi family, Nakamura |
| act2_s5 | Emi's spiral drawing | C left, close | Emi, Li Jie |
| act2_s6 | Blue-black glow ahead | B | everyone, in their groups |
| act3_s0 | Sea and two moons | C right, middle | students |
| act3_s1 | Panic | A | everyone, in their groups |
| act3_s2 | Emi terrified | C left, close | Emi, Li Jie |
| act3_s3 | Jishui station through the window | C right, near | Saito, Yamamoto at the window |
| act3_s4 | The door opens, nobody moves | C, facing the open door | Saito, Yamamoto |

There is no exterior shot: an outside view of the train never matched the interior, so the station is seen through the windows and the open door.

## Window views

- Acts 1-2: Tokyo night city on both sides, then the black tunnel (windows act as mirrors), then the blue-black glow.
- Act 3 onward: dark forest through the left windows, black sea with two violet crescent moons (one large, one small) through the right windows. Jishui station's platform is on the sea (right) side; its weathered sign reads 寂海.

## Portraits

Portraits are generated on a plain backdrop and then cut out to a transparent PNG (1024x1536 RGBA) with `rembg` using the `birefnet-general` model. `isnet-anime` left dark clothing and grey cardigans semi-transparent, so don't use it.
