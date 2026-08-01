# Audit 7 — Narrative & Emotional Polish (Phase 7)

**Scope:** §11.4 Repetition Cut (ch21–27, 6 concepts) · §11.1 Chapter Openings (ch1–28) · §11.2 Chapter Endings (ch1–28)
**Reference:** `docs/final_polish.md` §11.1 / §11.2 / §11.4
**Method:** Read all 28 chapter openings (act1 first ~16 lines), all 28 chapter endings (last act last ~18 lines), and every act of ch21–27 plus the home/callback acts in ch24, 26, 27, 28. Grep-mapped all 6 concepts across the full corpus.

**Verdict: PASS.** 2 minor repetition items only (both §11.4-adjacent). §11.1 = 0 flags. §11.2 = 0 flags.

---

## §11.4 Repetition Cut — ch21–27 (HIGH PRIORITY)

Each of the 6 high-risk concepts has a clean **first-full-explanation → character-pays → endgame-callback** arc. **None is re-explained from scratch in a later chapter.** The repetition risk has been well managed.

### 1. 沒有單一作者 (no single author) — **PASS**
- **First full:** `ch24/act1.md` — 千田「技術作者不能自動取得患者決定權」+ 外部醫師「不能因為一個人寫了文件——就假定他替患者做了決定」+ 患者權利代表「AUTHORSHIP 不能由單一人填入」→ `AUTHORSHIP FEDERATED／NO SINGLE OWNER`.
- **Character pays:** `ch24/act1` — 澪 declines the AUTHOR field despite every party looking at her; federated multi-signature replaces single authorship. The R4 authorship mystery (ch21–22) is a *plot* thread resolved by this principle, not a re-explanation of it.
- **Endgame callback:** `ch25/act7.md:15` — evidence store 「沒有單一人可單獨修改、單獨刪除或單獨發布」(federated principle applied to evidence custody). One line; builds on, does not re-teach.
- **No chapter re-explains it.**

### 2. 不複製患者 (don't copy patients) — **PASS**
- **First full:** `ch24/act3.md` — 千田 `WRONG APPROACH 1: COPY MISORA MODEL → OTHER PATIENTS`「複製給別人——等於把一個人的生理簽章貼到另一個人身上。不是幫助。是覆蓋」+ 「R5 複製的是程序。不是患者」+ 澪「不拿走。不複製。不送出」.
- **Character pays:** same act — 美空's model is generated locally, signed by her own root, `EXPORT LOCKED`; never copied out. 「被看見。被兩個獨立的來源看見。被——承認存在」.
- **Endgame callback:** `ch27/act2.md` + `ch28/act2.md` — each patient keeps own node / own bridge; `ch28/act2.md:105`「她不是——母體」. Callback only.
- **No chapter re-explains it.** (Grep confirms 複製/copy/模板/覆蓋 appears only in the ch24 home act.)

### 3. 不把未回應當同意 (silence ≠ consent) — **PASS**
- **First full:** `ch27/act4.md:89` — 「中央倒數沒有替未回應節點產生 ACK。guardian console 不替患者表示同意。⋯⋯任何患者都不能因其他人成功而被自動推進」.
- **Character pays:** same act — the 8 nodes return 8 *different* legal answers (CONTINUE / SAFE PAUSE / HOLD); none auto-advanced.
- **Endgame callback:** `ch28/act2.md:39-41` — 外部醫師「沉默——不能被當成新的同意」+ 澪「沉默——不是同意」. Two-line callback; builds on, does not re-teach.
- **No chapter re-explains it.**

