# Gate 2 — 伏筆公平測試 (Foreshadow-Fairness Audit)

> **Story:** 《神鏡七日》 (theSeventhMirror)
> **Phase:** 2, Gate 2
> **Method:** `rg` over `chapter_*/act*.md` (ch1–28) for each endgame mechanism's signature tokens; earliest hit = first appearance.
> **Gate rule** (final_polish.md §6): any endgame mechanism whose **first appearance is ch26 or ch27 = FAIL**. ch26/27 must only *pay off* previously-seeded mechanisms, never *introduce* one.
> **Scope:** prose only (`chapter_*/act*.md`). Plan files excluded (fairness is measured against what the *reader* sees).
> This audit ran **after** Phase 2 seed-planting (CHANGELOG_FINAL_POLISH.md T8–T16).

---

## Verdict table

| # | Mechanism | First-appearance chapter | Gate 2 | Notes |
|---|---|---|---|---|
| 1 | **M-00 / Mother Reference** (母體/M-00/基準母體) | **ch19** (act9/act10) | ✅ PASS | 澪's realization of 母體 lands ch19; the four-lineage build is ch20 (T13). ch26–28 only pay off. |
| 2 | **KAGAMI / Execution Anchor** (KAGAMI/執行錨點/K-01) | **ch20** (act2) | ✅ PASS | Phase 2 T13 seed in ch20 act2; wired to ch21 COMMIT-GATE. ch26/27 = execution, not introduction. |
| 3 | **Witness sideband** (sideband/witness/事後標記) | **ch20** (act2) | ✅ PASS | Phase 2 T13 seed in ch20 act2. ch26–28 pay off (egress / audit). |
| 4 | **Independent Analog Monitor** (wideband/類比監測) | **ch20** (act2) | ✅ PASS | Phase 2 T13 seed (wideband/類比) ch20 act2; reinforced ch21 act1/act2. |
| 5 | **Patient matrix / R5** (TOTAL HUMAN RECORDS/G07／05/LEGACY／04/ACTIVE／C/ACTIVE／D/R5) | **ch12** (act1, `G07／12`) — fully built **ch22** | ✅ PASS | Patient-ID seed ch12 (scratch mark `G07／12`); classification framework (LEGACY／, ACTIVE／REMOTE CAL, TOTAL HUMAN RECORDS, M-00/G07／03/LEGACY／02) ch22 act2/act3; `KAGAMI-SAFE／R5` version ch24 act1. ch26's canonical IDs (G07／05, LEGACY／02/04, ACTIVE／C/D) are **payoff of the ch22/ch24 matrix**, not introduction. |
| 6 | **MAR-CONT / 23:50 BCP** (BCP CUTOVER/MAR-CONT/23:50) | **ch15** (act4) | ✅ PASS | Phase 2 T12 seed: `BCP CUTOVER　23:50` / `PREPOSITION WINDOW 23:50–05:50` / `MAR-CONT　PROTECTIVE TRANSFER CLASS` (ch15 act4:41–45). Reinforced ch21 act5, ch24 act8, ch25. ⚠️ The `23:50` in **ch7 act4:7** is an unrelated ambient ER timestamp (`23:50。等候區。販賣機旁。`) — **not** the BCP mechanism. |
| 7 | **Seven-second / ECHO PEAK** (ECHO PEAK/7000ms/FANOUT GATEWAY/06:12:53) | **ch4** (act5/act8) | ✅ PASS | Core anomaly seeded ch4: phone-alert push "延遲了七秒" / `一秒。兩秒。三秒。⋯⋯七秒。` (ordinary explanation at the time = phone/network lag — textbook fair-play seed). Technical schema *name* (ECHO PEAK / FANOUT GATEWAY) added ch21 act3 (T11); the specific `06:12:53` timestamp intentionally deferred to ch27. |
| 8 | **Subject Bay / latch** (Subject Bay/all-human latch/clinical latch) | **ch26** (act2/act3) | ❌ **FAIL** | `Subject Continuity Bay`, `clinical latch`, `live subject ledger`, `lease snapshot` are all **first named in ch26** (act2:77, act3:67, act3:109). No pre-ch26 hit for `Subject`, `Bay` (as containment), `latch`, `掛載`, `cutover lease`, `載體/收容/承載/受體`, or any `艙` meaning containment-bay. The `Bay` hits in ch1/2/4/6/8 are geographic ("Tokyo Bay"); ch7 `patient bays` = ER cubicles; ch17/18 explicitly rule *out* `Bay 2` (`B2 不是 Bay 2`). **Needs Phase 5 back-seed.** |
| 9 | **Authorization capsules / trust domains** (trust domain/授權膠囊/Science HSM) | **ch24** (act7/act8, HSM) | ✅ PASS | `CONTINUITY HSM` + 七個離線區域 HSM (ch24 act7/act8) is the auth/hold hardware seed; `trust domain` + 5 regional domains enumerated ch25 act4 (T16). ch26/27 = operation. (Note: the literal term `授權膠囊`/`capsule` does **not** appear in prose — the mechanism is expressed entirely via HSM + trust-domain, so those are the tokens that carry the seed.) |
| 10 | **Radio / 70-year signal** (短波/接收器/座標在唱/七十年/收音機) | **ch1** (act2) | ✅ PASS | Phase 2 T8 seed (短波接收器 / 收音機靜電) ch1 act2. Tone-sequence `座標在唱` ch9/ch10 (T10); `七十年` window ch20/ch23. |

