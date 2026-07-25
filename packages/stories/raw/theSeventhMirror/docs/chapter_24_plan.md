# 《神鏡七日》Chapter 24 章節企劃 v2.2

## 第 24 章：第五版沒有母體

所屬大章：**第六日：知道全貌的澪也錯了**  
全書位置：**28 小章中的第 24 章**  
章節定位：**R5 聯邦式版本治理／無中央動態 Mother Reference 的目標架構／患者安全邊界與多源網路過渡邊界／紗英限制性同意、撤回與安全暫停／患者綁定本地臨床根／原位生成與雙重觀察驗證／Domain-P 不可遠端逆轉隔離／水瀨葵位置與獨立生命確認／父親早期患者安全保全／R5 分散式明確否決／套件綁定 SHARE-S 與撤回回執／Continuity 狀態機／第七日入口**  
建議篇幅：**約 9,000–11,000 字**  
視角：**第三人稱限知，緊貼朝倉澪**  
主要類型感：**跨機構系統設計、醫療同意、患者權利、有限技術勝利、被失蹤者重新具名、終局授權倒數**

---

# 0. 本章核心定位

Chapter 23 已完成：

1. **白石琴音**被當輪證據正式確認為第三輪 21:04 的維修服人物；
2. 琴音只有低強度循環熟悉感，沒有澪式的完整輪次記憶；
3. 高權限「家屬穩定支援」角色代理，將琴音的臨床求助轉製成承包商資產回收工單；
4. 琴音取得一次性門禁、制服與工具，取走銀色原始簽署卡匣，並將其安裝於美空床側控制器；
5. Chapter 7 的「灣岸中央」、Chapter 8 的「那些東西」及第一輪 21:19 已讀未回，已由支援線與片語熟悉感得到支付；
6. 第三輪可證明琴音的攔截任務、憑證角色濫用與強制風險，不能把前兩輪被白光重置的暴力偽裝成本輪物證；
7. **藤川真理**已以美空法定代理人身分參與外部醫療及設備保全；
8. 院內臨床／生體工學保管方已加入；
9. 銀色卡匣已被定位並採五方原位共同控制；
10. 卡匣具有彼此隔離的兩個安全域：

```text
DOMAIN-P
KAGAMI PUBLIC／MAINTENANCE AUTH

DOMAIN-C
PATIENT CLINICAL SHADOW ROOT
```

11. `Domain-P` 可在鏡島重建公共／維護授權；
12. `Domain-C` 綁定美空病人專屬局部影子參照；
13. 美空節點顯示：

```text
LOCAL SHADOW REF     G07／03
STATUS               PARTIAL／UNVALIDATED
ROOT                 DOMAIN-C／HARDWARE-BOUND
CENTRAL FALLBACK     ACTIVE
PUBLIC PRIVILEGE     NOT REQUIRED
EXPORT               LOCKED
```

14. 安裝後的一次自然網路切換顯示：
    - 美空局部影子曾短暫維持其腦電、自律及呼吸穩定；
    - 之後因漂移與驗證不足回退中央；
15. 局部影子只保存生理、神經與相位穩定模型，不保存人格、記憶、意識或「美空本人」；
16. 琴音提供了角色代理案件別名及有限任務資料；
17. 卡匣被控制後，星期一危機已由「尋找載體」轉為：
    - 隔離 `Domain-P`；
    - 保留 `Domain-C`；
    - 為其他紅區患者建立患者綁定的本地臨床根；
    - 追查更高層 emergency override；
    - 追查制度級公共授權根；
18. 本章必須回答：

> 能否在不複製美空、不再次使用紗英作永久母體，也不對任何患者進行新斷線試驗的前提下，建立安全橋接程序？  
> R5 應由誰起草、誰審查、誰同意、誰有權執行或停止？  
> 其他紅區患者究竟是誰、在哪裡？  
> 即使美空卡匣的公共權限被隔離，誰仍能在星期一重新授權鏡島？

本章的主要突破是正式建立：

> **`KAGAMI-SAFE／R5`**

但 R5 必須被誠實定義為：

> **無中央動態 Mother Reference 的目標架構與過渡規格。**

它不能假裝當輪已經完全離開 M-00。

當輪現況仍然是：

- 紗英仍在雙向穩定閉環中；
- 美空仍使用中央 fallback；
- 葵尚未完成外部醫療接管；
- `LEGACY／02` 尚無相容患者根；
- 沒有任何患者完成主動切換；
- `CONTINUITY-0` 仍可能重新建立公共授權。

因此章名《第五版沒有母體》的精確含義是：

> 第五版的**設計目標**不再包含中央動態母體。  
> 但當輪所有人仍必須在星期一以前，真正走完離開母體的過渡。

---

# 1. R5 修正版標頭：目標與現況分開

R5 不能再用幾個漂亮欄位，把尚未完成的目標寫成現況。

正式標頭改為：

```text
KAGAMI-SAFE／R5

AUTHORSHIP                         FEDERATED／NO SINGLE OWNER
DRAFTED BY                         MEDICAL + SYSTEM SAFETY
PATIENT-RIGHTS ATTESTATION         REQUIRED
LEGAL／EVIDENCE ATTESTATION        REQUIRED
OPERATIONS ATTESTATION             REQUIRED FOR PUBLIC CHANGES

TARGET CENTRAL DYNAMIC REFERENCE   NONE
TRANSITION INPUTS                 MULTI-SOURCE／M-00 ENDPOINT LIMITED／REVOCABLE
PATIENT ROOT                       PATIENT-BOUND／LOCAL

PATIENT SAFETY ENVELOPE            LOCAL／PATIENT-SPECIFIC
NETWORK TRANSITION ENVELOPE        NON-SEMANTIC／EXPIRING

RAW NEURAL EXPORT                  PROHIBITED
R5 PUBLIC PRIVILEGE                NONE

TARGET PUBLIC DOMAIN               SEPARATED
CURRENT TOKYO PUBLIC DOMAIN        EXTERNAL HOLD／NOT CONTROLLED BY R5

TARGET CENTRAL FAILBACK            HUMAN-AUTHORIZED
CURRENT CENTRAL FALLBACK           ACTIVE／PATIENT-SPECIFIC

STATUS                             PROVISIONAL
VALIDATION                         PASSIVE／STAGE-1
ACTIVE SWITCH                      PROHIBITED
```

## 1.1 為何不能只寫 `MOTHER_REFERENCE = NONE`

若每名患者仍必須符合一份由紗英定義的共同範圍，R5 只是把「母體」改名為「邊界」。

因此 R5 正式區分兩種安全邊界。

### A. `PATIENT SAFETY ENVELOPE`

每名患者各自生成。

來源只包括：

- 自己的腦電；
- 自己的呼吸與自律資料；
- 自己的睡眠／清醒節奏；
- 自己的自然故障；
- 自己的藥物與臨床狀態；
- 自己的局部控制器歷史。

它回答：

> 對這一名患者而言，什麼狀態仍屬可接受的醫療安全範圍？

### B. `NETWORK TRANSITION ENVELOPE`

它不是由 M-00 單獨定義，也不是所有患者必須模仿紗英的共同標準。

來源必須同時包括：

1. KAGAMI 共用匯流排的歷史遙測；
2. 正常維護與 BCP 切換紀錄；
3. 既有自然故障及路由抖動；
4. 區域節點相位與回聲抑制資料；
5. M-00 作為目前中央端點的醫療承受上限；
6. 各患者節點輸出的非語義安全證明。

其中 M-00 資料只回答：

> 當目前的中央端點仍連在閉環上時，它能承受多快、多少幅度的網路改變？

它不能回答：

> 其他患者應該變成什麼樣。

`NETWORK TRANSITION ENVELOPE` 只包含：

- 共用閉環可接受的相位變化速度；
- 切換期間的網路振盪上限；
- 回聲抑制介面條件；
- 哪些網路變動會使整體閉環失穩；
- 下一回聲窗前後的短期有效期限。

一名患者未來能成為主動切換候選，必須同時符合：

```text
PATIENT SAFETY ENVELOPE
∩
NETWORK TRANSITION ENVELOPE
```

因此：

- 患者自己的資料定義「這個人是否安全」；
- 多源網路資料定義「整套系統最多可以多快改變」；
- 紗英不再是其他人的醫療答案；
- 她只提供目前中央端點在過渡期間不可跨越的其中一組限制。

## 1.2 R5 沒有公共權限


R5 自身：

- 沒有 public fanout；
- 沒有一致性層；
- 沒有 Domain-P；
- 沒有將患者資料送入公共提示的路徑。

因此標頭寫：

```text
R5 PUBLIC PRIVILEGE    NONE
```

而不是不誠實地寫：

```text
PUBLIC DOMAIN          QUARANTINED
```

因為當輪 TOKYO 公共域仍由外部 hold 控制，尚未被 R5 接管。

## 1.3 目標 failback 與當輪 failback 分開

R5 的目標是：

> 任何患者回到中央閉環，都必須由當時的人類醫療與患者程序批准。

但當輪多名患者仍存在：

```text
CURRENT CENTRAL FALLBACK   ACTIVE
```

因此不能把目標政策寫成已生效現況。

---

# 2. 沒有單一作者，不等於沒有人負責

`AUTHOR = QUORUM` 文學上有效，程序上卻會混淆：

- 起草；
- 審查；
- 患者同意；
- 法律保全；
- 公共權限；
- 實際執行。

正式採用：

```text
AUTHORSHIP       FEDERATED／NO SINGLE OWNER
```

## 2.1 全局版本責任

### 起草

必須同時包括：

- 外部醫療；
- 獨立系統安全。

### 必要證明

不可由其他人替代：

- 患者權利／臨床倫理證明；
- 法律／司法證據保全證明；
- 涉及公共權限時的公共營運安全證明。

### 原則

- 醫師不能替系統安全簽署；
- 系統安全不能替患者同意；
- 家屬不能替其他患者；
- 警方不能替醫療判斷；
- 公共營運不能替患者權利；
- 任何一個必要領域缺席，相關範圍便不能生效。

不是普通多數表決。

而是：

> 每一項權限只能由真正擁有該權限的人簽自己的部分。

## 2.2 個別患者啟用

任何患者的局部影子主動啟用，必須**全部具備**：

1. 患者本人可表達時的意願；
2. 或法定代理／獨立患者權利代表；
3. 外部醫療；
4. 當地臨床保管方；
5. 系統安全。

不得使用：

- 3-of-5；
- 緊急倒數自動替代；
- 某一方失聯後由其他方代簽；
- 「整體利益」覆蓋患者程序。

## 2.3 澪的角色

澪可以：

- 提出倫理限制；
- 提供調查與跨輪資料；
- 以紗英及悠真家屬身分陳述；
- 指出 R4 的偏見；
- 參與公開證據及患者具名程序。

她不能：

- 單獨成為 R5 作者；
- 代表所有患者；
- 以未來記憶取代醫療；
- 因為「已見過錯誤未來」而取得最終授權。

本章核心台詞：

> 「第四版就是因為只有一個人知道得太多，才會變成那樣。」

---

# 3. 紗英的限制性同意與可操作撤回

紗英不應直接面對一排英文化技術欄位。

外部醫療與獨立患者權利代表，須以普通語言分兩段確認。

## 3.1 第一段：用途

醫師逐項問：

- 「可以用妳過去已經存在的醫療數字，幫其他病人慢慢離開這套機器嗎？」
- 「可以把這些資料拿去給東京的公共提示系統使用嗎？」
- 「可以把妳完整的腦部資料送出去嗎？」
- 「如果只留下拆線時不能跨過的安全範圍，可以嗎？」

## 3.2 第二段：反向確認

休息後，以反向問題再確認：

- 「如果資料可能被公共系統使用，要不要停止？」
- 「如果有人要求完整腦波，要不要停止？」
- 「如果只使用短期網路過渡限制，是否仍同意？」
- 「以後可以改變主意嗎？」

若兩段回答不一致：

> 採用較窄權限，或完全停止。

## 3.3 獨立患者權利代表

不能由：

