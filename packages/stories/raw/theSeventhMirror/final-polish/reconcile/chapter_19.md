# Chapter 19 Reconciliation

Scope: `docs/chapter_19_plan.md` (v2.2) ↔ `chapter_19/act1.md`–`act10.md`.
Authority: plan doc is canon.

## A. Plan↔Prose discrepancies (P0/P1-relevant)

No blocking discrepancies. Ch19 prose is highly faithful; the M-00 / 紗英 reveal matches plan §4.12–4.14 exactly.

- `[M-00 身分揭露兩步]` — plan §4.12 (lines 611–631): ordinary workstation shows only `M-00 / 基準母體 / 狀態：維持中 / 參照連線：使用中`; the emergency-medical module shows 氏名/生年月日/現行生命狀態 but **不顯示死亡資料**; the death record is found **separately** by 日下部. Prose act9.md (lines 33–45) and act10.md (lines 7–26, 31–36) reproduce this exactly — module omits death data (act10 line 25: `模組沒有顯示死亡資料`), 日下部 runs a separate query (act10 lines 31–36). **Compliant.**
- `[紗英身分四重交叉]` — plan §4.13 (lines 643–653): name+DOB / live vitals / police old-case photo / 左眉側舊疤 / 10-year death record. Prose act10.md (lines 15–23, 79–83, 121) hits all five including the scar. **Compliant.**
- `[相原核心台詞]` — plan §3.3 (line 238): `我不是來確認狀態燈。我是來見孩子。` Prose act3.md line 135 reproduces verbatim. **Compliant.**
- `[佐久間理人]` — plan §4.2 (line 353) names the physician `佐久間理人`. Prose act3.md line 25 reproduces verbatim. **Compliant.**

## B. Prose-only good details (fold-forward candidates)

- `[每一張表都不是同一件事 獨白]` — prose act3.md (lines 95–99) has 相原 deliver the structural critique: `需要研究同意的時候——你們說這是研究。需要鎮靜…你們說這是醫療…需要不讓我們見人的時候——你們說這是法人管理。每一張表都合法。但沒有一張表——是同一件事。` Plan §4.3 states the "責任空洞" abstractly. **Fold in: Y** — this is the clearest human-language statement of the consent-chain problem and should be preserved verbatim into the final pass.
- `[悠真 鏡子…還在嗎 / 好]` — prose act7.md (lines 47–58) reproduces the exact two-line exchange from plan §0/成果六. **Fold in: N** — plan-faithful, already the emotional climax.
- `[這一次，他活著]` — prose act8.md line 57, 日下部's five-word line, delivered in a separate bg block after 澪 slides to the floor. Plan §0 (line 101) and §11.2 specify it as the emotional pause **before** the M-00 cut. Prose honours the ordering (act8 closes the rescue, act9 opens M-00). **Fold in: N** — plan-faithful.

## C. P0 keyword scan

Across `docs/chapter_19_plan.md` AND `chapter_19/act*.md`:

| Keyword | Plan count | Prose count | Notes |
|---|---|---|---|
| `帶上鏡子` | 0 | 0 | clean |
| `這一輪` / `上一輪` | 0 / 0 | 0 / 0 | prose uses `前兩輪`/`第三輪`/`上一輪她沒有走到這一步` (narrator/澪 only, act8 line 61); **no Kotone utterance** — no P0 hit. (Note: act8 line 61 `上一輪` is 澪 internal narration about her own prior loop, not Kotone — safe.) |
| `藤川琴音` | 0 | 0 | clean |
| `悠真手機相簿` / `手機相簿` | 0 | 0 | clean |
| `日下部完整記得` / `完整記得第二輪` | 0 | 0 | clean |
| `千田證明前輪` | 0 | 0 | clean (千田's ch19 role is a brief technical phone-call on M-zone architecture, act5 lines 67–85; stays within knowledge boundary) |

## D. Phase 2 foreshadow seed check

No Phase-2 retrofit task is scoped to ch19 (Task 12 = 15/21/24; Task 13 = ch20). Verified:
- `Task 12 MAR-CONT`: absent from ch19 plan & prose — consistent with plan canon.
- `母體狀態：維持中` reveal: **present-in-plan (§4.12 line 617) / present-in-prose (act9 lines 35–41) / OK** — correctly fires in ch19 (plan §16 line 1573 pushes it from ch18 to ch19; prose honours this).
- 紗英 still-alive reveal correctly closes ch19 (act10), with 凪原 / 函館 / first-generation / non-earth deliberately deferred to ch20 (plan §13).
