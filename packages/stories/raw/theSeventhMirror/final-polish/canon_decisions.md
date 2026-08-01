# Canon Decisions — Phase 1 Locks

> Locked <today> after Phase 0.5 reconciliation. These 8 decisions resolve conflicts the spec left silent or self-contradictory.
> **Authority:** these decisions are canon. Any plan-doc or prose edit in Phase 1+ must conform. Supersedes conflicting content in `docs/high-level-plan.md` (old) until Phase 3 rewrites it.
> Resolution rule applied: **accept-all-recs** (user-approved).

---

## D1 — Kotone surname origin: **stepfather** ✅
Kotone (白石琴音) and Misora (藤川美空) are half-sisters (**同母異父**) sharing a mother; their **different surnames come from their respective (step)father(s)** — NOT a birth-father origin.
- **Conform:** `docs/chapter_22_plan.md`, `docs/chapter_23_plan.md` (currently says birth-father — fix to stepfather), `docs/characters.md`.
- Prose (ch22 act8, ch23) already uses stepfather framing — keep.

## D2 — Kotone age: **19** ✅
Kotone is **19** throughout.
- **Conform:** `docs/characters.md` (currently says 20 — fix to 19).
- Plan/prose already use 19 — keep.

## D3 — ch4 Kotone message: **rewrite to ch1 canonical anchor** ✅
The ch4 message (`chapter_4/act1.md:27`) `琴音，我在第七車。有人倒下了。我現在在警署。` @21:17 is impossible (at 21:17 Mio had just entered the car; 千田 alive; no 警署 yet).
- **Canonical message** = ch1's pre-departure safety message (`chapter_1/act6.md:81`):
  > 琴音，我今晚要去確認一件事。如果 22:00 前我沒回覆你，就照約定的方式聯絡我。
- **Send-time:** evening **before** Mio departs for the platform (matching ch1), NOT 21:17.
- **Preserve:** the **21:19 read-time** anchor (`act1.md:29-33`) — the Task 2 micro-foreshadow depends on it.
- ch4 act1 must show the canonical message text + plausible pre-departure send-time + the 21:19 read-time.

## D4 — 21:19 read-receipt direction: **琴音 ignored 澪** ✅
At 21:19, **Kotone did not read/reply to Mio's message** (Kotone ignored 澪). This makes Kotone's intercept role legible.
- **Conform:** `chapter_6/act8.md` (currently reverses: 澪 ignored 琴音 — fix to match ch5's 琴音-ignored-澪).
- ch5 act4 already implies 琴音 ignored 澪 — keep as the reference.

## D5 — ch2 千田 on the monitored car: **does NOT name the mirror** ✅
千田 says `那件東西` / `背面給我看。` on the monitored car — he does **not** say `鏡子` aloud. Preserves Task 1 fair-play (anonymous sender's object type must not be inferable).
- **Conform:** `chapter_2/act1.md:69,83` (currently says 鏡子 twice — change to 那件東西).
- Aligns with `docs/chapter_3_plan.md §1.2` mandate.

## D6 — Mirror-origin flashback: **canonical = ch1 wording** ✅
The mirror-origin flashback appears in 3 incompatible wordings. Canonical:
- **Mirror back design:** ch1's `一個褪色的卡通圖案` with deliberate scratches (`chapter_1/act2.md:15,33`). **Drop** ch4's `背面印著一隻很醜的貓`.
- **Yuma's gift line:** ch1's `整天嫌這嫌那，照照鏡子吧` (`chapter_1/act2.md:21`). **Drop** ch4's `因為妳從來不照鏡子`.
- **Conform:** `chapter_4/act2.md:23` (align to ch1 canonical).
- Also fix ch4 `act5.md:91` 千田 misquote → plan-exact `他們會說那是救援。/不要救東京。`
- Also align ch4 `act7.md:117` dream-voice: canonical dream voice = ch1's `不要⋯⋯回頭` (`chapter_1/act1.md:21`). ch4's `不要⋯⋯打開` is drift — align to `不要⋯⋯回頭` to keep the recurring motif stable.

## D7 — MAR-CONT scope: **ch15 / ch21 / ch24 only** ✅
MAR-CONT / 23:50 / BCP retrofit targets are **ch15, ch21, ch24** per final_polish.md Task 12. ch17 is **out of scope** (Batch E checklist mention is overridden by the spec).
- No ch17 MAR-CONT addition. Phase 2 Task 12 builds ch15 + ch21 (ch24 already present ✅).

## D8 — ch10 琴音 at 清澄區民中心: **remove 琴音 from the scene** ✅
琴音 does **not** physically appear at the ch10 清澄區民中心 家屬接頭. Keeps her "弱登場／不新增重大破綻" per `docs/chapter_10_plan.md`.
- **Conform:** `chapter_10/act8.md` (remove 琴音's presence/eavesdropping/reaction to 美空 reference).
- Also remove/defer the prose-only 水瀨 line previewing the 美空 "回來但沒有醒" case (reserved for ch11).

---

## P0 prose-internal fixes (not decisions, but locked here for Phase 1)

### A1 — ch28 Kotone loop-language
`chapter_28/act3.md:21` Kotone: `這一輪能證明的，我會全部說` trips Task 2 Gate-1.
- **Fix:** rephrase to remove `這一輪` while preserving meaning — e.g. `今晚能證明的，我會全部說` or `能證明的部分，我會全部說`. Kotone remains loop-language-free.

### A2 — ch26 澪 thought contradicts 悠真-rescued canon
`chapter_26/act4.md` 澪 interior: `他還沒有被找到。他失蹤了…我還沒有找到他` — contradicts canon (悠真 already rescued, in external medical care; appears on video ch27, visits 紗英 ch28).
- **Fix:** rewrite the thought to reflect 悠真 is rescued but in external medical care (e.g., worry about his condition/separation, not missing-status). The system-record line above is correct — leave it.

### Task 7-adjacent — ch28 千田 testimony
`chapter_28/act5.md:62` 千田: `前兩輪——我死了` edges §1.2 (`千田沒有前輪記憶`).
- **Fix:** reframe so it is clearly his testimony about what the **record/evidence** shows, not a first-person memory claim (he already denies provability — make the framing consistent from the start of the line).

### ch28 name typo
`chapter_28/act5.md:163` `白崎琴音` → `白石琴音`.

---

## Out-of-scope for Phase 1 (deferred to Phase 5 / noted)

These surfaced in reconciliation but are P2 or non-Task-1-7; do **not** touch in Phase 1:
- ch3 "那件東西是什麼" double-ask; 日下部 over-complicit non-seizure → Phase 5 Batch B
- ch5 act8 stop-point overshoot; door-crack vs ch6 plastic-curtain; 19:08 vs 20:30 → Phase 5 Batch B
- ch11 speaker-tag `夢話` vs `夢話聲音`; 澪 anonymous-line mis-attribution → Phase 5 Batch C
- ch13 sealed-backup deferral logistics → Phase 5 Batch D
- ch15 typo `離線復舉`→`離線復舊` → Phase 5 Batch D
- ch20 凪原 wardrobe flip; meta `Chapter N` leaks → Phase 5 Batch E
- All Phase 2 missing seeds (Tasks 8–16) → Phase 2