- 澪；
- 千田；
- 凪原；
- 原研究醫師；

單獨判斷紗英是否理解。

獨立代表確認：

- 她理解用途；
- 回答不是單純迎合；
- 疲勞沒有使答案失真；
- 她知道可以拒絕；
- 任何模糊均被解讀為不授權。

## 3.4 系統記錄

醫療人員把普通語言回答整理成：

```text
PATIENT SEPARATION           YES
PUBLIC USE                   NO
RAW NEURAL STREAM            NO
NETWORK TRANSITION LIMITS    YES
REVOCABLE                    YES
```

此記錄：

- 不追認十年研究；
- 不允許其他用途；
- 不允許永久使用；
- 不允許將紗英數位化成靜態母體。

## 3.5 可操作撤回與安全暫停

`REVOCABLE = YES` 必須成為真正能使用、又不會因突然停止而傷害患者的權利。

包括：

- 溝通板永久顯示 `STOP／NO USE`；
- 網路過渡邊界自動過期；
- 每次 R5 新版本重新確認；
- 失去確認能力時不得擴大用途；
- 獨立患者權利代表可在爭議時暫停；
- 撤回後不得用舊同意繼續衍生新版本。

撤回分成兩種情況。

### 尚未開始任何主動過渡

撤回後：

- 停止新使用；
- 不再生成新版本；
- 既有過渡邊界於安全期限內失效；
- 所有主動切換保持禁止。

### 已有患者正在受控過渡

撤回不能被曲解成：

> 立刻抽走所有限制資料，讓正在換線的患者失去保護。

此時必須：

1. 不開始下一名患者；
2. 不擴大用途；
3. 當前患者進入 `SAFE PAUSE`；
4. 只完成回到最近穩定狀態所需的最低醫療操作；
5. 安全暫停後，舊資料停止新使用並按期限失效；
6. 不得以「過渡已開始」為由永久保留資料。

醫師須用普通語言向紗英說明：

> 「如果有人已經正在慢慢換線，我們不會突然把線剪斷。會先停在最近的安全位置，再停止使用妳的資料。」

## 3.6 `NETWORK TRANSITION ENVELOPE`

其來源固定為：

```text
KAGAMI BUS TELEMETRY
+ NATURAL／MAINTENANCE CUTOVER HISTORY
+ M-00 ENDPOINT LIMITS
+ PATIENT NODE SAFETY PROOFS
```

只包含：

- 相位變化速率上限；
- 共用閉環允許的轉換梯度；
- 回聲抑制介面限制；
- 網路振盪禁止區；
- 版本、有效期限及撤回狀態。

不包含：

- 黑色海；
- 未來片段；
- 紗英個人記憶；
- 原始神經流；
- 完整 Mother Reference 模型。

其有效期只涵蓋：

> 下一回聲窗前後的短期過渡。

不能再出現：

> 七十二小時變成十年。

---

# 4. 患者綁定的本地臨床根


R5 的核心原則不能寫成：

> 每名患者使用自己的 Domain-C。

因為：

- 美空已有 Domain-C；
- 葵尚無局部影子；
- `LEGACY／02` 舊硬體不支援 Domain-C。

正式原則改為：

> 每名患者必須擁有一個只綁定自己的**患者本地臨床根**。

它可以是：

- 既有 `Domain-C`；
- 新生成的患者專屬根；
- 經臨床轉接器包裝的舊式本地根。

R5 禁止：

- 使用另一名患者的根；
- 使用中央 Mother Reference 作永久根；
- 使用公共 Domain-P 作患者臨床根；
- 將美空模型複製給葵或其他人。

標頭因此使用：

```text
PATIENT ROOT    PATIENT-BOUND／LOCAL
```

---

# 5. 本地生成、原位驗證、雙重觀察

R5 複製的是程序，不是患者。

## 5.1 每名患者節點

1. 使用自己的歷史醫療資料；
2. 在本地生成自己的局部影子；
3. 用患者綁定的本地臨床根簽署；
4. 與自己的 `PATIENT SAFETY ENVELOPE` 比較；
5. 再與短期 `NETWORK TRANSITION ENVELOPE` 比較；
6. 對外只輸出驗證結果。

## 5.2 對外輸出

```text
SUBJECT                    G07／03
SHADOW MODE                PASSIVE
PATIENT ENVELOPE           WITHIN／OUTSIDE
NETWORK ENVELOPE           WITHIN／OUTSIDE
DRIFT CLASS                LOW／MEDIUM／HIGH
FAILOVER READINESS         NOT ESTABLISHED
RAW DATA EXPORTED          NO
MODEL EXPORTED             NO
```

## 5.3 `EXPORT LOCKED`

保留 `EXPORT LOCKED`。

它同時保護：

- 患者隱私；
- 模型隔離；
- 不可匯出金鑰；
- 防止患者成為新中央模板。

R5 不要求：

- 解鎖原始模型；
- 傳回中央；
- 讓一名患者的模型被其他人使用。

## 5.4 本地節點不能自己證明自己安全

每次被動驗證須同時存在：

### A. 本地影子證明

- 程式版本雜湊；
- 硬體 attestation；
- 患者本地根簽章；
- 漂移與預測結果；
- 驗證程序版本。

### B. 獨立醫療觀察

不經 KAGAMI 控制器的：

- 外部腦電；
- 呼吸監測；
- 自律監測；
- 臨床事件標記；
- 獨立時間戳。

只有兩者一致，才能記錄：

> 被動驗證相符。

任何不一致：

> 以外部醫療結果為優先，並停止升級。

## 5.5 被動模式

- 現行控制保持；
- 局部影子只運算，不輸出刺激；
- 不接管患者；
- 不改變中央閉環；
- 不觸發 fallback；
- 只比較預測與實際醫療狀態。

## 5.6 歷史回放

只使用：

- 既有自然故障；
- 事件 A／B；
- 正常睡眠／清醒資料；
- 過去網路抖動；
- 既有治療參數。

禁止：

- 新斷線；
- 新刺激；
- 主動壓力測試；
- 為補資料製造故障。


# 6. Chapter 23 結束狀態

| 線索／角色 | Chapter 24 開始狀態 |
|---|---|
| 朝倉澪 | 已拒絕預授權 R4；取得美空局部影子作為替代方案第一塊技術。 |
| 朝倉紗英 | M-00；仍依賴雙向閉環；可作極低負荷意願確認，不可再被當成永久母體。 |
| 朝倉悠真 | 已完成外部醫療及參照安全切離；仍有未來片段殘留。 |
| 藤川美空 | `G07／03`；Domain-C 局部影子存在；尚未完成安全切換。 |
| 白石琴音 | 承認 21:04 取件及有限回報；提供角色代理案件資料；不完全合作。 |
| 藤川真理 | 代表美空參與設備及患者利益程序。 |
| 千田浩介 | 活著；可解釋 R2 及 R5 技術，不得成為單一決策者。 |
| 日下部悟 | 負責證據、患者權利及授權鏈程序。 |
| 凪原唯 | 仍相信原始過濾必要；其職務體系與科學份額預簽有關。 |
| Domain-P／美空卡匣 | 尚未隔離；原位受五方控制。 |
| Domain-C／美空卡匣 | 必須保留；局部影子尚未驗證。 |
| 角色代理 | 只知案件別名及上游 continuity broker，真人操作者仍封緘。 |
| TOKYO-7 | 下星期一仍 STAGED；普通營運路徑受控。 |
| 白光倒數 | 距下一次星期一 06:13 約一日二十三小時。 |

---

# 7. 時間線與節奏

Chapter 24 發生於：

> **第三輪，星期六 06:30 至 23:55。**  
> **悠真失蹤事件第十二日。**

Chapter 24 必須在星期六午夜以前結束。

星期日才正式進入：

> **第七日：不要救東京**

| 時間 | 事件 |
|---|---|
| 00:20–06:15 | Chapter 23 後睡眠、醫療及警方換班；不作主場景。 |
| 06:30–07:40 | 建立 R5 聯邦式版本治理；澪拒絕單一作者與「現況已無母體」的假表述。 |
| 07:40–09:15 | 外部醫療與獨立患者權利代表分兩段向紗英確認限制性用途、撤回及 `SAFE PAUSE`；建立多源網路過渡邊界規格。 |
| 09:15–11:15 | 以美空為例，確立本地生成、原位驗證、患者安全邊界及雙重觀察程序；回收 Chapter 20 模組化數位備援。 |
| 11:15–12:40 | Patient-Root Location Index 依法開啟；正式確認水瀨葵位置及 `LEGACY／02` 節點；取得葵獨立生命體徵並立即發出禁止轉移與禁止設定變更命令。 |
| 12:40–13:25 | 休息、進食、家屬及醫療通知程序。 |
| 13:25–15:25 | 在同型退役卡匣／製造商模擬器先驗證後，對美空 Domain-P 執行不可遠端逆轉的原位隔離；Domain-C 保留。 |
| 15:25–18:05 | 歷史回放與被動影子模式；形成四名紅區患者的 Stage-1 準備矩陣。 |
| 18:05–20:10 | R5 必要領域簽署；建立 distributed patient-safety hold；揭露父親七年前的臨時患者安全保全及 docket 轉換缺口。 |
| 20:10–22:10 | 沿角色代理向上調取封緘稽核；揭露套件綁定 SHARE-S、正常營運份額、continuity operational share、狀態機與 `CONTINUITY-0`。 |
| 22:10–23:05 | 凪原接受問詢；承認自己在本次七日窗前確認／續期確切 TOKYO-7 套件的 SHARE-S，並啟動多節點撤回。 |
| 23:05–23:55 | R5 provisional 狀態登錄；檢視 SHARE-S 撤回回執及 continuity deny 缺口；星期六在 23:55 結束。 |

白光倒數：

| 時點 | 距下一次星期一 06:13 |
|---|---:|
| 星期六 06:30 | 約 1 日 23 小時 43 分 |
| 星期六 18:05 | 約 1 日 12 小時 8 分 |
| 星期六 23:55 | 約 1 日 6 小時 18 分 |

另一條運用倒數：

| 事件 | 星期六 23:55 時剩餘 |
|---|---:|
| 星期日 23:50 continuity cutover | 約 23 小時 55 分 |
| 星期一 05:50 TOKYO-7 auto-prep | 約 29 小時 55 分 |
| 星期一 06:13 回聲窗 | 約 30 小時 18 分 |

---

# 8. 必須同步的跨章補丁


## 8.1 Chapter 12：`G07／08 = 水瀨葵`

Chapter 12 已建立：

- 水瀨葵材料出現 `G07／08`；
- 證據強度為中等；
- 當時不能確認是否仍在活動或是否為同一管理群個體。

Chapter 24 新突破：

- 新的患者根位置索引正式確認 mapping；
- 葵仍活著；
- 位於筑波關聯 `C2` 臨床隔離棟；
- 她為高依存未成年人；
- 現場外部醫療接管尚未完成。

正文不得寫成：

> Chapter 24 第一次猜到葵是 G07／08。

## 8.2 Chapter 20：模組化數位備援模型

Chapter 20 已建立：

- 國家曾製作數位 M-00 備援；
- 平時可運作；
- 接近七日回聲窗便漂移；
- 無法分辨真正未來片段與模型自生內容。

正式回補其原始模組化架構：

```text
M-00 DIGITAL BACKUP
├── PHYSIOLOGICAL PHASE CONTROL
├── ECHO SUPPRESSION
├── SEMANTIC INTERPRETATION
├── FUTURE CLASSIFICATION
└── PUBLIC CONSENSUS INTERFACE
```

Chapter 24 不得讓千田等人在一個上午從零造出 M-00 本地控制器。

R5 只作配置隔離：

- 保留 `PHYSIOLOGICAL PHASE CONTROL`；
- 保留最低必要 `ECHO SUPPRESSION`；
- 停用 `SEMANTIC INTERPRETATION`；
- 停用 `FUTURE CLASSIFICATION`；
- 移除 `PUBLIC CONSENSUS INTERFACE`；
- 將剩餘模組置於本地被動模式；
- 驗證其輸出不再依賴被停用模組。

