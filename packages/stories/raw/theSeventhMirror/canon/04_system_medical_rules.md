# Bible 4：System／Medical Rules（系統與醫療規則）

> **權威來源：** 本檔鎖定 `docs/final_polish.md §8 Bible 4` 所列 17 項系統／醫療概念的最終定義。
> 對齊 `docs/00_high_level_plan_final.md`（§5 時間循環、§7 東京方案、§17 已鎖定 Canon）、`docs/chapter_*_plan.md` 全 28 章、`docs/characters.md`，以及 `final-polish/canon_decisions.md`（D1–D8）。
> **狀態：** Phase 1 鎖定。Phase 1+ 的正文與章節企劃修改必須符合本檔。
>
> **首要規則（不可違反）：**
> - 循環為 **記憶回送型時間循環（memory-only loop）**——只有記憶能回到過去，**物理證據（傷口、物品、照片、錄音、資料晶片）不能帶回**（`00_high_level_plan_final.md` §5；`canon_decisions.md` 無修正）。
> - **R4 是「下一回聲窗中的可能未來」failure-mode，不是已發生的隱藏第四輪**（§7.4；`canon_decisions.md` 涉及 R4 之處均遵此）。
> - **MAR-CONT 範圍限 ch15／ch21／ch24 三章**（鎖定決策 D7）；不得在 ch17 或其他章節出現。
> - **外星訊號意圖始終未知**；「警告」只是高可信的人類解讀（§7.5）。

---

## 1. memory-only loop（記憶回送型時間循環）

**中文名：** 記憶回送型時間循環

**定義：** 本作的時間循環不是整個世界物理倒帶，而是「七天後，某些人的未來記憶被送回七天前的大腦」。白光（東京灣無聲白光）之後，特定大腦帶著記憶回到星期一早上 06:13。**只有記憶能跨時間；物理證據（傷口、物品、照片、錄音、資料晶片）一律不能帶回**。主角每一輪都必須重新蒐證。只有特定大腦（以青少年為主）能穩定接收；情緒越強烈，記憶越穩定；回送次數越多，精神損耗越嚴重。

**定義出處：** `00_high_level_plan_final.md` §5（時間循環規則）；表面規則與真正規則表。

**約束／邊界：**
- 白光為何觸發回送、循環的完整物理原因，到全書結束**仍未被證明**（§5 未解註記；§6、§14、開放謎題）。角色與敘事都不得過度宣稱已解。
- 澪是唯一完整保留兩次七日經歷（R1＋R2）的人；R3 不再回送，她走進第八天（§10）。
- 琴音只有低強度熟悉感，**沒有**可自由提取的連續輪次記憶，也不知自己處於第幾輪（§9 琴音、§17）。
- 日下部保留第二輪白光造成的語言／方向／危險碎片，**不完整記得**第二輪（§9 日下部、§17）。
- 千田**無前輪記憶**（§17、`canon_decisions.md` Task 7-adjacent）。

---

## 2. M-00（基準母體）

**中文名：** 基準母體（朝倉紗英）

**定義：** M-00 源自早期工程俗稱 **Mother Reference**，原意不是生育者，而是「第一份可供後續複製、比對與校準的穩定神經基準」。最初研究程式欄位為 `MOTHER_REF_00`，日文行政文件翻成「基準母體」，再簡寫為 `M-00`。M-00 是朝倉紗英——函館夜潮事件後的第一代穩定接收者，唯一能穩定區分過去、當下與尚未發生片段的人。她的神經反應將陌生訊號整理成較穩定的影像與節奏（黑色海完整構圖即其「翻譯層」），後續反應評估與接收模型均與此比對。M-00 被國家以官方死亡掩護，維持在半昏迷的雙向穩定閉環中長達十年。

**定義出處：** `00_high_level_plan_final.md` §9（朝倉紗英）、§17；`chapter_19_plan.md`（工作站顯示 `M-00／基準母體／狀態：維持中`）；`chapter_20_plan.md` §7（Mother Reference 術語來源、七十二小時同意、備援失敗史）。

**約束／邊界：**
- 紗英最初只同意**七十二小時**觀察；十年的長期維持從未取得持續、自由、完整的同意（ch20）。
- 黑色海可能是紗英對原始訊號的翻譯，**不是訊號原貌**（ch20 §6.4）。
- 國家曾製作數位模型、合成參照與其他接收者作備援，但均在七日回聲窗附近漂移、失穩（ch20 §7.4）。
- M-00 數位備援原本即為模組化架構：`PHYSIOLOGICAL PHASE CONTROL`／`ECHO SUPPRESSION`／`SEMANTIC INTERPRETATION`／`FUTURE CLASSIFICATION`／`PUBLIC CONSENSUS INTERFACE`（ch20 §5.5；ch24 §8.2 回收）。
- 紗英不能在當晚被粗暴拔線或直接搬走（外部醫療可獨立驗證的醫療事實）；但可立即開始外部共同接管、藥物核驗、替代維持與分階段撤離評估（ch20 §5.1）。
- M-00 不是悠真的生命插頭；悠真被救出後完成安全切離（safe-detached），腦中殘留不屬於自己的未來片段（ch19 §4.11）。
- `TOKYO-7` 在設計上具有可選的 `M-00 CAL` 校準欄位（ch20 §5.3）。

---

## 3. G07（第七同步群）

**中文名：** 第七同步群（管理群／測試群）

**定義：** G07 是 TKS-SYNC 系統中的群組代號。它在不同部署或專案內可各自重新編排：研究資料專案中的 `G07` 是「研究管理群」，灣岸警報部署中的 `G07` 是「同步測試群」。兩者即使格式相同，也可能只是兩個不同系統各自的「第七群」，不天然指向同一批實體。悠真在研究文件中被標為 `G07／12`（第七群／第十二端點）；水瀨葵為 `G07／08`；藤川美空為 `G07／03`。獨立研究摘要顯示，G07 至少有一項用途是尋找能在 M-00 不可用時維持分類穩定的備援參照；悠真為高適配候選。

