# Audit 1 & 6 — Timeline/Geography + Technical System

> **Story:** 《神鏡七日》(theSeventhMirror) — all 28 chapters
> **Auditor:** Cross-cutting audit subagent
> **Date:** 2026-07-29
> **Primary sources:** `canon/01_master_timeline.md` (Bible 1), `canon/04_system_medical_rules.md` (Bible 4)
> **Spot-checks:** `chapter_N/act*.md` for N=1..28; cross-referenced with `canon/03_evidence_ledger.md` (Bible 3), `canon/05_clue_foreshadowing_map.md` (Bible 5), `final-polish/canon_decisions.md`, `final-polish/gate4_bible_crosscheck.md`

---

## Summary Verdicts

| Audit | Scope | Verdict | Issues |
|---|---|---|---|
| **1 — 時間與地理** | Timeline, geography, transit, shifts, sleep, white-light cycle, ch28 layers | ✅ **PASS** | 0 blocking, 1 minor note |
| **6 — 技術系統** | End-to-end technical flow diagram, path/key/domain separation, override discipline | ✅ **PASS** | 0 blocking, 1 minor note |

**BLOCKER count: 0.** No timeline contradictions, no teleporting POVs, no collapsed technical paths, no dual-domain keys, no undefined overrides. One cross-bible scope tension (ch28 `MAR-CONT`) noted as MINOR — the prose handles its spirit correctly but it technically strains the D7/Bible 4 §8 scope statement.

---

# AUDIT 1 — 時間與地理 (Timeline / Geography)

## A1.1 逐章起訖時間 vs Bible 1 §11 — ✅ PASS

Cross-checked each chapter's stated opening/closing time against Bible 1 §11 (逐章起訖時間速查) and the in-prose `距下一次星期一 06:13` countdowns. All 28 chapters conform.

Spot-verified countdown arithmetic (the most failure-prone dimension):

| Chapter | Prose countdown | Computed from §11 | Match |
|---|---|---|---|
| ch17 act8 (end ≈ Mon 11:30) | 約六日十八小時四十三分 | Mon 11:30 → next Mon 06:13 = 6d 18h 43m | ✅ EXACT |
| ch18 act1 (≈ Mon 12:20) | 約六日十七小時五十三分 | 11:30 baseline +50m → 6d 17h 53m | ✅ |
| ch21 act1 (Wed 08:15) | 約四日二十一小時五十八分 | Wed 08:15 → next Mon 06:13 = 4d 21h 58m | ✅ EXACT |
| ch16 act1 (Sun 07:00) | 約二十三小時十三分 | Sun 07:00 → Mon 06:13 = 23h 13m | ✅ EXACT |
| ch15 act6 (Sat 22:30) | 約一日七小時四十三分 | Sat 22:30 → Mon 06:13 = 1d 7h 43m | ✅ EXACT |
| ch25 act1 (Sun 05:40) | opens 05:40 | §11: ch25 start 05:40 | ✅ |

The countdown discipline is internally consistent and arithmetically sound across R2 (ch12–16) and R3 (ch17–25). Countdowns update within chapters as acts progress.

## A1.2 同一 POV 兩地出現 (no character in two places) — ✅ PASS

- **澪 (Mio):** single continuous POV per chapter; no overlap.
- **琴音 (Kotone):** the only structural risk (21:04 維修服 vs alibi). ch23 locks her as the 21:04 construction-passage figure via 當輪 evidence (門禁/工單/影像), and Bible 1 §3 ch23 + Bible 2 §10.4 explain the 21:19 read-receipt (D4: 琴音 ignored 澪 — she was on the construction-route egress / support-task report). ch10 removes her physical presence at 清澄區民中心 (D8). No double-presence.
- **日下部 (Kusakabe):** appears in sequence; no overlap.
- D8 (ch10 Kotone removal) and D4 (21:19 direction) both confirmed applied in prose.

## A1.3 交通時間 (transit realism) — ✅ PASS

- ch1 朝倉家(江東區)→警察署→大學咖啡店→睡眠支援計畫東京分部→灣岸新交通月台: same-day chain across Tokyo, plausible for 06:13–21:17.
- ch6–7 施工通道→站務安全區→救護車→灣岸中央急救醫療中心 (22:45–23:10 transit): ~25 min ambulance + night roads — realistic.
- ch26–27 鏡島 (Tokyo Bay artificial island): all personnel pre-positioned; no same-night cross-city jumps.
- ch17 筑波後方服務口 (Monday early-morning logistics window): consistent with Bible 1 §8 shift note.

