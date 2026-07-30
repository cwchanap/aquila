# Bible 7 — Open Mysteries／Final Answers

> **《神鏡七日》Canon Bible 第七卷**
> 將全書所有謎題分為三類：**完整解答**、**有意開放**、**不能再增加**。
>
> **權威來源：** `docs/00_high_level_plan_final.md`（尤其 §7 八項必修校正、§14 結局）、`docs/chapter_*_plan.md`、`docs/characters.md`、`docs/final_polish.md §8 Bible 7`、`final-polish/canon_decisions.md`（D1–D8）。
>
> **語言：** 繁體中文，系統術語保留英文。
>
> **狀態：** Canon-lock。本檔為最終真相分區的權威入口。

---

## 分類總覽

| 類別 | 數量 | 性質 |
|---|---|---|
| **Class 1：完整解答** | 8 | 有明確答案、揭露章節與證據鏈 |
| **Class 2：有意開放** | 5 | 故事提示但不回答，開放性受刻意保護 |
| **Class 3：不能再增加** | 6 | 凍結邊界，禁止新增，既有元素已填補 |

---

# Class 1：完整解答（Fully Answered）

這八項謎題有作者層鎖定的明確答案。每一項都必須能在指定章節找到回收，並有可查驗的證據鏈支持。

---

## 1.1 電車案件（千田浩介之死）

### 鎖定答案

「無人電車密室殺人」其實是**三層誤導**。千田不是在電車上被刺殺——他在上車前（施工中的連絡通道）就已經被琴音刺傷。他用事先準備的止血貼壓住傷口，強行搭上電車，因為他知道自己只剩一次機會把銀色資料外殼交給澪。神鏡計畫事後修改監視器畫面，刪掉千田把資料外殼交給澪的片段，只留下澪手持血跡金屬物、千田倒下的畫面。

| 表面 | 真相 |
|---|---|
| 千田在密室電車內被殺 | 致命傷在上車前造成（施工通道） |
| 澪手持凶器 | 她拿的是千田塞給她的資料外殼 |
| 監視器證明澪殺人 | 監視器被刪改與補幀 |
| 車內只有兩人所以只能是澪 | 死亡地點不是攻擊地點 |

### 法律與證據紀律（§7.2）

「琴音在施工通道刺傷千田」是**作者真相與澪記憶**；前兩輪的暴力不能成為第三輪的刑事既定事實。第三輪法律處理只建立在**當輪可證**的行為上：施工通道門禁、維修建築與制服、憑證角色濫用、被刪改補幀的官方電車版本。千田不能替澪把「前輪攻擊地」冒充成法庭事實。

### 揭露章節

- 高層企劃 §8（表層案件作者真相）
- ch6 plan §7（維修人員真相、攻擊者如何騙過千田、攻擊者為何不攻擊澪）
- ch8 plan §7.1（千田第二次死亡的真相方向）
- ch23 plan §7（琴音程序地位、當輪可證明內容、被重置暴力的界線）

### 證據鏈

- 千田上車時一直按著肋下（被誤讀為緊張／胃痛）
- 電車地板血跡從座位下方開始擴散（傷口早已存在，止血貼失效）
- 澪袖口沒有噴濺血（她不是刺殺者）
- 金屬外殼邊緣有血，但沒有刺入深度痕跡（它不是凶器）
- 車站施工通道監視器維修（真正攻擊地點）
- 官方影像有 11 秒不自然（交付資料的片段被刪掉）
- 澪手機時間慢 7 秒（災害警報系統與監視器同步被干擾）
- 第三輪施工通道門禁、琴音工單、train footage 補幀無證明力

---

## 1.2 TOKYO（TOKYO-7 東京方案）

### 鎖定答案

「東京」不是城市，而是神鏡計畫**最終同步方案的系統維護別名 `TOKYO-7`**。東京方案表面是災害警報演習，實際上會利用東京灣人工島（鏡島）放大外星訊號，並透過災害警報、手機、電視把大量人口在同一瞬間置於同一組聲音與圖像之下，讓受試者大腦把訊號轉成「被政府修剪過的未來記憶」。手機不是洗腦工具，只是同步工具；真正影響人腦的是外星訊號。

### 部署範圍的敘事紀律（§7.6）

**當輪直接 execution scope 以東京參考部署（鏡島與東京節點）為主。** 多國／國際背景是**技術、資料與未來模板**，不是「本輪就讓全世界同步統一記憶」。全球共同記憶是神鏡方的**野心與失敗**，不是本輪發生的事實：本輪 unified public version 並未形成，官方手機 follow-up 在中央 fanout 前被取消。

