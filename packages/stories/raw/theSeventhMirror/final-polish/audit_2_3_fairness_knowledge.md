# Audit 2 + 3 — Clue/Reasoning Fairness & Character Knowledge

> **Story:** 《神鏡七日》(theSeventhMirror)
> **Scope:** Cross-cutting audit across all 28 chapters (`chapter_N/act*.md` prose)
> **Date:** 2026-07-29
> **Reviewer:** Cross-cutting audit subagent
> **References:** Canon Bibles 02 (knowledge matrix), 05 (clue map); `gate2_fairness_audit.md`; `gate4_bible_crosscheck.md`; `canon_decisions.md`; `CHANGELOG_FINAL_POLISH.md`
> **Canon status:** Canon LOCKED, Phase 5 prose polish COMPLETE

---

## Summary Verdicts

| Audit | Verdict | Issue count |
|---|---|---|
| **Audit 2 — 線索與推理公平性** | **❌ FAIL** | 1 BLOCKER + 2 NOTE |
| **Audit 3 — 角色認知** | **✅ PASS** | 0 |

**Single BLOCKER:** `Subject Continuity Bay / clinical latch` back-seed is **absent** from ch24/ch25 prose. The `CHANGELOG_FINAL_POLISH.md` line 30 claim ("M8 Subject Bay back-seeded in ch25 → now PASS") is **not reflected in the actual prose**. Gate 2 M8 therefore still FAILS.

---

## Audit 2 — 線索與推理公平性 (Clue / Reasoning Fairness)

### Method

For each of the 13 key clue/mystery threads, verified against the six fairness criteria by spot-checking the prose at the seed, mid-story, and payoff chapters cited in Bible 05:

1. 至少一條早期 seed (early seed exists)
2. 至少一個普通解釋 (ordinary explanation at seed time)
3. 中段第二次出現 (mid-story second appearance)
4. 終局 payoff (endgame payoff)
5. 不依賴終局才新增的規則 (no endgame-only rules)
6. 不因角色突然獲得資料而解謎 (no sudden data acquisition)

### Per-clue verdict table