## A1.4 醫療／警察輪班 (medical/police shifts) — ✅ PASS

- ch7–8 灣岸中央急救醫療中心 **夜間急診值班**: 澪 held as witness through the night (00:50–03:30 ch8); 02:40 千田觀察區急變 triggers night-shift resuscitation — consistent with overnight ER staffing.
- ch8 02:40 code response: realistic night-shift medical event.
- ch26 鏡島 00:05–05:49 全員輪班 (現場 + 遠端): pre-staged multi-role overnight operation.

## A1.5 睡眠 (sleep realism) — ✅ PASS

| Ch | Bible 1 §8 sleep record | Prose | Match |
|---|---|---|---|
| ch3–4 | R1 Mon-night questioning, minimal sleep | confirmed | ✅ |
| ch5 | R2 06:13 wake; 琴音 asks "是否又一夜沒睡" | confirmed | ✅ |
| ch7–8 | R2 Mon-night hospital wait, no sleep | confirmed | ✅ |
| ch9 | R2 Tue 04:30 home, no real sleep, writes diff table | confirmed | ✅ |
| ch11 | **R2 Wed: 澪短暫睡過數小時** (credibility requirement) | confirmed | ✅ |
| ch14–16 | R2 Fri–Sun cumulative sleep debt | confirmed | ✅ |
| ch20 | **R3 Tue eve: forced food + ~30 min short sleep** | confirmed | ✅ |
| ch26 | R3 Mon 00:05–05:49 all-night鏡島 operation | confirmed | ✅ |

The ch11 credibility-mandated sleep and ch20 forced short sleep are both present — the two places where the plan explicitly requires sleep to maintain推理可信度.

## A1.6 白光週期 06:13 錨點 — ✅ PASS

- 06:13 anchor appears consistently as the loop-arrival time across R1 (ch1), R2 (ch5), R3 (ch17).
- ch17 act1 opens "06:13。星期一。朝倉家。" (third awakening) ✓
- R1/R2 return at 06:13; R3 does NOT return (06:13:01 time continues) — confirmed in ch28 act7 (澪 watches 06:13 pass, "06:13:01。06:13:02。06:14").
- `ECHO PEAK = 06:13:00` consistent across ch21 act3 (schema), ch27 act7–8 (execution).

## A1.7 關鍵時間戳 23:50／05:50／06:13 — ✅ PASS

| Timestamp | Required chapters | Found in prose | Note |
|---|---|---|---|
| **06:13** | ch1/4/5/17 (+ ch27 end) | all present ✅ | loop anchor |
| **06:12:53** | ch27 only (NOT ch21) | ch27 act7 ✅; ch21 = 0 matches ✅ | D1/flag#2 honored — ch21 shows only relative ±7000ms, no absolute calc |
| **06:20** | ch24(預告)/ch27/ch28 | ch25 act8 lease valid-until, ch28 expiry ✅ | LEASE EXPIRY |
| **05:50** | ch24(預告)/ch26 end/ch27 start | ch27 act1 "05:50:00" ✅ | ANNOUNCE start |
| **23:50** | ch7(scene)/ch24(預告)/ch25/ch26 | ch25 act8 lease issued ✅; ch7 act4 ambient ER ✅ | BCP cutover vs unrelated ER timestamp correctly distinguished (Bible 5 C7.1) |

- **ch7's 23:50** is correctly an unrelated ambient ER timestamp (`23:50。等候區。販賣機旁。`), NOT the BCP mechanism — Gate 2 M6 and Bible 5 C7.1 both confirm; prose does not conflate them. ✅
- **06:12:53 in ch21 = ABSENT** ✅ — the D1/Bible 4 flag #2 requirement (ch21 characters know only relative +7000ms; absolute timestamp comes from bundle metadata in ch27) is honored. Verified ch21 has zero occurrences of `06:12:53` / `06:12:5` / `12:53`.

## A1.8 場景時間戳 21:04／21:17／21:19／22:18／18:42 — ✅ PASS