**定義出處：** `chapter_13_plan.md`（首次讀出 `G07／12` 語法）；`chapter_14_plan.md` §3.4（G07 可重複使用）；`chapter_17_plan.md`（筑波路線牌 `G07／12／B2`）；`chapter_20_plan.md` §7.4（備援用途）；`chapter_24_plan.md` §8.1（`G07／08 = 水瀨葵`）。

**約束／邊界：**
- **不得**把研究管理群 `G07`、灣岸同步測試群 `G07` 與 `TOKYO-7` 維護別名中的 `7` 直接畫上等號（ch14 §3.4、ch15 §4.5）。三者在 ch15 之前只有數字相似，證據層級不同。
- G07 的完整用途包括：備援參照、一致性敘事訓練、下一代公共同步適配（ch21 §19）；但 ch20 只能證明其中一項。
- 群號可在不同部署重複使用；公開文件可見空殼群號 `G07`，但群內端點表、實體位置、維護帳號與別名對照表不公開（ch14 §3.4、ch15 §4.6）。
- `G07／12` 的 `12` **不一定**是人員序號；本章（ch17）不能確認它代表人（可能為設備、檢體或批次）。

---

## 4. Domain-P／Domain-C（雙安全域）

**中文名：** 公共授權域／患者臨床影子根域

**定義：** 美空床側控制器（銀色卡匣）具有兩個彼此隔離的安全域。
- **Domain-P**（`KAGAMI PUBLIC／MAINTENANCE AUTH`）：公共／維護授權域，可在鏡島重建公共授權。
- **Domain-C**（`PATIENT CLINICAL SHADOW ROOT`）：患者臨床影子根域，綁定美空病人專屬局部影子參照（`G07／03`）。

兩域具有獨立供電、獨立時鐘與獨立重置域。Domain-P 的執行可被本地、不可遠端逆轉地隔離（`QUARANTINE-P`），而 Domain-C 不受影響、臨床簽章保持 active。`CONTINUITY-0` 無法遠端復活已隔離的 Domain-P，只能另行簽發一枚新的制度級公共 token。

**定義出處：** `chapter_24_plan.md` §0（卡匣兩域首次揭露）、§12（Domain-P 安全隔離完整程序）、Scene 5（行動高潮）。

**約束／邊界：**
- Domain-P 隔離**不屬患者切換**——不拔除卡匣、不進行活體切換、不進行影子接管（ch24 §12.4）。
- 美空卡匣隔離後，制度仍能另造一把公共鑰匙（ch24 §12.5、§12.6）；隔離的有限勝利是真實的，但不是整體勝利。
- Domain-C 只保存生理、神經與相位穩定模型，**不保存**人格、記憶、意識或「美空本人」（ch24 §0）。
- Domain-C 的 `EXPORT` 狀態為 `LOCKED`：保護患者隱私、模型隔離、不可匯出金鑰、防止患者成為新中央模板（ch24 §5.3）。

---

## 5. patient-bound root（患者綁定本地臨床根）

**中文名：** 患者綁定本地臨床根

**定義：** R5 的核心原則——每名患者必須擁有一個只綁定自己的患者本地臨床根。它可以是既有的 Domain-C、新生成的患者專屬根，或經臨床轉接器包裝的舊式本地根。R5 禁止使用另一名患者的根、禁止使用中央 Mother Reference 作永久根、禁止使用公共 Domain-P 作患者臨床根、禁止將美空模型複製給葵或其他人。模型留在本地、以患者綁定的臨床根簽署；對外只輸出與獨立醫療一致的驗證結果。

**定義出處：** `chapter_24_plan.md` §4（患者綁定的本地臨床根）、§1（`PATIENT ROOT = PATIENT-BOUND／LOCAL`）。

**約束／邊界：**
- 美空已有 Domain-C；葵尚無局部影子（需新生成）；`LEGACY／02` 舊硬體不支援 Domain-C（需臨床轉接器）——三者狀態不同，R5 不假設人人已有 Domain-C（ch24 §4）。
- 本地節點**不能自己證明自己安全**：每次被動驗證須同時存在本地影子證明（程式版本雜湊、硬體 attestation、患者本地根簽章）與獨立醫療觀察（外部腦電、呼吸、自律監測、獨立時間戳）。只有兩者一致，才能記錄「被動驗證相符」；任何不一致以外部醫療結果為優先並停止升級（ch24 §5.4）。
- `EXPORT LOCKED` 保留——不要求解鎖原始模型、不傳回中央、不讓一名患者的模型被其他人使用（ch24 §5.3）。

---

## 6. R1–R5（KAGAMI-SAFE 版本鏈）

**中文名：** 神鏡安全切離案版本鏈（五版）

**定義：** KAGAMI-SAFE 是圍繞 M-00 外部醫療移管及鏡島放大節點安全切離的案件根名稱，包含五個版本：