---

## Mechanisms that FAIL Gate 2 (first-appear ch26/27)

### ❌ M8 — Subject Bay / latch
- **First appearance:** ch26 (act2:77 `R1 的 latch`; act3:67 `Subject Continuity Bay` / `clinical latch` / `live subject ledger`; act3:109 `她不操作 latch。她不進 Bay。`).
- **Why it fails:** the physical containment mechanism — the *Subject Continuity Bay* location and the *clinical latch* primitive that holds patients and that ch27's break-glass tries to cross (ch27 act3:11 `TARGET CLINICAL DEPENDENCY LATCH`) — is introduced in ch26. It is the single endgame mechanism the reader meets for the first time inside the ch26/27 fail-window.
- **Partial mitigation (does NOT clear the gate):** the *authorization-layer* relatives exist earlier — `CLINICAL HOLD` as a COMMIT-GATE status field (ch21 act3:125) and `CONTINUITY HSM` / 七個離線區域 HSM (ch24). But those are *who-authorizes-the-hold* mechanisms; the *where-the-hold-physically-lives* Bay + latch is not foreshadowed. Phase 2 T16 added trust domains to ch25 but did **not** plant a Subject Bay seed (changelog confirms ch26 "Subject Bay mount condition present" was pre-existing, and no earlier seed was added).
- **Recommended Phase 5 back-seed:** in **ch24 or ch25** (where the CONTINUITY/regional HSM hold is already discussed), add one low-intensity line naming the physical containment — e.g. have 日下部 or the 獨立系統安全人員 note that the hold resolves to a *Subject Continuity Bay* whose door is governed by a *clinical latch* (status only, no geography/IDs revealed). That converts ch26 from "introduce" to "pay off" and clears Gate 2 without leaking any ch26 payoff detail.

---

## ch26/ch27 introduction check (sanity)

For the 9 PASS mechanisms, ch26/27 contain **only payoffs**, never first-mentions:
- M1 母體 → payoff of ch19/ch20. M2 KAGAMI → execution of ch20/ch21 anchor. M3 sideband → egress/audit of ch20 seed. M4 analog → readout of ch20/ch21 monitor.
- M5 patient matrix → ch26 canonical IDs resolve the ch22/ch24 framework; ch27 enforces patient-count constraint.
- M6 BCP/MAR-CONT → ch26 executes the ch15/ch21/ch24 cutoff. M7 seven-second → ch27 fires `06:12:53` (deferred timestamp) on the ch4/ch21 seed.
- M9 HSM/trust → ch26 operates the ch24/ch25 auth chain. M10 radio → ch26/ch28 deliver the ch1/ch9/ch10 signal thread.
- The **only** first-mention inside the window is M8 (above).

---

## Overall Gate 2 verdict

> **❌ FAIL (conditional)** — 9 of 10 endgame mechanisms first appear before ch26.
> **1 mechanism fails:** **M8 Subject Bay / latch** (first appears ch26).
>
> Gate 2 passes globally once M8 receives a Phase 5 back-seed in ch24/ch25. No other mechanism requires rework. Phase 2 seed-planting (T8/T10/T11/T12/T13/T15/T16) successfully unblocked the four ch20 tech lineages, the patient matrix, the BCP/MAR-CONT chain, and the seven-second schema — all now clear the ch26/27 introduction bar.