| Timestamp | Required chapters | Prose | Match |
|---|---|---|---|
| **21:04** | ch6(R2), ch18(預告), ch23(R3 鎖定) | ch6 act1/act5, ch18 act3, ch23 act1/act3/act4 ✅ | all 3 present |
| **21:17** | ch1, ch2, ch4 | ch1 act6 (anon msg), ch4 act2 (timeline) ✅ | ch2 opens at boundary time without restating the number — acceptable (chapter-span timestamp, not a beat that must repeat) |
| **21:19** | ch1, ch4, ch5(回顧), ch23(解釋) | ch4 act1 (read-receipt anchor), ch5 act2 (回顧) ✅ | ch1 act6 shows message sent but NOT yet read ("已送達。沒有已讀") — correct, the 21:19 read lands in ch4 per D3. ch23 conveys the explanation via the 21:04 evidence chain + "沒有已讀標記" (act1:123) rather than restating the literal timestamp. |
| **22:18** | ch6(章末), ch7(開頭) | ch6 act8 (message), ch7 act1 opens 22:20 (processing) ✅ | ch7 begins the questioning beat at 22:20; the 22:18 message handling is the implied chapter entry — consistent with Bible 1 §2 (22:18 處理訊息 → 22:20 問話). |
| **18:42** | ch5(R2), ch18(R3) | ch5 act5, ch18 act3/act5 ✅ | both present; ch18 seals prediction at 07:15, message arrives 18:42,排程憑證早於06:13 — anti-collusion chain intact |

The D3 canonical message (ch1 pre-departure safety message, NOT @21:17) and D4 direction (琴音 ignored 澪) are both reflected in prose.

## A1.9 Chapter 28 三個時間層 — ✅ PASS

ch28 act structure maps cleanly to Bible 1 §7's three time layers:

| Layer | Bible 1 §7 | ch28 acts | Match |
|---|---|---|---|
| 第一層 (Mon 06:13:01–11:30) | immediate aftermath, 06:20 lease expiry, 08:00 紗英 decision, 10:00 日下部 handoff | act1「下一秒」, act2「五名患者」, act3「這一輪能證明」, act4「母親只是患者」, act5「活人與具體決定」, act6「不知道只是還不知道」 | ✅ |
| 第二層 (24h/weeks/3 months) | patient bridge sequence, legal/disciplinary, 紗英 brief awakening | act6 (father MAR-CONT evidence), act7「普通時間」(daily 06:13 checking ritual over months) | ✅ |
| 第三層 (~half year) | wideband receiver, narrowband multi-tone, pulsar map, 70-year window | act8「七十年」 | ✅ |

- **Locked final sentence** present verbatim in act8:151–155: "收音機裡沒有倒數。／只有一個必須用七十年走到的座標。／未來第一次留在前面。" ✅
- The three layers are distinct and non-overlapping in time.

## A1.10 Canon-decisions timeline-adjacent fixes — ✅ ALL APPLIED

| Fix | Check | Status |
|---|---|---|
| D3 (ch4 message → ch1 canonical anchor, preserve 21:19) | ch1 act6 canonical message, ch4 act1 21:19 read-time | ✅ applied |
| D4 (21:19 琴音 ignored 澪) | ch6 act8 direction corrected | ✅ applied |
| A1 (ch28 act3 Kotone loop-language) | act3:21 Kotone line now "現在能證明的，我會全部說" (這一輪 removed from her speech); act title + 澪 interior retain 這一輪 (authorial/澪-POV, permitted) | ✅ applied |
| A2 (ch26 悠真 thought) | act4:97 "悠真。safe-detached...已經被救" — missing-status gone | ✅ applied |
| ch28 name typo | act5:163 "白石琴音" (was 白崎) | ✅ applied |
| Task7-adjacent (千田 testimony) | act5:62 "那不是我親身記得的事。我沒有——前輪的親身記憶" — record-attributed framing | ✅ applied |

## A1 Note (minor, non-blocking)

- **N1-T:** ch23 does not restate the literal `21:19` timestamp when explaining the Kotone alibi; the explanation is conveyed through the 21:04 evidence chain and "沒有已讀標記" (act1:123). This is a stylistic choice, not a contradiction — Bible 1 §4 lists ch23 as the "解釋" chapter for 21:19, and the explanation content (琴音 on construction-route egress) is present in Bible 1 §3 ch23 + Bible 2 §10.4. No fix required.

