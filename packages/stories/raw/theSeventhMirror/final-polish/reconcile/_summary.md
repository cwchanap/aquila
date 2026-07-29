# Reconciliation Summary — 《神鏡七日》 Final Polish Phase 0.5

> Consolidated from `final-polish/reconcile/chapter_1.md` … `chapter_28.md`.
> Ranked by phase impact. Per-chapter detail is in the individual report files.

---

## A. P0 items (block Phase 1 Gate — must resolve first)

| # | Chapter(s) | Item | Spec ref | Nature |
|---|---|---|---|---|
| A1 | ch28 act3:21 | Kotone line `這一輪能證明的，我會全部說` trips final_polish Task 2 Gate-1 (Kotone: no `這一輪`/`上一輪`). Faithful to ch28 plan but conflicts with the gate. | Task 2 | Needs explicit exception or rephrase |
| A2 | ch26 act4 | 澪 interior thought: `他還沒有被找到。他失蹤了…我還沒有找到他` — contradicts canon that 悠真 is already rescued & in external medical care (ch25/ch26 plan §1; appears on video ch27, visits 紗英 ch28). | §1.4 / canon | Prose-internal contradiction |
| A3 | ch4 act1:27 | Kotone's message `琴音，我在第七車。有人倒下了。我現在在警署。` @21:17 — impossible timestamp (21:17 is pre-departure) and wrong content vs ch1's actual safety message. The 21:19 read-receipt anchor hangs on wrong content/time. | Task 6 / canon | Prose-internal corruption |
| A4 | ch2 act1:69,83 | 千田 says `鏡子` twice on the monitored car — conflicts with ch3 plan §1.2 mandate `那件東西。背面給我看。` (keep police off the mirror). | Task 1 / plan-vs-plan | Canon decision needed |
| A5 | ch1 act6:1 | Act *title* `# 第六幕：帶上鏡子` leaks object type as a scene heading (message body is sanitised). Lone `帶上鏡子` hit in ch1–4. | Task 1 | Prose |

---

## B. Phase 1 task-aligned items (feed Tasks 1–7)

| Task | Status from reconciliation |
|---|---|
| **T1** anonymous msg | Plan-level: ch1 plan foreshadow table still has stale `帶上鏡子`-adjacent content. Prose: A4 (ch2 千田 says 鏡子), A5 (ch1 act title). ch18 message correctly uses `帶上悠真留下的那件東西` ✅. |
| **T2** Kotone loop-test | **Cleaner than expected.** Across ch5–8 all 15 `這一輪/上一輪` hits are 澪/narrator — **zero Kotone**. Kotone tea-test/"這次至少不是左手" tells entirely absent. Only open P0 is A1 (ch28). |
| **T3** screenshot source | ch9: the two 截圖 ch12 requires are ABSENT from both plan & prose (prose uses 行事曆 instead). ch12 plan line 72 still uses banned `悠真手機相簿`; prose never states source at all. ch17 correctly implements family-backup source ✅. **The 截圖-來源 chain is empty at ch9 and ch12 — needs building.** |
| **T4** Kusakabe memory | ch17 correctly implements (fragments only, banned terms in prohibition framing) ✅. No prose violations. |
| **T5** Kotone surname | ch22 plan line 497 still says `藤川琴音`; prose correct `白石琴音` ✅. **Two cross-cutting conflicts surfaced** (see §D). |
| **T6** ch6/7 handoff | No duplicated 22:20–22:45 scene ✅. But **plan-internal conflict**: ch6 plan §9 puts 琴音's message + 澪's reply inside ch6; ch7 plan §0.1 + Task 6 say ch6 keeps only the hook, ch7 handles reply. Prose followed ch6-plan. Ownership inverted vs ch7 plan. |
| **T7** Chida boundary | ch28 mostly compliant. Boundary-adjacent: 千田 `前兩輪——我死了` (act5:62) defensible (he denies provability) but edges §1.2 (`千田沒有前輪記憶`). Suggest attributing to the record, not first-person. |

---

## C. Phase 2 missing seeds (feed Tasks 8–16)

| Task | Seed | Status | Chapters |
|---|---|---|---|
| T8 | ch1 family/object foreshadow (短波接收器, 收音機靜電, 北海道, 腦波書, 夢要先寫日期, 琴音固定探視) | **MISSING** (all 6 items absent from plan & prose) — EXCEPT Kotone hospital-visit is already in prose (act4:161) but not plan | ch1 |
| T9 | ch5 uncontaminated shell sketch | **MISSING** from both plan & prose | ch5 |
| T10 | ch9/10 radio tone sequence (`不像語音，像座標在唱`) | **MISSING** from both plan & prose | ch9, ch10 |
| T11 | seven-second / peak schema | ch14 correctly scoped (06:12:53 absent) ✅. ch21 schema **MISSING**. ch25 present ✅. ch27 fully paid ✅. | ch14✅ ch21❌ ch25✅ ch27✅ |
| T12 | 23:50 / BCP / MAR-CONT | ch15 **MISSING**. ch21 **MISSING**. ch24 present ✅. ch25 present ✅. **Scope question**: Batch E checklist lists ch17 but Task 12 scopes ch15/21/24 — decision needed. | ch15❌ ch21❌ ch24✅ ch25✅ |
| T13 | ch20 four tech lineages (M-00 module, analog monitor, K-01/KAGAMI, witness sideband) | **HEADLINE GAP: ALL FOUR MISSING from both plan & prose.** Will fail Gate-2 for these endgame mechanisms and starves ch21 Task 14 of its seed. | ch20 |
| T14 | ch21 COMMIT-GATE 8-field block | **MISSING** from both plan & prose | ch21 |
| T15 | eight-patient matrix | ch22 explicit totals (9/1/8/4/4) **MISSING**. ch24 canonical prep matrix (G07/05 etc.) **MISSING** (uses different framework). ch26 canonical IDs **MISSING** (uses aggregate OTHER-A/B/C/D). ch27 compliant ✅. | ch22❌ ch24❌ ch26❌ ch27✅ |
| T16 | ch25/26 auth capsules, trust domains, Subject Bay mount | ch25: capsules + HSM split present ✅, but "trust domain" term absent & 5 regional domains not enumerated. ch26: Subject Bay mount condition present ✅. | ch25✅(thin) ch26✅ |