### 揭露章節

- ch13–16（階段四：東京不是城市）
- ch15 plan（`TOKYO-7` 早於悠真失蹤、千田死亡及澪開始調查）
- 高層企劃 §7（東京方案組成表）

### 證據鏈

- 千田遺言「不要救東京」（不是放棄城市，是不要讓方案成功）
- 文件：「東京，不指涉地名。東京為最終同步方案。」
- `TOKYO-7／<BUNDLE-HASH>` exact bundle
- 鏡島作為 reference deployment 點與訊號放大裝置所在地
- 災害警報系統、手機、電視作為同步工具

---

## 1.3 七秒（the seven-second app path）

### 鎖定答案

`+7000ms` 是**官方手機應用的伺服器發送補正**（server-send offset），不是循環怪象。部署骨架為：

```text
ECHO PEAK                  06:13:00
ORDINARY BROADCAST MARKER  PEAK - 7000ms
APP FOLLOW-UP SEND         MARKER + 7000ms
CENTRAL FANOUT GATEWAY     REQUIRED
```

七秒的功能有三：（A）**配置指紋**——當公共提示順序與七秒補正一致時，可辨認正在運作的是特定 TOKYO-7 多通道設定；（B）**最後手機路徑封鎖**——在手機推送真正送出前可取消最後一條應用推送；（C）**提交狀態診斷**——七秒期間的通道回饋可判讀提交鎖是否已完成。

七秒**不能**作為唯一倒數；真正安全切離由 `COMMIT-GATE` 及放大節點狀態決定。

### 揭露章節

- ch14（鎖定公共 marker 與 app 推送相差約七秒）
- ch21 plan §8.1（R2 七秒的正確功能 + peak-marker 部署骨架）
- ch27（精確取消指定 payload）

### 證據鏈

- 澪手機慢 7 秒（被誤讀為循環怪象）
- R2 附錄部署骨架文件
- ch27 在中央 pre-fanout sequencing gateway 的 `+7000ms` 窗口內精確取消 official app follow-up

### 終局

official app TOKYO-7 follow-up 在中央 pre-fanout sequencing gateway 的 `+7000ms` 窗口內被精確取消；cancel receipt 列入證物。

---

## 1.4 M-00（母親的案件）

### 鎖定答案

朝倉紗英**沒有病逝**。她是**第一代穩定接收者（系統母體 `M-00`）**——早期工程欄位 `Mother Reference` 所指的第一份穩定神經基準。被神鏡計畫維持在半昏迷狀態，是循環能持續存在的關鍵，也是 R4 回聲警告的託管者。

關鍵鎖定事實：
- **最初只同意七十二小時**；十年的長期同意從未存在。凪原只能承認制度已做出的決定，不能用「她曾自願」洗去後續十年。
- 紗英是**第一個**將函館零散元素（黑暗平面、錯位月光、七次亮脈衝）整合成黑色海、倒月與七線的人；M-00 建立後，後續孩子才開始反覆看見完整標準化版本。
- 她沒有單純等待被救，而是多年來一直暗中把零碎記憶推向澪，讓女兒有機會抵達最後一輪。
- 保存大量 fragments，**不等於全知**；是 R4 回聲的託管者。

### 揭露章節

- ch17–20（階段五：母體尚可維持循環）
- ch20 plan §7.1（紗英為何特殊）、§7.2（「母體」術語的工程來源）、§7.3（初始同意與十年控制）、§7.4（備援失敗史與 G07 的獨立文件）

### 證據鏈

- 母親病歷缺頁（被改，她從未真正死亡）
- 函館三組有日期的材料顯示紗英是第一個整合者
- M-00 臨床索引、`Mother Reference` 欄位
- 國家曾用數位模型與其他接收者尋找備援，全在七日回聲窗附近失穩

### 終局

五名 downstream patients 逐一轉入 patient-specific bridge 後，M-00 operational role 退役；operational registry 保留 `M-00／RETIRED`，patient registry 還原 `朝倉紗英`，historical alias immutable（使用證據受 court／medical hold，禁止刪除）。

---

## 1.5 琴音（Kotone 的完整真相）

### 鎖定答案

白石琴音是**神鏡計畫半受迫協力者，也是千田浩介死亡事件的直接加害者**。妹妹藤川美空（受試者 `G07／03`，13 歲）長期昏迷。父母離異後琴音隨母親改嫁、從繼父姓「白石」，美空隨父親姓「藤川」；兩人為同母異父姊妹（D1 鎖定）。