---

# AUDIT 6 — 技術系統 (Technical System)

## A6.1 End-to-End Flow Diagram — verified across ch24–ch28 ✅

The complete endgame flow was traced through the prose. All four sub-paths are present and **kept distinct** (no two collapsed into one):

```
[1] SIGNAL → PROTECTIVE FILTER → CLINICAL BRANCH → PATIENT ROOTS
    ch27 act8:15  "protective filter——ACTIVE. FILTER LOAD—WITHIN LIMIT.
                   HIGH-COHERENCE COUPLING—SUPPRESSED.
                   RAW SIGNAL TO PUBLIC CONSENSUS—BLOCKED."
    ch27 act8:57  "clinical branch——ACTIVE"
    ch27 act8:57  "兩個 LOCAL CONTROL PRIMARY。六個 HOLD／SAFE PAUSE／COMPARE"

[2] TOKYO-7 → SCIENCE TOKEN → OPERATIONAL TOKEN → LEASE → PREPOSITION
    → KAGAMI EXECUTION ANCHOR → CONSENSUS/PUBLIC
    ch25 act8:67  CUTOVER AUTH LEASE assembled: BUNDLE HASH TOKYO-7,
                  SCIENCE TOKEN + OPERATIONS TOKEN, ISSUED SUN 23:50,
                  VALID UNTIL MON 06:20
    ch26 act6:31  "KAGAMI 不簽。它不簽 execution anchor"
    ch27 act8:21  "EXECUTION ANCHOR—NOT ISSUED.
                   TOKYO-7 CONSENSUS OUTPUT—NONE"

[3] ORDINARY MARKER → CENTRAL APP GATEWAY → +7000ms FOLLOW-UP
    ch27 act7:7   06:12:53 central sequencing gateway
    ch27 act7:9   "唯一一條...區域 cluster 只能建立 send object。
                   不能——直接向 provider fanout" (single choke point)
    ch27 act7:59  "CANCEL—ACCEPTED" (pre-fanout)
    ch27 act7:75  "ORDINARY APP—ACTIVE" (ordinary services continue)
    ch27 act8:21  "MOBILE FOLLOW-UP—CANCELLED"

[4] WITNESS BUFFER → CONSENT FILTER → PREPOSITIONED ENVELOPES
    → RELEASE KEYS → OPT-IN INDEX
    ch27 act8:31  "WITNESS KEY RELEASE—RELEASED OR SAFETY-DEFERRED"
                  (priority below filter/clinical/abort)
    ch27 act8:37  "PUBLIC WITNESS INDEX—ONLINE.
                   OPT-IN NOTICE—SENT. SINGLE ORDER—NONE"
```

## A6.2 沒有兩條路被錯寫成一條 (no two paths written as one) — ✅ PASS

The three output paths at 06:13 are explicitly separated in ch27 act8:57–61:
- **Consensus/public path:** `CONSENSUS OUTPUT—NONE` / `EXECUTION ANCHOR NOT ISSUED` (blocked)
- **Clinical path:** `clinical branch—ACTIVE` / `LOCAL-PRIMARY 2, SAFE PAUSE/HOLD 6` (runs independently)
- **Witness path:** `witness index—ONLINE` / `OPT-IN NOTICE—SENT` / `SINGLE ORDER—NONE` (separate sideband)

The witness path is permanently separate from consensus (Bible 4 §14): ch27 act8:33 "witness channel 的優先級——低於 filter。低於 clinical。低於 abort" — three distinct priority tiers, never merged.

## A6.3 沒有同一密鑰兼任兩領域 (no key serves two domains) — ✅ PASS

Two independent two-domain separations verified:

**(a) Capsule domains (ch24):** Domain-P (`KAGAMI PUBLIC／MAINTENANCE AUTH`) vs Domain-C (`PATIENT CLINICAL SHADOW ROOT`, bound G07/03). ch24 act5 confirms:
- Independent power, clock, reset domains (act5:33–35: "三條獨立電力軌。三個獨立時鐘源。兩個獨立重置迴路")
- `QUARANTINE-P` only modifies Domain-P; Domain-C unchanged (act5:29, :182: "Domain-C 狀態—UNCHANGED")
- No cartridge removal, no patient rebinding (act5:45)
- Remote restoration forbidden via revocation epoch (act5:145–149)