這解釋：

> 為何能在當日進入 Stage-1 被動驗證，卻仍不能承受完整回聲窗或主動接管。

## 8.3 Chapter 15／21／22：23:50 continuity cutover 伏筆

正式總稿至少回補一處低強度技術欄位：

```text
BCP CUTOVER          23:50
CONT-0 HANDOFF       NIGHTLY
PREPOSITION WINDOW   23:50–05:50
AUTH ELIGIBILITY     CUTOVER-DEPENDENT
EXECUTION WINDOW     05:50–06:20
```

早期讀者只能理解為：

- 公共警報與交通系統的夜間災害復舊交接。

Chapter 24 才揭露三個不同階段：

### 1. 星期日 23:50：授權資格

- `SHARE-CONT` 取得 operational eligibility；
- 系統尚未執行最終 commit；
- 只是取得完成提交所需的授權組合。

### 2. 23:50–05:50：套件預置

- 區域節點接收綁定套件；
- 驗證 package hash；
- 準備離線公共路徑；
- 鏡島設備預熱；
- 本地鏡像完成交接。

### 3. 05:50 之後：執行階段

- auto-prep；
- CAL LOCK；
- consensus preparation；
- execution commit；
- 06:13 回聲窗。

23:50 不是任意戲劇倒數。

它是：

> 系統開始把「沒有正常營運批准」轉換成 continuity operational eligibility 的時刻。

## 8.4 Chapter 21：R4 版本保留


R4 雖無當輪原始正文，已被正式保留為：

> `R4／RECONSTRUCTED／FAILURE-MODE ONLY`

因此 R5 可合法使用第五版編號。

不能因 R4「不存在實體正文」而將第五版重新命名為 R4。

## 8.5 父親 R1 的患者安全保全

Chapter 21 已證明父親建立 R1。

Chapter 24 新增：

- 父親以疑似違法拘束及未成年人醫療風險案件承辦人身分提出申請；
- 當時由：
  - 內部監察；
  - 值班檢察／法院；
  - 醫療安全官；

  共同簽發一項臨時患者安全保全；
- 父親不是國家級密鑰持有人；
- 他是案件承辦及通知持有人。

該保全只阻止：

> 七年前的一次早期 pilot／提交。

它沒有七年持續保護全國系統。

案件被轉為國安管理、失去有效承辦並未獲續期後，很快失效。

## 8.6 Chapter 10–11：水瀨佳乃

正式回收：

- 她不是只提供黑色海圖的功能家屬；
- 本章由依法參與人員向她作最低必要通知；
- 她不立即出現在技術會議；
- 她的第一反應不只是高興，而是：
  > 「你們找到的是她，還是又一個編號？」

---

# 9. Patient-Root Location Index：為何現在才看到葵

Chapter 22 的依存圖只能開示：

- 管理碼；
- 年齡帶；
- 依存級別；
- 是否有本地備援；
- 是否屬 HUMAN。

它不能顯示：

- 完整姓名；
- 精確位置；
- 控制器位置；
- 法定代理；
- 另一法人醫療資料。

R5 因為需要：

- 患者綁定本地臨床根；
- 當地臨床保管方；
- 患者／代理程序；
- 現場控制器；

取得新的司法／醫療命令，依法開啟：

> **Patient-Root Location Index**

該索引才顯示：

- 姓名；
- 生日；
- 管理碼；
- 法人；
- 臨床位置；
- 控制器類型；
- 代理狀態。

這不是：

> 從同一張表多看一眼便突然出現新資訊。

而是：

> 新的患者安全需要，解鎖了新的資料層。

---

# 10. 四名紅區患者的修正版準備矩陣

## 10.1 狀態名稱

不再使用容易誤解的：

> `PASSIVE-READY`

正式改為：

> **`PASSIVE-CONCORDANT／STAGE-1`**

其含義只限：

- 被動影子輸出與既有醫療觀察在部分資料中相符；
- 程式沒有在旁觀模式立即失敗；
- 尚未建立 failover readiness；
- 主動切換明確禁止。

## 10.2 `M-00／朝倉紗英`

位置：

- 筑波外部共同監督區。

R5 工作：

- 使用 Chapter 20 既有數位備援；
- 移除語義、公共與未來分類功能；
- 只保留醫療相位回傳；
- 建立被動本地控制鏡像；
- 使用 `NETWORK TRANSITION ENVELOPE`；
- 與外部醫療感測交叉。

狀態：

```text
LOCAL PHASE MODEL       PASSIVE-CONCORDANT／LIMITED
NETWORK ENVELOPE        SIGNED／EXPIRING
PATIENT ENVELOPE        ACTIVE／MEDICAL
ACTIVE CONTROL          PROHIBITED
FAILOVER READINESS      NOT ESTABLISHED
```

本章不能讓紗英正式脫離 KAGAMI 閉環。

## 10.3 `G07／03／藤川美空`

位置：

- 千葉縣北西部長期神經復健中心。

R5 工作：

- 保留 Domain-C；
- 隔離 Domain-P；
- 事件 A／B 歷史回放；
- 被動影子；
- 本地影子結果與獨立醫療感測交叉；
- 建立睡眠轉換漂移清單。

狀態：

```text
PATIENT ROOT            DOMAIN-C／PROTECTED
DOMAIN-P                QUARANTINE-P
SHADOW OBSERVATION      PASSIVE-CONCORDANT／LIMITED
DRIFT                    UNRESOLVED／SLEEP TRANSITION
ACTIVE CONTROL          PROHIBITED
FAILOVER READINESS      NOT ESTABLISHED
```

## 10.4 `G07／08／水瀨葵`

Patient-Root Location Index 確認：

```text
SUBJECT           G07／08
NAME              水瀨 葵
AGE               14
TYPE              HUMAN／MINOR
STATUS            ACTIVE／SYSTEM-REPORTED
LOCATION          TSUKUBA-AFFILIATE／C2 CLINICAL ISOLATION
LOCAL ROOT        NONE CONFIRMED
LEGAL STATUS      RESEARCH-ASSIST／SEALED
```

索引本身只能證明：

> 原系統宣稱有一名與葵資料一致的活動患者位於 C2。

在通知水瀨佳乃「葵仍活著」以前，必須取得第二條當輪獨立確認。

可使用：

- 不隸屬 C2 管理鏈的外部醫師取得即時生命體徵；
- 當地急救人員目視患者及床號；
- 法院命令院方提交帶現場時間戳的生命監測；
- 外部設備以獨立通道確認心率、呼吸及基礎腦電。

當輪結果：

```text
INDEPENDENT VITAL CONFIRMATION   YES
CONFIRMED BY                     EXTERNAL MEDICAL／TIMESTAMPED
PATIENT MOVEMENT                 NOT OBSERVED
```

新資訊：

- 葵仍活著；
- 她位於另一法人管理的 C2；
- C2 不在 Chapter 19 原限定搜索範圍；
- 尚未完成外部醫療接管。

一旦位置與生命體徵確認，Chapter 24 當日立即執行：

1. 禁止轉移患者；
2. 禁止遠端設定變更；
3. 禁止銷毀或更換控制器日誌；
4. 當地警方／兒少保護抵達設施外圍；
5. 外部醫療持續取得獨立生命監測；
6. 保全出入口、救護車及運送車輛；
7. 申請緊急進場與醫療接管。

Chapter 25 完成現場進入。

狀態：

```text
PHYSICAL ACCESS         PENDING／PERIMETER SECURED
VITAL STATUS            INDEPENDENTLY CONFIRMED
PATIENT ADVOCATE        NOTIFIED
NO-MOVE ORDER           ACTIVE
NO-CONFIG-CHANGE        ACTIVE
LOCAL SHADOW            NOT AVAILABLE
R5 STATUS               BLOCKED／ON-SITE ACCESS
```

## 10.5 `LEGACY／02`


可開示：

```text
SUBJECT           LEGACY／02
TYPE              HUMAN／ADULT
LOCATION          HAKODATE-AFFILIATE LONG-TERM CARE NODE
STATUS            ACTIVE／HIGH DEPENDENCY
LOCAL CONTROLLER  LEGACY HARDWARE
PATIENT ROOT      UNSUPPORTED／ADAPTER REQUIRED
```

- 身分依法遮蔽；
- 有法院指定代理／醫療監護程序；
- 是函館早期暴露者之一；
- 不是設備；
- 舊控制器沒有 Domain-C。

R5 工作：

- 設計只作臨床用途的患者根轉接器；
- 不複製美空模型；
- 將本地生成與驗證程序移植至舊硬體；
- 外部醫療團隊已派往現場。

狀態：

```text
ADAPTER                 SPECIFICATION ONLY
PATIENT DATA            LOCAL ONLY
R5 STATUS               BLOCKED／HARDWARE
```

## 10.6 章末矩陣

```text
M-00         PASSIVE-CONCORDANT／ACTIVE SWITCH PROHIBITED
G07／03      PASSIVE-CONCORDANT／DRIFT UNRESOLVED
G07／08      ACCESS-PENDING／NO-MOVE ACTIVE
LEGACY／02   ADAPTER-PENDING
```

這不是：

> 2／4 患者已準備離線。

而是：

> 兩名患者的旁觀式模型出現有限相符；另外兩名仍受現場及硬體阻礙。

---

# 11. 水瀨葵：找到位置，不等於帶她回來

## 11.1 對水瀨佳乃的最低必要通知

通知前，外部團隊已取得：

1. Patient-Root Location Index 的姓名／生日／管理碼對應；
2. 不隸屬 C2 管理鏈的當輪獨立生命體徵確認；
3. no-move、no-config-change 及現場外圍保全回執。

通知由：

- 兒少保護；
- 外部醫療；
- 警方／司法保全；
- 家屬支援人員；

共同進行。

不由澪單獨打電話。

佳乃聽到：

> 「系統索引顯示一名與葵資料一致的患者位於 C2。」  
> 「我們也已經從外部取得她目前仍有生命體徵的獨立確認。」  
> 「禁止轉移與設定變更已經生效。」  
> 「我們尚未完成現場接管，也不能承諾她現在能安全移動。」

她問：

> 「你們找到的是她，還是又一個編號？」

回覆：

> 「我們先用編號找到她。現在正在讓醫療和法律程序承認她的名字。」

佳乃不立即道謝。

她先問：

- 葵能否聽見；
- 是否有人在她身邊；
- 為何四十二日沒通知家屬；
- 她何時能見女兒。

大多數問題本章沒有答案。

## 11.2 第七曙光的新角色


第七曙光不成為：

- 技術團隊；
- 擅自公開 C2 位置的組織；
- 突擊醫療設施的家屬群。

它可以：

- 協助合法家屬通知；
- 提供失蹤前醫療及生活資料；
- 保存官方改寫前的外部紀錄；
- 協助建立患者代表；
- 準備第七日同步公開已核實、可公開的失蹤證據。

---

# 12. Domain-P 安全隔離

## 12.1 為何需要先驗證

即使 Domain-P 與 Domain-C 理論隔離，也不能直接在美空身上執行未驗證命令。

先使用：

- 同型退役卡匣；
- 製造商服務模擬器；
- 固件版本一致的測試控制器；

確認：

1. `QUARANTINE-P` 只修改 Domain-P 執行許可；
2. Domain-C 有獨立供電；
3. Domain-C 有獨立時鐘；
4. Domain-C 有獨立重置域；
5. 不觸發全卡匣 reboot；
6. 不改變患者綁定；
7. 不觸發中央 fallback；
8. 不接受遠端 institutional root 回退同一隔離狀態。

## 12.2 執行授權

真正執行需：

- 藤川真理／患者代理授權；
- 外部醫療安全 share；
- 獨立系統安全 share；
- 院內臨床保管執行；
- 警方／司法保全全程記錄。

五方簽名不是全能密鑰。

各自只提供：

- 患者利益；
- 醫療安全；
- 技術授權；
- 設備操作；
- 證據保全。

## 12.3 停止條件

任何下列情況出現，立即停止：