**動機：** 神鏡計畫告訴她，只要東京方案成功，所有受試者都有機會醒來。這是她協助計畫的唯一理由。

### 循環認知紀律（§7.2，與舊版最大差異）

- 琴音只有**低強度循環熟悉感與重複行為衝動**，**沒有可自由提取的連續輪次記憶**，也不知道自己處於第幾輪。
- 她能掌握千田行蹤與通道權限，是**神鏡方透過支援線提供的交通資料與臨時權限**，不是她自己的循環記憶。
- 白光重置後，她不保留完整通知，只保留「灣岸中央」「那些東西」等**片語熟悉感**。
- **前兩輪刺傷千田的暴力只存在於作者真相與澪記憶**；第三輪法律處理只看當輪可證行為。
- 她本人**不能知道**自己那些小習慣（如固定不點同一款飲料）的行為來源。

### 揭露章節

- ch5–8（階段二：凶手也在重來）
- ch7 plan §7.1（琴音為什麼知道醫院名）
- ch22–23（琴音身分、年齡與循環邊界鎖定）
- ch23 plan §7（琴音程序地位、當輪可證明內容、被重置暴力的界線、琴音的有限承認）
- ch24（琴音作有限安全披露）

### 證據鏈

- 琴音星期一不點同一款飲料（低強度熟悉感的無意識確認儀式；她本人不知行為來源）
- 琴音說出澪沒告訴她的醫院名稱（神鏡支援線提供交通／個案資料）
- 第三輪 21:04 取件與攔截準備（當輪證據確認）

### 終局

琴音主動正式到案，陳述全部當輪可證行為；開啟患者狀態資料層並撤回自己的 `G07／03` persistent delegation；留在隔離服務區，不操作控制器。她不要求澪原諒，也不被作者修復友情。

---

## 1.6 R4／R5

### R4 — 可能未來的失敗模式

**鎖定答案：** R4 不是一個已發生的隱藏第四輪，而是一條**由當前第三輪延伸、在下一個星期一 06:13 前完成的可能未來**：那個版本的澪為了保住悠真，接受過與琴音相似的「必要犧牲」邏輯並失敗。其回聲警告經下一次白光送回本週星期一，由紗英託管記憶承接。現在的澪拒絕預先授權 R4，是時間線偏離那條失敗未來的關鍵。

標記：`NOT PRE-AUTHORIZED／FAILURE-MODE ONLY`。本輪不存在 R4 的文件、雜湊、建立時間、簽章、轉錄者或提交紀錄——這正是 R4 不能被當成普通刪除文件的原因。

R4 的可能來源被限定為：當前第三輪繼續向前 → 在下一個星期一 06:13 前完成 R4 → 下一次白光將 R4 的託管警告回送至本週星期一 06:13。當前行動已因警告改變，原本產生 R4 的未來可能不再發生；它是一條具有因果痕跡、卻可被拋棄的可能未來。

### R5 — 無中央動態母體的聯邦式過渡規格

**鎖定答案：** `KAGAMI-SAFE／R5` 是**無中央動態 Mother Reference 的目標架構與過渡規格**。它不能假裝當輪已經完全離開 M-00。

核心設計：
- 每名患者各自生成 `PATIENT SAFETY ENVELOPE`（只來自自己的腦電、呼吸、自律、睡眠節奏、自然故障、藥物與臨床狀態）。
- 多源網路資料生成 `NETWORK TRANSITION ENVELOPE`（匯流排遙測、自然／維護切換紀錄、M-00 端點醫療承受上限、患者節點非語義安全證明）。
- 兩者取交集才構成主動切換候選資格。
- 紗英不再是其他人的醫療答案；她只提供目前中央端點在過渡期間不可跨越的其中一組限制。
- R5 自身**沒有公共權限**。

R5 評判 R4 的基準是父親 R1 的五項原則（最重要：**活動接收者未完成撤離前，不得執行硬切**）。

### 揭露章節

- ch21–22（階段六：知道全貌的澪也錯了）
- ch21 plan §5（兩種記憶通道與 R4 時間錨）、§6.6（R4 無當輪版本治理紀錄）
- ch22（R4 被定位為 failure-mode 可能未來）
- ch24（R5 建立）

### 證據鏈

- 澪反覆夢見自己在鏡島（來自可能未來的破碎回聲）
- R4 無當輪文件／雜湊／簽章／轉錄者／提交紀錄
- 紗英託管記憶承接回聲
- 父親 R1 五項原則作為評判基準
- 澪出示經遮蔽的 R4 決議，證明她已拒絕那條失敗路線