**(b) Lease token domains (ch25):** Science token vs operational token from cryptographically separated HSMs. ch25 act8:53 (千田): "兩個 token 分別由兩個密碼學分離的 HSM 產生。science token 來自 S7 science escrow。opera[tional...]". Bible 4 §7 confirms SHARE-S (science) ≠ SHARE-O/SHARE-CONT (operational); the two HSM domains never cross-sign.

No single key serves two domains in either axis.

## A6.4 沒有未定義 override (no undefined override) — ✅ PASS

- **Clinical latch / break-glass (ch27 act3):** physical break-glass requires three domain shares; all three DENY:
  - `MEDICAL SAFETY SHARE — DENY` (八名 ACTIVE HUMANS 尚未全部安全切離)
  - `PATIENT-RIGHTS SHARE — DENY`
  - `LOCAL OPERATIONS SHARE — DENY`
  - → `BREAK-GLASS DENIED`, panel archived to immutable audit log (act3:77). Matches Bible 4 §9.
- **Seven-stage clock (ch27):** every patient's stage ceiling pre-signed in ch26 (Bible 4 §11 constraint); countdown cannot raise any ceiling. Only G07/05 and LEGACY/04 enter HANDOFF; others stop at COMPARE/HOLD/SAFE PAUSE.
- **App cancel (ch27 act7):** cancellation is pre-authorized (`LOCAL OPERATIONS ARM—PRE-AUTHORIZED`, act7:33), not an ad-hoc override; HSM policy pre-loaded at 05:49 auto-verifies, no new human signing in the 7-second window.

## A6.5 沒有終局臨時新通道 (no endgame ad-hoc new channel) — ✅ PASS (with 1 minor scope note)

All endgame channels are pre-existing / pre-authorized:
- Seven-stage clock = pre-existing G07 clinical maintenance protocol (Control Quiet Window, Bible 4 §12), not a new design.
- Witness sideband = established ch20 (Bible 4 §14), pre-positioned ch26.
- App gateway cancellation = pre-authorized conditional cancel, not a new path.
- Lease = assembled from existing S7/operational HSM infrastructure.

The prose explicitly guards against the "new endgame channel" trap. **ch28 act6:75** (澪 interior on MAR-CONT): "不是——最終章新開的秘密海上基地。是——既有的程序分類。前章的 BCP 文件裡出現過。" — the author anticipates and explicitly disclaims an ad-hoc channel.

## A6.6 不會因 public HOLD 關閉 clinical branch — ✅ PASS

This is the single most important safety invariant, explicitly demonstrated:
- ch27 act3:23 — when break-glass is DENIED, the narration ties the denial to clinical preservation: "MEDICAL SAFETY SHARE — DENY...CLINICAL BRANCH [preserved]".
- ch27 act8:57 — at peak, consensus/public is NONE (HOLD), yet **"clinical branch——ACTIVE"**.
- ch27 act8:61 — summary: "CLINICAL——LOCAL-PRIMARY 2／HOT STANDBY RETAINED。SAFE PAUSE／HOLD 6" while "TOKYO-7—EXECUTION ANCHOR NOT ISSUED. CONSENSUS OUTPUT NONE."
- The clinical branch and the consensus/public branch are provably independent: collapsing public does not collapse clinical. ✅

## A6.7 app cancel 不影響普通服務 — ✅ PASS

ch27 act7 is explicit and repeated:
- act7:27 — `ORDINARY SERVICE EXCLUDED?——YES` (HSM policy check)
- act7:55 (澪): "不是——所有官方服務。不是——所有警報...只是——這一則...其他警報——不要動。ordinary safety notice——繼續。普通公共服務——繼續"
- act7:75 — `ORDINARY APP——ACTIVE`
- act7:77 (澪): "普通官方 app——繼續運作。普通安全通知——繼續。普通公共服務——繼續。只有——TOKYO-7 那一則——被攔住了"
- act7:83 — "ordinary services——繼續。protective filter——繼續。clinical branch——繼續。Public Deny Manifest——繼續。Public Witness Index——繼續"

The cancel is surgically scoped to the single pre-fanout TOKYO-7 mobile follow-up object; ordinary public services are untouched. ✅ Matches Bible 4 §15.

