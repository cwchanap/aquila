# Chapter 25 Reconciliation

> Scope: `docs/chapter_25_plan.md` (v2.2) ↔ `chapter_25/act1–act8.md`.
> Authority: plan doc is canon. Pass = factual diff only (no literary/style review).

## A. Plan↔Prose discrepancies (P0/P1-relevant)

- `[七 trust domains 列舉]` — plan says "作者層鎖定為七個 trust domain：1.北部災害備援域…7.國家級離線 continuity vault" (plan §3.9, §6.5, loc ~393–409/843–864); prose depicts only "七個 mirror 保存的是同一份授權的冗餘 release capability…五個地區域、一個臨床 continuity 域、一個國家離線 vault" being named in 澪 interior only generically (act3/act4 give the count and the science-clinical-national split, but never enumerate the 5 regional domains nor call them "trust domains"). Impact: Task 16 (seven trust domains) — seed present-in-plan, **partial-in-prose**; low risk (the seven-mirror count is paid; the disaster-recovery rationale is named but not enumerated). P2.
- `[LEGACY／02 平行進度 時間]` — plan §13 places 函館 `LEGACY／02` bench update in the morning block and an evening update (plan §12); prose pays the morning update in act4 (12:15, "bench hardware compatible…active connection none") but defers the evening update to ch25 act7 background. No discrepancy — sequencing consistent. Non-spec.

No P0 discrepancies found. Prose tracks plan v2.2 closely across all eight acts (relocation/no-move, AOI-LOCAL sidecar unbound→bound, 6/7 receipts, Public Deny Manifest, 澪 refusing to put cross-loop memory into evidence, 23:50 CUTOVER AUTH LEASE, snapshot-before-queue, partial preposition).

## B. Prose-only good details (fold-forward candidates)

- `[澪 4-hour sleep in command vehicle]` — prose act1 (loc ~9) grounds fatigue with blanket/stiff neck. Plan §2 says "至少完成約四小時睡眠". Fold in: **Y** — already plan-consistent; humanizing, keep.
- `[C2 nurse voluntarily surrenders controller logs]` — prose act2 (loc ~33–41): a C2 nurse walks over unbidden and hands the tablet to the external doctor. Plan §4.4 requires "有人相信搬送較安全…有護理／生體工學人員願意提供真實日誌". Fold in: **Y** — plan-mandated, well-executed.
- `[佐伯＋真理 in Manifest room; 真理 pleads to include 澪's cross-loop memory]` — prose act6 (loc ~25–31). Plan §7.6/§7.7. Fold in: **Y** — already plan; gives the 澪 refusal real cost. Keep.
- `[佳乃 "我不要你們再把她從一個系統，搬進另一個系統"]` — prose act3 (loc ~15) and act5 (loc ~57). Plan §5.6. Fold in: **Y** — canon line, delivered twice (once as consent condition, once bedside); not redundant.

## C. P0 keyword scan

Scanned across `docs/chapter_25_plan.md` + `chapter_25/act*.md`:

- `帶上鏡子` — **0**.
- `這一輪|上一輪` — **0** in ch25 prose/plan.
- `藤川琴音` — **0**.
- `悠真手機相簿|手機相簿` — **0**.
- `日下部完整記得|完整記得第二輪` — **0**.
- `千田證明前輪` — **0**.
- Forbidden endings `外星警告|外星善意|全世界同步|立即完全離線|零傷亡` — **0**.

All clear.

## D. Phase 2 foreshadow seed check + ending lock check

- `Task 11 七秒 schema` — present-in-plan / **present-in-prose** (act7: "+7000ms 補正…尚未送出 payload…監看中"). 06:12:53 correctly **not** revealed (deferred to ch27 via bundle metadata). ✓
- `Task 12 23:50` — present-in-plan / **present-in-prose** (act8 climax: CUTOVER AUTH LEASE ISSUED SUN 23:50, VALID UNTIL MON 06:20, EPOCH N, EXECUTION NOT YET). ✓
- `Task 16 authorization capsules` — present-in-plan / **present-in-prose** (act3/act4/act7: NON-EXPORTABLE / ONE-TIME / WINDOW-BOUND / PRIOR RELEASE COUNT 0 / release handle destroyed). ✓
- `Task 16 seven trust domains` — present-in-plan / **partial-in-prose** (seven-mirror count + "五地區＋臨床 continuity 域＋國家 vault" stated in 澪 interior; five regional domains not enumerated by name; term "trust domain" not used in prose). Seed functional but thin.
- `Task 16 Science HSM／Operational HSM 分離` — present-in-plan / **present-in-prose** (act4: "密碼學上——是兩個不同的 HSM…金鑰分離。policy 分離。audit 分離"). ✓
