# Art bible, train carriage (acts 1-3)

The train carries exactly 16 passengers, the cast on the character sheet. No extras anywhere inside the train.

## Carriage (identical in every in-train scene)

A single Chuo Line commuter carriage seen down its length: continuous side-facing bench seats along both walls in dark navy patterned fabric, split into seat groups by silver stanchion poles; silver overhead grab rails with white hanging hand straps; flat white LED ceiling lights; large rectangular windows above the benches; sliding doors near the camera end and a connecting door at the far end; no advertisements, no text. Lighting and what shows through the windows change per scene, the carriage does not.

## Seating plan

Camera stands at the door end looking down the carriage.

- **Left bench, near to far:** Li Jie and Emi side by side, Yamamoto, Ito Makoto and Ito Nana side by side, Ling Mo alone in the far corner with his hood up.
- **Right bench, near to far:** Saito Ren alone, the four students in a row (Kenta, Asuka, Misaki, Takumi), Nakamura alone, the Kobayashi family in a row (Yudai, Tomoko, Hina, Shota).

That is 16. Anyone shown standing in a scene stands next to their own seat.

## Camera angles

Every train scene uses one of three fixed angles, each with its own empty reference image under `packages/assets/media/train_adventure/backgrounds/_reference/`. Pass the matching reference first when generating a scene.

- **A, down the length** (`carriage_master.png`): camera at the door end looking toward the connecting door. Used for ensemble beats: act1_s1, act2_s2, act2_s3.
- **C, across the aisle** (`carriage_side.png`): camera in the aisle facing one bench straight on, windows above it. Facing the left bench, the seat order reads left to right Li Jie, Emi, Yamamoto, Ito Makoto, Ito Nana, Ling Mo. Facing the right bench, it reads Shota, Hina, Tomoko, Yudai, Nakamura, Takumi, Misaki, Asuka, Kenta, Saito. Used for act2_s0, act2_s1, act3_s0, act3_s1.
- **D, outside on the platform** (`carriage_exterior.png`): the same car's side at the Jishui platform. Silver stainless body, one thin navy stripe below the windows, doors with yellow edging. Used for act3_s2.

## Window views

- Acts 1-2: Tokyo night city on both sides, then the black tunnel, then the blue-black glow ahead.
- Act 3 onward: dark forest through the left windows, black sea with two violet crescent moons through the right windows. Jishui station's platform is on the sea (right) side, with the forest rising behind the train.

## Portraits

Portraits are generated on a plain backdrop and then cut out to a transparent PNG (1024x1536 RGBA) with `rembg` using the `birefnet-general` model. `isnet-anime` left dark clothing and grey cardigans semi-transparent, so don't use it.
