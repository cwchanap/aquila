# Gate 4 — Bible Cross-Check Report

> **Story:** 《神鏡七日》(theSeventhMirror)
> **Gate:** 4 — 七份 Bible 互相無衝突 (Seven Canonical Bibles have no mutual conflicts)
> **Date:** 2026-07-29
> **Reviewer:** Gate 4 subagent
> **Sources:** All 7 canon bibles (`canon/01–07_*.md`), `final-polish/canon_decisions.md`, `final-polish/CHANGELOG_FINAL_POLISH.md`, `final-polish/reconcile/_summary.md`

---

## Verdict: ❌ FAIL

Three bibles (Bible 3, 5, 7) still reference the **removed Kotone tell** "這次至少不是左手" as canon evidence. This tell was removed from canon because (a) it was never planted in prose and (b) it contradicts §7.2 — Kotone has no loop memory, only low-intensity behavioral familiarity. The tell implies Kotone explicitly remembers a previous loop's injury detail, which crosses the line from "行為衝動" into "可自由提取的輪次記憶."

This is the only BLOCKER. All other cross-bible dimensions (R4 definition, timeline, character knowledge, evidence classification, terminology) are consistent once the tell is removed.

---

## 1. Cross-Bible Conflict Analysis

### 1.1 R4 Definition (POSSIBLE-FUTURE failure-mode) — ✅ CONSISTENT

All five bibles that define R4 agree it is a possible-future failure-mode, NOT a hidden fourth loop:

| Bible | Location | Wording |
|---|---|---|
| Bible 1 | §3 ch21 | "由當前第三輪向前延伸、在下一個星期一 06:13 前完成的可能未來（failure-mode），不是已發生的隱藏第四輪" |
| Bible 3 | §6 header | "R4 是從當前第三輪延伸...的可能未來澪的 failure-mode，不是已發生的隱藏第四輪" |
| Bible 4 | §6 R4 row + constraint | "可能未來中的澪...FAILURE-MODE ONLY"; "R4 是 POSSIBLE-FUTURE failure-mode，不是已發生的隱藏第四輪" |
| Bible 5 | C6.5 | "R4 不是已發生的隱藏第四輪，而是一條由當前第三輪延伸...的可能未來" |
| Bible 7 | §1.6 / §3.5 | "R4 不是一個已發生的隱藏第四輪，而是一條...可能未來"; "R4 不是真實輪次" |

**No conflict.**

### 1.2 Timeline / Clue Seed Chapters (Bible 1 ↔ Bible 5) — ✅ CONSISTENT

Bible 5's clue seed chapters match Bible 1's timestamps:
- 06:13 loop anchor: Bible 5 C5.11 (seed ch1) ↔ Bible 1 §4 (06:13 across all loops). ✓
- 21:04 construction passage: Bible 5 C1.11 (seed ch1–4) ↔ Bible 1 §4 (21:04 R2/R3). ✓
- 23:50 BCP cutover: Bible 5 C7.1 (seed ch15) ↔ Bible 1 §4 (23:50 system timestamp). ✓
- +7000ms: Bible 5 C5.3 (seed ch1/ch4) ↔ Bible 1 §4 (06:12:53 = ECHO PEAK − 7000ms). ✓
- Three-stage delay (ch4 phenomenon → ch21 technical name → ch27 exact timestamp): both bibles agree. ✓