### 4. public 不等於 clinical (public ≠ clinical) — **PASS (1 minor within-chapter repetition)**
- **First full:** `ch27/act4.md:13-23` — 「public role denied。consensus role denied⋯⋯clinical transition support 保留」+ fixed scope/expiry/STOP rules.
- **Character pays:** same act — 紗英 loses public/consensus roles yet clinical support is *temporarily, revocably* retained because 5 patients still depend on her.
- **Endgame callback:** `ch28/act1.md:82` **and** `ch28/act2.md:55`.
- ⚠️ **MINOR ISSUE — within-ch28 near-verbatim repetition.** The callback line is stated almost identically in two consecutive acts of the *same* chapter:
  - `ch28/act1.md:82`: 「媽媽。public role 停了。consensus role 停了。可是——clinical transition support 還在。因為——五名 downstream patients 還接在她身上。她還是——source endpoint。還是——被需要著。」
  - `ch28/act2.md:55`: 「媽媽。public role 停了。consensus role 停了。可是——clinical transition support 還在。五名 downstream patients——還接在她身上。她——還是 source endpoint。」
  - **Fix:** vary or condense one (e.g., act2 can drop to just「clinical transition support 仍生效——五人仍接在她身上」since act1 already carried the emotional weight). This is a single-instance trim, not a structural problem.

### 5. PASSIVE 不等於 safe (passive ≠ safe) — **PASS**
- **First full:** `ch24/act1.md:114-116` (`VALIDATION PASSIVE／STAGE-1`, `ACTIVE SWITCH PROHIBITED`) fully elaborated in `ch24/act3.md:205`「這不是成功。這是 Stage-1 被動相符。不使用 PASSIVE-READY。不使用任何暗示接近安全離線的表述」+ `ch24/act6.md:87`「PASSIVE-CONCORDANT。不是 PASSIVE-READY」.
- **Character pays:** `ch27/act4.md:25-31` — 美空's drift exceeds the boundary → `SAFE PAUSE REQUIRED`. Honest labeling *costs* a handoff. The principle pays off exactly where it was established to bite.
- **Endgame callback:** `ch28/act4.md:45`「先作 Stage-0——passive」. One-line callback.
- **No chapter re-explains it.** ch27 (`act2`, `act4`) uses the established term `Stage-1 passive-concordant` / `passive model` as status shorthand only — no re-lecture. (Note: `READY` in `ch27/act5.md` refers to *local-root readiness for the 2 eligible handoff patients*, a distinct concept from PASSIVE-READY; not a conflation.)

### 6. lease valid 不等於 applicable (lease valid ≠ applicable) — **PASS**
- **First full:** `ch26/act1.md:53` — 澪「租約有效。可是——有效不等於適用。一份有效的授權——如果它要用在還沒安全切離的人身上——鏡島的本地接受鏈會擋住它」(+ S42-vs-S43 distinction, 12-step acceptance chain).
- **Character pays:** `ch26/act1–act8` — they walk the live-state path; KAGAMI's own safety interlock reads the real patient state and says HOLD itself. 「不是我們說不。是——它自己說的」.
- **Endgame callback:** `ch28` — lease expires 06:20; the distributed clock (timing, not control) takes over (`ch26/act8.md:91-93`). Callback only.
- **No chapter re-explains it.** Grep confirms 「租約有效／有效不等於適用／valid…applicable」 appears **only** in ch26 — ch25 (which *shows* the lease forming as setup) never states the principle.

### Adjacent observation (not one of the 6 concepts) — ⚠️ MINOR
The 「拒絕 → 失聯／沒有」renaming *mechanism* is explained at the end of **two consecutive chapters**:
- `ch24/act8.md:299,307,313`: 「它會把我們所有的拒絕，壓縮成一個詞⋯⋯它不會說『他們拒絕了』。它會說——『他們失聯了』」
- `ch25/act8.md:113`: 「我們說了不。它聽到的是——沒有。它把『不』重新命名成『沒有』」

This is legitimate TIME-PRESSURE escalation (ch24 = the *warning*, ~24h out; ch25 = the *realization*, lease actually forms at 23:50), so it is not a §11.2 ending-pattern violation. But ch25 re-walks the *mechanism* ch24 already taught. A tighter `ch25/act8` would show only the realization (「23:50——它發生了」) and trust ch24's explanation, rather than re-deriving the rename logic. **Suggested trim, not required.**