| # | Mystery / Clue | Seed | Ordinary expl. | Mid 2nd appear | Payoff | No endgame-rule | No sudden data | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | 車內密室 / 千田之死 (attack-site ≠ death-site) | ✅ ch2 (手按外套內側) | ✅ 緊張/胃痛 | ✅ ch5–6 (施工通道血跡) | ✅ ch22–23 (琴音=21:04 維修服) | ✅ | ✅ | **PASS** |
| 2 | 銀色外殼 (非凶器；TOKYO-7 載體) | ✅ ch2–3 (破邊/金色接點/T與7) | ✅ 刃物狀金屬片 | ✅ ch4, ch13–15 (離線設定載體形制) | ✅ ch22 (銀色原始簽署載體), ch28 (千田拆解) | ✅ | ✅ | **PASS** |
| 3 | CCTV / 監視器 (壓縮流缺交付片段/+7000ms) | ✅ ch2 (時間碼錯位「十來秒」) | ✅ 設備故障/同步雜訊 | ✅ ch3 (控制中心壓縮流), ch4 (車載原始檔) | ✅ ch27 (06:12:53 pre-fanout gateway 取消) | ✅ | ✅ | **PASS** |
| 4 | 琴音 (Kotone 真正角色) | ✅ ch1–2 (21:19 已讀未回/綠茶/探視) | ✅ 朋友太累/胃不舒服 | ✅ ch7–8 (灣岸中央/那些東西失言) | ✅ ch22–23 (attestation+任務快取+承認) | ✅ | ✅ (handler-supplied, 非循環記憶) | **PASS** |
| 5 | G07 (悠真受試者編號) | ✅ ch12 act1 (鏡背 G07/12 + 預約頁) | ✅ 文件管理碼 | ✅ ch12 act5 (G07 管理群/03 美空 provisional) | ✅ ch19 (G07/12=悠真 客觀確認), ch22 (G07/03 系統確認) | ✅ | ✅ | **PASS** |
| 6 | TOKYO (設定檔名稱, 非地名) | ✅ ch2 (「不要救東京」遺言) | ✅ 恐怖宣言/災難 | ✅ ch13 act8 (設定檔名稱欄≠地區欄), ch15 (TOKYO-7 維護別名) | ✅ ch16 (「東京不指涉地名」) | ✅ | ✅ | **PASS** |
| 7 | 七秒 (+7000ms / ECHO PEAK) | ✅ ch4 act5/act8 (手機晚七秒) | ✅ 網路 lag/推播延遲 | ✅ ch21 act3 (ECHO PEAK/7000ms/FANOUT GATEWAY 技術名) | ✅ ch27 act7 (06:12:53 精確時間戳) | ✅ (三段式延遲刻意) | ✅ | **PASS** |
| 8 | R4 (failure-mode 可能未來) | ✅ ch21 (紗英輸出 R4/AUTHOR/MIO) | ✅ 「未來澪的決定」 | ✅ ch22 (約束式重建/四紅區下限) | ✅ ch22 (NOT PRE-AUTHORIZED), ch27 (澪拒預授權=時間線偏離關鍵) | ✅ | ✅ (紗英託管, 非 hidden loop) | **PASS** |
| 9 | Domain-P / Domain-C (雙安全域) | ✅ ch24 act1/act5 (銀色卡匣兩域) | ✅ 硬體安全分區 | ✅ ch24 act5 (六項隔離驗證) | ✅ ch26–27 (隔離 Domain-P/保留 Domain-C/clinical latch 不可遠端逆轉) | ✅ | ✅ | **PASS** |
| 10 | Continuity (MAR-CONT / 23:50 BCP) | ✅ ch15 act4 (BCP CUTOVER 23:50) | ✅ 災害復舊 BCP 術語 | ✅ ch21 act5, ch24 act8 | ✅ ch26 (執行 cutoff/CONTINUITY CUTOVER) | ✅ | ✅ | **PASS** |
| 11 | **Subject Bay / clinical latch** | **❌ NO pre-ch26 seed** | **❌** | **❌** | ✅ ch26 act3/4/5/7, ch27 (break-glass 拒絕) | **❌ (ch26 才引入實體收容機制)** | ⚠️ | **❌ FAIL** |
| 12 | Witness (見證路徑) | ✅ ch20 act2 (sideband/witness/事後標記) | ✅ 系統附帶紀錄機制 | ✅ ch25 (trust domains), ch26 act4 (witness buffer/egress) | ✅ ch26–28 (egress/audit/opt-in Public Witness Index) | ✅ | ✅ | **PASS** |
| 13 | 收音機 (短波/七十年訊號) | ✅ ch1 act2 (改裝短波接收器) | ✅ 母親遺物/舊收音機 | ✅ ch9 (座標在唱), ch20 act2 (wideband receiver 類比監測血統) | ✅ ch28 act8 (座標在唱/收音機裡沒有倒數) | ✅ | ✅ | **PASS** |

### ❌ BLOCKER — Subject Continuity Bay / clinical latch (clue #11)

**Status:** Gate 2 M8 was the **only** mechanism that FAILED in `gate2_fairness_audit.md` (first appearance ch26). The recommended fix was a one-line back-seed in ch24 or ch25.

**Finding:** The back-seed **does not exist in the prose**.

Evidence (verified 2026-07-29):
- `grep -rln "Subject Continuity Bay" chapter_*/` → returns **only** `chapter_26/{act3,act4,act5,act7}.md`. Zero hits in ch1–25.
- `grep -rn "Bay|latch|臨床閂|掛載|收容|Subject|clinical" chapter_25/` → only `clinical` appears, exclusively in `bg` image-prompt strings (e.g. "clinical lighting", "clinical sidecar", "external clinical sidecar"). **No prose mention** of Subject Bay, clinical latch, live subject ledger, or physical containment.
- Full read of `chapter_25/act3.md` (67 lines): discusses `AOI-LOCAL` sidecar, `continuity enclave`, `SHARE-S science escrow mirror`, `HSM revocation` — these are all **authorization-layer** ("who-authorizes-the-hold") mechanisms. The **physical containment** Bay + latch is absent.
- Full read of `chapter_25/act4.md` (85 lines): discusses seven `trust domain`s, `SHARE-S capsule`, `continuity operational HSM`, `CONTINUITY-0` — again **authorization-layer only**. No Bay, no latch.
- `chapter_24/` grep: only `Continuity Root` (act8:76, payload-binding concept). No Subject Bay.