| 版本 | 作者 | 內容 | 時間 |
|---|---|---|---|
| **R1** | 父親（朝倉源一郎） | 根文件與五項安全原則：①醫療與校準分離 ②先撤離所有活動接收者 ③不得以新受試者永久替代 ④原始紀錄先行外部保全 ⑤無法安全切離時不得啟動 TOKYO。 | 七年前 4 月 |
| **R2** | 千田浩介（技術修訂附錄） | 東京灣人工島節點 `KAGAMI-01`、與公共輸出分離的 `COMMIT-GATE`、離線設定載體、原始訊號過濾／一致性層／公共 fanout 可分段隔離、七秒補正的正確用途。 | 七年前 5 月上旬 |
| **R3** | 紗英臨床安全修訂（父親納入版本鏈） | 區分兩種記憶通道（七日經歷回送 vs 額外記憶託管回聲）；只限制後者；不將完整未成立未來方案託管送回，只留安全錨點。內容來源早於 R1，納入版本鏈晚於 R2。 | 七年前 5 月下旬 |
| **R4** | **可能未來中的澪**（非當輪作者） | 無當輪檔案、雜湊、建立時間、簽章。標記 `R4／RECONSTRUCTED／FAILURE-MODE ONLY`／`FULL PACKAGE／NO ESCROW TO MIO`。為失敗模式：在未撤離全部活動接收者前接受硬切，造成其他受試者死亡、昏迷或永久記憶損傷。 | 下一回聲窗可能未來 |
| **R5** | FEDERATED（無單一作者） | 聯邦式版本治理；目標架構無中央動態 Mother Reference；患者綁定本地臨床根；多源網路過渡邊界；限制性同意與撤回。 | 當輪第三輪星期六 |

**定義出處：** `chapter_21_plan.md` §6（版本時間表）、§7（R1 五項原則）、§8（R2 技術）、§9（R3 部分重建）、§13（R4 不存在）；`chapter_24_plan.md` §0、§1（R5 標頭）。

**約束／邊界：**
- **R4 是 POSSIBLE-FUTURE failure-mode，不是已發生的隱藏第四輪**（§7.4；`canon_decisions.md`）。其時間來源被嚴格綁定為：當前第三輪繼續向前、在下一個星期一 06:13 前完成 R4，並由該次白光把託管回聲送回本週星期一 06:13。當前行動已因警告改變，原未來可能不再發生；它是一條具有因果痕跡、卻可被拋棄的可能未來。
- R4 的作者是 Mio；其安全註記要求**不要**把完整 R4 套件透過額外託管回聲送回（`NO ESCROW`）。紗英在 ch21 記得：在那條可能未來裡，澪曾看見代價，仍接受過一次（`MIO／SAW COST／ACCEPTED／ONCE`）。
- R5 不重新訓練新系統，只回收 ch20 模組化備援，保留 `PHYSIOLOGICAL PHASE CONTROL` 與最低必要 `ECHO SUPPRESSION`，停用 `SEMANTIC INTERPRETATION`／`FUTURE CLASSIFICATION`／`PUBLIC CONSENSUS INTERFACE`（ch24 §8.2）。
- R5 的 `AUTHORSHIP = FEDERATED／NO SINGLE OWNER`：起草、患者權利、法律、系統、公共營運各領域**不可互相替代**；任何患者的局部影子主動啟用必須全部具備五項（患者意願或法定代理、外部醫療、當地臨床保管、系統安全），不得使用 3-of-5 或緊急倒數自動替代（ch24 §2）。
- 當輪 R5 只取得 `PASSIVE-CONCORDANT／STAGE-1` 被動相符，`ACTIVE SWITCH = PROHIBITED`、`FAILOVER READINESS = NOT ESTABLISHED`（ch24 §10.6）。

---

## 7. SHARE-S／SHARE-O／SHARE-CONT（授權份額三變體）

**中文名：** 科學份額／正常營運份額／持續營運份額

**定義：** TOKYO-7 最終提交（final commit）的授權邏輯需要兩個不同領域：
```
SHARE-S／SCIENCE  +  ONE OPERATIONAL SHARE
```
- **SHARE-S**（科學份額）：綁定確切 TOKYO-7 bundle hash、`CAL_REF = M-00`、consensus profile、public route set、有效窗（星期日 23:50 至星期一 06:20）。由凪原以現任統括調整官身分在本次七日窗前確認／續期；分送至七個離線區域 HSM。舊 SHARE-S **不能**配對任意新 payload。
- **SHARE-O**（正常營運份額）：正常營運方定期發送 heartbeat（authorization status、bundle acceptance）。
- **SHARE-CONT**（持續營運份額／continuity operational share）：在星期日 23:50 continuity cutover 後才取得 operational eligibility；平時不具資格。

正常狀態下 `SHARE-S + SHARE-O` 可形成授權，`SHARE-CONT` 不具資格。continuity cutover 後 `SHARE-CONT` 才取得資格，`SHARE-S + SHARE-CONT` 可形成授權組合。

**定義出處：** `chapter_24_plan.md` §14（最終提交、SHARE-S 撤回與 Continuity 狀態機）、§14.1–14.6。

**約束／邊界：**
- SHARE-S 撤回不是抽象申請——七個離線 HSM 各自返回不可改寫的 revocation receipt；當輪固定為 4／7 已確認、3／7 待處理，截止為星期日 23:50（ch24 §14.3）。
- 舊 continuity HSM 只識別 `VALID OPERATIONAL SHARE`／`NO VALID OPERATIONAL SHARE`，**不識別**新式法律／醫療 explicit deny——司法凍結、醫療拒絕與真正通訊中斷都會被壓縮為 `OPERATIONAL SHARE UNAVAILABLE`（ch24 §14.4）。
- 凪原的個人責任：她續期了確切套件的科學份額、維持角色 escrow、沒有在外部調查開始後立即撤回、曾接受 continuity 條款作安全網。她不是唯一最後按鈕，仍對自己真正作過的決定負責（ch24 §14.8）。
- 23:50 只是取得授權資格（commit authorization eligible），**不是** execution commit；之後六小時才是套件分送、區域驗證、離線路徑與鏡島預熱；05:50 後才進入執行階段（ch24 §14.6）。

---

## 8. capsule／lease（授權膠囊與租約機制）

**中文名：** 授權膠囊與 BCP 租約