- Domain-C 心跳改變；
- 控制器重置；
- 美空腦電、自律或呼吸出現預定警報；
- 中央 fallback 狀態改變；
- 本地匯流排出現未預期寫入；
- 模擬器與現場固件不一致。

## 12.4 執行結果

```text
DOMAIN-P
EXECUTION             DISABLED
SESSION MATERIAL      ZEROIZED
REVOCATION EPOCH      INCREMENTED／LOCAL
REMOTE RE-ENABLE      PROHIBITED
REPROVISION           PHYSICAL SERVICE + PATIENT PROCESS
FORENSIC READ         ALLOWED
AUDIT                  IMMUTABLE

DOMAIN-C
STATUS                 UNCHANGED
PATIENT BINDING        G07／03
CLINICAL SIGNING       ACTIVE
CLOCK／RESET DOMAIN    UNCHANGED
```

美空現行臨床控制與生理參數沒有超出預定波動。

這不是：

- 活體切換；
- 斷線；
- 影子接管。

只是：

> 對不接觸患者控制通道的公共安全域執行本地、不可遠端逆轉的隔離。

## 12.5 `CONTINUITY-0` 不能復活美空卡匣

`CONTINUITY-0` 無法：

- 降低美空卡匣的本地 revocation epoch；
- 恢復已清除的 Domain-P session material；
- 改動 Domain-C；
- 遠端解除 `QUARANTINE-P`。

若制度級 continuity 仍要建立公共授權，只能：

- 在另一枚空白制度級 token；
- 或 `KAGAMI-01` 內建安全模組；

重新簽發一個新的臨時 Domain-P。

因此 Scene 5 的有限勝利是真實的：

> 美空床邊的同一張卡匣，不會被章末的 Continuity Root 遠端復活。

終局威脅則是：

> 制度仍能另造一把公共鑰匙。

## 12.6 鏡島本地拒絕清單

該硬體序號及 revocation epoch 被加入：

- `KAGAMI-01` 本地 denylist；
- 維護終端拒絕清單；
- 物理監控告警；
- 提交前硬體核驗阻斷。

它能阻止：

- 同一張美空卡匣直接被帶往鏡島使用。

不能阻止：

- 制度級根簽發另一張臨時公共 token；
- emergency override；
- 另一枚制度級卡匣。

---

# 13. 父親的患者安全保全與 R5 分散式 hold

## 13.1 父親沒有國家級密鑰

七年前，父親不是單獨修改 TOKYO 系統。

他以：

- 疑似違法拘束；
- 未成年人醫療風險；
- 死亡紀錄異常；
- 公共系統可能使用受試者；

為由，啟動既有緊急患者安全程序。

臨時保全由：

- 內部監察；
- 值班檢察／法院；
- 醫療安全官；

共同簽發。

父親只是：

> 案件承辦人、通知持有人及續期窗口。

## 13.2 七年前保全的真正作用

封緘稽核顯示：

```text
PATIENT-SAFETY PRESERVATION ORDER
SOURCE DOCKET       KAGAMI-SAFE／R1
TARGET              EARLY TOKYO PILOT
LEGAL STATUS        TEMPORARY
MEDICAL HOLD        ACTIVE／AT ISSUE
CASE OFFICER        ASAKURA／POLICE
```

它曾真正阻止：

> 七年前的一次早期 pilot／提交。

## 13.3 不是「沒人記得續期」，而是案件類別轉換

父親失蹤前後，案件由：

```text
CRIMINAL／PATIENT-SAFETY DOCKET
```

被重新分類為：

```text
NATIONAL SECURITY／CRITICAL INFRASTRUCTURE EVENT
```

轉送造成：

1. 原 patient-safety order 仍綁定舊 docket；
2. 新國安 docket 沒有自動遷移患者醫療 hold；
3. 原命令被標記：
   > `SUPERSEDED／PENDING REVIEW`
4. 新案件沒有自動通知患者代理及外部醫療；
5. 父親失蹤後，舊 docket 失去有效承辦；
6. 審查期限內沒有完成 hold 遷移；
7. 臨時保全因此很快失效。

```text
STATUS        LAPSED
REASON        DOCKET RECLASSIFIED
              PATIENT HOLD NOT MIGRATED
              CASE OFFICER UNAVAILABLE
              RENEWAL WINDOW EXPIRED
```

這不表示：

- 父親個人密鑰遺失；
- 父親七年來一直單獨擋住系統；
- 大家只是忘記按續期；
- 父親目前已死亡。

它表示：

> 一項以患者為中心的保全，在案件被重新定義成基礎設施事件時，沒有被一起帶過去。

本章仍不判定：

- 這是重大制度疏失；
- 還是有人刻意利用轉送缺口。

## 13.4 R5 的新 hold

R5 建立：

> **`DISTRIBUTED PATIENT-SAFETY HOLD`**

它不由單一人持有，也不因某人失聯自動失效。

最低必要領域：

- 法院／司法程序；
- 外部醫療；
- 患者權利；
- 系統安全；
- 涉及公共提交時的營運安全。

## 13.5 精確狀態與「明確否決」缺口

```text
DISTRIBUTED PATIENT-SAFETY HOLD

LEGAL STATUS          COURT-ACKNOWLEDGED／TEMPORARY
MEDICAL STATUS        ACTIVE
PATIENT-RIGHTS        ACTIVE
SHARE-O EFFECT        FROZEN
TOKYO POLICY          FILED／DISPUTED
EXPLICIT DENY TOKEN   ISSUED／CENTRAL
CONTINUITY HSM        DENY NOT RECOGNIZED
CONTINUITY ROOT       NOT ANCHORED
ENFORCEMENT           PARTIAL／PENDING
```

它目前能：

- 凍結正常營運份額 `SHARE-O`；
- 使任何人工提交面臨違反醫療／司法命令的責任；
- 阻止合法營運方參與；
- 保全患者及公開證據；
- 在中央在線政策層記錄一份明確否決；
- 作為第七日法院、醫療及公共說明的依據。

它目前不能：

- 讓離線 continuity HSM 識別這份新式 deny；
- 阻止 `SHARE-CONT` 在 23:50 取得資格；
- 物理關閉鏡島；
- 替代患者本地影子；
- 保證星期日 23:50 不發生 cutover。

Chapter 25 的任務之一是：

> 將「明確拒絕」錨定進 continuity authority，而不只是繼續讓 SHARE-O 保持沉默。

---

# 14. 最終提交、SHARE-S 撤回與 Continuity 狀態機


## 14.1 最終提交需要兩個不同領域

正式邏輯：

```text
FINAL COMMIT AUTHORIZATION REQUIRES

SHARE-S／SCIENCE
+
ONE OPERATIONAL SHARE
```

可用營運份額：

```text
NORMAL OPERATIONAL SHARE       SHARE-O
CONTINUITY OPERATIONAL SHARE   SHARE-CONT
```

正常狀態下：

- `SHARE-S + SHARE-O` 可形成授權；
- `SHARE-CONT` 不具資格。

continuity cutover 後：

- `SHARE-CONT` 才取得 operational eligibility；
- `SHARE-S + SHARE-CONT` 可形成授權組合。

## 14.2 SHARE-S 綁定確切套件，不是泛用科學許可

```text
SHARE-S／SCIENCE

PROFILE HASH          TOKYO-7／<BUNDLE-HASH>
CAL_REF               M-00
CONSENSUS PROFILE     <CONSENSUS-HASH>
PUBLIC ROUTE SET      <ROUTE-HASH>
VALID WINDOW          SUN 23:50–MON 06:20
EXPIRY                MON 06:20
SIGNER ROLE           SCIENCE
ESCROW STATE          DISTRIBUTED／READY
```

因此：

- 凪原續期的不是抽象「防災科學能力」；
- 她續期的是一個具體 TOKYO-7 配置；
- Continuity Root 不能更換 payload 後繼續借用舊 SHARE-S；
- 只要 bundle hash、CAL_REF、consensus profile 或 route set 被合法改變，原 SHARE-S 便無法匹配。

這為 Chapter 25 提供另一條阻斷路徑：

> 使已預簽套件無法通過完整 hash 驗證。

## 14.3 SHARE-S 撤回不是一封抽象申請

SHARE-S 已分送至七個離線區域 HSM。

撤回需要：

1. 凪原以同一職務角色簽發 revocation；
2. 每個 HSM 返回不可改寫的 revocation receipt；
3. receipt 必須在 23:50 cutover 前送達；
4. 23:50 後進入離線 BCP 的節點，不再接受普通中央撤回；
5. 未確認節點仍可能提供有效 SHARE-S。

當輪狀態：

```text
SHARE-S REVOCATION

ISSUED          YES
ACKNOWLEDGED    4／7
PENDING         3／7
CUTOFF          SUN 23:50
BUNDLE HASH     TOKYO-7／<BUNDLE-HASH>
```

凪原的撤回是真實行動。

它尚未成功。

Chapter 25 可：

- 物理或司法控制未回執節點；
- 讓 package hash 失效；
- 禁止鏡島接受未撤回 share；
- 迫使 continuity authority 承認 distributed deny。

## 14.4 SHARE-O 如何從「拒絕」變成「失聯」

正常營運份額定期發送：

```text
OPERATIONAL HEARTBEAT
AUTHORIZATION STATUS
BUNDLE ACCEPTANCE
```

R5 distributed hold 使：

- SHARE-O 不再發出 approval；
- 正常營運 heartbeat 不再續期；
- 中央在線 policy 已收到 `EXPLICIT DENY`；
- 但離線 continuity HSM 使用舊狀態機，只識別：

```text
VALID OPERATIONAL SHARE
NO VALID OPERATIONAL SHARE
```

它沒有可識別的：

```text
EXPLICIT LEGAL／MEDICAL DENY
```

因此在舊 continuity 邏輯中：

- 法院凍結；
- 醫療拒絕；
- 真正通訊中斷；

都會在 cutover 後被壓縮為：

> `OPERATIONAL SHARE UNAVAILABLE`

角色凍結 SHARE-O 並非犯蠢。

它是必要的患者保護。

真正的制度缺陷是：

> 系統沒有「營運方合法拒絕」這個可持續狀態。

## 14.5 Continuity 狀態機

星期日 23:50 前：

```text
SHARE-S       READY／PARTIAL REVOCATION
SHARE-O       FROZEN／EXPLICIT DENY CENTRAL
SHARE-CONT    ARMED／INELIGIBLE
```

continuity HSM 判讀：

```text
VALID SHARE-O?     NO
RECOGNIZED DENY?   NO
CUTOVER TIME?      NOT YET
```

星期日 23:50 後：

```text
VALID SHARE-O?     NO
RECOGNIZED DENY?   NO
CUTOVER TIME?      YES
RESULT             OPERATIONAL UNAVAILABLE
SHARE-CONT         ELIGIBLE
```

R5 distributed hold 的真正終局目標是：

> 讓 continuity HSM 能辨認一項不可被 substitute 取代的明確患者安全否決。

## 14.6 23:50 只取得授權資格，不是執行 commit

### 第一階段：23:50 授權資格

```text
COMMIT AUTHORIZATION    ELIGIBLE
SHARE-S + SHARE-CONT    AVAILABLE
```

尚未執行 public fanout。

### 第二階段：23:50–05:50 套件預置

- 分發綁定 bundle；
- 區域 HSM 驗證；
- 離線公共路徑準備；
- 鏡島設備預熱；
- package hash 鎖定。

### 第三階段：05:50 後執行

- auto-prep；
- CAL LOCK；
- consensus preparation；
- execution commit；
- 06:13 回聲窗。

章末威脅應表述為：

> 星期日 23:50，系統將取得完成最終提交所需的授權組合。

不能表述為：

> 23:50 最終提交已完成。

## 14.7 `CONTINUITY-0`

`CONTINUITY-0` 是：

- 制度級硬體安全模組／離線根；
- 不綁定任何患者；
- 不依賴美空卡匣；
- 可為 `SHARE-CONT` 簽發新的臨時公共 token；
- 可在正常營運份額長時間不可用時維持基礎設施運作。

它不能：