---

## 1.7 Continuity（continuity governance）

### 鎖定答案

Continuity governance **不是單一 mastermind**，而是分散的跨機關輪值 duty roles 與 policy。其核心缺陷是：**舊離線 continuity 邊界不識別新式 explicit deny**，把合法拒絕判成 operational unavailable，從而產生 `SHARE-CONT` 與 lease。

關鍵機制：
- `Science Escrow` 與 `Operational HSM` 分離；三個機構的輪值 duty roles；cutover 由 policy 自動驅動。沒有任何單一值班者同時持有完整患者資訊及全部取消權。
- `Continuity Policy Review Board` 核准了 deny-blind state machine，將 `CENTRALLY MANAGED` 視為 `MANAGED-EQUIVALENT`，將 post-snapshot queue 優先於 emergency revocation。
- SHARE-S 綁定確切 TOKYO-7 bundle hash，綁定 M-00 CAL_REF；凪原在本輪前續期後又簽發撤回，但七個離線 HSM 只有四個回傳回執。

### 揭露章節

- ch24（continuity 狀態機、套件綁定 SHARE-S 與撤回回執）
- ch25（Public Deny Manifest、官方與媒體反應）
- ch27 plan §7（physical break-glass、三領域 share 拒絕）
- ch28 plan §15.3–15.5（continuity custodian 真相、必須保留的具體人類決定、CONTINUITY-0 後續）

### 證據鏈

- SHARE-O 被凪結、explicit deny 不被舊狀態機識別
- SHARE-S 撤回：七個離線 HSM 只有四個回傳回執
- A17／S42 lease（绑定期患者狀態）
- Continuity Policy Review Board 核准 deny-blind state machine
- break-glass audit：medical／patient-rights／local-operations 三領域全部 DENY

### 必須保留的具體人類決定（ch28 §15.4）

雖然沒有單一 mastermind，公開審理至少能追究：凪原續期 SHARE-S、C2 值班醫療主管確認 relocation proposal、S7 cutover duty role 未完成人工暫停、Physical continuity duty role 發出 break-glass request、Continuity Policy Review Board 核准 deny-blind policy、Docket transfer decision makers 未遷移父親 patient-safety hold。

---

## 1.8 official trim failure（官方修剪失敗）

### 鎖定答案

政府試圖把原始外星訊號改造成對官方有利的敘事（**修剪資料**），讓普通人產生「政府已經處理過危機」「公開真相會造成更大災難」「接受管制才是安全的」「那些失蹤孩子是必要犧牲」的下意識感覺。但**終局修剪失敗**：

- **execution anchor 未簽**（KAGAMI 從未讓 lease 進入 execution）
- **physical override 被拒**（continuity physical break-glass 被 medical safety／patient rights／local operations 三領域明確拒絕）
- **official mobile follow-up 被取消**（在中央 pre-fanout sequencing gateway 的 `+7000ms` 窗口內被精確取消）
- **TOKYO-7 unified public version 沒有形成**（官方手機 follow-up 在中央 fanout 前被取消；普通警報與服務繼續）

A17 lease 以 `EXPIRED／UNEXECUTED` 到期；package caches 轉入司法／營運 evidence quarantine；S7 future science release 已 disabled。

### 揭露章節

- ch25（Public Deny Manifest：建立不可被事後改寫的公共事實）
- ch27（lease execution anchor 未簽、physical break-glass 被拒）
- ch28（官方修剪如何失敗、Public Witness Index）

### 證據鏈

- `CUTOVER AUTH LEASE`：`EXECUTION ANCHOR NEVER ISSUED`、`STATUS EXPIRED／UNEXECUTED`
- official app follow-up cancel receipt、send nonce 列入證物
- Public Deny Manifest 多方簽署（公共營運方、法院、外部醫療、患者權利代表、獨立系統安全）
- 神鏡計畫文件、受試者名單、交通紀錄、監視器原始檔被公開；多國政府否認參與，開始互相切割；無法再組成一份所有證據都配合的完整官方版本

### 核心公開句

> **營運方沒有失聯。它正在拒絕。**
> **拒絕 TOKYO-7，不等於停止普通警報、交通服務或保護性原始過濾。**

---

# Class 2：有意開放（Intentionally Open）

這五項是**刻意保留的開放性**。故事提供提示、線索與邊界，但**故意不給出確定答案**。任何把這些寫死的版本都違反 §7 的敘事紀律。