**No conflict.** (Note: Bible 5 C7.1 correctly flags that ch7's 23:50 is an unrelated ER timestamp, not the BCP mechanism — this is accurately reflected in both bibles.)

### 1.3 Character Knowledge "Cannot Know" ↔ Bible 7 "Fully Answered" — ⚠️ ONE CONFLICT (the Kotone tell)

Checked every Class 1 answered mystery against Bible 2's "cannot know" columns:

| Mystery | Revealing channel | Conflict? |
|---|---|---|
| 1.1 千田之死 | Physical evidence + ch23 當輪證據 (not 千田's loop memory) | ✅ No |
| 1.2 TOKYO | Documents (not a character's loop memory) | ✅ No |
| 1.3 七秒 | ch27 system mechanism | ✅ No |
| 1.4 M-00 | ch19–20 凪原披露 + files (紗英 is 託管者, not source of proof) | ✅ No |
| 1.5 琴音 | ch22–23 當輪證據 (attestation, 門禁, 工單) | ⚠️ **CONFLICT** |
| 1.6 R4/R5 | 紗英託管 + ch22 reconstruction | ✅ No |
| 1.7 Continuity | System records | ✅ No |
| 1.8 官方修剪失敗 | ch27–28 events | ✅ No |

**The conflict (1.5 琴音):** Bible 7 §1.5 lists "琴音脫口「這次至少不是左手」（身體性熟悉感的洩漏）" as evidence. This tell requires Kotone to verbally reference a specific injury detail from a previous loop — which is loop memory, directly contradicting:
- Bible 2 §0.1: Kotone "沒有可自由提取的連續輪次記憶"
- Bible 4 §1: Kotone "沒有可自由提取的連續輪次記憶，也不知自己處於第幾輪"
- Bible 7 §1.5 itself: "她本人**不能知道**自己那些小習慣...的行為來源"

The tell is internally contradictory within Bible 7 (listed as evidence in the same section that says she can't know her habit sources). The green-tea behavioral switch is legitimate (unconscious impulse); the "left hand" verbal slip is not (explicit loop content reference). **Must remove.**

### 1.4 Evidence Classification (Bible 3 ↔ Bible 7) — ⚠️ SAME CONFLICT (propagated)

Bible 3 `KOT-03` bundles two items into one evidence row:
- "星期一固定不點同一款飲料" (legitimate — behavioral impulse, SUBJECTIVE)
- "這次至少不是左手" (removed — loop memory leak)

These must be **split**: keep the tea behavior under KOT-03; remove the left-hand tell entirely. The classification tags are otherwise consistent between Bible 3 and Bible 7.

### 1.5 Terminology (Bible 6 ↔ all others) — ✅ CONSISTENT

- Character names: All bibles use the locked names (白石琴音, 藤川美空, 朝倉紗英, etc.). No bible uses the banned variants (~~藤川琴音~~, ~~白崎琴音~~). ✓
- System terms: `TOKYO-7`, `M-00`, `G07／nn`, `KAGAMI-01`, `MAR-CONT`, `SHARE-S` — all bibles use identical English terms with matching Chinese glosses. ✓
- R4 labeling: `NOT PRE-AUTHORIZED／FAILURE-MODE ONLY` — consistent across Bibles 3, 4, 5, 6, 7. ✓

**No conflict.**

---

## 2. Removed Kotone Tell — Bibles Needing Update

Grep across all 7 bibles for "至少不是左手" / "左手":

| Bible | File | Line(s) | Reference type | Action needed |
|---|---|---|---|---|
| **Bible 3** | `03_evidence_ledger.md` | 96 (KOT-03) | Evidence item (bundled with tea behavior) | **Remove the tell; keep tea behavior; rename/split KOT-03** |
| **Bible 5** | `05_clue_foreshadowing_map.md` | 204 (C2.6), 811–815 (§10 R3) | Clue entry + risk flag | **Delete C2.6 entirely; update §10 R3 to "RESOLVED — tell removed from canon"** |
| **Bible 7** | `07_open_mysteries_and_final_answers.md` | 185 (§1.5 evidence chain) | Evidence in Kotone's answer | **Remove the bullet; the remaining evidence (tea behavior, hospital-name slip, 21:04 取件) is sufficient** |

**Bibles 1, 2, 4, 6 do NOT reference the tell.** No update needed for those.

**Rationale for removal (confirmed):**
- `reconcile/_summary.md` T2: "Kotone tea-test/'這次至少不是左手' tells **entirely absent**" from prose.
- `CHANGELOG` line 32: "characters.md de-looped (handler-supplied intel framing; removed 測試新一輪 + absent tell)".
- The tell implies Kotone remembers Mio's injury location across loops = loop memory, violating §7.2.

---

## 3. Consolidated Issues Register

### BLOCKER (must fix before Canon Lock)

| # | Source | Issue | Bibles affected |
|---|---|---|---|
| B1 | Task context + Bible 5 §10 R3 | **Removed Kotone tell "這次至少不是左手" still referenced as canon evidence.** Contradicts §7.2 (Kotone has no loop memory), Bible 2 §0.1, Bible 4 §1, and Bible 7 §1.5's own "cannot know" statement. Unplanted in prose. Must remove from Bibles 3 (KOT-03), 5 (C2.6 + §10 R3), 7 (§1.5 evidence chain). | 3, 5, 7 |

**BLOCKER count: 1** (one root issue, three files)

### DEFER (Phase 5 prose-level verification/fix)

| # | Source bible | Issue | Verification needed |
|---|---|---|---|
| D1 | Bible 4 flag #2 | 06:12:53 must NOT be calculated by ch21 characters (only relative +7000ms known); absolute timestamp comes from bundle metadata in ch27. | Verify ch21 prose has no absolute-time calculation. |
| D2 | Bible 4 flag #3 | `MAR-CONT` must NOT appear in ch17 or any chapter outside ch15/21/24 (D7 locked range). | Verify ch17 (and other non-15/21/24 chapters) prose has zero MAR-CONT mentions. |
| D3 | Bible 4 flag #5 | ch21 must NOT reveal R4 cost details (紗英 outputs `MIO／SAW COST／ACCEPTED／ONCE` but ch21 doesn't describe what the cost IS); ch22 does the reconstruction. | Verify ch21 prose doesn't preempt ch22's R4 cost disclosure. |
| D4 | Bible 5 §10 R1 | Subject Continuity Bay / clinical latch back-seed. CHANGELOG says back-seeded in ch25 (Gate 2 M8 now PASS), but Bible 5 still flags as open risk. | Verify ch25 prose contains the back-seed line; update Bible 5 R1 status to RESOLVED. |
| D5 | Bible 5 §10 R5 | 母親「病歷缺頁」specific clue has no confirmed chapter in plan files. May be a dead seed if ch17–19 doesn't use this path. | Verify ch17–19 prose; either confirm landing or mark as non-canon in Bible 5. |
| D6 | Bible 6 §5 | 離線復舉 typo (should be 復舊, not 復舉) in ch15. Listed as Phase 5 Batch D. | Fix in ch15 prose. |

**DEFER count: 6**

### NOTE (informational — already locked, intentional, or non-blocking)

| # | Source bible | Issue | Status |
|---|---|---|---|
| N1 | Bible 2 §10.1 | 千田「前兩輪我死了」(ch28) vs §1.2 無前輪記憶. | Locked by canon_decisions Task 7; prose reframed to record-attributed testimony. CHANGELOG confirms done. |
| N2 | Bible 2 §10.2 | ch26 澪 interior「他還沒有被找到」vs ch19 rescue. | Locked by A2; prose must say worried-about-external-care, not missing. CHANGELOG confirms done. |
| N3 | Bible 2 §10.3 | ch6 act8「21:19 澪 ignored 琴音」vs D4 (琴音 ignored 澪). | Locked by D4; direction corrected. |
| N4 | Bible 2 §10.4 | ch28 act3 琴音「這一輪能證明的」violates Kotone loop-language ban. | Locked by A1; rewritten to「今晚能證明的」. CHANGELOG confirms done. |
| N5 | Bible 2 §10.5 | ch10 琴音 physical appearance at 區民中心 vs D8. | Locked by D8; removed entirely. CHANGELOG confirms done. |
| N6 | Bible 2 §10.6 | `G07／03` layered confirmation (ch12 provisional → ch22 system-confirmed). | Correctly layered in all bibles; not a conflict. |
| N7 | Bible 2 §10.7 | 悠真失蹤 before loop anchor — core limit. | Informational; consistently reflected. |
| N8 | Bible 4 flag #1 | R3 content-source time vs version-number order (content predates R1, version-number postdates R2). | §6.2 explains; use「臨床安全修訂」not「第三版」in prose. Stylistic. |
| N9 | Bible 4 flag #4 | M-00「母體」dual semantics (Mother Reference vs 澪's actual mother). | Intentional narrative tension; ch20 §7.2 exploits it. Must keep both meanings alive. |
| N10 | Bible 5 §10 R2 | 「座標在唱」seed (ch9) → payoff (ch28) distance ~19 chapters, no mid-escalation. | Not unfair (low-intensity seed); consider light ch20 echo in Phase 5. |
| N11 | Bible 5 §10 R4 | 悠真「故意把交通卡借給朋友」— no confirmed chapter. | Characterization detail, not推理線索; optional ch9–12 landing. |
| N12 | Bible 5 §10 R6 | 「夢要先寫日期」family habit — payoff diffusion (no sharp single moment). | Acceptable low-intensity seed. |
| N13 | Bible 5 §10 R7 | 父親下落 seed thin in ch4–ch20 (only ch1 + ch15+). | Emotional/theme line, not core推理; acceptable. |
| N14 | Bible 6 §5 | Romanization variants (Kusakabe/Kusakube, Hiromasa/Kosuke, Asao/Asakura). | 漢字 locked; characters.md is authority for pinyin. |
| N15 | Bible 6 §5 | 黑色海 naming variants (黑色海/黑海/Black Sea/黒い海). | In-prose should unify to「黑色海」; game-internal filenames are legitimate multilingual. |
| N16 | Bible 6 §5 | 凪原唯 role-title variants across chapters. | Same person, different titles over time — reasonable; clarify same-person on first title change. |
| N17 | Bible 7 附录 | Cross-class characteristics (循環物理, 外星意圖↔七十年, 父親, R4, 琴音 erased-loop). | Intentional narrative tension, not canon defects. |
| N18 | Bible 7 §3.2 line 513 | "13 步" — likely typo for "13 歲" (§1.5 line 162 says "13 歲"). | Minor internal inconsistency; fix 步→歲. |
| N19 | Bible 7 §1.7 line 255 | "SHARE-O 被凪結" — "凪結" is non-standard; likely typo for "凍結" (frozen) or unclear shorthand. | Clarify wording. |

**NOTE count: 19**

---

## 4. Summary

| Severity | Count | Blocking Canon Lock? |
|---|---|---|
| BLOCKER | 1 (affects 3 bibles) | **Yes** |
| DEFER | 6 | No (Phase 5 prose) |
| NOTE | 19 | No |

**Most important finding:** The removed Kotone "這次至少不是左手" tell persists as canon evidence in 3 bibles (3, 5, 7). It is the single direct cross-bible conflict: Bible 7 lists it as proof of Kotone's guilt, while Bibles 2 and 4 (and Bible 7's own §1.5 constraints) establish that Kotone has no loop memory. Removing the tell from all three bibles resolves the conflict; the remaining Kotone evidence chain (green-tea behavioral switch, hospital-name slip via handler-supplied intel, 21:04 當輪取件 confirmation) is fully sufficient and internally consistent.

All other cross-bible dimensions — R4 definition, timeline timestamps, character knowledge boundaries, evidence classification tags, and locked terminology — are **mutually consistent** across the 7 bibles.