**定義：** TOKYO-7 的最終執行依賴一套密碼學租約鏈。
- **capsule（套件／bundle）**：綁定特定 TOKYO-7 profile 的授權套件，含 bundle hash、CAL_REF、consensus profile、public route set。套件預置（package preposition）後才可進入執行準備；套件 hash 是阻斷路徑之一——若 hash 無法通過最終驗證，套件失效。
- **lease（租約／CUTOVER AUTH LEASE）**：由 S7 Science Escrow HSM 在 23:50 產生當輪 science token，結合 operational token、bundle hash、lease nonce 形成 `AUTH_EPOCH`（如 A17）。租約綁定特定 `SUBJECT_EPOCH`（如 S42）與 continuity 的 `MANAGED-EQUIVALENT／CACHED` 患者語義。租約有效至 06:20，到期後以 `EXPIRED／UNEXECUTED` 狀態轉入司法／營運 evidence quarantine。

**定義出處：** `chapter_24_plan.md` §14.2（SHARE-S 綁定套件）、§8.3（23:50 continuity cutover 三階段）；`chapter_26_plan.md` §0（lease 載入與 Subject Bay 掛載條件）、§0.1；`chapter_28_plan.md`（06:20 lease 到期）。

**約束／邊界：**
- 當輪 lease（A17／S42）密碼學上仍有效，卻不再適用於 S43（當輪已合併患者 signed updates 形成 `SUBJECT_EPOCH S43`）；新 S43 bundle 需要 A18 science token，但 `FUTURE RELEASE = DISABLED`、`NEW SCIENCE TOKEN = UNAVAILABLE`，因此 Route A（正式 S43 rebind）失敗（ch26）。
- lease 載入前（23:50 前），外部團隊只能看到中央聚合摘要，**不能**取得鏡島本地 S42 或執行 monotonic merge；Subject Bay 掛載條件未成立（ch26 §0.1）。
- 23:50–05:50 為套件預置階段（分發綁定 bundle、區域 HSM 驗證、離線公共路徑準備、鏡島設備預熱、package hash 鎖定）；05:50 後才進入 auto-prep／CAL LOCK／consensus preparation／execution commit（ch24 §8.3）。
- **MAR-CONT（PROTECTIVE TRANSFER CLASS）**欄位僅在 **ch15／ch21／ch24** 三章出現（鎖定決策 D7）；早期讀者只能理解為公共工程驗收文件常見的災害復舊排程（BCP CUTOVER 23:50／PREPOSITION WINDOW 23:50–05:50）。**不得**在 ch17 或其他章節出現。

---

## 9. Subject Bay／latch（受試者連續性艙與臨床安全閂）

**中文名：** 受試者連續性艙與臨床安全閂

**定義：**
- **Subject Continuity Bay**：平時並非可隨時查閱的普通資料庫，`SUBJECT LEDGER = SEALED／LOCAL OFFLINE`、`BCP CACHE = SUMMARY ONLY`、`SERVICE MOUNT = UNAVAILABLE`。只有在 cutover lease 已載入、package preposition 開始、KAGAMI 進入 BCP 本地維護窗後，才本地掛載（`LOCAL SERVICE MOUNT`、`LEASE SNAPSHOT S42 VISIBLE`、`EXECUTION-ANCHOR PATH = ACTIVE／PREP ONLY`）。
- **clinical latch（臨床安全閂）**：保護八名活動人類依存者的鎖。普通軟體無法在 unresolved humans 存在時 override clinical latch。物理 break-glass 跳過患者拒絕需三領域 share（medical safety、patient-rights、local operations）全部具備，加上本地實體操作與不可改寫 audit。

**定義出處：** `chapter_26_plan.md` §0.1（Subject Bay 掛載條件）、§0.2（R1 安全語義與 continuity 偷換）；`chapter_27_plan.md` §7（physical break-glass）。

**約束／邊界：**
- Subject Bay 只能在 23:50 lease 載入後打開，不是角色故意等到 lease 出生後才想起安全閂（技術限制）；同時法院核准的是條件式患者安全開示（程序限制）——只有指定 bundle 已進入本地預置／執行準備，且 distributed hold 未被 continuity 接受時，才可打開包含患者私密狀態的本地 Bay（ch26 §0.1）。
- Continuity 的制度錯誤不是刪除安全閂，而是把「仍由中央控制」重新定義成「等同已安全處理」（`MANAGED-EQUIVALENT／CACHED`）——S42 顯示的不是普通 `CLEAR`，而是 `CACHED／MANAGED-EQUIVALENT`（ch26 §0.2）。
- 當輪固定人類依存紀錄為 9（1 safe-detached 悠真 + 8 active），八名 active = 4 紅區具名 + 4 其他活動（ch26 §0.3）。
- ch27 physical break-glass 三領域 share 全部 DENY：`MEDICAL SAFETY = DENY`、`PATIENT-RIGHTS = DENY`、`LOCAL OPERATIONS = DENY`；break-glass panel outer action attempted、inner bypass not reached、audit immutable（ch27 §7）。

---

## 10. execution anchor（執行錨點）

**中文名：** 執行錨點（KAGAMI-01 本地確認點）

**定義：** KAGAMI-01（鏡島人工島節點，舊代號 K-01）是設定家族索引裡的端點，功能欄為 `execution anchor`（執行錨點），附帶 `local clinical check`（本地臨床檢查）。某些操作需要一個本地確認點才能成立——它是 TOKYO-7 consensus／public bundle 的最終 commit 鎖。KAGAMI 不是第三張授權票；science 與 operations token 是兩個機構授權領域，KAGAMI 只負責判定：這份租約是否仍適用於當輪患者狀態，以及是否能在不傷害臨床依存者的情況下執行。

**定義出處：** `chapter_20_plan.md` §5.5.C（K-01／KAGAMI 血統早期欄位）；`chapter_21_plan.md` §8.3（`EXECUTION ANCHOR／KAGAMI-01` 對應 ch20 種子的回扣）；`chapter_26_plan.md` §0（KAGAMI 判定職責）。