---

## D. Cross-cutting canon decisions needed (resolve in Phase 1, before plan edits)

| # | Conflict | Options |
|---|---|---|
| D1 | **Kotone surname origin**: ch23 plan = birth-father surname; ch22 prose + characters.md = stepfather surname | Pick one; propagate to all three. (Recommend: stepfather — already in prose + characters.md, less new lore.) |
| D2 | **Kotone age**: plan/prose = 19; characters.md = 20 | Pick one; align all. |
| D3 | **ch4 Kotone message corruption** (A3): wrong timestamp + content vs ch1 anchor | Rewrite ch4 message to match ch1 pre-departure safety content at a plausible time. |
| D4 | **21:19 read-receipt direction**: ch5 act4 implies 琴音 ignored 澪; ch6 act8 reverses (澪 ignored 琴音) | Pick one direction; fix the other. |
| D5 | **ch2 千田 says 鏡子** (A4) vs ch3 plan obscures | Decide: does 千田 name the mirror aloud on the monitored car, or not? Affects Task 1 fair-play. |
| D6 | **Mirror-origin flashback** now in three incompatible wordings (ch4 flagged) | Pick one canonical wording. |
| D7 | **MAR-CONT scope** (T12): Task 12 says ch15/21/24; Batch E checklist says ch17 | Confirm ch17 is out of scope (Task 12 wins) OR add ch17. |
| D8 | **ch10 琴音 physically appears** at 清澄區民中心 (violates plan "弱登場／不新增重大破綻") | Decide: remove 琴音 from the scene, or relax the plan constraint. |

---

## E. Prose defects (P2 — defer to Phase 5/7)

| Chapter | Defect |
|---|---|
| ch3 | "那件東西是什麼" asked twice (plan says once); 日下部 too complicit (actively chooses not to seize) |
| ch5 | act8 overshoots stop-point (澪 enters passage); door-crack vs ch6 plastic-curtain; arrives 19:08 vs plan 20:30 |
| ch11 | speaker tag `夢話` vs canon alias `夢話聲音`; 澪 mis-attributes anonymous line to no_moon |
| ch15 | typo `離線復舉` → `離線復舊` (act4:77,89) |
| ch20 | 凪原 wardrobe flip 深色風衣(act1)→白袍(act7); meta `Chapter N` references leak into prose (act1:29, act2:97) |
| ch28 | name typo `白崎琴音` → `白石琴音` (act5:163) |

---

## F. High-value fold-forward candidates (fold into plan during Phase 1/2)

| Chapter | Candidate |
|---|---|
| ch1 | Kotone's `妹妹那邊的探視` (act4:161) — already-correct Task 8 seed, plan lacks it |
| ch2 | 千田's on-page broadcast-timing behaviour makes "chose this car for sync-test window" legible |
| ch5 | 琴音 dropping `她妹妹最近狀況穩定` (act4:75) — subtle 美空/family seed |
| ch6 | 澪's 圍巾 + father-taught pressure姿势 to stop bleeding — seeds 朝倉源一郎/日下部 thread |
| ch8 | overheard `請通知警方與家屬` + 澪's fair-play inference — strong 推理讀者 clue |
| ch12 | 美空 family-member column `琴○／K` — canon-compatible seed for ch22 sister reveal |
| ch18 | 琴音's "left-hand-to-brim" gesture — payoff when 琴音 identified |
| ch19 | 相原's `每一張表都不是同一件事` critique — keeper |
| ch21 | 悠真's fish drawing — fold-forward to 葵/bluefish_7 |
| ch23 | 美空's bedside radio — low-intensity 收音機/七十年 seed |

---

## G. Headline conclusions for Phase 1 planning

1. **Task 2 is largely already done in prose** — the feared Kotone loop-language spread across ch5–8 does not exist. Phase 1 Task 2 shrinks to: (a) the A1 ch28 exception/rephrase, (b) plan-doc cleanup of stale foreshadow tables.
2. **Task 13 (ch20 tech lineages) is the single biggest Phase 2 gap** — all four lineages missing at plan level, blocking Gate-2 for four endgame mechanisms. Prioritise this.
3. **Task 15 (patient matrix) is missing across ch22/ch24/ch26** — only ch27 is compliant. Three-chapter plan+prose build needed.
4. **Task 3 (screenshot chain) is broken at the source** — ch9 doesn't establish the 截圖, ch12 plan uses banned term, ch17 is fine. Needs ch9 + ch12 build, not just a term swap.
5. **Eight cross-cutting canon decisions (§D)** must be resolved BEFORE plan edits, else edits will contradict each other.
6. **ch27 and ch16 are the gold-standard faithful chapters** — use as reference for what "locked canon compliance" looks like.