---

## 2.1 父親最終下落

### 故事確實說了什麼

- 父親（朝倉刑警）七年前完成 `KAGAMI-SAFE／R1`（M-00 外部醫療移管及鏡島放大節點安全切離案）。
- 他到過 M 區外第一道門；報告被國安接管；之後從普通行政紀錄消失。
- 父親是**案件承辦，不是國家級密鑰持有人**；他透過案件、法院／檢察及醫療程序，使七年前 early pilot 停過。
- ch28 提供雙證據程序性進展：
  - **A. Independent medical transfer clearance**：官方失蹤 +11 日後 `STATUS AT EXAM = ALIVE`，biometric match，transport fitness cleared／restricted。
  - **B. Maritime manifest／handoff receipt**：同一 subject hash，vehicle／vessel recorded，handoff completed，`DESTINATION CLASS = MAR-CONT／PROTECTIVE CUSTODY`，receiving receipt present。
- `MAR-CONT` 是**既有的海上災害／關鍵人員保護轉送類別**（`PROTECTIVE TRANSFER CLASS`／`MARITIME CONTINUITY ROUTE`），不是最終章新開的秘密海上基地。ch15／21／24 已伏筆。

兩條鏈共同證明：父親在官方失蹤十一日後仍活著，並完成過一次實際轉送；案件與 continuity protective custody 有關。

### 故事刻意不回答

- 父親目前仍活著／已死亡
- 具體位置
- 是否一直被拘束到現在
- 是否成為另一名受試者
- 是否為外星訊號接收者
- 是否留下完整終局答案

`NO DISCHARGE RECORD` 只代表後續資料仍封緘或缺失。

### 框架開放性的章節

- ch21 plan §7.3（父親失蹤線邊界：本章只能確認四項，不能確認現在下落）
- ch28 plan §17（父親：被證明活過，仍沒有完整下落）
- ch28 Scene 6：「第一次，不知道只是還不知道。不是制度替一個人寫好的死亡或離開。」

### 澪的反應（鎖定邊界）

> 他在那一天之後還活過。他被帶去了某個地方。後面仍然不知道。

---

## 2.2 循環物理（loop physics）

### 故事確實說了什麼

本作的時間循環不是整個世界物理倒帶，而是**記憶回送型時間循環（memory-only loop）**：七天後，某些人的未來記憶被送回七天前的大腦。

已鎖定的機制規則：
- 只有記憶能回到過去（物理證據不能跨時間）
- 只有特定大腦能穩定接收（解釋政府為何需要青少年受試者）
- 情緒越強烈，記憶越穩定（人體實驗會故意製造恐懼、壓力與失去親人的刺激）
- 不同受試者記得不同碎片
- 回送次數越多，精神損耗越嚴重
- 澪每次醒來都是星期一早上 6:13；七天後東京灣爆發無聲白光；白光之後特定大腦帶著記憶回到七天前

### 故事刻意不回答

> 白光為何觸發回送、循環的完整物理原因，到全書結束**仍未被證明**。

循環停止的唯一物理原因也未證明。作者層只鎖定：「她這一次留在當輪。」當輪無法證明循環停止的唯一充分原因。

### 框架開放性的章節

- 高層企劃 §5（未解註記）、§14
- ch28 plan §4.4（循環結果的證據邊界）、§24.1（可成立／不能成立的邊界）
- ch28 作者層真相第 2 條：「當輪無法證明循環停止的唯一物理原因。」

---

## 2.3 外星意圖（alien intent）

### 故事確實說了什麼

- 十年前，北海道一座舊天文台接收到一段神祕訊號；它不像語言，也不像普通電波，更像一種「未來的回聲」。
- 部分青少年接觸訊號後，會夢見幾天後的片段（破碎、情緒化、難以理解）。
- 「警告」是**高可信的人類解讀**，不是已被訊號證實的立場。
- 函館舊觀測站、船舶與岸站的獨立紀錄顯示，訊號無法匹配任何已知地表、海底或登記衛星來源。
- ch28 半年後的新訊號：source family consistent with prior Hakodate band，但 power／coherence 較低；no high-coherence phase detected、no KAGAMI amplification、no known neural coupling observed。

### 故事刻意不回答（§7.5 敘事紀律）

> **外星意圖始終未知。** 訊號沒有已辨認的命令，也沒有把未來送回任何人的腦中。

