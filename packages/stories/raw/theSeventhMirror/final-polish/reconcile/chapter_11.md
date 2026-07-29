# Chapter 11 Reconciliation

Scope: `docs/chapter_11_plan.md` ↔ `chapter_11/act1.md`–`act8.md`.
Authority: plan doc is canon source. Factual diff only — no style/merit review.

---

## A. Plan↔Prose discrepancies (P0/P1-relevant)

### A1. 夢話發音角色標籤不符 canon（`夢話` vs `夢話聲音`）— 非 spec / 輕微
`dream_voice 角色標籤` — characters.md #13 (`docs/characters.md:412-419`) 定義角色 ID `dream_voice`、alias「**夢話聲音**」。ch9 act6 正確使用 `**夢話聲音**`（`chapter_9/act6.md:15,19,27`）。但 ch11 act7 全段使用 `**夢話**`（`chapter_11/act7.md:59,61,63,99,101,113,115,123,125,151,153,163,203,205,207`）。Impact: 非 spec——prose 內部標籤不一致，偏離 canon alias。plan ch11 Scene 7 (`docs/chapter_11_plan.md:676-787`) 未明確腳本化標籤格式，故屬 prose 端常規化疏漏。

### A2. 澪將「帶上悠真留下的那件東西」誤歸給 no_moon — 非 spec / prose 內部事實錯誤
`no_moon 對妳說過哪些詞？` — plan Scene 3 (`docs/chapter_11_plan.md:467-469`) 讓佐伯問「no_moon 對妳說過哪些詞？」。prose act3 澪答：「它問我是不是悠真的姐姐。**它說『帶上悠真留下的那件東西』。沒有直接說鏡子。**」（`chapter_11/act3.md:49`）。

但依 ch9/ch10 與 Task 1 canon：「帶上悠真留下的那件東西」出自**第一章原始匿名訊息**（送澪去第七車者），**非 no_moon**。no_moon 的實際訊息（ch9 act10、ch10 act1）為：暗號／你不是悠真／你是他姐姐嗎／黑色海不是他一個人看見的／想找他先別去筑波／帳號可以被人用／看 bluefish_7 等——從未出現「帶上…那件東西」。Impact: 非 spec——prose 內部把兩條獨立訊息來源混淆，由澪在佐伯的防污染審查中錯誤陳述。plan Scene 3 未逐字腳本化澪的答案，屬 prose 端事實錯誤。

---

## B. Prose-only good details (fold-forward candidates)

### B1. 區民館場地費分帳細節
prose act8 (`chapter_11/act8.md:17-22`)：「不是奉獻。是下次會議室的場地費。區民館三樓一小時八百日圓。他們在分。」並有佐伯「藤川妳不用付，妳上次補了列印費」。plan 無此細節。Fold in: **Y**——強化「普通家屬／非教派」主題，與 plan §12.1 誤導設計意圖一致。

### B2. 夢話日語近音逐字稿完整實現
prose act7 (`chapter_11/act7.md:151-153,163`)「なのかめ⋯⋯／うみのむこう⋯⋯ひかる⋯⋯／とう⋯⋯きょう⋯⋯ひらく⋯⋯」+ 眾人各自記錄「東京？／とう⋯⋯？／遠く？／開く？／光る？」(`chapter_11/act7.md:215`)——逐項實現 plan Scene 7 (`docs/chapter_11_plan.md:739-759`)。Fold in: **N**（已一致）。

### B3. 手機封口袋編號 = 7
prose act2 (`chapter_11/act2.md:103-107`) 澪的手機封進 7 號袋，引發內心一頓。plan 僅說「編號不透明拉鍊袋」(`docs/chapter_11_plan.md:424`)。Fold in: **Y**——低強度數字呼應（7），不過度暗示，符合 plan「普通家屬」基調。

### B4. 水瀨佳乃「這也是悠真留下的圖嗎？」
prose act6 (`chapter_11/act6.md:17`) 逐字實現 plan Scene 6 (`docs/chapter_11_plan.md:636-641`)。Fold in: **N**（已一致）。

---

## C. P0 keyword scan

掃描範圍：`docs/chapter_11_plan.md` + `chapter_11/act*.md`。

| 關鍵字 | 計數 | 位置 | 歸屬/判定 |
|---|---|---|---|
| `帶上鏡子` | 0 | — | ✓ PASS |
| `這一輪\|上一輪` | 0 | — | ✓ PASS |
| `藤川琴音` | 0 | — | ✓ PASS（Task 5） |
| `悠真手機相簿\|手機相簿` | 0 | — | ✓ PASS |
| `日下部完整記得\|完整記得第二輪` | 0 | — | ✓ PASS（Task 4） |
| `千田證明前輪` | 0 | — | ✓ PASS（Task 7） |

---

## D. Phase 2 foreshadow seed check

| Task | seed | plan | prose | 狀態 |
|---|---|---|---|---|
| Task 11（七秒 peak metadata）| 06:13 不精確預告 | YES（Scene 5：佐伯「都在六點多。精確時間我還在重查」`§8 Scene 5 line 587-589`） | YES（act5：佐伯「都在六點多。精確時間我還在重查」`chapter_11/act5.md:67`） | ✓ present（ch11 層級的 06:13 預播，留 ch12 精確化） |
| 第七曙光內部名稱（非 Task 8-16，但為第三大段核心） | YES（Scene 4 `§8 Scene 4`） | YES（act4 `chapter_11/act4.md:21`） | ✓ present |
| 東京（孩子錄音近音）| YES（Scene 7） | YES（act7） | ✓ present |
| 澪隱瞞千田遺言 | YES（Scene 7） | YES（act7 `chapter_11/act7.md:241-245`） | ✓ present |

ch11 無 Task 8–16 直接分派項目；任務級伏筆（Task 11 七秒）由 ch14+ 承擔，ch11 僅做 06:13 不精確預播，處理正確。