**Conclusion:** `CHANGELOG_FINAL_POLISH.md` line 30 ("Gate 2 | Fairness audit: 9/10 PASS; M8 Subject Bay back-seeded in ch25 (was ch26 first-appear) → now PASS | ch25") records a fix that was **never applied to the prose**. The Gate 2 M8 FAIL is **still live**.

**Impact on fairness:** The physical containment mechanism that ch27's break-glass sequence tries to cross (`TARGET CLINICAL DEPENDENCY LATCH`, ch27 act3) is introduced cold in ch26. The reader has no prior seed for *where* the hold physically lives or *what primitive* governs the door. The ch21 `CLINICAL HOLD` (COMMIT-GATE status field) and ch24 `CONTINUITY HSM` cover only the *authorization* layer, not the *physical* layer. This is the single unfair endgame mechanism in the book.

**Recommended fix (unchanged from Gate 2 recommendation):** In ch24 act7/act8 or ch25 act3/act4, add one low-intensity line where 日下部 or 獨立系統安全人員 notes that the hold resolves to a *Subject Continuity Bay* whose door is governed by a *clinical latch* (status only; no geography/IDs revealed). This converts ch26 from "introduce" to "pay off" and clears Gate 2 without leaking any ch26 payoff detail.

> **Note:** Bible 05 §10 R1 still flags this as an open risk, and `gate4_bible_crosscheck.md` D4 logs it as a DEFER item "Verify ch25 prose contains the back-seed line." This audit confirms: **the verification fails — the line is not there.**

### NOTE items (non-blocking, informational)

#### NOTE A2-1 — 「病歷缺頁」dead seed (Bible 05 §10 R5 / Gate 4 D5)

Bible 05 C4.1 and high-level-plan §12 list 「母親病歷缺頁」as a foreshadowing seed (ordinary: 醫院疏失; payoff: 病歷被改，紗英從未真正死亡). Grep of ch17–19 for `病歷|缺頁` returns **zero hits**. The actual M-00 reveal path in ch19 act10 runs via **官方登記死亡 vs 醫療模組維持中** contradiction (death-registration vs current-life-status), NOT via missing medical pages.

**Assessment:** The 「病歷缺頁」specific seed is a dead seed (never landed in prose). This is **not a fairness violation** — the M-00 reveal has abundant fair seeds (ch1 遺物: 接收器/腦波書/北海道照片 per Task 8; ch19 death-registration contradiction). But Bible 05 C4.1 should either be re-pointed to the actual reveal path or marked as non-canon. Carried forward from Gate 4 D5; still open.

#### NOTE A2-2 — 「座標在唱」mid-story temperature (Bible 05 §10 R2 / Gate 4 N10)

The ch9 「座標在唱」seed → ch28 payoff spans ~19 chapters. Bible 05 R2 flagged the risk that readers may forget the ch9 flash by ch28. Spot-check confirms a **light mid-story touch exists**: ch20 act2:147–149 connects the函館 wideband receiver to 母親的舊短波接收器 ("不是同一台。是同一脈"), which maintains the radio lineage temperature. The specific 「座標」metaphor is not re-uttered between ch9 and ch28, but the receiver bloodline stays warm.

**Assessment:** Not unfair (low-intensity seed, fair on re-read). The ch20 receiver-continuity touch partially mitigates the distance. Acceptable as-is; no change required.

---

## Audit 3 — 角色認知 (Character Knowledge)

### Method

For each high-risk character, spot-checked their key speaking/knowing moments across the chapters where they appear, verifying the four questions:

1. 這句話是誰說的？ (Who said this?)
2. 他此刻如何知道？ (How do they know at this moment?)
3. 是事實、推測還是記憶？ (Is it fact, speculation, or memory?)
4. 該角色是否會使用這個術語？ (Would this character use this terminology?)

High-risk characters: 琴音 (NO loop memory), 日下部 (death-fragment memory only), 千田 (NO prior-loop memory), 凪原, 紗英, 悠真.

### Per-character verdict

#### 琴音 (Kotone) — ✅ PASS

The central canon discipline (§7.2 / Bible 2 §0.1 / Bible 4 §1): Kotone has **only low-intensity behavioral familiarity**, no freely-retrievable loop memory, and must not use 這一輪/上一輪/又一次 loop-language.

| Chapter | Moment | Who/how | Fact/spec/memory | Terminology | OK? |
|---|---|---|---|---|---|
| ch1 act3 | 改喝綠茶; 對睡眠計畫名稱停頓 | 身體性熟悉 (unconscious impulse) | 衝動 (not memory) | 無輪次語言 | ✅ |
| ch2 act4 | 21:19 已讀未回 (琴音 ignored 澪) | handler-supplied; D4 direction | 當輪行為 | 無輪次語言 | ✅ |
| ch6 act8 | 澪 recalls 「21:19 我傳給她的——已讀。她沒有回」 | 澪 POV of being ignored | 當輪事實 | (D4 fix clean: 琴音 ignored 澪) | ✅ |
| ch7 act4 | 失言「灣岸中央」(醫院名未公開) | handler-supplied (支援線推送) | 當輪資訊洩漏 | 無輪次語言 | ✅ |
| ch23 act3 | 正式被當輪證據確認 (attestation/任務快取/二次驗證) | 當輪可證 (FAMILY-ASSIST 工單/門禁) | 當輪事實 | 無輪次語言 (ch23 act3:121 明確:「沒有說『這一輪』。沒有說『上一輪』。沒有說『又一次』」) | ✅ |
| ch28 act3:21 | 「**現在**能證明的，我會全部說」 | 正式到案陳述 | 當輪可證 | **Phase 5 Batch G fix clean** — 「這一輪」removed, replaced with「現在」 | ✅ |

**Loop-language audit:** Every「這一輪」in ch28 act3 is either (a) 澪 interior (澪 is the loop-keeper, allowed), (b) narrator-level act heading (「第三幕：這一輪能證明的事」— meta framing, not Kotone speech), or (c) 澪's paraphrase of Kotone's「現在」. Kotone herself uses zero loop-language. **Phase 5 Batch G fix verified clean.**

#### 日下部悟 (Kusakabe) — ✅ PASS

Canon discipline (§7.3 / Bible 2 §5): retains R2 white-light 語言/方向/危險碎片 only; incompletely remembers R2; does not accept「世界倒流」as formal conclusion.

| Chapter | Moment | Who/how | Fact/spec/memory | Terminology | OK? |
|---|---|---|---|---|---|
| ch17 act2 | 「沒有第四排」neutral-sentence fragment test | 半句提示後完成 (碎片, 非自己想起) | 跨輪碎片 (acknowledged as 不該知道) | 中性句; 無循環斷言 | ✅ |
| ch17 act4 | 分層原則 (本輪現存/事件前公共資料/前輪記憶/待驗證) | 刑警程序思維 | 方法論 | 「前輪記憶」是 澪 的欄位; 他只說「妳留給自己看。不要唸出來」 | ✅ |
| ch21 act3 | 主持 R2/KAGAMI/COMMIT-GATE 七秒邊界 | 當輪文件 (R2 技術附錄) | 當輪文件事實 | 工程術語 (符合刑警/證據角色) | ✅ |
| ch28 act5:144 | 「這次我沒有下一輪可以改」 | 停職後承認 | 推測→接受 (無下一輪) | 接受循環後果, 非宣稱循環機制 | ✅ |

#### 千田浩介 (Chida) — ✅ PASS

Canon discipline (§1.2 / Bible 2 §6): **NO prior-loop memory**; cannot pass off erased-loop attack-site as courtroom fact.