- **不得**把未知意圖寫死成「訊號源認可／守護／偏袒人類」這類 benevolent 立場。
- 不得讓外星文明直接告訴人類「你們通過測試」。
- 外星智慧完整目的仍未揭露。

### 框架開放性的章節

- 高層企劃 §6（訊號本質的敘事紀律 §7.5）、反轉四（§11）
- ch20 plan（函館夜潮事件、非地球已知系統來源）
- ch28 plan §20（新訊號與舊危險來源的暫定差異）、§28 第 34 條（外星智慧完整目的仍未揭露）

---

## 2.4 美空／葵長期預後（Misora／Aoi long-term prognosis）

### 故事確實說了什麼

患者得到**不同 stage，不強迫同時 handoff**（§7.7）。ch28 數週 bridge 過程：

- 美空：COMPARE 後 SAFE PAUSE（drift）；原訂 transition 因自律波動延期約 48 小時；其後以 Domain-C bridge 脫離 M-00 common endpoint。drift 不再上升，Domain-C 保持，**無意識改善證據**。
- 葵：HOLD；AOI-LOCAL baseline；原訂 bridge 因感染／鎮靜調整延後；AOI-LOCAL 經額外觀察後建立 patient-specific bridge，**仍未醒**。

兩人均各自取得 patient-specific bridge，不再共同依賴 M-00，但仍需長期醫療、隱私及法律保護。

### 故事刻意不回答

- **不讓美空醒來。**
- **不讓葵醒來。**
- 不用奇蹟回答。
- 所有患者長期結果仍需多年醫療與法律跟進。

琴音三個月後問「美空呢」，澪只答：「沒有醒。影子模型還在做。」

### 框架開放性的章節

- 高層企劃 §7.7（患者得到不同 stage）
- ch28 plan §5.6（美空、葵與其他 downstream patients）、§10.2（固定順序、非固定日期）、成果十／十一
- ch28 作者層真相第 10 條：「美空與葵不在本章醒來。」

---

## 2.5 七十年窗口（the 70-year window）

### 故事確實說了什麼

ch28 半年後 epilogue：母親留下的 wideband analog comparison receiver 與其他台站共同接收到一輪低功率窄帶多音。

```text
SIGNAL TYPE         NARROWBAND MULTI-TONE／MATHEMATICAL
REFERENCE FRAME     PROBABLE PULSAR-RELATIVE
ORIGIN              CONSISTENT WITH PRIOR HAKODATE SOURCE
TIME OFFSET         APPROX. +70 YEARS
CONTACT WINDOW      PROBABLE／NOT PROVEN
ALTERNATIVES        OPEN
SEMANTIC COMMAND    NONE DETECTED
FUTURE MEMORY       NONE DETECTED
```

多組獨立模型得到「相近但非絕對」的解讀：它**可能**是一張 pulsar-relative map，指向約七十年後的時間／位置窗口。沒有已辨認命令，也沒有把未來送回任何人的腦中。可能替代解讀包括訊號原點時間標記、觀測對齊窗口、重複週期或位置／時間聯合座標。

### 故事刻意不回答

- 七十年窗口是否為接觸
- 接觸是否必然發生
- 訊號是否必然善意
- 解碼是否已成定論
- 訊號是否絕對安全（`SAFETY NOT PROVEN`）

`CONTACT WINDOW = PROBABLE／NOT PROVEN`；不是所有團隊都同意它是否真是星圖、七十年是否是接觸、座標是否指向位置／時間或兩者。

### 框架開放性的章節

- 高層企劃 §14（收音機與七十年 §7.5）
- ch28 plan §20（母親留下的 receiver、公開監測網、新訊號與舊危險來源的暫定差異、為何是七十年）、§21（最終畫面與最後一句）
- ch28 作者層真相第 33 條：「pulsar-relative map 及 +70 years 為高可信暫定解讀，不是絕對真相。」

### 鎖定最終句（不寫死，但承認開放）

> 收音機裡沒有倒數。
> 只有一個必須用七十年走到的座標。
> **未來第一次留在前面。**

這句使用的是角色與社會採用的暫定理解，不表示接觸必然發生、訊號必然善意、解碼已成定論、或外星智慧向人類頒發答案。

---

# Class 3：不能再增加（Must NEVER Be Added — Frozen Boundaries）

這六項是**凍結邊界**。故事對它們關閉。任何 Phase 1+ 的計畫或正文新增都違反 Canon。每一項都已由既有元素填補其敘事功能。

---

## 3.1 新 mastermind（禁止新增幕後主使）

### 為何禁止