- 復活美空卡匣已隔離的 Domain-P；
- 改動 Domain-C；
- 遠端降低美空卡匣 revocation epoch。

它只能：

> 另行製造一把新的公共鑰匙。

其 custodian 仍封緘。

## 14.8 凪原的個人責任

作者層鎖定：

> 凪原以現任統括調整官身分，在本次七日窗開始前的星期五，確認並續期綁定確切 TOKYO-7 bundle hash 的 SHARE-S escrow。

她的理由：

- 相信保護性原始過濾仍必要；
- 相信科學份額只有與正常營運份額一起才可使用；
- 知道 continuity substitute 存在；
- 卻把它理解為真正通訊／基礎設施失聯時的最後備援；
- 沒有充分處理司法凍結及營運拒絕也會被舊 policy 判為 unavailable。

她可以說：

> 「我沒有在這一週執行最終 commit。」

她不能說：

> 「這與我無關。」

因為她：

- 續期了確切套件的科學份額；
- 維持了角色 escrow；
- 沒有在外部調查開始後立即撤回；
- 曾接受 continuity 條款作安全網。

本章中她：

- 簽發 SHARE-S 撤回；
- 交出 bundle hash 及續期紀錄；
- 取得 4／7 revocation receipts；
- 承認剩餘 3 個節點在 cutover 前仍可能保留有效 share；
- 不能單方面撤銷 `CONTINUITY-0`。

她不是唯一最後按鈕。

她仍對自己真正作過的決定負責。

---

# 15. 角色代理與 continuity authority


琴音提供的前台案件別名：

```text
FAMILY-STABILITY／CASE-G07-03
```

向上解析為：

```text
FAMILY-STABILITY／CASE-G07-03
        ↓
CLINICAL CONTINUITY BROKER
        ↓
TOKYO-7 CONTINUITY AUTHORITY
```

每層：

- 使用角色憑證；
- 前台不顯示真人；
- 真正操作者位於封緘、不可改寫稽核；
- 需新的司法／國安程序才能打開。

本章只能確認：

- 家屬支援代理並非孤立低層帳號；
- 它屬於 continuity authority 的臨床入口；
- 同一 authority 可：
  - 轉製家屬請求；
  - 維持中央依賴；
  - 在普通營運拒絕時準備替代份額。

不能確認：

- `CUSTODIAN ID` 真人；
- 是否為單一個人；
- 是否直接受凪原指揮；
- `CONTINUITY-0` 物理位置。

---

# 16. 八場景結構

## Scene 1：第五版不寫一個人的名字

**時間：06:30–07:40**  
**地點：臨時共同安全會議室**

版本系統要求填入：

> AUTHOR

所有人先看向澪。

澪拒絕：

> 「第四版就是因為只有一個人知道得太多，才會變成那樣。」

千田拒絕由工程方單獨署名。

外部醫療指出：

> 技術作者不能自動取得患者決定權。

患者權利代表指出：

> 委員會多數也不能替患者同意。

最終建立：

```text
AUTHORSHIP    FEDERATED／NO SINGLE OWNER
```

文件同時誠實區分：

- 目標無中央動態母體；
- 當輪仍在過渡。

章名第一次支付：

> 第五版的設計裡沒有母體。  
> 但所有人仍在母體留下的系統裡。

---

## Scene 2：母親只限制系統可以怎麼變

**時間：07:40–09:15**  
**地點：M-00 外部醫療區／安全視訊**

外部醫療與獨立權利代表，以普通語言分兩段詢問紗英。

紗英允許：

- 用既有醫療資料幫助患者分離；
- 建立短期網路過渡限制。

她拒絕：

- public use；
- raw neural stream；
- 永久使用；
- 語義內容。

休息後反向再問。

答案一致。

醫師另向她說明：

> 「如果有人已經正在慢慢換線，而妳之後說停止，我們不會突然剪線。會先停在最近的安全位置，再停止使用。」

溝通板新增永久：

> `STOP／NO USE`

技術組正式區分：

- 每名患者自己的 `PATIENT SAFETY ENVELOPE`；
- 由匯流排遙測、自然切換、M-00 端點限制及患者節點證明共同生成的 `NETWORK TRANSITION ENVELOPE`。

凪原第一次看見：

> 紗英的同意不是「繼續維持」，而是「規定現有系統最多可以怎樣拆除」。

本場為本章情感主高潮。

---

## Scene 3：不拿走任何人的模型

**時間：09:15–11:15**  
**地點：美空節點／離線安全室**

千田畫出兩種錯誤方案：

1. 把美空模型複製給其他患者；
2. 把紗英數位化成永久中央參照。

兩者均被否決。

獨立系統安全人員示範：

- 模型留在本地；
- 患者本地根簽署結果；
- 外部醫療以獨立感測交叉；
- `EXPORT LOCKED` 不需要解除。

簡化說法：

> 「我們不拿走她的節奏。只讓她自己的機器和外部醫療一起證明，它現在有沒有跟上。」

Chapter 20 的備援架構被重新打開：

```text
PHYSIOLOGICAL PHASE CONTROL
ECHO SUPPRESSION
SEMANTIC INTERPRETATION
FUTURE CLASSIFICATION
PUBLIC CONSENSUS INTERFACE
```

R5 不重新訓練一套新系統。

它只：

- 保留前兩個醫療模組；
- 停用後三個語義／公共模組；
- 置於本地被動模式；
- 驗證輸出不再依賴被停用模組。

不能宣布成功。

只進入 Stage-1。

---

## Scene 4：我們找到她仍在系統裡的位置

**時間：11:15–13:25**  
**地點：Patient-Root Location Index 保全室／C2 外圍／家屬通知室**

新的醫療／司法命令打開患者根位置索引。

系統先顯示：

- `G07／08 = 水瀨葵`；
- C2 臨床隔離棟；
- ACTIVE／SYSTEM-REPORTED；
- 本地根未確認。

團隊不立即通知佳乃「葵仍活著」。

先取得：

- 外部醫師不經 C2 管理鏈的即時生命讀值；
- 現場時間戳；
- 床號與患者識別交叉。

確認：

```text
VITAL STATUS    INDEPENDENTLY CONFIRMED
```

隨後立即執行：

- no-move；
- no-config-change；
- 控制器日誌保全；
- 當地警方、兒少及外部醫療抵達外圍；
- 救護與運送車輛監控。

另一列：

- `LEGACY／02`；
- HUMAN／ADULT；
- 函館節點；
- 舊硬體；
- adapter required。

水瀨佳乃得到最低必要通知。

她問：

> 「你們找到的是她，還是又一個編號？」

回答：

> 「我們先用編號找到她。現在也有外部醫療確認她仍有生命體徵。接下來要讓醫療和法律程序真正接管她。」

本章不完成 C2 進場。

---

## Scene 5：公共鑰匙離開病人

**時間：13:25–15:25**  
**地點：美空床側控制器／同型硬體測試台／鏡島安全終端**

先在同型退役卡匣及模擬器驗證：

- Domain-P／C 獨立供電；
- 獨立時鐘；
- 獨立重置；
- `QUARANTINE-P` 不觸發全卡重啟；
- 隔離紀錄不能被遠端 institutional root 回退。

設定醫療停止條件。

五方共同執行。

操作後：

```text
DOMAIN-P
EXECUTION        DISABLED
SESSION          ZEROIZED
REVOCATION       LOCAL／NON-REMOTE-REVERSIBLE

DOMAIN-C
STATUS           UNCHANGED
```

美空生理與控制器狀態保持在預定範圍。

鏡島端將該序號與 revocation epoch 加入 denylist。

琴音看見：

> 妹妹的臨床根仍在。  
> 公共權限卻可以被關掉。

系統安全人員補充：

> `CONTINUITY-0` 也不能遠端復活這張卡匣。它若要重開鏡島，只能另造一把公共鑰匙。

她被告知的「兩者不可分」第一次由當輪操作推翻。

此場為行動高潮。

---

## Scene 6：旁觀相符，不是準備切換

**時間：15:25–18:05**  
**地點：離線回放室／M-00 與美空節點**

不進行新斷線。

美空：

- 事件 A／B 回放；
- 被動影子；
- 外部醫療感測交叉；
- 睡眠轉換漂移仍存在。

M-00：

- 使用模組化舊備援的生理控制與回聲抑制部分；
- 只比對醫療相位回傳；
- 不含 semantic／future／public 模組；
- 不接管。

結果：

```text
M-00       PASSIVE-CONCORDANT／LIMITED
G07／03    PASSIVE-CONCORDANT／DRIFT UNRESOLVED
G07／08    ACCESS-PENDING
LEGACY／02 ADAPTER-PENDING
```

澪問：

> 「所以她們現在可以離線了嗎？」

外部醫師回答：

> 「不可以。」  
> 「但我們第一次不是只知道不能拔。我們開始知道，拔以前還缺什麼。」

這句為有限技術勝利的核心。

---

## Scene 7：一個人不見，安全不能一起失效

**時間：18:05–20:10**  
**地點：共同安全會議／法院與家屬代表連線**

R5 各領域簽署自己的部分。

沒有人替別人簽。

封緘稽核顯示父親七年前的臨時患者安全保全。

日下部解釋：

- 父親不是單人密鑰；
- 他透過案件、法院／檢察及醫療使系統停過一次；
- 原刑事／患者 docket 後來被改分類為國安基礎設施案件；
- 患者 hold 沒有被遷移；
- 父親失蹤後，也沒有新的患者代表收到通知；
- 保全因而失效。

澪沒有追問父親位置。

她只說：

> 「這次不能因為一個人不見了，或案件被換了名字，所有人的安全就一起失效。」

新的 distributed hold 被法院、醫療及患者權利程序承認。

狀態顯示：

```text
SHARE-O EFFECT        FROZEN
EXPLICIT DENY         ISSUED／CENTRAL
CONTINUITY HSM        DENY NOT RECOGNIZED
ENFORCEMENT           PARTIAL
```

有限勝利與真正缺口同時存在。

---

## Scene 8：23:50

**時間：20:10–23:55**  
**地點：封緘稽核室／主管機關安全視訊**

琴音角色代理向上展開 continuity authority。

提交邏輯顯示：

```text
FINAL AUTHORIZATION REQUIRES

SHARE-S
+
SHARE-O OR SHARE-CONT
```

SHARE-S 並非泛用科學許可。

它綁定：

- TOKYO-7 bundle hash；
- M-00 CAL_REF；
- consensus profile；
- public route set；
- 星期日 23:50 至星期一 06:20 的有效窗。

凪原承認：

- 她在本輪前確認／續期了這個確切 bundle；
- 她相信正常 SHARE-O 仍是必要條件；
- 她沒有充分處理 continuity HSM 不認得法律／醫療 explicit deny。

她簽發撤回。

七個離線 HSM 回執：

```text
ACKNOWLEDGED    4／7
PENDING         3／7
CUTOFF          SUN 23:50
```

系統安全人員展示舊 continuity 狀態機：

```text
VALID SHARE-O?     NO
RECOGNIZED DENY?   NO
CUTOVER TIME?      NOT YET
```

23:50 後將變為：

```text
VALID SHARE-O?     NO
RECOGNIZED DENY?   NO
CUTOVER TIME?      YES
RESULT             OPERATIONAL UNAVAILABLE
SHARE-CONT         ELIGIBLE
```

日下部問：

> 「所以 23:50 會啟動嗎？」

回答：

> 「不會。它只會取得完成提交所需的授權組合。」  
> 「之後六小時才是套件分送、驗證與鏡島預熱。05:50 才進入執行階段。」

美空 Domain-P 已被不可遠端逆轉地隔離。

但 `CONTINUITY-0` 可以在另一枚制度級 token 或鏡島 HSM 上簽發新的公共授權。

章末狀態：