| Chapter | Moment | Who/how | Fact/spec/memory | Terminology | OK? |
|---|---|---|---|---|---|
| ch17–22 (R3 活著) | 有限證詞: 18:42 訊息是他預設; TOKYO-7 離線載體; 20:40 維護窗口 | 當輪親見 + 工程師背景 | 當輪事實 | 工程術語 (符合 TKS 公共警報部背景) | ✅ |
| ch24 act1 | R5 公共授權與臨床根設計反省 | 當輪工程判斷 | 當輪事實 + 自我反省 | 工程術語 | ✅ |
| ch28 act5:62 | 「紀錄上的來源——是朝倉澪的跨輪記憶。按那份陳述——前兩輪我被記錄為死亡。**可是——那不是我親身記得的事。我沒有——前輩的親身記憶。**施工通道是——當輪證據指向的地點。前輪實際攻擊地——我不在場。不能由我證明。」 | 紀錄/證據 (非第一人稱記憶) | 證詞 (record-attributed) | **Phase 5 Batch G fix clean** — reframed from「前兩輪我死了」to record-attributed testimony | ✅ |

**Phase 5 Batch G fix verified clean:** 千田 explicitly denies first-person memory ("不是我親身記得的事") and confines himself to what the record + 當輪證據 show. He refuses to pass off 澪's cross-loop memory as his own testimony ("不能由我證明").

#### 凪原唯 (Nagihara) — ✅ PASS

Canon discipline (Bible 2 §7): knows 訊號非地球已知系統來源/函館夜潮; does NOT know/acknowledge 循環停止物理原因 or whether she's the top decision-maker.

| Chapter | Moment | Who/how | Fact/spec/memory | Terminology | OK? |
|---|---|---|---|---|---|
| ch20 act8 | 最低必要披露 (M-00/函館第一層) + 「她同意的是 72 小時。十年不是她同意的」「是我們」 | 受試者報告 + 系統收集 | 事實 (披露) | 科學負責人術語 | ✅ |
| ch22 act6:359 | 「不認為自己錯了。她只是——在這一次——接受了不預先授權」 | 澪 觀察 | 澪 推測 | — | ✅ |
| ch24 act8:241 | 「不認為自己錯了…她不是為了權力。她是因為恐懼。函館那一夜。」 | 澪 觀察 + 函館 grounding | 澪 推測 (有真實恐懼基礎) | — | ✅ |

#### 朝倉紗英 (Sae / M-00) — ✅ PASS

Canon discipline (Bible 2 §3): preserves large fragments but ≠ omniscient; is R4 echo custodian; long semi-comatose.

| Chapter | Moment | Who/how | Fact/spec/memory | Terminology | OK? |
|---|---|---|---|---|---|
| ch20 act8:91 | 「⋯⋯第三次了嗎？」(澪未提供數字) | 紗英託管 (跨輪感知) | 託管回聲 (非完整證明) | 無系統術語; 感性問句 | ✅ |
| ch21 | 自主輸出 R4/AUTHOR/MIO/FULL PACKAGE/NO ESCROW + MIO/SAW COST/ACCEPTED/ONCE | 紗英託管 | 託管回聲 | 系統語法 (符合 M-00 託管介面) | ✅ |
| ch23–27 | 限制性同意 (STOP/NO USE, SAFE PAUSE, 拒絕 public use/raw neural) | 紗英託管 + 文件 | 託管 + 授權 | 授權語法 (符合託管介面) | ✅ |

#### 朝倉悠真 (Yuma) — ✅ PASS

Canon discipline (Bible 2 §2): 未來 fragments (殘留非自己記憶); 非穩定預言者; ch19 起被救出 safe-detached.

| Chapter | Moment | Who/how | Fact/spec/memory | Terminology | OK? |
|---|---|---|---|---|---|
| ch21 | 證詞: 「星期一大家會收到同一個版本」+ 刻碼動機「怕醒來只記得號碼」 | 悠真本人 (受試者經歷) | 受試者記憶 (非穩定預言) | 受試者兒童視角語言 | ✅ |
| ch28 | 殘留靜態非持續未來 fragments; 不再被當預言工具 | 作者真相 | fragment (非命令) | — | ✅ |