Continuity governance **沒有單一 mastermind**。ch28 §15.3 解封顯示：`CUSTODIAN` 不是一名掌握全部按鈕的幕後人物，而是 Science Escrow 與 Operational HSM 分離、三機構輪值 duty roles、cutover 由 policy 自動驅動。沒有任何單一值班者同時持有完整患者資訊及全部取消權。

引入新 mastermind 會破壞「現代陰謀的可怕之處不是所有人都邪惡，而是每個人只做一小部分，沒有人看到全貌」的核心設計（高層 §4）。

### 既有元素已填補

- **凪原唯**是核心科學家（前研究中心負責人、現內閣危機科學統括者），但她**不是最高決策者**；她的恐懼有真實基礎（函館夜潮），選擇仍不可原諒。
- Continuity 由 Science Escrow／Operational HSM 分離、三機構輪值 duty roles、Continuity Policy Review Board 等共同構成。
- ch28 §15.4 列出六類必須保留的具體人類決定，讓「分散責任不等於沒有個人作過決定」。

---

## 3.2 新患者群（禁止新增受試者群體）

### 為何禁止

患者計數已鎖定（final_polish §14.4）：

```text
TOTAL HUMAN RECORDS          9
SAFE-DETACHED                1／G07-12／朝倉悠真
ACTIVE HUMAN DEPENDENCIES    8
```

後續 bridge **只減少 downstream，不重新增加**。不得在 ch27 突然冒出兩名「方便成功」的患者。

### 既有元素已填補

固定八名 active humans 矩陣已完整定義：

| 個案 | 身分 |
|---|---|
| M-00 | 朝倉紗英（source patient endpoint） |
| 藤川美空 | `G07／03`，13 步，長期昏迷 |
| 水瀨葵 | `G07／08` |
| `LEGACY／02` | 姓名 LEGACY 封緘 |
| `LEGACY／04` |成年人，曾留下有限自我同意 |
| `G07／05` | 16 歲，失蹤前學校吹奏樂部成員，prior assent |
| `ACTIVE／C` | |
| `ACTIVE／D` | |

---

## 3.3 新 science root（禁止新增科學根）

### 為何禁止

訊號來源家族已鎖定為**函館 prior Hakodate source family**。ch28 §20.3 新 carrier 顯示 `SOURCE FAMILY CONSISTENT WITH PRIOR HAKODATE BAND`。引入新科學根會破壞「10 年前一個訊號 → 一切後果」的因果鏈。

### 既有元素已填補

- 北海道舊天文台十年前接收的外星訊號為**唯一科學根**。
- 所有後續現象（黑色海、倒月、七線、G07 受試者、KAGAMI、TOKYO-7、函館夜潮事件）皆由此衍生。
- ch28 新訊號明確標示為同一 source family 的低功率後續，不是新根源。

---

## 3.4 新秘密設施（禁止新增秘密設施）

### 為何禁止

`MAR-CONT` 是**既有的海上災害／關鍵人員保護轉送類別**（`PROTECTIVE TRANSFER CLASS`／`MARITIME CONTINUITY ROUTE`），不是最終章新開的秘密海上基地（ch28 §17.1）。引入新秘密設施會破壞「陰謀披著正常制度的外衣」的現實感（高層 §6）。

### 既有元素已填補

主要舞台已在高層 §4 鎖定：

| 地點 | 故事功能 |
|---|---|
| 東京臨海地區 | 無人電車殺人案、東京灣白光、終局鏡島事件 |
| 江東區老住宅區 | 澪與悠真生活區 |
| 霞關周邊 | 政府危機管理部門 |
| 筑波研究區 | 睡眠研究中心與神鏡計畫資料庫 |
| 北海道舊天文台 | 最早接收外星訊號；函館夜潮事件 |
| 東京灣人工島「鏡島」 | TOKYO-7 參考部署點與訊號放大裝置 |

- `MAR-CONT` 作為既有 BCP／transport 程序分類，已在 ch15／21／24 伏筆。
- 鏡島是既有東京灣人工島，不是新設施。

---

## 3.5 新時間輪次（禁止新增時間輪次——精確為 3 輪）

### 為何禁止

全書採**三大段認知階段，三次七日週期**（§7.1）：

| 輪次 | 章節 | 說明 |
|---|---|---|
| 第一輪 R1 | ch1–4 | 第一個七天；結束於第一次白光＋首次記憶回送 |
| 第二輪 R2 | ch5–16 | 第二個七天；結束於第二次白光＋回送 |
| 第三輪 R3 | ch17–28 | 第三個七天；**不再回送**，澪走進第八天 |