## A6.8 MAR-CONT scope (D7) — ✅ PASS in-mechanism; 1 minor cross-bible note

`MAR-CONT` literal occurrences per chapter:
- ch15 act4 (seed) ✅
- ch21 act5 (reinforce) ✅
- ch24 act8 (full three-stage) ✅
- ch28 act6 (epilogue evidence disclosure) ⚠️ see note

ch17 (the chapter D7 specifically protects) = **0 occurrences** ✅. All non-scoped mid-story chapters = 0 ✅.

### A6 Note (minor, non-blocking) — N6-T: ch28 `MAR-CONT` scope tension

`MAR-CONT` appears in **ch28 act6** as a maritime manifest / destination class for the father's transport (`DESTINATION CLASS—MAR-CONT／PROTECTIVE CUSTODY`).

- **Bible 4 §8** states MAR-CONT "僅在 ch15／ch21／ch24 三章出現...不得在 ch17 或其他章節出現" and **D7** locks scope to "ch15, ch21, ch24." Taken strictly, ch28 is "其他章節."
- **However:** (a) this is the **epilogue** (evidence disclosure), not mid-story seeding; (b) **Bible 3 (evidence ledger)** already sanctions this use — it records the father's ch28 evidence as `MAR-CONT／PROTECTIVE CUSTODY／MARITIME CONTINUITY`; (c) the prose explicitly frames it as an **existing** classification, not a new channel ("既有的程序分類。前章的 BCP 文件裡出現過"), directly addressing the A6.5 "no ad-hoc new channel" concern; (d) the D7/Bible 4 §8 scope was designed to prevent the BCP continuity **mechanism** from leaking early (esp. ch17), not to forbid the epilogue from disclosing an evidence classification.

**Recommendation:** Not a blocker. The canon owner may wish to either (i) amend Bible 4 §8's "不得...其他章節出現" to except ch28 epilogue evidence use, or (ii) confirm the ch28 use is acceptable as disclosure-of-existing-classification. The prose is internally correct either way.

---

# CONSOLIDATED ISSUE REGISTER

## BLOCKER (must fix before sign-off)
| # | Audit | Issue | Status |
|---|---|---|---|
| — | — | **None.** | — |

**BLOCKER count: 0**

## MINOR / NOTE (non-blocking)
| # | Audit | Issue | Recommendation |
|---|---|---|---|
| N1-T | 1 | ch23 explains the 21:19 Kotone alibi via evidence chain + "沒有已讀標記" rather than restating the literal `21:19` timestamp. | No fix needed — stylistic; explanation content is present. |
| N6-T | 6 | ch28 act6 uses `MAR-CONT` (father's maritime transport classification), technically outside D7/Bible 4 §8's strict "ch15/21/24 only" scope. Bible 3 sanctions the ch28 evidence use; prose frames it as existing classification. | Canon owner: amend Bible 4 §8 to except ch28 epilogue evidence disclosure, OR confirm acceptability. Prose needs no change. |

## Cross-references to Gate 4 DEFER items (confirmed clean in prose)
| Gate 4 DEFER | This audit's verification |
|---|---|
| D1 — 06:12:53 must NOT be calculated by ch21 characters | ✅ ch21 has 0 occurrences; only relative ±7000ms shown |
| D2 — MAR-CONT must NOT appear in ch17 or non-15/21/24 | ✅ ch17 = 0 occurrences (ch28 epilogue use noted as N6-T) |
| D3 — ch21 must NOT reveal R4 cost details | ✅ ch21 conveys `MIO／SAW COST／ACCEPTED／ONCE` without describing the cost; ch22 does reconstruction |

---

# Conclusion

Both audits **PASS**. The timeline is arithmetically exact, geographically consistent, with no POV double-presence and realistic sleep/shift discipline. The technical system's endgame flow keeps all four paths (signal/filter/clinical, lease/anchor/consensus, app gateway, witness sideband) rigorously separate — no collapsed paths, no dual-domain keys, no undefined overrides, and the two critical safety invariants (public HOLD ≠ clinical closure; app cancel ≠ ordinary-service disruption) are explicitly demonstrated in ch27. The single notable finding (ch28 MAR-CONT scope) is an epilogue evidence-disclosure callback that the prose handles correctly; it is a cross-bible wording tension, not a prose defect.