```text
KAGAMI-SAFE／R5
TARGET CENTRAL DYNAMIC REFERENCE   NONE
VALIDATION                         STAGE-1
M-00                               PASSIVE-CONCORDANT
G07／03                            PASSIVE-CONCORDANT

DISTRIBUTED HOLD
EXPLICIT DENY                      CENTRAL ONLY
CONTINUITY HSM                     NOT ANCHORED

TOKYO-7
SHARE-S                            READY／REVOCATION 4 OF 7
SHARE-O                            FROZEN
SHARE-CONT                         ELIGIBLE AT SUN 23:50
CONTINUITY-0                       ARMED
```

星期六 23:55。

章末：

> 第五版的設計裡沒有母體。  
>   
> 可不到二十四小時後，系統仍會把所有人的拒絕重新命名為營運失聯。

---

# 17. 本章必須完成的十七項成果

## 成果一：R5 正式存在，但只作 provisional 過渡規格

- R5 被登錄；
- 不聲稱無母體現況已完成；
- 主動切換仍禁止。

## 成果二：R5 沒有單一所有者

- `AUTHORSHIP = FEDERATED`；
- 起草、患者權利、法律、系統及公共權限分開；
- 必要領域不可互相替代。

## 成果三：真正區分患者安全邊界與多源網路過渡邊界

- 每名患者定義自己的醫療安全；
- 網路邊界來自匯流排遙測、自然切換、M-00 端點及患者安全證明；
- 不把紗英改名成靜態新母體。

## 成果四：紗英取得限制資料用途、撤回及安全暫停能力

- 普通語言；
- 兩段確認；
- 獨立權利代表；
- `STOP／NO USE`；
- 自動過期；
- 過渡中使用 `SAFE PAUSE`，不突然傷害患者。

## 成果五：R5 複製程序，不複製患者

- 患者綁定本地臨床根；
- 模型留在本地；
- `EXPORT LOCKED` 保留；
- 對外只輸出雙重驗證結果。

## 成果六：本地影子不能自己證明自己安全

- 程式與硬體 attestation；
- 患者根簽章；
- 獨立醫療感測；
- 雙重時間戳交叉。

## 成果七：回收 Chapter 20 的模組化備援

- 不從零建立 M-00 控制器；
- 只保留生理相位與回聲抑制；
- 停用語義、未來分類及公共接口。

## 成果八：美空 Domain-P 被安全且不可遠端逆轉地隔離

- 先在同型硬體驗證；
- 隔離不改動 Domain-C；
- `CONTINUITY-0` 不能復活同一卡匣；
- 制度只能另造公共 token。

## 成果九：美空與 M-00 只取得 Stage-1 被動相符

- 不使用 `PASSIVE-READY`；
- `FAILOVER READINESS = NOT ESTABLISHED`；
- 不宣稱接近安全離線。

## 成果十：水瀨葵的位置與生命狀態得到雙重確認

- Patient-Root Location Index；
- 外部當輪生命體徵；
- no-move；
- no-config-change；
- 現場外圍保全；
- Chapter 25 才完成進場。

## 成果十一：`LEGACY／02` 明確為活人及硬體瓶頸

- HUMAN／ADULT；
- 患者綁定根轉接器待設計；
- 本章不公開姓名。

## 成果十二：父親安全 hold 被還原為程序行動及 docket 轉換缺口

- 由案件、法院／檢察及醫療共同簽發；
- 父親是承辦，不是密鑰持有人；
- 只阻止七年前 early pilot；
- 國安重新分類時患者 hold 未被遷移。

## 成果十三：R5 distributed hold 的效力與缺口被精確標示

- 法院、醫療及患者權利生效；
- SHARE-O 凍結；
- 中央 explicit deny 已發出；
- continuity HSM 尚不認得 deny。

## 成果十四：SHARE-S 綁定確切套件

- bundle hash；
- CAL_REF；
- consensus profile；
- route set；
- 有效窗與到期；
- 不能配對其他 payload。

## 成果十五：SHARE-S 撤回成為可追蹤的節點任務

- 七個離線 HSM；
- 4／7 已確認；
- 3／7 待處理；
- 23:50 截止；
- Chapter 25 可直接行動。

## 成果十六：Continuity 狀態機明確展示「拒絕如何變成失聯」

- SHARE-O heartbeat 停止；
- 中央 explicit deny 存在；
- 離線 HSM 不識別 deny；
- 23:50 後將其判為 operational unavailable；
- SHARE-CONT 取得資格。

## 成果十七：第六大段在星期六午夜前結束

- Chapter 24 於星期六 23:55 結束；
- Chapter 25 才正式進入星期日與第七日；
- 23:50 是授權資格，不是 execution commit。

---

# 18. 證據鏈與推論邊界

## 18.1 R5

可成立：

- R5 是正式登錄的聯邦式 provisional 過渡規格；
- 目標架構無中央動態 Mother Reference；
- 每名患者由自己的 Patient Safety Envelope 定義醫療安全；
- Network Transition Envelope 來自匯流排遙測、自然切換、M-00 端點限制及患者節點證明；
- 沒有任何患者完成主動切換。

不能成立：

- 當輪已經沒有母體；
- R5 已證明可承受完整回聲窗；
- 所有患者可在星期一前切離；
- R5 一定終止循環；
- R5 不會產生未知風險。

## 18.2 紗英的資料用途與撤回

可成立：

- 紗英以可理解、分段程序同意有限用途；
- 她拒絕 public use 及 raw stream；
- 撤回有 `STOP／NO USE`、自動過期及版本重確認；
- 若過渡已開始，撤回會觸發 `SAFE PAUSE`，不突然剪斷患者保護；
- M-00 只提供多源網路過渡邊界中的端點限制。

不能成立：

- 此同意追認十年研究；
- 她同意永久提供資料；
- 網路邊界等於完整 M-00 模型；
- 其他患者須模仿紗英；
- 「可撤回」等於可在任何瞬間粗暴刪除正在使用的安全限制。

## 18.3 被動驗證

可成立：

- 本地影子與不經 KAGAMI 的獨立醫療資料在有限資料中相符；
- M-00 模組化舊備援停用語義／未來／公共模組後，可作被動醫療模型；
- 美空睡眠轉換仍有漂移；
- 程式雜湊、硬體 attestation、患者根簽章及雙重時間戳均被保全。

不能成立：

- 模型已可接管；
- failover readiness 已建立；
- 回聲窗高負荷已驗證；
- 被動相符等於臨床安全；
- 節點能只靠自己的簽章證明自己安全。

## 18.4 Domain-P 隔離

可成立：

- Domain-P 被本地、不可遠端逆轉地隔離；
- Domain-C 未改變；
- 美空卡匣無法再直接作鏡島公共授權；
- `CONTINUITY-0` 不能復活同一卡匣；
- 操作不屬患者切換。

不能成立：

- 所有公共權限消失；
- `CONTINUITY-0` 已停止；
- 卡匣可直接拔除；
- 美空已離開中央閉環；
- 制度無法另簽新的公共 token。

## 18.5 水瀨葵

可成立：

- Patient-Root Location Index 確認 `G07／08 = 水瀨葵`；
- 外部醫療另取得當輪獨立生命體徵；
- 她仍活著並位於 C2；
- no-move、no-config-change 及外圍保全已生效。

不能成立：

- 葵已被救出；
- 她可安全移動；
- 外部醫療已完成進房接管；
- 她知道家屬正在找她；
- C2 其他患者身分可公開。

## 18.6 父親保全

可成立：

- 父親透過案件、法院／檢察及醫療程序，使七年前 early pilot 停過；
- 國安 docket 重新分類時，患者 hold 沒有被遷移；
- 承辦失聯與遷移缺口使保全失效。

不能成立：

- 父親個人持有國家密鑰；
- 他七年來一直阻止 TOKYO；
- 他目前已死亡或仍被拘束；
- hold 失效已被證明由某名真人惡意操控。

## 18.7 Distributed hold

可成立：

- 法院、醫療及患者權利程序已承認；
- SHARE-O 被凍結；
- 中央在線政策層已收到 explicit deny；
- 任何人工提交將面臨明確法律及醫療責任。

不能成立：

- 離線 continuity HSM 已識別這份 deny；
- SHARE-CONT 已被阻止取得資格；
- hold 已物理關閉鏡島；
- hold 已完全執行。

## 18.8 SHARE-S

可成立：

- SHARE-S 綁定確切 TOKYO-7 bundle hash、CAL_REF、consensus profile、route set 及有效窗；
- 凪原在本輪前確認／續期該套件；
- 她已簽發撤回；
- 七個離線 HSM 中四個已回傳撤回回執，三個待確認。

不能成立：

- 撤回已全面生效；
- 凪原可單方面控制所有 HSM；
- 舊 SHARE-S 可配對任意新 payload；
- 23:50 後普通中央撤回仍一定可送達離線節點。

## 18.9 Continuity 授權鏈

可成立：

- final authorization 需要 SHARE-S 加一份營運份額；
- SHARE-O frozen；
- SHARE-CONT 在 23:50 前不具資格；
- 舊 continuity HSM 不識別新式法律／醫療 explicit deny；
- 23:50 後可能將無有效 SHARE-O 判為 operational unavailable；
- `CONTINUITY-0` 不依賴美空卡匣，可另簽新的公共 token；
- 23:50 只是授權資格及預置開始，不是 execution commit。

不能成立：

- continuity custodian 真人；
- 星期日一定成功取得授權；
- 凪原能單方面阻止或啟動；
- 三個待撤回 HSM 一定拒絕撤回；
- 最終 public payload 的人類心理效果已完全證明；
- 制度級根物理位置已知。

---

# 19. 誤導與普通解釋

| 線索 | 普通解釋 |
|---|---|
| R5 聯邦式治理 | 大型跨機構醫療系統的普通責任分工 |
| 無中央動態母體 | 技術目標，未必能在當輪完成 |
| Patient Safety Envelope | 一般個體醫療安全參數 |
| Network Transition Envelope | 基礎設施切換限制，不必然仍以紗英為母體 |
| `EXPORT LOCKED` | 正常患者隱私與安全隔離 |
| 被動相符 | 模型旁觀吻合，不代表可接管 |
| `SAFE PAUSE` | 一般醫療撤回保護，不代表方案一定可安全停止 |
| 葵位於 C2 | 可能被官方描述成高風險合法治療 |
| 外部生命確認 | 只證明目前有生命體徵，不證明患者權利受保障 |
| no-move order | 保全患者安全，不必然證明非法拘束 |
| Domain-P 隔離 | 標準硬體權限撤銷，不代表 TOKYO-7 整體被阻止 |
| Domain-P 不可遠端逆轉 | 只保護同一卡匣，制度仍可另簽 token |
| 父親早期保全 | 普通臨時法院／醫療命令 |
| docket 重新分類 | 國安案件常見程序轉換，不必然有惡意 |
| SHARE-S bundle binding | 正常安全簽章最小權限設計 |
| SHARE-S escrow | 正常災害預簽，不等於本週直接啟動 |
| 4／7 撤回回執 | 區域離線節點延遲，不必然故意拒絕 |
| SHARE-CONT | 關鍵基礎設施常見持續運用備援 |
| 23:50 cutover | 正常夜間 BCP 交接 |
| continuity 不識別 deny | 舊離線系統的相容性缺陷，不必然是陰謀 |
| `CONTINUITY-0` | 制度備援，不必然由單一惡意人物控制 |
| 水瀨佳乃通知受限 | 保護未成年人及現場安全，不必然是繼續掩蓋 |

---

# 20. 角色狀態變化

## 20.1 朝倉澪

本章開始：

- 已拒絕 R4；
- 容易因掌握跨輪資料再次成為方案中心。

本章結束：

- 主動拒絕 R5 單一作者位置；
- 不再把自己、悠真或母親視為必須成為中心的人；
- 理解「沒有母體」是目標，不是已完成現況；
- 看見紗英第一次限制、撤回及安全暫停自己的資料用途；
- 知道葵仍活著，但不能把「知道位置」冒充「已救出」；
- 接受美空與 M-00 只有 Stage-1 被動相符；
- 知道父親透過程序停過系統，而不是擁有神祕個人密鑰；
- 發現真正終局是舊 continuity 狀態機不承認合法拒絕；
- 知道 SHARE-S 撤回仍有三個離線節點未確認；
- 從自我審判正式轉入星期日的集體行動。