澪是唯一完整保留兩次七日經歷（R1＋R2）的人；R3 是她正在生活、且不再重來的那一輪。

引入新時間輪次（如「隱藏第四輪」）會破壞三輪結構的推理公平性與情感重量。

### 既有元素已填補

- **R4 不是已發生的隱藏第四輪**，而是 failure-mode 可能未來（§7.4）。它作為「可能未來的警告」已填補「第四輪」的敘事空間，但**不是真實輪次**。
- R3 不再回送，澪走進第八天——這是全書結構的核心承諾。

---

## 3.6 新終局鑰匙（禁止新增終局鑰匙）

### 為何禁止

終局**不靠新規則**，所有終局機制均有前期伏筆（高層 §16 原則 1）。§7.7 明確列出終局**不是**什麼：

- **不炸毀人工島**
- **不關閉 protective filter**（filter 阻止高相干統一神經輸出，卻不消除物理白光與低強度感官殘響）
- **不奇蹟甦醒**（患者得到不同 stage，不強迫同時 handoff）
- **不全世界統一記憶**（TOKYO-7 unified public version 沒有形成）

引入新終局鑰匙（神秘按鈕、新主角能力、新外星介入）會破壞「澪的勝利不是照計畫執行，而是拒絕那條失敗的可能未來」的主題（高層 §16 原則 8）。

### 既有元素已填補

終局鑰匙全部是**前期伏筆的組合**：

- 預先簽署的**本地七階段分散式換手時鐘**（Distributed Switch Clock）
- **all-human safety latch**（三領域 share 拒絕 physical break-glass）
- **opt-in Patient Witness Path**（只送 keys／IDs／roots，不含 raw neural stream）
- **Public Deny Manifest**（多方簽署的不可改寫公共事實）
- **lease 自然到期未執行**（A17 lease `EXPIRED／UNEXECUTED`，execution anchor never issued）
- 澪**拒絕預先授權 R4**（時間線偏離失敗未來的關鍵）

這些機制在 ch21–27 逐步建立，ch28 收束；沒有任何一項是 ch28 臨時發明。

---

# 附錄：分類邊界備註

以下謎題在結構上**部分被回答、部分刻意開放**，但本檔遵循 `final_polish.md §8 Bible 7` 的分區，將它們歸入單一類別。此處僅標記，不改變分類。

| 謎題 | 主要歸類 | 跨類特性（僅標記，不修正） |
|---|---|---|
| 循環物理 | Class 2（開放） | 機制「是什麼」（記憶回送型）已完整解答（偏 Class 1），但「為何物理上能發生」與「為何停止」始終開放（Class 2）。spec 將整體列為開放。 |
| 外星意圖 ↔ 七十年窗口 | Class 2（開放）× 2 | 兩者高度交織：訊號「是什麼」（高可信人類解讀為警告、可能是 pulsar-relative map）部分被回答，但「意圖」與「七十年是否為接觸」共享同一個不可證性。spec 分為兩項，但本質上同源。 |
| 父親最終下落 | Class 2（開放） | 「活過官方失蹤並被轉送」有雙證據（偏 Class 1），但「最終下落」開放（Class 2）。spec 將整體列為開放。 |
| R4 | Class 1（完整解答） | R4「是什麼」（failure-mode 可能未來，非隱藏第四輪）已完整解答，但 R4 的「具體內容」（那個版本的澪具體做了什麼犧牲）保持刻意模糊——這是 R4 作為「警告」而非「答案」的設計。 |
| 琴音 erased-loop 暴力 | Class 1（完整解答） | 「琴音是直接加害者」作者真相已鎖定（Class 1），但「前兩輪暴力能否成為第三輪刑事事實」被刻意保持為法律開放（§7.2 紀律：只看當輪可證行為）。這是法律層的開放，不是真相層的開放。 |

> 這些跨類特性是**刻意的敘事張力**，不是 Canon 缺陷。它們讓故事在「已回答」與「必須自己承擔未知」之間保持重量。

---

# 最終原則

> **第八天不是所有問題被解決的日子。**
> **是所有人第一次不能再把後果交給下一輪的日子。**

Class 1 的解答讓推理公平閉合；Class 2 的開放讓主題不被簡化；Class 3 的凍結讓世界不會因新增設定而失去重量。

三者共同構成《神鏡七日》的真相分區：**能回答的，已誠實回答；不該回答的，拒絕假裝；會破壞故事的，永不再增加。**

> **未來第一次留在前面。**