**約束／邊界：**
- 當輪 ch27：KAGAMI-01 **不簽** execution anchor（`EXECUTION ANCHOR = NOT ISSUED`）；TOKYO-7 consensus／public branch 全程 HOLD（ch27 §0）。
- KAGAMI execution anchor 與 official app follow-up 屬不同路徑：即使 KAGAMI 不簽 execution anchor，continuity-controlled cluster 已預置的 app object 仍可在 +7000ms 發出官方解釋，因此 ch27 仍需精確取消 exact mobile payload（ch27 §3.3）。
- COMMIT-GATE 在最終提交前仍須確認臨床側（`CLINICAL HOLD`、`CLINICAL TOPOLOGY HASH`）；`REGIONAL PACKAGE／PREPOSITION ONLY` 表示區域套件只標記為預置，不構成執行許可（ch21 §8.3）。

---

## 11. seven-stage schedule（七階段分散式換手時鐘）

**中文名：** 七階段分散式換手時程（Distributed Switch Clock）

**定義：** `Distributed Switch Clock` 不傳送神經內容，也不是由鏡島持續逐步指揮所有患者。05:49 前，每個具相容 root／sidecar 的節點均已預載同一份已簽署時程（`SIGNED LOCAL SCHEDULE`）。05:50 的 `ANNOUNCE` 只確認各節點使用哪一個已預載 epoch，不會持續向所有患者發出下一步命令。七個階段為：

| 階段 | 時間 | 功能 |
|---|---|---|
| `ANNOUNCE` | 05:50:00–05:51:20 | 確認本地 schedule epoch，不改變控制。 |
| `SAMPLE` | 05:51:20–05:54:20 | 各節點取樣自己的相位、外部醫療、local root 與中央支援。 |
| `HOLD` | 05:54:20–05:57:00 | 凍結新的 transition step；未準備患者可永久停在此階段。 |
| `COMPARE` | 05:57:00–06:01:00 | 與 Patient Safety Envelope 及 Network Transition Envelope 比較。 |
| `ACKNOWLEDGE` | 06:01:00–06:04:00 | 各患者／guardian case 回報 `CONTINUE／SAFE PAUSE／DENY`。 |
| `HANDOFF` | 06:04:00–06:08:30 | 已知 Control Quiet Window；只允許預先核准候選受控換手。 |
| `SETTLE` | 06:08:30–06:11:30 | 驗證急性穩定；失敗者回到最近安全狀態。 |

**定義出處：** `chapter_27_plan.md` §0.1（七階段時鐘、分散式本地時程與 Control Quiet Window）、§4.4（timing package）、§5（七階段患者執行）。

**約束／邊界：**
- 時間由多源交叉（節點自己的 monotonic clock、KAGAMI phase marker、獨立標準時間、外部醫療時間戳）；任何節點出現 clock skew 超限、epoch 不一致、本地 monotonic 異常或醫療時間戳矛盾，便自動進入 SAFE PAUSE（ch27 §0.1）。
- 共享時鐘是分散式協議，**不是**新的 Mother Reference 或中央單點（ch27 §0.1）。
- timing package 只含 timing，`PATIENT DATA = NONE`、`CONTROL VALUES = NONE`、`CENTRAL REFERENCE = NONE`、`AUTO ADVANCE = NO`；不發送 M-00 神經波形、悠真錄音、美空模型或統一控制值（ch27 §4.4）。
- 每名患者的最高階段（stage ceiling）已在 ch26 預簽，倒數不能提高任何患者的 ceiling（ch27 §0.2、§3.8）。當輪只有 `G07／05` 與 `LEGACY／04` 進入 HANDOFF；其餘停在 COMPARE／HOLD／SAFE PAUSE。
- 悠真保持 `SAFE-DETACHED`，不重新接入；部署的是歷史 handshake 重建出的本地 schedule，不是悠真的聲音或即時生理訊號（ch27 §4.3）。

---

## 12. control quiet window（控制靜默窗口）

**中文名：** 控制靜默窗口（G07 臨床維護既有協議）

**定義：** Control Quiet Window 是既有 G07 臨床維護協議的一部分。在 HANDOFF 階段，protective／clinical prep 會把 central phase bus 降至預定低梯度；中央 active input 可依已驗證 slope 分段降低；可避免本地 root 與中央 controller 同時爭奪控制。只有此窗口具備合法、已驗證的 local-primary handoff 條件。因此兩名候選不能在星期日白天或 05:50 前任意換手。

**定義出處：** `chapter_27_plan.md` §0.1（Control Quiet Window 定義）、§3.13（必須是既有醫療維護功能）。

**約束／邊界：**
- 其醫療決策須滿足：`PREDICTED CENTRAL ECHO-PEAK RISK > PREDICTED QUIET-WINDOW HANDOFF RISK`（留在中央撐過 echo peak 的預測風險，高於在已驗證 quiet window 內作受控換手的風險）。若風險比較不成立，最安全的答案是 SAFE PAUSE，而不是為證明 R5 可行而換手（ch27 §0.1、§4.5）。
- 兩名候選（`G07／05`、`LEGACY／04`）只能在此窗口降低 central active input；流程：local patient root 取得 control-ready → central active input 依預簽 slope 分段降低 → local control 只在 quiet-window 內成為 primary → external medical 比較生理狀態 → central hot standby 保留 → 任一步異常立即 abort（ch27 §5.6）。
- G07 臨床 handshake 欄位：`CONTROL QUIET WINDOW = HANDOFF STAGE ONLY`、`CENTRAL PHASE GRADIENT = REDUCED／VERIFIED`、`DUAL-DRIVE PREVENTION = ACTIVE`（ch27 §3.13）。

---

