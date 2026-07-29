# Chapter 20 Reconciliation

Scope: `docs/chapter_20_plan.md` (v2.2) ↔ `chapter_20/act1.md`–`act8.md`.
Authority: plan doc is canon.

## A. Plan↔Prose discrepancies (P0/P1-relevant)

**A0 — HEADLINE: Task 13's four tech lineages are MISSING from BOTH plan and prose.**
`final_polish.md` Task 13 (§6, lines 425–457) mandates that ch20 "真正加入" four distinct technical lineages as Phase-2 fairness foreshadow for the ch21–28 endgame. A full grep of `docs/chapter_20_plan.md` and `chapter_20/act*.md` for every lineage name and field returns **zero** in both plan and prose:

| Task-13 lineage (spec) | Required content | ch20 plan | ch20 prose |
|---|---|---|---|
| M-00 Digital Backup module | fields `PHYSIOLOGICAL PHASE CONTROL / ECHO SUPPRESSION / SEMANTIC INTERPRETATION / FUTURE CLASSIFICATION / PUBLIC CONSENSUS INTERFACE` | **ABSENT** (0 hits for `Digital Backup`, any of the 5 fields) | **ABSENT** |
| Independent Analog Monitor | 改裝 wideband receiver / out-of-band comparison / 後來返還家屬 / 不含患者資料 | **ABSENT** (0 hits for `Analog`, `wideband`, `寬頻接收`, `類比監測`) | **ABSENT** |
| K-01／KAGAMI lineage | execution anchor + local clinical check early fields | **ABSENT** (0 hits for `K-01`, `KAGAMI`, `執行錨點`, `execution anchor`) | **ABSENT** |
| Witness／after-action sideband | clinical after-action markers / regional audit receiver / 低頻 sideband / 不傳 raw neural | **ABSENT** (0 hits for `Witness`, `sideband`, `旁帶`, `after-action`; the lone `見證` at plan line 1057 = 函館直接見證人, unrelated) | **ABSENT** |

Note: the ch20 plan **does** cover adjacent content — M-00 medical/two-cannot-disconnect (§5), Mother Reference etymology / `MOTHER_REF_00` (§7.2), Hakodate three-stage timeline (§6.4), backup-failure + G07 backup research (§7.4), non-earth origin (§8), `第三次了嗎` (§9). The prose faithfully implements all of that (`Mother Reference` 4×, `基準母體` 4×, `MOTHER_REF` 4×, `備援` 26×, `函館` 25×). But the **four distinct Task-13 technical lineages were never written into the plan**, hence never into the prose. This is a plan-level Phase-2 omission that propagates downstream. **Impact: Task 13.** Per Gate-2 fairness test, any endgame mechanism first appearing in ch26/27 fails — these four lineages are required to exist by ch20 so ch21+ pays them off.

The sole `見證` hit (plan line 1057, `十年前函館直接見證人`) refers to 凪原 being an eyewitness to Hakodate — **unrelated** to the Witness/after-action sideband. Do not count it.

**A1 — 凪原 wardrobe inconsistency (prose-internal, P2).**
Prose introduces 凪原 in act1.md line 13 as `深色風衣。銀框眼鏈。黑色短髮。` but in act7.md line 11 re-describes her as `白袍。銀框眼鏡。` (same person, same continuous scene 19:45→03:25). Plan §4 does not fix her costume. **Impact: non-spec (continuity).** Pick one before final lock.

**A2 — Meta `Chapter N` references break immersion in prose (P2).**
Author-layer scaffolding leaked into prose in 3 places (ch20 act1.md line 29, act2.md line 67, act2.md line 97) and once in ch19 act5.md line 39:
- act1.md line 29 (澪 internal): `她就是那個名字。Chapter 14 審查委員名單裡的名字。Chapter 15 修訂監修欄裡的 Y. NAGIHARA。Chapter 16 跨部門協調責任人。`
- act2.md line 97 (日下部 dialogue): `第一——Chapter 15 退役離線載體手冊中的設定家族索引…`
- act2.md line 67 is **intentionally self-corrected** by the narrator (line 69: `她用了「Chapter 19」這個詞。不。她沒有。她說的是——「今晚稍早」。`), so that one is a deliberate device — but act1 line 29 and act2 line 97 are **not** corrected and break the fourth wall (characters/narrator referencing chapter numbers). **Impact: non-spec (style).** Replace with in-world document names (`舊審查委員名單` / `修訂監修欄` / `跨部門不開示決定` / `退役載體手冊設定家族索引`).