### Cross-character consistency notes

- **澪 interior loop-language (「這一輪/上一輪/前兩輪」) throughout ch17–28:** All instances verified as 澪's own interior monologue. 澪 is the **sole** character with complete R1+R2 memory (Bible 2 §0.1). Her use of loop-language is canon-compliant. No high-risk character adopts her terminology.
- **Narrator-level headings using「這一輪」(e.g. ch28 act3 title「第三幕：這一輪能證明的事」):** These are author/narrator framing, not character speech. Acceptable.
- **Kotone ch23 act3:121 explicit meta-statement:** 「她沒有提到輪次。沒有說『這一輪』。沒有說『上一輪』。沒有說『又一次』。只說——那晚持有人沒有來。」— The prose itself audited Kotone's testimony for loop-language and confirmed it clean. This is the canon discipline enforced in-text.

---

## Consolidated Issues Register

### BLOCKER (must fix)

| # | Issue | Source | Chapters affected |
|---|---|---|---|
| **B1** | **Subject Continuity Bay / clinical latch back-seed MISSING from prose.** `CHANGELOG_FINAL_POLISH.md` line 30 claims it was back-seeded in ch25 ("now PASS"), but grep + full read of ch24/ch25 confirms zero occurrences of `Subject Continuity Bay`, `clinical latch`, `live subject ledger`, or any physical-containment term. The mechanism first appears in ch26 act3/4/5/7 — inside the Gate 2 ch26/27 fail-window. Gate 2 M8 therefore still FAILS. The physical containment that ch27's break-glass tries to cross (`TARGET CLINICAL DEPENDENCY LATCH`) is introduced cold. | Gate 2 M8 / Bible 05 §10 R1 / Gate 4 D4 | ch24 or ch25 (needs the back-seed); ch26 (currently cold-introduces) |

**BLOCKER count: 1**

### NOTE (informational, non-blocking)

| # | Issue | Status |
|---|---|---|
| N1 | 「病歷缺頁」dead seed (Bible 05 C4.1 / §10 R5). The M-00 reveal runs via death-registration contradiction (ch19 act10), not missing medical pages. Bible 05 entry should be re-pointed or marked non-canon. Not a fairness violation (M-00 has abundant fair seeds). | Open (carried from Gate 4 D5) |
| N2 | 「座標在唱」ch9→ch28 distance ~19 chapters. ch20 wideband-receiver touch partially mitigates. Not unfair; acceptable as-is. | Open (carried from Gate 4 N10) |

**NOTE count: 2**

---

## Phase 5 Batch G fix verification

| Fix | Location | Status |
|---|---|---|
| ch28 千田「前兩輪我死了」→ record-attributed testimony | `chapter_28/act5.md:62` | ✅ **CLEAN** — "紀錄上的來源——是朝倉澪的跨輪記憶…不是我親身記得的事。我沒有——前輩的親身記憶…不能由我證明" |
| ch28 Kotone「這一輪能證明的」→ loop-language-free | `chapter_28/act3.md:21` | ✅ **CLEAN** — "現在能證明的，我會全部說" (「這一輪」removed; remaining「這一輪」instances are 澪 interior or narrator headings only) |

---

## Overall Assessment

**Audit 2 (Fairness):** 12 of 13 clue threads are fully fair-play — seed → ordinary explanation → mid-story escalation → endgame payoff, with no endgame-only rules and no sudden data acquisition. The single failure is the **Subject Continuity Bay / clinical latch** mechanism, which remains un-back-seeded despite the changelog claiming otherwise. This is the same issue Gate 2 flagged as its only FAIL; it was never actually resolved in prose.

**Audit 3 (Character Knowledge):** All six high-risk characters (琴音, 日下部, 千田, 凪原, 紗英, 悠真) stay within their canon knowledge boundaries across all 28 chapters. The Phase 5 Batch G fixes (千田 record-attributed testimony; Kotone loop-language removal) are both clean. No character acquires information they shouldn't have, and no high-risk character uses terminology above their knowledge tier.