## 13. SAFE PAUSE（安全暫停）

**中文名：** 安全暫停

**定義：** SAFE PAUSE 是適用於兩個層次的安全狀態：
- **七階段時鐘層次：** 任何節點出現 clock skew 超限、epoch 不一致、本地 monotonic 異常、醫療時間戳矛盾、patient envelope 超限或 drift 超標時，自動進入 SAFE PAUSE；臨床支援不變、公共路徑關閉、下一階段未授權。
- **紗英撤回層次：** 當主動過渡已開始、紗英啟動 `STOP／NO USE` 時，撤回**不會**被曲解成「立刻抽走所有限制資料，讓正在換線的患者失去保護」。此時：①不開始下一名患者 ②不擴大用途 ③當前患者進入 SAFE PAUSE ④只完成回到最近穩定狀態所需的最低醫療操作 ⑤安全暫停後舊資料停止新使用並按期限失效 ⑥不得以「過渡已開始」為由永久保留資料。

**定義出處：** `chapter_24_plan.md` §3.5（可操作撤回與安全暫停）；`chapter_27_plan.md` §0.1、§5（七階段中的 SAFE PAUSE）。

**約束／邊界：**
- SAFE PAUSE 是**結果不是失敗**——未準備患者停在 SAFE PAUSE 與其他患者完成 handoff 同樣合法（ch27 §5.3）。
- 醫師須以普通語言向紗英說明：「如果有人已經正在慢慢換線，我們不會突然把線剪斷。會先停在最近的安全位置，再停止使用妳的資料。」（ch24 §3.5）
- ch27 當輪停在 SAFE PAUSE 的患者：美空（COMPARE 後 drift 超限）、ACTIVE／C（醫療條件不足）；停在 HOLD 的患者：葵、`LEGACY／02`、`ACTIVE／D`（ch27 §0.3）。
- M-00 clinical transition support 亦保留 SAFE PAUSE available 狀態；紗英或權利代表啟動 STOP 時，依 ch24 程序處理，不瞬間抽走正在使用的臨床支援（ch27 §6.3）。

---

## 14. Witness Path（見證者路徑）

**中文名：** 患者見證者路徑（Patient Witness Path）

**定義：** Witness Path 是與 consensus／public branch **永久分開**的獨立數位發布路徑。它不經 consensus、不傳 raw neural、不自動播放患者音訊或字幕。完整路徑為：
```
PATIENT WITNESS BUFFER
  ↓ CONSENT／RELEASE FILTER
  ↓ WITNESS SERIALIZER
  ↓ ENCRYPTED REGIONAL PREPOSITION
  ↓ WITNESS ECHO SIDEBAND／RELEASE KEY
  ↓ REGIONAL WITNESS RECEIVERS
  ↓ PUBLIC WITNESS INDEX／OPT-IN NOTICE
```
Witness Echo Sideband 只傳 `RELEASE EPOCH`、`FRAGMENT IDS`、`RELEASE KEYS`、`CONSENT-STATE ROOT`、`INTEGRITY ROOT`——不傳大容量影音或 raw neural。頻道優先級低於 protective filter、clinical safety 與 medical telemetry；若患者安全負荷超限，key release 可延遲或放棄。

**定義出處：** `00_high_level_plan_final.md` §17（永久分開的技術路徑：`PATIENT WITNESS PATH`）；`chapter_20_plan.md` §5.5.D（Witness／after-action 血統：低頻 sideband）；`chapter_27_plan.md` §8（Patient Witness Path 完整定義）、§3.5（Witness Egress 完整低頻血統）。

**約束／邊界：**
- 澪拒絕已預先寫好的統一前言（`UNIFIED WITNESS PREFACE`）：「不要替他們排成一個答案。事實可以一起查。經歷不需要被排成一樣。」fragment 只加最低限度安全與來源標頭：`SOURCE-VERIFIED WITNESS FRAGMENT`／`PROVENANCE VERIFIED`／`NO PUBLIC ACTION REQUIRED`／`CONTENT MAY BE SUBJECTIVE／INCOMPLETE`／`SOURCE／CONSENT TIER AVAILABLE`／`NO CONSENSUS ORDER`（ch27 §0.4、§8.4）。
- 頻道優先級固定：①PROTECTIVE FILTER／CLINICAL SAFETY ②PATIENT ABORT／MEDICAL TELEMETRY ③WITNESS RELEASE KEY。若 filter load 超限、medical abort 或 telemetry congestion，則 `WITNESS KEY RELEASE = DEFERRED`（ch27 §3.16、§8.6）。
- 撤回截止：`WITHDRAWAL OPEN` 直到 release key 送出；`FINAL CONSENT ROOT` 在 settle 後／peak 前鎖定；解鎖後不能保證媒體或公眾副本完全回收（ch27 §8.2、§3.18）。
- 一般公眾只收中立 opt-in notice，不自動播放；初始 regional subsets 只作容錯、抗刪除與峰值頻寬分散；峰值後所有依法可公開 fragments 逐步聚合進同一 opt-in Public Witness Index，不讓不同地區永久被限制在不同版本（ch27 §8.7、§8.8）。

---

## 15. app seven-second path（官方應用七秒路徑）

**中文名：** 官方應用七秒補正路徑（伺服器發送偏移）

**定義：** `+7000ms` 是官方「灣岸防災」應用的**伺服器發送補正**（server-send offset），不是手機顯示時間。公共／廣播通道先（`0ms`），月台／車內顯示（`+1200ms`），官方應用推送在廣播後 `+7000ms` 才由伺服器送出，備援簡訊 `+9500ms`。所有正式 app fanout 均須通過唯一中央 sequencing gateway（`CENTRAL FANOUT GATEWAY`）；區域 cluster 只能建立 send object，沒有 app-provider fanout credential。七秒是取消一份已確定、尚未進入中央 fanout 的 TOKYO-7 follow-up 的最後窗口。