## B. Prose-only good details (fold-forward candidates)

- `[act2 自我修正裝置]` — prose act2.md lines 67–71 deliberately writes `Chapter 19` then retracts it via narrator (`她說的是——今晚稍早`). **Fold in: Y as a style rule** — adopt this retract-and-correct device or, better, remove all meta chapter-refs per A2.
- `[紗英手寫零件 vs 完整構圖]` — prose act4.md (lines 29–59) dramatizes the three-stage Hakodate timeline as physical artefacts: 6 examiners' scattered pencil notes (事故當晚) → 紗英's dated sketches (事故後第1–2日) → standardized M-00-templated versions. Plan §6.4 tabulates this; prose makes it visible. **Fold in: Y** — preserve the artefact staging.
- `[「遮蔽」未披露]` — prose act3.md lines 141–151 and act5.md lines 97–99 plant `G07 其他用途——遮蔽` as an explicit unresolved hook, with 日下部 recording `「遮蔽」——未披露`. Plan §7.4 carries the same field. **Fold in: Y** — strong forward hook; ensure ch21+ pays it off.
- `[「再多一天」]` — prose act3.md lines 85–89 expands 凪原's `當時我們以為，只要再多一天，就能做出不需要她的版本` (plan §7.3 line 1349) into 澪's searing internal `三千六百五十個小小的「再留一天」`. **Fold in: Y** — captures 凪原's moral structure precisely.
- `[第三次了嗎 climax]` — prose act8.md (lines 63–131) executes the plan §9.3 protocol exactly: 澪 says only `悠真安全了。` / `我是澪。`; 紗英 voluntarily produces `第三次了嗎`; breathing therapist enforces 血氧/呼吸 frequency cutoffs (lines 109–113). **Fold in: N** — plan-faithful.

## C. P0 keyword scan

Across `docs/chapter_20_plan.md` AND `chapter_20/act*.md`:

| Keyword | Plan count | Prose count | Notes |
|---|---|---|---|
| `帶上鏡子` | 0 | 0 | clean |
| `這一輪` / `上一輪` | 0 / 0 | 0 / 0 | prose uses `第三輪`/`下一次`/`上一個星期日` (narrator/澪 internal only). 紗英 says `第三次了嗎` (act8) — this is **紗英**, not Kotone, and is the intended Phase-2 seed, not a P0 violation. **No Kotone utterance of loop-language** — no P0 hit. |
| `藤川琴音` | 0 | 0 | clean |
| `悠真手機相簿` / `手機相簿` | 0 | 0 | clean |
| `日下部完整記得` / `完整記得第二輪` | 0 | 0 | clean (ch20 is post-rescue; 日下部 memory not in scope here) |
| `千田證明前輪` | 0 | 0 | clean (千田 has no ch20 scene per plan §1; he stays a background technical resource) |

## D. Phase 2 foreshadow seed check (ch20 = Task 13)

Format: `Task <#> <seed>: present-in-plan / present-in-prose / status`.

- `Task 13 M-00 Digital Backup module (5 fields)`: **MISSING / MISSING / MISSING** — neither plan nor prose contains the module or any of its five fields.
- `Task 13 Independent Analog Monitor (改裝 wideband receiver, returned to family, no patient data)`: **MISSING / MISSING / MISSING**.
- `Task 13 K-01／KAGAMI lineage (execution anchor + local clinical check early fields)`: **MISSING / MISSING / MISSING** — note ch20 plan §5.3 has the M-00→TOKYO-7 blood-line graph but **no K-01/KAGAMI/execution-anchor** field anywhere; this lineage is also the one ch21 Task 14 (`EXECUTION ANCHOR／KAGAMI-01`) expects to already exist.
- `Task 13 Witness／after-action sideband (clinical after-action markers, regional audit receiver, 低頻 sideband, no raw neural)`: **MISSING / MISSING / MISSING**.

**Over-exposed?** No — none of the four is over-exposed; the opposite. The ch20 main payload (Mother Reference, Hakodate, 備援失敗, 非地球來源, `第三次了嗎`) is all **present and correctly bounded** in both plan and prose. The gap is exclusively the four Task-13 technical lineages, which were never retrofitted into the plan.

**Recommendation:** Before final lock, revise `docs/chapter_20_plan.md` to add the four Task-13 lineages (as low-intensity, ordinary-explanation-first seeds per Phase-2 principle), then regenerate ch20 prose. Without this, Gate-2 (`任何終局機制若答案是「Chapter 26/27 才第一次出現」即未通過`) will fail for these four mechanisms.