> **Note (non-issue):** `ch26/act8.md:37` and `ch27/act4.md:83` both enumerate all 8 patients' stages. This is **plan → execution**, not repetition — the values genuinely update between them (美空 goes from predicted-SAFE-PAUSE to actual-SAFE-PAUSE; ACTIVE/C drops to SAFE PAUSE). Acceptable.

---

## §11.1 Chapter Openings (ch1–28) — **0 flagged**

Every chapter's opening (first ~500–800 chars) accomplishes **at least 2** of {locate time/place · continue prior consequence · pose core question · show state change}. **None** opens with a long technical summary, and **none** repeats the previous chapter's conclusion.

Notably strong openings: **ch5** (loop reveal at 6:13), **ch9** (title states the core question; "不能睡"), **ch17** ("第三次" loop marker), **ch19** (third-loop exhaustion, "一夜沒睡"), **ch20** (M-00 / 紗英 reveal + state), **ch26** (lease已形成, "不是把它弄壞"), **ch27** ("只是 epoch"), **ch28** (06:13:00.997 sub-second countdown).

**Observation (not a flag):** a one-line countdown callback 「距星期一 06:13——約⋯⋯」 appears in several openings (ch14, 21, 22, 23, 25, 26, 27). These are brief *state markers* (澪's exhaustion + the loop clock), each ≤1 line, not technical summaries or conclusion repetitions. Consistent with the loop motif; compliant.

---

## §11.2 Chapter Endings (ch1–28) — **0 flagged**

Every chapter's ending falls into one of {NEW FACT · REINTERPRETATION · CHARACTER CHOICE · TIME PRESSURE · EMOTIONAL COST}. **No chapter** ends on a forbidden 「new conspiracy / new superior / new equipment / new code」cliffhanger.

Standout endings: **ch4** ("只有澪已經失去過一次" — loop REINTERPRETATION), **ch6** ("我改變的也許只是死亡的地址" — REINTERPRETATION/EMOTIONAL COST), **ch18** (澪 writes 悠真's real name beside "青少年協力者" — CHARACTER CHOICE), **ch19** (mother kept 10 years — REINTERPRETATION/EMOTIONAL COST), **ch20** (紗英 "第三次了嗎" — NEW FACT), **ch27** ("最後一則通知沒有送出" — EMOTIONAL COST/NEW FACT), **ch28** ("未來第一次留在前面⋯⋯七十年" — epilogue EMOTIONAL COST).

**Observations (not flags):**
- **ch12 / ch13 / ch14** end on consecutive open investigative questions ("這套系統用什麼資料⋯⋯?" / "為什麼 TOKYO⋯⋯?" / "七秒後才送出去"). Thematically consistent for the investigation-arc mid-section; each is a *distinct* REINTERPRETATION of existing facts, not a forbidden cliffhanger.
- **ch24 / ch25** end on consecutive TIME-PRESSURE beats of the same threat (CONTINUITY-0 ARMED → lease forms at 23:50). Legitimate warning→realization escalation (see §11.4 adjacent note above); the *beat* differs even if the mechanism overlaps.
- System-status endings (`ch23/act8` `LOCAL SHADOW SEED…AVAILABLE`; `ch24/act8` `CONTINUITY-0 ARMED`) are borderline "new code" surface reads, but both represent the **already-established** R5/threat path advancing — not deus-ex-machina revelations. Acceptable.

---

## Summary

| Check | Verdict | Issues |
|---|---|---|
| §11.4 Repetition (6 concepts) | **PASS** | 2 minor (both repetition, not re-explanation) |
| §11.1 Openings (28 ch) | **PASS** | 0 |
| §11.2 Endings (28 ch) | **PASS** | 0 |

**Actionable items (2):**
1. `ch28/act1.md:82` ≈ `ch28/act2.md:55` — condense/vary the duplicated public-vs-clinical callback (concept 4).
2. `ch24/act8` vs `ch25/act8` — the "拒絕→失聯" rename mechanism is re-derived in ch25 after ch24 taught it; trim ch25's re-derivation to the realization only. (Suggested, not required.)

**Total issue count: 2** (both minor §11.4-adjacent repetition; 0 §11.1; 0 §11.2).