**定義出處：** `chapter_14_plan.md` §3.2（七秒異常定稿表述、文件 B）、成果三；`chapter_21_plan.md` §8.1（七秒的正確功能：A 配置指紋、B 最後手機路徑封鎖、C 提交狀態診斷）、§8.1b（peak-marker 部署骨架）；`chapter_27_plan.md` §3.1（七秒是中央 pre-fanout 發送窗口）、§3.17（唯一中央 fanout choke point）。

**約束／邊界：**
- 七秒**不是**：關閉全系統、取消白光、撤回已播廣播、控制所有手機在七秒整顯示、時間循環成因（ch27 §3.1）。
- 七秒**不能**：撤回已播出的廣播、被當成整套系統的硬切倒數、取代 `COMMIT-GATE` 的真正安全狀態判讀（ch21 §8.1）。
- 部署骨架：`ECHO PEAK = 06:13:00`、`ORDINARY BROADCAST MARKER = PEAK - 7000ms`（即 06:12:53）、`APP FOLLOW-UP SEND = MARKER + 7000ms`（即 06:13:00）、`CENTRAL FANOUT GATEWAY = REQUIRED`（ch21 §8.1b）。角色只知道相對值（PEAK ± 7000ms），不提前計算絕對時刻；06:12:53 必須來自 bundle metadata，不是終局臨時配合七秒伏筆的時間（ch27 §3.2）。
- ch27 取消程序：06:12:53 `BROADCAST MARKER = ECHO PEAK - 7000ms` 時，唯一中央 app sequencing gateway 封存 send object 並產生 nonce；06:12:53–06:13:00 預載 HSM policy 自動驗證 exact object，本地營運確認「只取消這一則」，中央 fanout 前取消。澪與本地營運的作用不是在七秒內重新簽三份授權，而是辨認該物件、arm 已預先存在的條件式取消、堅持只取消此 object（ch27 §3.11）。
- `+7000ms` 記錄的是伺服器何時送出，不保證每一台手機都會在廣播後七秒整亮起；行動網路、推送排隊與裝置處理仍可能增加額外延遲（ch14 §3.2）。

---

## 16. consent／expiry／taper（同意、到期與遞減規則）

**中文名：** 限制性同意、自動到期與臨床遞減

**定義：** 三項互相綁定的患者權利規則，貫穿 R5 與終局：
- **consent（限制性同意）**：外部醫療與獨立患者權利代表以普通語言分兩段（用途／反向確認）向紗英詢問。允許：用既有醫療資料幫助患者分離、建立短期網路過渡限制。拒絕：public use、raw neural stream、永久使用、語義內容。模糊或不一致採較窄權限。獨立患者權利代表不能由澪、千田、凪原或原研究醫師單獨判斷。系統記錄為：`PATIENT SEPARATION = YES`／`PUBLIC USE = NO`／`RAW NEURAL STREAM = NO`／`NETWORK TRANSITION LIMITS = YES`／`REVOCABLE = YES`。
- **expiry（自動到期）**：網路過渡邊界自動過期；每次 R5 新版本重新確認；失去確認能力時不得擴大用途；撤回後不得用舊同意繼續衍生新版本。M-00 clinical transition support：`NEW PATIENT ENROLLMENT = PROHIBITED`、`SCOPE EXPANSION = PROHIBITED`、`NEXT MEDICAL REVIEW = 06:30`、`CONSENT RECONFIRMATION = 08:00 OR EARLIER IF STOP`、`AUTO-EXPIRY = 08:00 UNLESS RECONFIRMED`。ch28 紗英對固定五人、固定範圍、最長三十日 outer limit 作限制性決定；`TARGET COMPLETION = AS SOON AS PATIENT-SPECIFICALLY SAFE`。
- **taper（臨床遞減）**：當 downstream 患者逐人完成 bridge（如美空以 Domain-C bridge 脫離 M-00 common endpoint、葵以 AOI-LOCAL bridge 脫離等），M-00 的 outgoing role 逐步縮減。最後 bridge 後 24–48 小時完成 post-bridge verification，`M-00` public／consensus／clinical transition roles 正式退役。Taper 不可跳過 patient-specific safety 程序。

**定義出處：** `chapter_24_plan.md` §3（紗英的限制性同意與可操作撤回）、§3.4（系統記錄）、§3.5（REVOCABLE = YES 的兩種撤回情況）；`chapter_27_plan.md` §6.3（M-00 禁止擴張與固定重審）、§3.18（fragment 撤回截止與 M-00 支援期限）；`chapter_28_plan.md` §2（時間線：06:30 emergency preservation review、08:00 紗英限制性決定）、§24.5（preservation framework／紗英 taper）。

**約束／邊界：**
- 同意**不追認**十年研究；不允許其他用途；不允許永久使用；不允許將紗英數位化成靜態母體（ch24 §3.4）。
- 紗英只授權最窄 outgoing signal use／taper；outer limit 30 天；無 public／research／expansion；最後 downstream = 0 後 role 退役（ch28 §24.5）。
- 紗英脫離系統後只出現一段原因未能單獨證明的短暫清醒；`M-00` outgoing role 退役，歷史證據保留（`00_high_level_plan_final.md` §14 後果）。
- 患者依序 bridge 的時間表固定：`ACTIVE／C`（第一週）→ `ACTIVE／D`（第二週初）→ 美空（第二至三週）→ 葵（第三週後半）→ `LEGACY／02`（第四週初）；每次 bridge 後 downstream 減一，不得跳過（ch28 §2）。

---

## 17. new-signal safety quarantine（新訊號安全隔離協議）

**中文名：** 新訊號安全隔離協議（分散式訊號安全保管）