## 20.2 朝倉紗英

- 不再只作資料來源；
- 明確同意患者分離用途；
- 明確拒絕 public use、raw stream 及永久用途；
- 只提供多源網路過渡邊界中的端點限制；
- 擁有永久 `STOP／NO USE`；
- 撤回可觸發 `SAFE PAUSE`，不會被拿來突然傷害正在過渡的患者；
- 仍未脫離閉環；
- R5 成敗不再等同她是否願意繼續犧牲。

## 20.3 藤川美空

- Domain-P 被本地、不可遠端逆轉地隔離；
- Domain-C 保留；
- `CONTINUITY-0` 無法復活同一卡匣；
- 局部影子取得 Stage-1 被動相符；
- 睡眠轉換漂移仍未解決；
- 仍未醒；
- 仍未安全離線；
- 她的模型不被輸出或複製。

## 20.4 白石琴音

- 親眼看見公共權限可以在不拔除臨床根的情況下被隔離；
- 她被告知的「兩域不可分」被當輪操作推翻；
- 知道 R5 不複製美空；
- 知道制度若要重開鏡島，只能另造公共 token，不能再利用妹妹卡匣；
- 仍不完全信任系統及澪；
- 可在受控條件下協助理解家屬支援流程；
- 不能單獨操作卡匣或患者節點。

## 20.5 水瀨佳乃

- 第一次得到葵位置與生命體徵的雙重當輪確認；
- 同時知道葵尚未被救出；
- 知道 no-move 與 no-config-change 已生效；
- 成為葵患者代理程序核心；
- 第七曙光開始準備家屬資料及公開證據；
- 不被要求立刻相信國家或調查團隊。

## 20.6 千田浩介

- 從單一工程解說者，轉為受限制的技術起草者；
- 回收 Chapter 20 模組化備援模型，而非臨時創造奇蹟；
- 建立本地生成、多源網路邊界與雙重觀察協議；
- 協助 Domain-P 不可逆隔離；
- 發現制度級根可另簽公共 token；
- 第七日仍不得單獨持有權限。

## 20.7 日下部悟

- 將父親舊案件在國安 docket 轉換中失去患者 hold 的缺口，轉成 distributed hold；
- 推動葵位置開示、獨立生命確認及立即保全；
- 保全 SHARE-S bundle hash、撤回回執及 continuity 狀態機；
- 不因 R5 出現便降低刑事及公開證據準備；
- 第七日將同步技術、患者接管與證據公開。

## 20.8 凪原唯

- 承認自己在本輪前續期綁定確切 TOKYO-7 bundle 的 SHARE-S escrow；
- 不能把責任完全推給抽象職務；
- 也證明自己不是唯一最後按鈕；
- 已簽發撤回並取得 4／7 回執；
- 知道三個離線節點仍可能在 cutover 後使用有效 SHARE-S；
- 面臨第七日最終選擇：
  - 協助控制剩餘 HSM、使 bundle hash 無效或錨定 explicit deny；
  - 或讓 continuity policy 利用她的預簽。

---

# 21. 作者層真相鎖定

1. R5 的基本方向正確，但完整回聲窗仍有重大風險。
2. 第五版的目標架構沒有中央動態 Mother Reference；當輪過渡仍使用 M-00 端點的短期非語義限制。
3. 每名患者自己的 Patient Safety Envelope 才定義個體安全。
4. Network Transition Envelope 由 KAGAMI 遙測、自然／維護切換、M-00 端點限制及患者節點安全證明共同生成。
5. 紗英不再定義所有患者應成為什麼，只限制現有閉環可以多快拆除。
6. 紗英的限制性同意有效、可撤回，但不追認十年研究。
7. 若主動過渡已開始，撤回將觸發 `SAFE PAUSE`，不會突然抽走安全限制。
8. 美空與 M-00 只能取得 Stage-1 被動相符，不能在 Chapter 24 主動切換。
9. Chapter 20 舊備援模型原本即為模組化；R5 只保留生理相位與回聲抑制。
10. 水瀨葵確實是 `G07／08`，仍活著並位於 C2。
11. 葵的生命狀態已由不隸屬 C2 的外部醫療獨立確認。
12. C2 收到 no-move 及 no-config-change 後，控制方會在 Chapter 25 嘗試以 continuity／醫療安全名義抗拒進場。
13. `LEGACY／02` 是函館早期暴露的成人患者，不是設備。
14. 美空卡匣 Domain-P 可被安全且不可遠端逆轉地隔離，Domain-C 可保留。
15. `CONTINUITY-0` 不能復活美空卡匣，只能在另一制度級 token 或鏡島 HSM 上簽發新公共授權。
16. SHARE-S 已由凪原在本次七日窗前確認／續期，且綁定確切 TOKYO-7 bundle hash。
17. SHARE-S 撤回已由 4／7 區域 HSM 確認，剩餘 3 個節點仍是第七日目標。
18. 舊 continuity HSM 不識別新式法律／醫療 explicit deny。
19. SHARE-CONT 在星期日 23:50 continuity cutover 後取得 operational eligibility；23:50 尚不是 execution commit。
20. 父親 R1 透過案件、法院／檢察及醫療程序使七年前 early pilot 停過。
21. 原患者 hold 在案件重分類為國安基礎設施事件時未被遷移，之後因承辦失聯與期限到期而失效。
22. R5 distributed hold 具有真實法律、醫療及患者權利效力，並凍結 SHARE-O，但尚未錨定到 continuity HSM。
23. 第七日仍需：
    - 完成 C2 接管；
    - 為葵建立患者本地根；
    - 平行推進 `LEGACY／02` 臨床轉接器；
    - 取得剩餘 SHARE-S 撤回回執或使 bundle hash 失效；
    - 讓 continuity HSM 識別不可替代的 explicit deny；
    - 控制 `KAGAMI-01`；
    - 公開證據；
24. TOKYO-7 最終失敗不能只靠 R5，還需要患者接管、公共證據及七秒路徑共同作用。
25. Chapter 24 在星期六 23:55 結束。
26. Chapter 25 正式進入星期日與第七日《不要救東京》。

---

# 22. Chapter 25 銜接

## Chapter 24 結束時已知

- `KAGAMI-SAFE／R5` 已正式登錄為 provisional；
- `AUTHORSHIP = FEDERATED`；
- 目標為無中央動態 Mother Reference；
- 當輪仍處於 M-00 過渡；
- 每名患者另有自己的 Patient Safety Envelope；
- Network Transition Envelope 由多源非語義資料生成；
- 紗英只允許短期、可撤回的過渡用途，並擁有 `STOP／NO USE` 及 `SAFE PAUSE`；
- 模型留在本地，對外只輸出與獨立醫療一致的驗證結果；
- 美空與 M-00 為 `PASSIVE-CONCORDANT／STAGE-1`，主動切換禁止；
- 美空卡匣 Domain-P 已不可遠端逆轉地隔離，Domain-C 保留；
- `CONTINUITY-0` 不能復活美空卡匣，只能另簽公共 token；
- `G07／08 = 水瀨葵` 當輪位置與生命體徵均得到獨立確認；
- C2 已受 no-move、no-config-change 及外圍保全；
- `LEGACY／02` 需要患者根轉接器；
- R5 distributed hold 已獲法院、醫療及患者權利承認；
- SHARE-O frozen；
- 中央 explicit deny 已發出；
- continuity HSM 尚不識別 deny；
- 父親曾透過合法程序阻止七年前 early pilot；
- SHARE-S 綁定確切 TOKYO-7 bundle；
- 凪原已簽發撤回；
- 7 個離線 HSM 中 4 個已確認、3 個待處理；
- SHARE-CONT 將於星期日 23:50 取得 operational eligibility；
- 23:50 是授權與預置開始，不是 execution commit；
- `CONTINUITY-0` 可另簽新的公共營運 token；
- Chapter 24 於星期六 23:55 結束；
- 距 continuity cutover 約二十三小時五十五分；
- 距星期一 06:13 約三十小時十八分。

## Chapter 25 的三條主線

Chapter 25 正式進入：

> **第七日：不要救東京**

### A. C2 現場接管

1. 執行外部醫療、兒少保護與司法進場；
2. 正式接管水瀨葵與可確認活動患者；
3. 保全 C2 控制器、患者資料與運送路線；
4. 為葵建立患者綁定本地臨床根；
5. 先部署被動影子，不進行終局主動切換；
6. 處理控制方以「醫療安全／continuity」名義抗拒進場的反制。

### B. Continuity 授權阻斷

1. 取得剩餘 3 個 SHARE-S revocation receipts；
2. 或使綁定 bundle hash 無法通過最終驗證；
3. 將 distributed explicit deny 錨定至 continuity HSM；
4. 追查 `CONTINUITY-0` custodian、制度位置及新 token 發行路徑；
5. 控制 `KAGAMI-01` 對新公共 token 的接受；
6. 明確區分 23:50 授權資格、預置與 05:50 execution 階段。

### C. 公開證據與患者代表

1. 由第七曙光、日下部、家屬、外部醫療及媒體準備同步公開：
   - 原始交通紀錄；
   - 失蹤者資料；
   - 醫院轉移；
   - 受試者依存；
   - 患者 hold 被繞過的程序；
2. 防止系統將患者接管及權限阻斷定義成非法破壞；
3. 讓公眾明白：
   > 拒絕 TOKYO-7 不是放棄東京，而是拒絕讓東京以未撤離者為代價。

## 平行工作

`LEGACY／02` 的患者根轉接器與函館外部醫療，由平行團隊處理。

Chapter 25 只以：

- 進度；
- 風險；
- 是否趕上 cutover；

作更新，不另開第四條完整主線。

## Chapter 25 不做的事

- 不在本章完成最終 06:13 切換；
- 不讓葵立即完全脫離中央；
- 不解決所有紅區患者；
- 不一次揭露 continuity custodian、最終 payload 與父親下落。

## 核心問題

> 當系統把合法拒絕壓縮成「營運不可用」時，患者、家屬、醫師、工程師、警察與公眾能否同時建立一份離線制度也無法再忽略的「不」？

---

# 23. 本章不能揭露的事


1. `CONTINUITY-0` 實際保管人；
2. 角色代理與 `CUSTODIAN ID` 背後真人；
3. 最終具名最高授權者；
4. 凪原的 SHARE-S 撤回是否成功；
5. 制度級根物理位置；
6. 水瀨葵完整醫療狀態；
7. 葵是否能在星期一前安全切離；
8. `LEGACY／02` 完整姓名；
9. 父親現在下落；
10. 父親保全未續期背後是否有具名惡意行為；
11. R5 主動切換完整程序；
12. 美空是否最終醒來；
13. 其他受試者完整名單；
14. 全球共同記憶方案完整架構；
15. 外星訊號真正目的；
16. 第三輪是否能終止循環；
17. 第八天是否真的會到來。

---

# 24. 本章一句話總結

