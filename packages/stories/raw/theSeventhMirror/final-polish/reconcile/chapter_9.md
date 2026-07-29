# Chapter 9 Reconciliation

Scope: `docs/chapter_9_plan.md` ↔ `chapter_9/act1.md`–`act10.md`.
Authority: plan doc is canon source. Factual diff only — no style/merit review.

---

## A. Plan↔Prose discrepancies (P0/P1-relevant)

### A1. 截圖前置完全缺失（Task 3 + ch12 §2.1 前置補丁）— P0
`截圖來源/兩張舊截圖` — plan (ch12) requires ch9 to establish two 截圖: "Chapter 9 必須已建立的兩張舊截圖。一張是第二階段預約頁，一張是簡單的睡眠結果畫面…澪在悠真手機相簿深處找到兩張舊截圖" (`docs/chapter_12_plan.md:69-72`)。但 ch9 plan (`docs/chapter_9_plan.md` 全文) 對這兩張截圖**完全未提**；ch9 prose 也**完全未建立**——prose 在 act5 用的是「悠真手機備份裡的行事曆」與兩筆「預約提醒」行事曆事件（`chapter_9/act5.md:57-77`），並非兩張截圖。後果：ch12 prose（act1/act2/act5）反覆依賴「預約頁截圖」「簡易結果畫面截圖」作為既有材料，但這些截圖在 ch9 從未被建立，來源在 prose 中始終未交代。Impact: Task 3（截圖來源改寫）+ ch12 §2.1 跨章前置補丁——plan 與 prose 雙向未播種。

### A2. Task 10 收音機音序伏筆缺失 — P1（Phase 2）
`收音機靜電/座標在唱` — plan（final_polish.md §6 Task 10, lines 365-372）要求 ch9 加入「悠真曾錄下舊接收器規律靜電」並使用唯一句「不像語音，像座標在唱。」。ch9 plan 全文**無**收音機/接收器/靜電/座標在唱任何字眼；ch9 prose 亦**無**（act6 「中段停頓怪怪的…像提示音」`chapter_9/act6.md:82-91` 是指夢話錄音的停頓節奏，並非接收器靜電，且未出現該指定句）。Impact: Task 10 — ch9 伏筆未播種（plan 與 prose 雙缺）。

---

## B. Prose-only good details (fold-forward candidates)

### B1. 「悠真手機備份」的「備份」措辭
prose act5 用「悠真手機備份裡的行事曆」(`chapter_9/act5.md:57`)。plan 無此措辭。Fold in: **Y**——方向與 Task 3 的新術語（家庭共享雲端／家中平板自動同步備份）一致，是套用新來源術語的天然落點。

### B2. 夢話錄音「中段停頓…像提示音」
prose act6 (`chapter_9/act6.md:82-91`) 讓澪注意到夢話中段停頓「短、均勻、像提示音」。plan 僅說「錄音裡某些停頓節奏，讓她想到防災測試廣播前的短促提示音」(`docs/chapter_9_plan.md:463`)，prose 實現一致。Fold in: **N**（已一致）。但若實施 A2/Task 10，此段可作為「夢話節奏 → 接收器靜電」的橋接點——**Y 候選**，視 Task 10 實施方式。

### B3. 澪「上一輪醒來之前」的循環記憶錨點
prose act6 旁白二次提及「上一輪醒來之前／前」（`chapter_9/act6.md:75,95`）。plan 未逐字腳本化。Fold in: **N**——與 canon（澪完整保留兩輪記憶）一致，無需改 plan。

---

## C. P0 keyword scan

掃描範圍：`docs/chapter_9_plan.md` + `chapter_9/act*.md`。

| 關鍵字 | 計數 | 位置 | 歸屬/判定 |
|---|---|---|---|
| `帶上鏡子` | 1 | `docs/chapter_9_plan.md:98`（明確否定句「不是『帶上鏡子』」） | ✓ PASS（canon 形式「帶上悠真留下的那件東西」；prose 0 命中） |
| `這一輪\|上一輪` | 2 | `chapter_9/act6.md:75`（旁白）、`chapter_9/act6.md:95`（旁白） | ✓ PASS——兩次皆為**旁白**描述澪的循環記憶，**非琴音**。P0（琴音歸屬）= 0 |
| `藤川琴音` | 0 | — | ✓ PASS（Task 5；prose act2 用 `白石琴音`） |
| `悠真手機相簿\|手機相簿` | 0 | — | ✓ PASS for ch9（prose 用「悠真手機備份」） |
| `日下部完整記得\|完整記得第二輪` | 0 | — | ✓ PASS（Task 4） |
| `千田證明前輪` | 0 | — | ✓ PASS（Task 7） |

---

## D. Phase 2 foreshadow seed check

| Task | seed | plan | prose | 狀態 |
|---|---|---|---|---|
| Task 10 | 收音機規律靜電 + 「不像語音，像座標在唱。」 | NO | NO | **MISSING** |
| Task 8（ch1 專用，但「悠真對收音機靜電聲日常反應」會延伸至 ch9 Task 10） | 收音機日常 | N/A (ch1) | N/A | 兩者皆缺，與 Task 10 同根 |

ch9 無其他 Task 8–16 分派項目。