**定義：** 約半年後，朝倉家的 wideband analog comparison receiver（母親留下的改裝短波接收器，與函館時期 Independent Analog Monitor 同一脈）在既定 prior-source observation window 中收到一輪窄帶多音；其他台站同時報告相同 RF pattern。澪的第一個行動是：①將喇叭靜音 ②保留本地 RF 記錄 ③建立 acquisition hash ④發送 public commitment（acquisition time、frequency／spectrum metadata、receiver configuration、hash／Merkle commitment、multi-site detection count、non-reconstructable preview、`SAFETY STATUS = UNASSESSED`）⑤將原始 RF／IQ／waveform 送入 `DISTRIBUTED SIGNAL SAFETY QUARANTINE`——多國、民間與學術機構加密分散保存，無單一刪除者，不自動播放，存取需訊號及神經安全程序。

新訊號的暫定特徵：`SOURCE FAMILY = CONSISTENT WITH PRIOR HAKODATE BAND`、`POWER／COHERENCE = LOWER`、`HIGH-COHERENCE PHASE = NOT DETECTED`、`KAGAMI AMPLIFICATION = NONE`、`KNOWN NEURAL COUPLING = NONE OBSERVED`、`SAFETY = NOT PROVEN`。多組模型暫定解讀為星圖與約七十年後的時間／位置窗口：`SIGNAL TYPE = NARROWBAND MULTI-TONE／MATHEMATICAL`、`REFERENCE FRAME = PROBABLE PULSAR-RELATIVE`、`TIME OFFSET = APPROX. +70 YEARS`、`CONTACT WINDOW = PROBABLE／NOT PROVEN`、`ALTERNATIVES = OPEN`、`SEMANTIC COMMAND = NONE DETECTED`、`FUTURE MEMORY = NONE DETECTED`。

**定義出處：** `chapter_28_plan.md` §0.2（第三層 epilogue）、§2 第三層（約半年後時間線）、§20.3（新訊號與舊危險來源的暫定差異）、§20.5（公開保全不等於無限制播放）、§20.6（安全審查與逐步開放）、§20.8（暫定聲音化星圖）、§20.9（為何是七十年）、§20.10（開放而非私有）、§21（最終畫面）、§24.13（新訊號證據鏈邊界）、Scene 8（七十年）。

**約束／邊界：**
- **不得**把未知意圖寫死成「訊號源認可／守護／偏袒人類」這類 benevolent 立場（§7.5）。新訊號沒有已辨認命令，也沒有把未來送回任何人的腦中。
- 安全審查包括：RF／modulation 結構、與函館高風險模式的相似與差異、是否存在 semantic／phase-lock、低功率 demodulation 的神經風險；**不以人體直接暴露作第一線測試**（ch28 §20.6）。
- 逐步開放順序：hash／頻譜 → 數學特徵 → 安全聲音化 → 部分 waveform → 受控 raw RF／IQ（ch28 §20.6）。
- 七十年的意義：遠長於澪可用循環立即驗證的時間；長於當代決策者任期；需要跨世代科學與倫理準備；不能被一名主角或一個政府私有（ch28 §20.9）。
- 新接收網初步原則：commitments public、raw data 分散安全保管、多國多機構多民間驗證、不以患者大腦作解碼器、不把未來記憶作政策、不允許新的單一 continuity authority（ch28 §20.10）。
- 最終句（鎖定）：「收音機裡沒有倒數。／只有一個必須用七十年走到的座標。／**未來第一次留在前面。**」

---

## 衝突或歧義標記（flag，未修正）

以下概念在計畫文件中存在輕微歧義或多版本表述，已按鎖定決策與高層企劃取統一版本，列此供 Phase 5 校驗時複查：

1. **R3 內容來源時間 vs 版本編號順序**：R3 的內容來源（紗英臨床安全短語）早於 R1 根文件，但版本編號晚於 R2。`chapter_21_plan.md` §6.2 已明確解釋此非矛盾（「被納入 KAGAMI-SAFE 案件版本鏈的時間晚於 R2」），但讀者可能混淆。建議正文中以「臨床安全修訂」而非「第三版」稱之，避免與 R4／R5 的「版本」概念混淆。

2. **06:12:53 的可知時間點**：`chapter_14_plan.md` 只讓角色知道相對值 `+7000ms`；`chapter_21_plan.md` §8.1b 與 `chapter_27_plan.md` §3.2 規定 06:12:53 必須來自 bundle metadata，且「不讓本章（ch21）角色提前知道 06:12:53」。需確認 ch21 正文確實未讓角色計算出絕對時刻（檢查表已列）。

3. **MAR-CONT 欄位的早期讀者可見性**：D7 鎖定 MAR-CONT 範圍為 ch15／ch21／ch24；但 `chapter_15_plan.md` §4.7 與 `chapter_21_plan.md` §11.2b 均將它寫成「低強度背景欄位，讀者只當成公共工程驗收文件常見的災害復舊排程」。ch24 §8.3 則完整展開三階段。需確認 ch17 與其他章節確實**未**出現 MAR-CONT 字樣（D7 強制範圍）。

4. **M-00「母體」稱呼的雙重語義**：M-00 既是工程術語 Mother Reference（基準），又是朝倉紗英本人（澪的母親）。`chapter_20_plan.md` §7.2 已讓凪原說「這個詞不是因為她是妳母親」、澪回「可是你們知道她是」，刻意利用此雙關。正文中需保持此雙重語義的張力，不得把任何一方寫死。

5. **R4 的「接受過一次」代價內容**：`chapter_21_plan.md` §13.5 中紗英輸出 `MIO／SAW COST／ACCEPTED／ONCE`，但 ch21「不揭露代價內容」；ch22 才正式重建 R4 並揭露代價（對未撤離接收者的具體傷害）。需確認 ch21 正文未提前描述代價細節。