> Chapter 24 不宣稱團隊在一天內造出了真正的無母體系統。澪拒絕成為第五版的單一作者，外部醫療、患者權利、系統安全、司法保全與公共營運只能簽署自己真正有權負責的部分。R5 將每名患者自己的 Patient Safety Envelope，與由 KAGAMI 匯流排遙測、自然／維護切換、M-00 端點限制及患者節點證明共同生成的 Network Transition Envelope 分開；紗英在獨立權利代表協助下，以普通語言分兩段確認，可以用既有資料幫助患者離開中央系統，不可以用於公共提示、不可以匯出原始神經流，並可透過永久 STOP 及醫療上可行的 SAFE PAUSE 撤回。每名患者的局部影子只在本地生成，以患者綁定的臨床根簽署；節點結果還必須與不經 KAGAMI 的外部醫療感測一致。Chapter 20 原本即模組化的 M-00 數位備援被停用語義、未來分類及公共接口，只保留生理相位與回聲抑制，因此美空與紗英只能取得 `PASSIVE-CONCORDANT／STAGE-1`，主動切換仍被禁止。新的 Patient-Root Location Index 正式確認 `G07／08 = 水瀨葵`，外部醫療再取得獨立生命體徵後才通知水瀨佳乃；禁止轉移、禁止設定變更及 C2 外圍保全同步生效。美空卡匣的 Domain-P 則先在同型硬體驗證，再以本地 revocation epoch、session zeroization 及不可遠端回退方式隔離；Domain-C 保留，`CONTINUITY-0` 不能復活同一卡匣，只能另造公共 token。父親 R1 的舊 patient-safety order 也被還原成一項由案件、法院／檢察及醫療共同簽發的臨時保全：它曾阻止七年前 early pilot，卻在案件被重新分類成國安基礎設施事件時沒有遷移患者 hold，之後因承辦失聯與期限到期而失效。R5 新 distributed hold 已獲法院、醫療及患者權利承認，也凍結正常 SHARE-O，中央 policy 甚至已收到 explicit deny；可離線 continuity HSM 不認得這項新式拒絕，只看見「沒有有效營運份額」。最終授權鏈隨後揭露：SHARE-S 綁定確切 TOKYO-7 bundle hash，凪原在本輪前續期後又簽發撤回，但七個離線 HSM 只有四個回傳回執；剩餘三個若在星期日 23:50 夜間 BCP cutover 前仍未撤回，`SHARE-CONT` 便可能因舊狀態機把合法拒絕判成 operational unavailable 而取得資格。23:50 尚不是最終 commit，只是授權組合與六小時套件預置的開始；05:50 才進入 execution。星期六 23:55，第五版的設計裡終於沒有母體。可不到二十四小時後，系統仍準備把所有人的「不」壓縮成一句：沒有收到營運批准。

---

# 25. 最終寫作檢查表

## 時間與結構

- [ ] 章名使用《第五版沒有母體》；
- [ ] 所屬大章維持《知道全貌的澪也錯了》；
- [ ] 本章為第六大段最後一章；
- [ ] 本章發生於第三輪星期六 06:30–23:55；
- [ ] 不跨入星期日；
- [ ] 使用「悠真失蹤事件第十二日」，不暗示悠真仍失蹤；
- [ ] Chapter 23 後安排睡眠、醫療及警方換班；
- [ ] Chapter 25 才正式進入星期日與第七日《不要救東京》。

## R5 治理

- [ ] 正式建立 `KAGAMI-SAFE／R5`；
- [ ] R5 寫成無中央動態 Mother Reference 的目標與過渡規格；
- [ ] 不假裝當輪已完全無母體；
- [ ] `AUTHORSHIP = FEDERATED／NO SINGLE OWNER`；
- [ ] 區分起草、患者權利、法律、系統及公共營運責任；
- [ ] 必要領域不可互相替代；
- [ ] 個別患者啟用不得使用可替代多數表決；
- [ ] 澪拒絕成為單一作者；
- [ ] 千田不成為單一工程決策者；
- [ ] 凪原不成為單一安全決策者。

## 兩種安全邊界

- [ ] 區分 `PATIENT SAFETY ENVELOPE` 與 `NETWORK TRANSITION ENVELOPE`；
- [ ] 每名患者以自己的資料定義患者安全；
- [ ] Network Transition Envelope 由 KAGAMI 遙測、自然／維護切換、M-00 端點及患者安全證明共同生成；
- [ ] 不把 M-00 改名成靜態新母體；
- [ ] 標頭分開 TARGET 與 CURRENT 狀態；
- [ ] `R5 PUBLIC PRIVILEGE = NONE`；
- [ ] 不宣稱 TOKYO public domain 已被 R5 隔離；
- [ ] 不宣稱所有 central fallback 已改成人工批准。

## 紗英的限制性同意與撤回

- [ ] 紗英接受普通語言、兩段式用途詢問；
- [ ] 獨立患者權利代表在場；
- [ ] 關鍵限制反向確認；
- [ ] 模糊或不一致採較窄權限；
- [ ] 紗英同意 patient separation；
- [ ] 紗英拒絕 public use；
- [ ] 紗英拒絕 raw neural stream；
- [ ] 紗英只允許短期 network transition limits；
- [ ] 紗英具有永久 `STOP／NO USE`；
- [ ] 邊界自動過期；
- [ ] 每次新版本重新確認；
- [ ] 撤回發生在過渡前時停止新使用；
- [ ] 撤回發生在過渡中時使用 `SAFE PAUSE`；
- [ ] SAFE PAUSE 只完成回到最近穩定狀態所需的最低醫療操作；
- [ ] 不得以過渡已開始為由永久保留資料；
- [ ] 此同意不追認十年研究。

## 患者本地根與驗證

- [ ] R5 使用患者綁定本地臨床根，不假設人人已有 Domain-C；
- [ ] 美空使用既有 Domain-C；
- [ ] 葵需新生成患者根；
- [ ] `LEGACY／02` 需臨床轉接器；
- [ ] 模型本地生成、原位驗證；
- [ ] `EXPORT LOCKED` 保留；
- [ ] 不輸出患者模型及原始資料；
- [ ] 本地節點不能自己證明自己安全；
- [ ] 使用程式雜湊、硬體 attestation、患者根簽章及獨立醫療感測；
- [ ] 使用雙重時間戳；
- [ ] 不進行新刺激、斷線或活體壓力測試；
- [ ] 使用歷史回放與被動影子；
- [ ] M-00 控制模型回收 Chapter 20 既有備援；
- [ ] 回補舊備援原本即為生理／回聲／語義／未來／公共模組化架構；
- [ ] 只保留生理相位與最低必要回聲抑制；
- [ ] 停用語義、未來分類及公共接口；
- [ ] 狀態使用 `PASSIVE-CONCORDANT／STAGE-1`；
- [ ] 不使用 `PASSIVE-READY`；
- [ ] `FAILOVER READINESS = NOT ESTABLISHED`；
- [ ] M-00 不主動接管；
- [ ] 美空不主動切換。

## 水瀨葵與其他患者

- [ ] Patient-Root Location Index 解釋葵位置為何現在才開示；
- [ ] `G07／08 = 水瀨葵` 得到當輪正式確認；
- [ ] 葵位置與生命狀態分成系統索引及外部醫療兩條證據；
- [ ] 通知佳乃以前取得獨立生命體徵；
- [ ] 葵位置確認後立即發 no-move；
- [ ] 立即發 no-config-change；
- [ ] 現場外圍由警方、兒少及外部醫療保全；
- [ ] 保全控制器日誌、出入口及運送車輛；
- [ ] Chapter 25 才完成正式進場；
- [ ] 水瀨佳乃由正式家屬程序取得最低必要通知；
- [ ] 第七曙光只作家屬代表、資料保全及公開準備；
- [ ] `LEGACY／02` 明確為 HUMAN／ADULT；
- [ ] `LEGACY／02` 姓名保持依法遮蔽；
- [ ] `LEGACY／02` 線在 Chapter 25 以平行進度呈現，不另開第四條主線。

## Domain-P 隔離

- [ ] Domain-P 隔離先在同型退役硬體／模擬器驗證；
- [ ] Domain-P／C 具有獨立供電、時鐘及重置；
- [ ] `QUARANTINE-P` 不觸發全卡 reboot；
- [ ] 隔離操作具醫療停止條件；
- [ ] Domain-P session material 被清除；
- [ ] 本地 revocation epoch 被提升；
- [ ] 原卡匣隔離不可被遠端 institutional root 逆轉；
- [ ] 美空卡匣 Domain-P 原位隔離；
- [ ] Domain-C 保留；
- [ ] 不拔除卡匣；
- [ ] 鏡島端加入序號及 revocation epoch denylist；
- [ ] `CONTINUITY-0` 不能復活美空卡匣；
- [ ] 制度級根只能另簽新公共 token；
- [ ] 不誤寫成所有 public authorization 已消失。

## 父親保全與 distributed hold

- [ ] 父親安全 hold 由案件、法院／檢察及醫療共同簽發；
- [ ] 父親是承辦，不是國家級密鑰持有人；
- [ ] 舊 hold 只阻止七年前 early pilot；
- [ ] 原案件由刑事／患者安全 docket 改分類為國安基礎設施事件；
- [ ] 患者 hold 在 docket 轉換時未被遷移；
- [ ] 原患者代表及外部醫療未獲自動通知；
- [ ] 承辦失聯與期限到期使保全失效；
- [ ] 不把失效簡化成「大家忘記續期」；
- [ ] 本章不揭露父親位置；
- [ ] R5 建立 distributed patient-safety hold；
- [ ] hold 精確顯示法院、醫療、患者權利、TOKYO policy 及 continuity HSM 狀態；
- [ ] hold 凍結 SHARE-O；
- [ ] 中央 explicit deny 已發出；
- [ ] continuity HSM 尚不識別 deny；
- [ ] hold 尚不能阻止 `CONTINUITY-0`。

## SHARE-S 與撤回

- [ ] SHARE-S 綁定確切 TOKYO-7 bundle hash；
- [ ] SHARE-S 綁定 M-00 CAL_REF；
- [ ] SHARE-S 綁定 consensus profile；
- [ ] SHARE-S 綁定 public route set；
- [ ] SHARE-S 有明確有效窗及到期；
- [ ] 舊 SHARE-S 不能配對任意新 payload；
- [ ] 凪原承認在本輪前確認／續期 SHARE-S；
- [ ] 凪原不是本週 execution commit 執行者，也不能藉此免責；
- [ ] 凪原簽發撤回；
- [ ] 撤回需七個離線 HSM 回執；
- [ ] 本章固定為 4／7 已確認、3／7 待處理；
- [ ] 撤回截止為星期日 23:50；
- [ ] 23:50 後離線 BCP 節點不接受普通中央撤回；
- [ ] Chapter 25 可透過節點控制、bundle hash 失效或鏡島拒絕未撤回 share 處理。

## Continuity 狀態機與 23:50

- [ ] 最終授權改為 SHARE-S 加一份營運份額；
- [ ] SHARE-O 為正常營運份額；
- [ ] SHARE-CONT 為 continuity operational share；
- [ ] SHARE-CONT 在 23:50 前不具資格；
- [ ] continuity HSM 只識別 valid operational share／no valid share；
- [ ] 舊 HSM 不識別新式 legal／medical explicit deny；
- [ ] SHARE-O heartbeat 因 hold 停止；
- [ ] 司法凍結與真正失聯在舊狀態機中會被壓縮成 operational unavailable；
- [ ] 凍結 SHARE-O 是必要患者保護，不寫成角色犯蠢；
- [ ] 23:50 後 SHARE-CONT 才取得 operational eligibility；
- [ ] 23:50 只是授權資格與套件預置開始；
- [ ] 23:50 不等於 execution commit；
- [ ] 23:50–05:50 為 bundle 分發、區域驗證、離線路徑及鏡島預熱；
- [ ] 05:50 後才進入 auto-prep、CAL LOCK、consensus preparation 及 execution；
- [ ] 回補 `BCP CUTOVER／23:50` 早期伏筆；
- [ ] `CONTINUITY-0` 不依賴美空卡匣；
- [ ] 本章不揭露 continuity custodian 真人。

## 節奏與 Chapter 25

- [ ] 本章正文只前景化三件事：
  - [ ] 每名患者要有自己的安全範圍與本地節奏；
  - [ ] 美空臨床根與東京公共鑰匙可以分開；
  - [ ] 23:50 後系統會把合法拒絕判成營運不可用；
- [ ] 紗英限制資料用途是情感主高潮；
- [ ] Domain-P 隔離是行動高潮；
- [ ] 葵通知是家屬副高潮；
- [ ] Continuity 揭露是章末鉤子；
- [ ] 本章不完成任何患者主動切換；
- [ ] 本章不救出葵；
- [ ] 本章不完成 `LEGACY／02` 轉接器；
- [ ] 本章不停止 `CONTINUITY-0`；
- [ ] Chapter 25 聚焦三條主線：
  - [ ] C2 現場接管；
  - [ ] continuity 授權阻斷；
  - [ ] 公開證據與患者代表；
- [ ] Chapter 25 不在本章執行最終 06:13 切換。
