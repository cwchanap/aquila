# Chapter 12 Reconciliation

Scope: `docs/chapter_12_plan.md` ↔ `chapter_12/act1.md`–`act9.md`.
Authority: plan doc is canon source. Factual diff only — no style/merit review.

---

## A. Plan↔Prose discrepancies (P0/P1-relevant)

### A1. 截圖來源：plan 用禁用舊術語、prose 來源完全未交代 — P0（Task 3 核心章）
`悠真手機相簿（舊術語）` — plan §2.1 (`docs/chapter_12_plan.md:69-81`) 明文：「**澪在悠真手機相簿深處找到兩張舊截圖**。一張是第二階段預約頁，一張是簡單的睡眠結果畫面…她當時只確認日期，與其他預約提醒一併備份，沒有注意頁面下方的小字。」——此處「悠真手機相簿」**正是 Task 3（final_polish.md §5 Task 3, lines 228-240）明令改寫**的舊術語，必修為「家庭共享雲端／家中平板自動同步備份」。

進一步：ch12 prose（act1/act2/act5）反覆引用「預約頁截圖」「簡易結果畫面截圖」作為澪帶來的既有材料（`chapter_12/act1.md:95,109,111,115,119,125,137,149,151,163`、`chapter_12/act2.md:63,93,97`、`chapter_12/act5.md:57,91`），但**從未說明這些截圖從哪裡來**——既無舊術語「悠真手機相簿」，亦無 Task 3 新術語「家庭共享雲端／家中平板自動同步備份」。疊加 ch9 A1（ch9 從未建立這兩張截圖），整條截圖來源鏈在 ch9–ch12 之間**兩端皆空**。Impact: Task 3 — plan 用禁用舊術語；prose 來源未交代；ch9 前置補丁缺失。此為 ch9–12 範圍內**最高優先級** Task 3 缺口。

### A2.（prose-only，移至 B 區作 fold-forward）美空家族成員欄「琴○」預告 — 非 spec 但不違禁
詳 B1。此處不列入 A 區，因 plan §6「本章不能揭露的事」(`docs/chapter_12_plan.md:222-239`) 15 條禁令中**未禁止**揭露美空有姊姊；prose 的「琴○／K」暗示與 Task 5（琴音=白石琴音、美空之姊、不同姓氏）相容，僅屬 plan 未腳本化的早期伏筆。

---

## B. Prose-only good details (fold-forward candidates)

### B1. 美空病患入口 PDF「家族成員欄」預告琴音—美空姊妹連結
prose act5 (`chapter_12/act5.md:37-39,121`)：美空 PDF「家族成員欄。兩行。第一行是美空本人。第二行寫著『姊』。名字欄被遮蔽處理過，只顯示『琴○』。旁邊的羅馬拼音欄只剩一個字母『K』，其餘被遮蔽。備註欄標著『醫療設備更新——家屬協助』。」；act9 (`chapter_12/act9.md:121`) 澪回憶「那個家族成員欄。那個被遮掉的名字。琴○。」。plan §7.1 (`docs/chapter_12_plan.md:253-265`) 美空可用材料僅列「病患入口 PDF、門診紀錄引用、裝置摘要、藥盒刻痕影本」；§5 成果二 (`docs/chapter_12_plan.md:196-202`) PDF 只揭露「管理群：G07／個體：03」。家族成員欄/琴○ **plan 未授權**。Fold in: **Y**——強伏筆，與 Task 5 相容（白石琴音 K=Kotone），較 ch22 官方揭露早 10 章播種；建議補入 plan §7.1 作授權低強度 seed。

### B2. 澪在 G07／12 旁寫「悠真」+「把青椒挑到我碗裡的弟弟」情感母題
prose act1 (`chapter_12/act1.md:175-177`)、act5 (`chapter_12/act5.md:93-97`)、act9 (`chapter_12/act9.md:111,113-115,179`) 反覆出現「悠真」書寫與青椒細節。plan §0.9 (`docs/chapter_12_plan.md:28`) 僅說「建立本章情感主軸：澪第一次看見弟弟被系統寫成 G07／12，並在編號旁手寫『悠真』」。青椒具體化為 prose 原創。Fold in: **Y**——情感具體化有效，與 plan 情感主軸意圖一致。

### B3. 結論兩欄對稱結構（10 條可以成立 / 10 條仍不能成立）
prose act9 (`chapter_12/act9.md:17-87`) 逐條實現 plan Scene 9 (`docs/chapter_12_plan.md:785-809`)。Fold in: **N**（已一致）。

### B4. 佐伯「時間循環」列入不能成立、觸發澪反應
prose act9 (`chapter_12/act9.md:59-63`)：佐伯把「零六點十三分是孩子共同醒來或**時間循環**的客觀證明」列入右欄，澪內心「他不知道…可是這四個字穿過了我的皮膚」。plan 僅列條目 (`docs/chapter_12_plan.md:803`)，prose 實現戲劇反應。Fold in: **N**（已一致，prose 實現佳）。

---

## C. P0 keyword scan

掃描範圍：`docs/chapter_12_plan.md` + `chapter_12/act*.md`。

| 關鍵字 | 計數 | 位置 | 歸屬/判定 |
|---|---|---|---|
| `帶上鏡子` | 0 | — | ✓ PASS |
| `這一輪\|上一輪` | 0 | — | ✓ PASS |
| `藤川琴音` | 0 | — | ✓ PASS（Task 5；prose 之「琴○」暗示與 `白石琴音` 相容） |
| `悠真手機相簿\|手機相簿` | 1 | **`docs/chapter_12_plan.md:72`**「澪在悠真手機相簿深處找到兩張舊截圖」 | ⚠ **FLAG**——此為 **Task 3 必修點**：plan 仍用禁用舊術語「悠真手機相簿」，須改為「家庭共享雲端／家中平板自動同步備份」。prose ch12 為 0（規避術語但未以新術語取代） |
| `日下部完整記得\|完整記得第二輪` | 0 | — | ✓ PASS（Task 4） |
| `千田證明前輪` | 0 | — | ✓ PASS（Task 7） |

---

## D. Phase 2 foreshadow seed check

| Task | seed | plan | prose | 狀態 |
|---|---|---|---|---|
| Task 3 | 截圖來源 = 家庭共享雲端／家中平板自動同步備份 | **舊術語**（`chapter_12_plan.md:72`「悠真手機相簿」） | **未交代**（截圖作為既有材料出現，來源未註明） | **MISSING/需改寫** — Task 3 核心章，與 ch9 A1 聯動 |
| Task 11（七秒 peak metadata）| 06:13 精確化 + 缺對照組限制 | YES（Scene 4 `§9 Scene 4`） | YES（act4 `chapter_12/act4.md:55-103`） | ✓ present（ch12 完成 06:13 系統事件層揭露，留 ch14+ 做七秒 server-side path） |
| G07 管理群 + 兩階段分流 + TKS + 千田雇主連結 | YES（§5 四項核心成果） | YES（act1/act2/act4/act5/act6/act8/act9） | ✓ present |
| 銀色外殼解鎖禁令（不能讓小鏡子在本章證實解鎖外殼） | YES（§6.12, §15.14） | YES（act9 `chapter_12/act9.md:73-79` 澪內心反應但不成立） | ✓ present |

Task 12（23:50／BCP／MAR-CONT，ch15/21/24）、Task 13–16（ch20+）不屬 ch12 範圍。
