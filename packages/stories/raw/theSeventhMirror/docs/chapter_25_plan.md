# 《神鏡七日》Chapter 25 章節企劃 v2.2

## 第 25 章：拒絕不是失聯

所屬大章：**第七日：不要救東京**  
全書位置：**28 小章中的第 25 章**  
章節定位：**第七日開幕／C2 continuity 搬送反制／水瀨葵現場接管／AOI-LOCAL 空容器至患者綁定／SHARE-S 非匯出授權膠囊撤回 6／7／澪拒絕以跨輪記憶取得公共權威／PUBLIC DENY MANIFEST 雙層發布／文件真相與 06:13 人類經驗真相分流／S7 舊韌體快照／無第三簽署者的 CUTOVER AUTH LEASE／局部套件預置開始**  
建議篇幅：**約 10,000–12,000 字**  
視角：**第三人稱限知，緊貼朝倉澪**  
主要類型感：**醫療設施接管、程序對峙、母女重逢但未團圓、授權撤回追逐、公共證據發布、制度倒數**

---

# 0. 本章核心定位

Chapter 24 已完成：

1. `KAGAMI-SAFE／R5` 已正式登錄為 provisional 過渡規格；
2. R5 採用：
   - `AUTHORSHIP = FEDERATED／NO SINGLE OWNER`；
   - 無中央動態 Mother Reference 的目標架構；
   - 每名患者自己的 `PATIENT SAFETY ENVELOPE`；
   - 由 KAGAMI 匯流排遙測、自然切換、M-00 端點限制及患者安全證明共同產生的 `NETWORK TRANSITION ENVELOPE`；
3. 紗英只允許：
   - 使用既有資料協助患者分離；
   - 產生短期、非語義網路過渡限制；

   並明確拒絕：
   - public use；
   - raw neural stream；
   - 永久用途；
4. 紗英具有：
   - `STOP／NO USE`；
   - `SAFE PAUSE`；
   - 自動過期；
   - 每版重新確認；
5. 患者模型只在本地生成；
6. 本地影子輸出必須與不經 KAGAMI 的外部醫療感測交叉；
7. 美空與 M-00 只取得：

```text
PASSIVE-CONCORDANT／STAGE-1
FAILOVER READINESS／NOT ESTABLISHED
ACTIVE SWITCH／PROHIBITED
```

8. 美空卡匣的 `Domain-P` 已被本地、不可遠端逆轉地隔離；
9. `Domain-C` 保留；
10. `CONTINUITY-0` 不能復活美空的同一張卡匣，只能在另一枚制度級 token 或鏡島 HSM 上簽發新的公共授權；
11. `G07／08 = 水瀨葵` 的位置及生命體徵已由：
    - Patient-Root Location Index；
    - 不隸屬 C2 管理鏈的外部醫療；

    雙重確認；
12. C2 已受：
    - no-move；
    - no-config-change；
    - 日誌保全；
    - 外圍控制；
13. R5 distributed patient-safety hold 已獲：
    - 法院；
    - 醫療；
    - 患者權利程序；

    承認；
14. 正常營運份額 `SHARE-O` 已被凍結；
15. 中央在線 policy 已收到明確拒絕；
16. 舊離線 continuity HSM 不識別新式法律／醫療 explicit deny；
17. `SHARE-S` 綁定確切 `TOKYO-7` 套件：

```text
PROFILE HASH          TOKYO-7／<BUNDLE-HASH>
CAL_REF               M-00
CONSENSUS PROFILE     <CONSENSUS-HASH>
PUBLIC ROUTE SET      <ROUTE-HASH>
VALID WINDOW          SUN 23:50–MON 06:20
```

18. 凪原已簽發 SHARE-S 撤回；
19. 七個區域 HSM 保存的是同一 bundle-bound 科學授權的冗餘 escrow mirror；
20. 四個 mirror 已確認撤回，三個仍待處理；
21. `SHARE-CONT` 會在星期日 23:50 continuity cutover 後取得 operational eligibility；
22. 23:50 不是 execution commit；
23. 23:50–05:50 是：
    - 授權租約形成；
    - 套件分送；
    - 區域節點驗證；
    - 離線公共路徑準備；
    - 鏡島預熱；
24. 05:50 以後才進入：
    - auto-prep；
    - CAL LOCK；
    - consensus preparation；
    - execution commit；
25. Chapter 24 在星期六 23:55 結束；
26. 本章正式進入：

> **第七日：不要救東京**

本章必須回答：

> 能否在不移動、不刺激、不立即切換水瀨葵的前提下，真正接管 C2 的醫療、患者權利與控制器程序？  
> 能否把 SHARE-S 的撤回從 4／7 推進到只剩一個離線 release capability？  
> 當離線 continuity 邊界不認得「合法拒絕」，人類如何證明自己不是失聯，而是在清楚說不？  
> 公開真相會保護患者，還是被描寫成破壞東京安全？  
> 23:50 到來時，舊制度會接受排隊中的撤回，還是先以舊 epoch 製造一份跨越整個回聲窗的當輪授權租約？

本章集中三條主線：

### A. C2 現場接管

- 阻止以 continuity 名義發起的患者搬送；
- 外部醫療、兒少保護與司法程序進場；
- 確認葵本人及當輪生命狀態；
- 保持患者在原病床、原治療與原閉環；
- 在**外部臨床 sidecar** 中先建立不含患者資料的 `UNBOUND KEY CONTAINER`；
- 佳乃完成獨立視訊及床邊確認後，才將容器綁定為 `AOI-LOCAL／PROVISIONAL`；
- 綁定後只啟動 Stage-0 baseline capture，不寫入 C2 原控制器，不進行主動切換。

### B. Continuity 授權阻斷

- 取得 C2 facility continuity enclave 與 EAST-METRO mirror 的撤回回執；
- 將 SHARE-S 撤回推進至 6／7；
- 明確最後一個 S7 mirror 保存的是不可匯出、bundle-bound 的 release capability；
- 將撤回 envelope 送入 S7 cutover 更新佇列；
- 追查舊韌體是否在處理撤回前先建立當輪授權租約；
- 準備使 bundle hash、區域接受規則或鏡島 token 失效。

### C. 公開證據與患者代表

- 發布只包含最低必要內容的 `PUBLIC DENY MANIFEST`；
- 將 6／7、S7、HSM 結構等細節留在封緘技術附件；
- 明確說明普通公共警報、交通服務與保護性原始過濾仍在運作；
- 讓普通公眾只取得 Manifest、文件索引、hash commitment 與少量核實選段；
- 將完整經遮蔽 archive 僅交給法院、外部醫療及授權媒體查驗；
- 將夢話、第一人稱感覺、黑色海與受試者共同記憶碎片保留至 06:13 的最終同步；
- 使用多源 attestation 觸發分層公開；
- 面對主管機關反駁、媒體核驗與患者隱私爭議；
- 防止 continuity authority 將整場接管描述成「無人維持東京安全」。

### D. 澪的證據選擇

- 有人提議把澪對前兩輪千田死亡、R4 及未來 06:13 的記憶放入 Manifest，以提高輿論衝擊；
- 澪拒絕：
  > 「那是我知道的，不是現在所有人能共同證明的。」
- 她選擇不讓只有自己掌握的全貌取得公共授權；
- 她只允許可由當輪交通、醫療、法院、營運及硬體資料共同驗證的事實進入公共證據。

本章不能：

- 完成 06:13 最終切換；
- 讓葵脫離中央；
- 讓 R5 進入主動控制；
- 揭露 continuity custodian 真人；
- 解決所有紅區患者；
- 將七秒誤寫成全系統關機窗口；
- 讓 Public Deny Manifest 本身直接令 HSM停機；
- 在 23:50 向所有公眾提前公開完整夢話、第一人稱受試者碎片或黑色海經驗，削弱 06:13 的終局同步；
- 將澪的跨輪記憶冒充當輪公共證據。

本章的核心問題是：

> 當系統只懂「收到批准」或「營運不可用」，人類能否把一份明確的「不」變成它無法再假裝不存在的現實？

---

# 1. Chapter 24 結束狀態

| 線索／角色 | Chapter 25 開始狀態 |
|---|---|
| 朝倉澪 | 已拒絕 R4 及單一作者；準備把患者接管、授權阻斷與公開證據整合。 |
| 朝倉紗英 | 仍在中央閉環；只授權短期非語義過渡用途；可撤回。 |
| 朝倉悠真 | 已完成外部醫療及參照安全切離；仍在休養。 |
| 藤川美空 | Domain-P 已隔離；Domain-C 保留；Stage-1 被動相符，仍未離線。 |
| 水瀨葵 | `G07／08`；十四歲；C2 內仍活著；no-move、no-config-change 生效；尚未正式接管。 |
| 水瀨佳乃 | 已獲最低必要通知；尚未到床邊；為葵法定代理程序核心。 |
| 白石琴音 | 受調查並有限合作；不參與 C2 操作；可說明家屬支援流程。 |
| 千田浩介 | 受保護的技術起草者；協助患者根、capsule 撤回及 bundle 驗證。 |
| 日下部悟 | 協調 C2 程序、Manifest、證據庫及 continuity 授權鏈。 |
| 凪原唯 | 已簽發 SHARE-S 撤回；4／7 mirror 回執；必須協助剩餘撤回。 |
| SHARE-S | 綁定確切 TOKYO-7 bundle；4／7 release capability 已撤回。 |
| SHARE-O | FROZEN；中央 explicit deny 存在。 |
| SHARE-CONT | ARMED／INELIGIBLE，將於 23:50 取得資格。 |
| CONTINUITY-0 | 可簽發新公共營運 token；custodian 封緘。 |
| distributed hold | 法律、醫療、患者權利有效；continuity HSM 尚不認得。 |
| `LEGACY／02` | 函館平行團隊處理患者根轉接器；本章只作進度更新。 |

---

# 2. 時間線與節奏

Chapter 25 發生於：

> **第三輪，星期日 05:40 至 23:52。**  
> **悠真失蹤事件第十三日。**

Chapter 24 於星期六 23:55 結束後：

- 醫療、警方與技術人員採輪班；
- 澪至少完成約四小時睡眠；
- C2 外圍及區域 HSM 由其他班次持續保全；
- 不讓所有核心角色連續工作二十四小時。

| 時間 | 事件 |
|---|---|
| 05:40–06:40 | C2 continuity broker 自動產生 relocation proposal；C2 值班醫療主管確認；搬送車抵達後被 no-move 即時阻止。 |
| 06:40–08:50 | 外部醫療、兒少保護及司法程序進入 C2；直接床側確認葵、治療狀態及控制器；佳乃先透過外部醫師的獨立即時視訊看見葵。 |
| 08:50–11:30 | 在外部臨床 sidecar 建立 `AOI-LOCAL KEY CONTAINER／UNBOUND`；不寫入患者資料或 C2 控制器；C2 facility continuity enclave 接受 SHARE-S 撤回。 |
| 11:30–12:30 | EAST-METRO mirror 返回回執；撤回達 6／7；最後一個 S7 mirror 仍有效。 |
| 12:30–13:25 | 進食、輪班、佳乃與葵醫療程序休息。 |
| 13:25–15:40 | 佳乃第一次走到葵床邊；外部醫師再次確認患者後，才將空容器綁定為 `AOI-LOCAL／PROVISIONAL` 並啟動 Stage-0 baseline capture。 |
| 15:40–18:10 | 澪拒絕將跨輪記憶放入公共證據；發布 `PUBLIC DENY MANIFEST` 核心頁；主管機關反駁、媒體核驗、普通營運方澄清；完成文件真相與 06:13 人類經驗真相的公開分層。 |
| 18:10–20:35 | 公共證據庫進入多點託管；發布條件切換為多源 attestation；S7 撤回 envelope 及法院／醫療 deny 排隊。 |
| 20:35–23:35 | 找到舊 BCP 文件對 snapshot-before-queue 的不完整提示；法院要求人工暫停，凪原重簽高優先撤回，鏡島及區域節點部署 bundle hash 告警。 |
| 23:35–23:50 | 所有人類程序再次重申 `PRESENT／DENIED`；S7 仍無回執；continuity-controlled nodes 進入 cutover 監看。 |
| 23:50–23:52 | Science escrow HSM 與 Continuity operational HSM 分別產生 token；共同形成 `CUTOVER AUTH LEASE`；queued revocation 更新下一 epoch；局部 package preposition 開始。 |

倒數：

| 時點 | 距 23:50 cutover | 距星期一 05:50 auto-prep | 距星期一 06:13 |
|---|---:|---:|---:|
| 星期日 05:40 | 約 18 小時 10 分 | 約 24 小時 10 分 | 約 24 小時 33 分 |
| 星期日 18:10 | 約 5 小時 40 分 | 約 11 小時 40 分 | 約 12 小時 3 分 |
| 星期日 23:35 | 約 15 分 | 約 6 小時 15 分 | 約 6 小時 38 分 |
| 星期日 23:52 | cutover 已開始 | 約 5 小時 58 分 | 約 6 小時 21 分 |

---

# 3. 必須同步的跨章補丁

## 3.1 Chapter 24：SHARE-S 不是普通簽章檔案

正式回補：

七個 HSM 保存的不是可被複製的已完成簽章，而是：

> **`SCIENCE AUTHORIZATION CAPSULE`**

```text
SCIENCE AUTHORIZATION CAPSULE
BUNDLE HASH       TOKYO-7／<BUNDLE-HASH>
KEY MATERIAL      NON-EXPORTABLE
RELEASE           ONE-TIME／WINDOW-BOUND
REVOCATION EPOCH  LOCAL
VALID WINDOW      SUN 23:50–MON 06:20
```

每個 mirror：

- 持有同一科學角色授權的冗餘非匯出 release capability；
- 只能為精確 bundle hash 產生一次當輪 science token；
- 不能輸出私鑰；
- 不能替其他 bundle 簽署。

撤回回執的含義：

- 增加該 mirror 的 revocation epoch；
- 銷毀當輪 release handle；
- 令該 mirror 無法再產生 science token。

七個 mirror 不是七票。

任一仍有效的 mirror 都能產生完整 science token。

## 3.2 C2 mirror 與患者控制器分離

C2 的 SHARE-S mirror 位於：

> **C2 facility continuity enclave／災害復舊機櫃**

它與：

- 葵床側控制器；
- AOI-LOCAL sidecar；
- 患者根；
- 葵醫療資料；

物理及權限分離。

C2 mirror 撤回：

- 不改變葵治療；
- 不接觸患者根；
- 不使用患者資料。

## 3.3 `AOI-LOCAL` 不違反 no-config-change

葵患者根建立於：

> **外部臨床 HSM sidecar**

```text
AOI-LOCAL／PROVISIONAL
LOCATION          EXTERNAL CLINICAL SIDECAR
CONTROL OUTPUT    NONE
C2 CONFIG WRITE   NONE
PUBLIC PRIVILEGE  NONE
MODEL EXPORT      PROHIBITED
```

sidecar：

- 只讀取得外部醫療感測；
- 只讀取得依法保全的 C2 遙測；
- 不寫入原 C2 控制器；
- 不改變中央閉環；
- 不觸發 fallback；
- 不具有主動控制輸出。

## 3.4 Chapter 24：三個待回執 mirror

正式鎖定：

1. **C2 FACILITY CONTINUITY ESCROW**
2. **EAST-METRO BCP ESCROW**
3. **S7 SCIENCE ESCROW／CONTINUITY VAULT**

前兩個在 Chapter 25 返回撤回回執。

最後一個仍有效。

## 3.5 Chapter 24：S7 公平伏筆

星期日白天取得舊 BCP 文件：

```text
CUTOVER EPOCH SNAPSHOT
MAINTENANCE QUEUE APPLY／POST-SNAPSHOT
```

但當時仍不知道：

- S7 實際韌體是否沿用舊順序；
- queued revocation 是否具 emergency priority；
- custodian 是否可在 snapshot 前人工暫停。

因此團隊仍合理地：

- 提交撤回；
- 尋找 custodian；
- 準備 bundle hash 阻斷；
- 準備鏡島拒絕；
- 公開明確拒絕。

23:50 的失敗是已被公平提示的最壞分支被證實，不是最後一刻新增規則。

## 3.6 Chapter 10–24：公共證據包已預先遮蔽

公共證據庫不是星期日下午臨時整理全部資料。

Chapter 21–24 已逐步完成：

- 證據分類；
- 患者身分遮蔽；
- 法律審查；
- 家屬／患者代表審查；
- 技術秘密刪除；
- 可公開 hash 建立。

Chapter 25 只加入：

- 最新 Manifest；
- 撤回狀態；
- C2 接管證明；
- cutover attestation。

## 3.7 Chapter 14：七秒仍只作末端手機路徑

本章只監看：

- 官方手機應用路徑；
- `+7000ms` 補正；
- 尚未送出 payload；
- app channel 狀態。

本章不能：

- 使用七秒撤回已播廣播；
- 把七秒當成 cutover 或硬切倒數；
- 提前執行最終手機路徑封鎖。

## 3.8 Chapter 24：23:50 至 06:13 三階段

正文須持續區分：

1. **23:50：授權租約形成**
2. **23:50–05:50：局部套件預置**
3. **05:50 以後：auto-prep／CAL LOCK／consensus preparation**
4. **06:13：回聲窗**

---

## 3.9 七個 science escrow mirror 的運用理由

七個 mirror 不是因故事偏愛「七」而任意配置。

作者層鎖定為七個 trust domain：

1. 北部災害備援域；
2. 東部都會營運域；
3. 中部區域域；
4. 西部區域域；
5. 南部區域域；
6. 全國臨床 continuity 域；
7. 國家級離線 continuity vault。

C2 facility continuity enclave 屬於第六類臨床 continuity domain。

它並非因葵恰好在 C2 才突然出現，而是該設施本來就是全國臨床災害復舊網的一個節點。

## 3.10 文件真相與 06:13 人類經驗真相分流

Chapter 25 公開的是：

- bundle hash；
- 法院、醫療與營運拒絕；
- 搬送、醫院及患者依存的經遮蔽證據；
- 系統確實在明確拒絕下取得 continuity 授權的文件鏈。

它能證明：

> TOKYO-7 沒有合法營運同意，而且仍有患者尚未安全切離。

它不能取代 06:13 將支付的：

- 受試者第一人稱片段；
- 夢話與感覺；
- 名字與被帶走前的生活；
- 黑色海與病房經驗；
- 無法被簡化成一份政策文件的人類記憶。

因此：

> 文件讓世界知道有人正在拒絕。  
> 06:13 的真相碎片，才讓世界知道那些被當成代價的人經歷了什麼。

---

# 4. C2 的 relocation：誰提出、誰確認

## 4.1 兩階段啟動

C2 continuity 搬送不是含糊地「自動或某人啟動」。

正式鎖定：

```text
RELOCATION PROPOSAL    AUTO-GENERATED
SOURCE                 CLINICAL CONTINUITY BROKER

MEDICAL AFFIRMATION    C2 ON-CALL MEDICAL DIRECTOR
REASON                 PATIENT STABILITY／EXTERNAL CONTROL CONFLICT

TRANSPORT DISPATCH     CONTINUITY BROKER
DESTINATION            EAST CONTINUITY MEDICAL HUB／SEALED ROUTE
```

目的地是既有 continuity 醫療轉運網的一個高依存轉運中心。

它不是新的核心祕密設施，也不另開一條未解謎團。

## 4.2 no-move、醫療例外與車輛出發

no-move 命令只保留極窄的醫療緊急例外：

- 患者出現即時生命危險；
- 原設施無法提供必要治療；
- 必須由一名與原管理鏈無利益關係的獨立醫師確認；
- 搬送期間須即時通知法院及患者代理。

C2 continuity broker 的舊 policy 將：

> `EXTERNAL CONTROL CONFLICT`

自動分類為可能危及患者穩定，因而可以先產生 relocation proposal。

C2 值班主管：

- 知道 no-move 存在；
- 以患者穩定為理由作內部 medical affirmation；
- 卻沒有取得必要的獨立醫師確認；
- 因此只能讓承包商車輛被預派，不能合法使患者離床。

搬送工單在承包商收到完整 no-move 執行通知以前發出。

車輛抵達後：

- 外部獨立醫師明確否決緊急例外；
- 法院、兒少及外部醫療阻止患者進入搬送流程；
- 葵尚未離床，也沒有被接上搬送設備。

這不是：

> C2 已合法取得搬走葵的權力。

而是：

> continuity 流程試圖利用工單與時間差，讓搬送先成為既成事實。

## 4.3 C2 值班主管的責任

值班主管：

- 不必是終局惡人；
- 真心相信外部接管增加失穩風險；
- 知道 no-move 存在；
- 仍以醫療緊急例外確認 relocation；
- 必須面對程序與醫療判斷審查。

## 4.4 C2 醫護並非同一意志

本章須顯示：

- 有人相信搬送較安全；
- 有人只遵循合法工單；
- 有護理／生體工學人員願意提供真實日誌；
- 有人反對外部進場，但不是為隱藏公共計畫；
- 外部接管不把所有院內人員當共犯。

制度問題是：

> 各自善意的人只看見自己負責的一段安全，卻共同把患者留在一個永遠不允許拒絕的系統裡。

---

# 5. 水瀨葵的現場接管與外部 sidecar

## 5.1 接管不是立即移動

外部團隊進入 C2 後：

1. 葵留在原病床；
2. 現有生命支持不變；
3. 中央閉環暫不改變；
4. 不更改鎮靜／刺激；
5. 不重置控制器；
6. 不變更遠端路由；
7. 外部醫療取得共同監督；
8. 原管理鏈失去單方面設定權。

「接管」的精確含義是：

> 法律、醫療及患者權利控制權改變；患者身體與治療暫不冒險移動。

## 5.2 葵的獨立現場確認

由不隸屬 C2 管理鏈的外部醫師：

- 目視確認本人；
- 核對姓名、生日與既有醫療識別；
- 使用外部設備取得：
  - 腦電；
  - 呼吸；
  - 自律；
  - 當輪生命體徵；
- 不以 C2 系統摘要作唯一證據。

葵：

- 有生命體徵；
- 未建立自由溝通；
- 不在本章醒來或說出完整內容；
- 任何眼瞼、呼吸或反射變化均標記為：
  > 是否屬隨意／辨認反應無法判定。

## 5.3 佳乃先透過獨立即時視訊確認

在簽署患者根以前：

- 外部醫師於病房內；
- 視訊由外部設備建立；
- 佳乃看到：
  - 葵本人；
  - 外部醫師；
  - 當輪時間；
  - 不經 C2 剪輯的即時畫面。

這是佳乃第一次在當輪直接看見女兒仍在 C2。

她尚未到床邊。

## 5.4 上午：建立未綁定安全容器

佳乃透過獨立即時視訊確認葵仍在 C2 後，同意先建立一個不含患者資料的外部安全容器。

```text
AOI-LOCAL KEY CONTAINER
STATUS            UNBOUND／PROVISIONAL
LOCATION          EXTERNAL CLINICAL SIDECAR
CONTROL OUTPUT    NONE
C2 CONFIG WRITE   NONE
PUBLIC PRIVILEGE  NONE
PATIENT DATA      NONE
```

上午只完成：

- sidecar 硬體與程式 attestation；
- 空金鑰容器生成；
- 權限限制；
- 只讀資料路徑檢查；
- 不開始 baseline；
- 不把容器標記為葵的正式患者根。

該容器：

- 不含葵模型；
- 不含美空資料；
- 不含 M-00 原始資料；
- 無法簽發 Domain-P；
- 無法啟動鏡島；
- 不修改原控制器。

## 5.5 下午：患者綁定與 Stage-0 baseline

佳乃走到葵床邊後：

1. 外部醫師再次確認患者本人；
2. 患者權利代表重述用途與限制；
3. 佳乃完成患者代理確認；
4. 空容器才正式綁定為：

```text
AOI-LOCAL／PROVISIONAL
PATIENT BINDING    G07／08／水瀨 葵
STATUS             PROVISIONAL／BOUND
LOCATION           EXTERNAL CLINICAL SIDECAR
PUBLIC PRIVILEGE   NONE
MODEL EXPORT       PROHIBITED
ACTIVE CONTROL     PROHIBITED
C2 CONFIG WRITE    NONE
```

綁定後才啟動：

```text
LOCAL SHADOW
SUBJECT          G07／08
MODE             BASELINE CAPTURE／PASSIVE
MODEL STATUS     BUILDING
ACTIVE OUTPUT    NONE
CENTRAL CONTROL  UNCHANGED
```

資料來源：

- 葵在 C2 的既有本地醫療資料；
- 失蹤前由佳乃依法提供的醫療資料；
- 外部腦電、呼吸與自律感測；
- 原控制器只讀遙測。

本章不能讓葵取得：

- `PASSIVE-CONCORDANT`；
- failover readiness；
- 主動切換資格。

她只完成：

> 從中央管理碼，轉成擁有自己患者根與本地基線的具名患者。

## 5.6 佳乃第一次走到床邊

下午，在醫療判斷允許下，佳乃進入床邊。

她叫葵名字。

葵可能：

- 呼吸節奏改變；
- 眼瞼微動；
- 沒有可靠意識反應。

醫療記錄保持克制。

佳乃說：

> 「我來了。妳不用現在回答。」

她對澪說：

> 「我不要你們再把她從一個系統，搬進另一個系統。」

此句成為葵線的倫理界線，也成為她同意患者綁定的條件。


# 6. SHARE-S 撤回：非匯出授權膠囊由 4／7 到 6／7

## 6.1 七個 mirror 保存的是 release capability

正式技術定義：

```text
SCIENCE AUTHORIZATION CAPSULE
BUNDLE HASH       TOKYO-7／<BUNDLE-HASH>
KEY MATERIAL      NON-EXPORTABLE
RELEASE           ONE-TIME／WINDOW-BOUND
REVOCATION EPOCH  LOCAL
VALID WINDOW      SUN 23:50–MON 06:20
```

每個 HSM mirror：

- 不保存可任意複製的簽章檔案；
- 保存同一科學授權的非匯出 release capability；
- 只能為精確 bundle hash 產生一次 science token；
- 無法替另一份 bundle 簽署；
- 無法輸出私鑰。

撤回回執代表：

- 當地 revocation epoch 已增加；
- 本輪 release handle 被銷毀；
- 該 mirror 無法再產生 science token；
- `PRIOR RELEASE COUNT = 0`；
- `TOKEN ISSUED = NO`。

若任何 mirror 顯示 prior release count 大於零，該 token 必須另行追查，不能只視為已撤回。

作者層鎖定：

> 前六個 mirror 均未在撤回前釋放 token；只有 S7 在 23:50 產生當輪 science token。

因此：

- 七個 mirror 不是七票；
- 六個撤回不會削弱最後一個 token 的「份量」；
- 只要最後一個 mirror 仍有效，它仍能產生完整 SHARE-S。

千田的正文翻譯：

> 「那不是投票。最後一個裡面，還是一整份。」

## 6.2 C2 facility continuity enclave

C2 的科學 escrow mirror 位於：

> **C2 facility continuity enclave**

位置及權限與：

- 葵床側控制器；
- AOI-LOCAL sidecar；
- 患者根；
- 葵原始醫療資料；

分離。

C2 接管後：

1. 司法保全確認 continuity enclave；
2. 系統安全核對 exact bundle hash；
3. 凪原撤回被載入；
4. HSM 增加 revocation epoch；
5. 產生不可改寫回執。

```text
C2 SCIENCE CAPSULE
REVOCATION          APPLIED
PRIOR RELEASE COUNT 0
TOKEN ISSUED        NO
RELEASE HANDLE      DESTROYED
RECEIPT             VALID
```

此操作不觸碰葵患者控制鏈。

撤回進度：

```text
ACKNOWLEDGED      5／7
```

## 6.3 EAST-METRO BCP escrow

平行公共營運安全團隊處理：

> `EAST-METRO BCP ESCROW`

程序：

- 法院與營運安全共同進場；
- 核對 bundle hash；
- 進入實體維護模式；
- 載入凪原撤回；
- 取得 HSM receipt。

結果：

```text
EAST-METRO SCIENCE CAPSULE
REVOCATION          APPLIED
PRIOR RELEASE COUNT 0
TOKEN ISSUED        NO
RELEASE HANDLE      DESTROYED
RECEIPT             VALID

ACKNOWLEDGED        6／7
PENDING             S7／CONTINUITY VAULT
```

正文不另開完整場景。

以一則平行成功更新支付。

## 6.4 最後一個 S7 science escrow

```text
S7 SCIENCE ESCROW
STATE             OFFLINE／CUTOVER-BOUND
CAPSULE           VALID
REVOCATION        PENDING
UPDATE WINDOW     SUN 23:50
CUSTODIAN         SEALED
```

它與 `CONTINUITY-0` 位於同一 **continuity governance boundary**，但不是同一把密鑰或同一 HSM。

### Science escrow HSM

- 只保存 SHARE-S capsule；
- 只能產生 science token；
- 不能簽發 operational token。

### Continuity operational HSM

- 保存 `CONTINUITY-0`；
- 只能產生 SHARE-CONT 及臨時公共 token；
- 不能產生 SHARE-S。

兩者：

- 密碼學上分離；
- 有不同金鑰、policy 及 audit；
- 受同一 continuity governance 於同一 cutover 事件驅動；
- 都不認得新的中央 explicit deny。

真正的制度缺陷是：

> 兩把獨立的鑰匙沒有在密碼學上變成一把。  
> 可它們被放進同一個不理解拒絕的制度邊界，並在同一時刻自動取得資格。

## 6.5 七個 mirror 的 trust-domain 配置

七個 mirror 的存在具有實際災害復舊理由。

作者層配置為：

1. 北部災害備援域；
2. 東部都會營運域；
3. 中部區域域；
4. 西部區域域；
5. 南部區域域；
6. 全國臨床 continuity 域；
7. 國家級離線 continuity vault。

C2 facility continuity enclave 屬於第六類臨床 continuity domain。

因此：

- 它不是因葵位於 C2 才方便地出現；
- 它本來就是全國臨床災害復舊架構的一部分；
- 七個 mirror 是高可用性與地理／功能分域的結果，不只是七日象徵。

## 6.6 6／7 的證據尺度

6／7 是真實進展：

- 六個區域 release capability 已被銷毀；
- 普通區域節點無法再釋放 SHARE-S；
- 有效科學授權來源收斂至 S7。

但不是成功：

- S7 仍能產生完整 science token；
- 6／7 不能被當成過半；
- 公開 Manifest 不直接顯示 6／7；
- 細節只保留在封緘技術附件。

---

# 7. `PUBLIC DENY MANIFEST`：普通語言核心頁與封緘附件

## 7.1 為何需要公開拒絕

中央在線層已知道：

- SHARE-O 被凍結；
- 法院、醫療及患者程序反對；
- 營運 heartbeat 仍存在。

舊離線 continuity 邊界卻不識別這種新式 explicit deny。

公開 Manifest 的目的不是直接控制 HSM。

而是建立一項不可被事後改寫的公共事實：

> 營運方、醫療、法院及患者代表都在場。  
> 他們正在拒絕精確的 TOKYO-7 bundle。

## 7.2 公開核心頁

普通人可讀摘要：

> 普通防災警報、交通服務與保護性訊號過濾仍正常運作。  
> 被拒絕的是指定的 TOKYO-7 同步套件。  
> 公眾不需前往任何醫療、研究或交通設施。

可驗證機器欄位：

```text
PUBLIC DENY MANIFEST

PACKAGE                       TOKYO-7／<BUNDLE-HASH>
OPERATIONS STATUS             PRESENT
AUTHORIZATION                 DENIED
NORMAL OPERATIONAL SHARE      FROZEN／EXPLICIT DENY
SCIENCE AUTHORIZATION         REVOCATION ISSUED
REVOCATION STATUS             NOT FULLY ACKNOWLEDGED

COURT HOLD                     ACTIVE
MEDICAL HOLD                   ACTIVE
PATIENT-RIGHTS HOLD            ACTIVE
PATIENT DEPENDENCY             UNRESOLVED

ORDINARY SERVICES              ACTIVE
PROTECTIVE FILTERING           ACTIVE
TOKYO-7／<BUNDLE-HASH>         DENIED
PUBLIC ACTION REQUIRED         NONE
```

`RAW SIGNAL FILTER`、capsule epoch 及內部 hold ID 只留在封緘附件。

公開核心頁不顯示：

- 6／7；
- S7；
- HSM 類型；
- continuity vault；
- 撤回路由；
- 可被利用的內部節點資訊。

## 7.3 核心公開句

> **營運方沒有失聯。它正在拒絕。**

第二句：

> **拒絕 TOKYO-7，不等於停止普通警報、交通服務或保護性原始過濾。**

第三句：

> **請勿前往研究、醫療或基礎設施設施；公眾不需採取任何現場行動。**

這避免「不要救東京」被誤解為：

- 停止所有防災；
- 破壞交通；
- 鼓勵群眾前往設施；
- 讓東京自行承擔危險。

## 7.4 封緘技術附件

只向：

- 法院；
- 公共營運安全；
- 外部醫療合規；
- 授權媒體查驗人員；
- 患者權利監督；

開放。

附件包括：

- 6／7 mirror 回執；
- S7 pending；
- authorization capsule 定義；
- bundle hash 全欄；
- SHARE-S 撤回時間；
- continuity cutover 風險；
- distributed hold 的精確狀態；
- 不含患者原始神經資料。

## 7.5 多方簽署範圍

Manifest 不是由澪單獨發布。

各方只簽自己的事實：

- 公共營運方：
  - operations present；
  - bundle authorization denied；
  - ordinary services active；
- 法院／司法程序：
  - hold 有效；
- 外部醫療：
  - 患者依存未解除；
  - raw filter 仍需維持；
- 患者權利代表：
  - 未完成個別安全切離；
- 獨立系統安全：
  - exact bundle hash；
  - 公開欄位與封緘附件一致。

## 7.6 官方與媒體反應

Manifest 上線後，主管機關發布：

> 文件屬未完成調查資料，公開可能危害患者與關鍵基礎設施安全。

公共營運方以自身簽章回應：

> 普通警報、交通調度與原始訊號過濾仍正常。被拒絕的是具體 TOKYO-7 bundle。

媒體反應分裂：

- 部分媒體先只發布 Manifest；
- 部分要求核驗 bundle hash 後才報道；
- 部分接受主管機關說法，暫稱文件「真偽未定」；
- 經授權安全編輯室可查驗封緘附件，但不能公開患者位置及 HSM 路由。

第七曙光內部亦出現分歧：

- 有家屬希望公開所有姓名；
- 醫療與患者權利代表要求繼續遮蔽；
- 最終採用：
  > 患者安全優先於即時輿論效果。

這證明：

> 公開真相不是按下一個輿論勝利按鈕。

---

## 7.7 澪拒絕讓跨輪記憶取得公共權威

Manifest 準備期間，有人提出：

- 澪可以公開自己記得千田兩次死亡；
- 公開 R4 的可能未來；
- 公開自己知道 06:13 曾經發生過什麼；
- 以此提高媒體與公眾對危機的信任。

這對輿論非常有吸引力。

澪拒絕：

> 「那是我知道的，不是現在所有人能共同證明的。」  
> 「不能因為這一次我相信自己，就把它寫成所有人必須相信的證據。」

她允許進入公共證據的只有：

- 當輪交通與門禁；
- 醫院轉移；
- 患者依存；
- 法院與醫療 hold；
- bundle hash；
- 營運拒絕；
- 可由多方查驗的硬體與授權資料。

跨輪記憶仍可：

- 供當輪行動風險判斷；
- 供澪個人陳述；
- 保存在受保護調查附錄中。

不能：

- 取代公共物證；
- 成為世界必須服從澪的理由；
- 被包裝成已由所有人確認的事實。

這是澪在本章最不可替代的選擇：

> 她放棄一項只有自己能提供、卻無法共同驗證的強大說服工具。

---

# 8. 公共證據庫：三層真相與多源觸發

## 8.1 與 Manifest 分開

Manifest 是簡短、可立即查驗的公共拒絕。

完整證據另建立：

> **`PATIENT／TOKYO-7 EVIDENCE VAULT`**

用途：

- 防止官方事後刪改；
- 讓法院、醫療、媒體與家屬共享同一證據基礎；
- 防止 continuity authority 將患者接管描述成無依據破壞。

## 8.2 已在前章完成的工作

Chapter 21–24 已逐步完成：

- 證據分類；
- 身分遮蔽；
- 病房位置遮蔽；
- 醫療最低必要化；
- 家屬／患者代表審查；
- 法律審查；
- 可公開 hash；
- 技術密鑰與操作細節刪除。

Chapter 25 只加入：

- Manifest；
- 最新撤回回執；
- C2 接管證明；
- cutover lease／preposition attestation；
- 官方與營運方公開反應。

## 8.3 證據來源

只使用已保全資料：

- 原始交通及搬送紀錄；
- 門禁與工單；
- 醫院轉移；
- 患者管理碼及依法可公開的身分證明；
- R1–R5 metadata；
- 父親舊 hold docket；
- bundle hash；
- science capsule 撤回 receipt；
- SHARE-O explicit deny；
- 外部醫療經遮蔽結論；
- C2 no-move／no-config-change；
- 美空 Domain-P 隔離結果。

## 8.4 三層發布

### A. 普通公眾

23:50 後只公開：

- Public Deny Manifest；
- 文件索引；
- hash commitments；
- 少量已核實、已遮蔽的交通／醫院／工單選段；
- ordinary services 仍運作的說明。

### B. 法院、外部醫療及授權媒體

可查驗：

- 完整經遮蔽 archive；
- 交通、醫院、工單及患者依存鏈；
- 6／7 撤回及封緘技術附件；
- cutover lease 與區域 preposition 證據。

不得公開患者原始資料或操作密鑰。

### C. 保留至 06:13 的人類經驗真相

Chapter 25 不向大眾大規模公開：

- 夢話錄音完整內容；
- 受試者第一人稱感覺；
- 黑色海經驗；
- 被帶走前的生活片段；
- 可能與回聲窗共振的個人音訊；
- 未成年人可被重新識別的私人敘述。

這些不是為了製造懸念而壓住證據。

而是因為：

- 它們不是 Manifest 所需的最低法律事實；
- 其中部分含患者高度私人內容；
- 最終 06:13 的同步將支付「受試者自己如何被世界聽見」，而不是重播一份已發布文件。

## 8.5 不公開內容

- 原始神經流；
- 患者局部模型；
- 未證實外星來源；
- 精確病房；
- continuity vault 路由；
- R5 實作密鑰；
- 06:13 現場行動細節。

澪的跨輪記憶亦不列為公共事實證據。

## 8.6 多點託管

證據庫分別由：

- 法院／律師；
- 外部醫療聯盟；
- 公共營運合規；
- 第七曙光家屬代理；
- 多家媒體安全編輯室；
- 獨立時間戳／公證服務；

保存。

沒有單一人可：

- 單獨修改；
- 單獨刪除全部副本；
- 單獨發布未遮蔽內容。

## 8.7 多源釋放條件

普通公眾摘要與 hash index 的 cutover 更新，至少滿足下列 **2-of-3**：

1. continuity authority 發出與 exact bundle hash 綁定的授權 lease attestation；
2. `KAGAMI-01` 獨立監看回報同一 bundle hash 的 token 接受、warmup 或預置佇列；
3. 至少兩個彼此獨立的區域分發節點回報同一 bundle hash 的 preposition。

每項來源須具：

- 獨立時間戳；
- 來源簽章；
- exact bundle hash；
- release policy 版本。

完整經遮蔽證據包 的機構查驗可同步更新，但不向所有公眾無差別發布。

其他緊急觸發可包括：

- C2 患者再次被移動；
- 法院、醫療及營運聯絡窗口同時失聯；
- 已保全資料遭不可解釋 hash 變更。

任何患者資料公開仍只限預先遮蔽版本。

## 8.8 第七曙光的角色

第七曙光負責：

- 家屬證詞；
- 失蹤日期；
- 官方改寫前的外部資料；
- 患者語言；
- 遮蔽審查；
- 監督文件不要再次只剩代碼。

它不：

- 操作 HSM；
- 進入 C2 控制器；
- 決定 R5；
- 公開精確位置；
- 代表所有患者同意；
- 提前公開保留至 06:13 的第一人稱碎片。

---

# 9. S7：科學 escrow 與 operational root 的制度性集中

## 9.1 同一 governance，不是同一把密鑰

S7 continuity authority 內存在兩套密碼學分離設備。

### S7 Science Escrow HSM

- 保存 SHARE-S authorization capsule；
- 只能產生 science token；
- 不能產生 operational token。

### Continuity Operational HSM

- 保存 `CONTINUITY-0`；
- 只能產生 SHARE-CONT 及臨時公共 token；
- 不能產生 SHARE-S。

兩者：

- 金鑰分離；
- policy 分離；
- audit 分離；
- 不能互相替代簽署。

制度性錯誤在於：

> 兩套獨立安全域受同一 continuity governance 在同一 cutover 事件自動驅動，而該 governance 不認得明確拒絕。

## 9.2 白天可見的舊文件

團隊找到舊 BCP 文件：

```text
CUTOVER EPOCH SNAPSHOT
SCIENCE ELIGIBILITY    LOCAL EPOCH
OPERATIONAL STATUS     LOCAL POLICY
MAINTENANCE QUEUE      APPLY／POST-SNAPSHOT
```

但仍不知道：

- S7 實際韌體版本；
- queued revocation 是否有 emergency priority；
- custodian 是否可手動暫停；
- snapshot 是否會產生當輪 lease。

因此白天仍必須：

- 送撤回 envelope；
- 發法院暫停要求；
- 由凪原重簽高優先撤回；
- 尋找 custodian；
- 佈署 bundle hash 告警；
- 準備鏡島及區域拒絕。

## 9.3 撤回 envelope

```text
S7 REVOCATION ENVELOPE

TARGET CAPSULE        SHARE-S
BUNDLE HASH           TOKYO-7／<BUNDLE-HASH>
ORIGINAL SIGNER       SCIENCE ROLE
REVOCATION SIGNER     SAME ROLE／NAGIHARA
REGIONAL RECEIPTS     6／7
SHARE-O               PRESENT／DENIED
COURT HOLD            ACTIVE
MEDICAL HOLD          ACTIVE
PATIENT HOLD          ACTIVE
PRIORITY               EMERGENCY
```

該 envelope：

- 符合現行格式；
- 不含患者原始資料；
- 已在 23:50 前排入更新路徑；
- 尚無 receipt。

本章不能假設它已生效。

---

# 10. 23:50：無第三簽署者的 `CUTOVER AUTH LEASE`

## 10.1 cutover 前十五分鐘

23:35 起：

- 公共營運方持續發送 heartbeat；
- 狀態明確為 `PRESENT／DENIED`；
- 普通服務仍 active；
- protective filtering 仍 active；
- 法院、醫療及患者 hold 仍有效；
- Public Deny Manifest 已公開；
- science revocation 已發出，但未完全確認；
- S7 envelope 已排隊；
- KAGAMI 及區域節點監看已啟動。

日下部說：

> 「之後它再寫失聯，就不是因為我們沒有回答。」

## 10.2 S7 的實際 cutover 順序

23:50，最壞的舊韌體分支被證實仍在：

```text
1. SNAPSHOT LOCAL REVOCATION EPOCH
2. EVALUATE SCIENCE CAPSULE
3. EVALUATE OPERATIONAL STATUS
4. ISSUE DOMAIN TOKENS
5. APPLY INBOUND MAINTENANCE QUEUE
```

### Science side

```text
CAPSULE             VALID
REVOCATION EPOCH    N
BUNDLE HASH         MATCH
SCIENCE TOKEN       ISSUED
TOKEN SERIAL        <SCIENCE-SERIAL>
```

### Operational side

舊離線狀態機只認：

```text
VALID SHARE-O?
```

不認：

```text
OPERATIONS PRESENT／DENIED
```

因此：

```text
VALID SHARE-O?        NO
RECOGNIZED DENY?      NO
CUTOVER TIME?         YES

RESULT                OPERATIONAL UNAVAILABLE
SHARE-CONT            ELIGIBLE
OPERATIONAL TOKEN     ISSUED
TOKEN SERIAL          <OPERATIONS-SERIAL>
```

## 10.3 Lease 是確定性封套，不是第三張票

`CUTOVER AUTH LEASE` 不由 continuity governance 再簽一份第三授權。

它只是攜帶兩個獨立 token 的確定性封套：

```text
CUTOVER AUTH LEASE
{
  science_token,
  operational_token,
  bundle_hash,
  issue_epoch,
  issued_at,
  expires_at,
  lease_nonce
}
```

每個接受節點必須自行驗證：

1. science token 的 science-domain 簽章；
2. operational token 的 operations-domain 簽章；
3. 兩者綁定同一 bundle hash；
4. 有效時間窗一致；
5. epoch 一致；
6. lease nonce 尚未被使用；
7. token serial 未被本地 denylist 撤銷。

continuity governance 只負責：

- 組裝；
- 分送；
- 記錄。

它不提供第三份授權。

正式狀態：

```text
CUTOVER AUTH LEASE
BUNDLE HASH          TOKYO-7／<BUNDLE-HASH>
SCIENCE SOURCE       S7 SCIENCE ESCROW
OPERATIONS SOURCE    SHARE-CONT
ISSUED               SUN 23:50
VALID UNTIL          MON 06:20
REVOCATION EPOCH     N
EXECUTION             NOT YET
```

## 10.4 排隊撤回的結果

Lease 形成後，S7 才處理 inbound queue。

```text
S7 REVOCATION
APPLIED              EPOCH N+1
FUTURE RELEASE       DISABLED
CURRENT LEASE        UNAFFECTED
```

撤回不是沒有生效。

它：

- 阻止下一個 epoch；
- 阻止 S7 再產生第二份 science token；
- 卻不能回溯取消以 epoch N 兩個有效 token 組裝的當輪 lease。

作者層鎖定：

> 前六個 science mirror 的 receipt 均顯示 `PRIOR RELEASE COUNT = 0`；本輪唯一 science token 由 S7 於 23:50 產生。

## 10.5 Chapter 26 的技術目標

既然原 capsule 已撤回，Chapter 26 不必再與 S7 爭奪下一次釋放。

它必須處理已存在的 lease：

- 使 lease 綁定的 bundle hash 失效；
- 令區域節點拒絕其中一個或兩個 token；
- 阻止 `KAGAMI-01` 接受 lease 所簽發的新 Domain-P；
- 或取得 continuity custodian 進行 emergency lease cancellation。

---

# 11. 局部 package preposition

## 11.1 不作全國無差別開始

23:50 後，節點狀態分裂：

```text
PACKAGE PREPOSITION

CONTINUITY-CONTROLLED CLUSTERS    STARTED
NORMAL OPERATIONS CLUSTERS        HELD／DENIED
LEGACY／UNKNOWN CLUSTERS          PENDING
```

若需更具體畫面，可顯示：

```text
CONTINUITY-CONTROLLED NODES       2 STARTED
NORMAL OPERATIONS NODES           5 HELD
LEGACY／UNKNOWN NODES             2 PENDING
```

正式正文可避免強調總數，只需讓讀者知道：

- continuity 直接控制的少數路徑開始接受；
- 正常營運節點因 hold 與 Manifest 維持拒絕；
- 舊式節點狀態不明。

這證明：

- 6／7 撤回有作用；
- SHARE-O 凍結有作用；
- Manifest 與營運拒絕有作用；
- 但仍有一條足以威脅鏡島的 continuity 路徑開始工作。

## 11.2 23:50 尚不是 execution commit

畫面：

```text
AUTH LEASE             ISSUED
REGIONAL PREPOSITION   PARTIAL／STARTED
KAGAMI WARMUP          QUEUED
AUTO-PREP               MON 05:50
EXECUTION COMMIT        NOT YET
PUBLIC FANOUT           NOT SENT
```

不能寫：

> TOKYO-7 已完成啟動。

只能寫：

> 系統已取得當輪授權租約，並開始局部預置。

## 11.3 證據庫觸發

證據庫公開需滿足 2-of-3。

本章章末可由：

1. `CUTOVER AUTH LEASE` attestation；
2. 兩個 continuity-controlled regional nodes 回報相同 bundle hash；

共同觸發。

`KAGAMI-01` warmup 尚在 queued，可作第三條後續證據。

觸發後分層送達：

### 普通公眾

- Manifest；
- 文件索引與 hash commitment；
- 少量已核實選段。

### 法院、醫療與授權媒體

- 完整經遮蔽 archive；
- 封緘技術附件；
- lease／preposition 證明。

### 保留至 06:13

- 受試者夢話；
- 第一人稱感覺；
- 黑色海與共同記憶碎片。

---

# 12. `LEGACY／02` 平行進度

本章只提供一個上午更新及一個晚間更新。

## 上午

```text
LEGACY／02 ADAPTER
BENCH HARDWARE          COMPATIBLE
PATIENT ROOT WRAPPER    GENERATED／OFF-PATIENT
ACTIVE CONNECTION       NONE
```

## 晚間

```text
LEGACY／02
EXTERNAL MEDICAL        ON SITE
HISTORICAL REPLAY       STARTED
PATIENT DEPLOYMENT      PENDING
CUTOVER RISK            HIGH
```

作用：

- 保持第四名紅區患者沒有被遺忘；
- 顯示 R5 不只救主角家屬及已具名孩子；
- 不另開第四條完整主線。


# 13. 八場景結構

## Scene 1：搬送車已經到了

**時間：05:40–06:40**  
**地點：C2 外圍／第七日行動指揮**

星期日清晨，continuity broker 自動產生 relocation proposal。

C2 值班醫療主管以：

> 患者穩定／外部控制衝突

確認執行。

一支醫療搬送承包班次抵達。

目的地顯示：

```text
EAST CONTINUITY MEDICAL HUB
ROUTE          SEALED
```

no-move 命令及外部醫療現場判斷，使搬送在患者離床前停止。

院方主張：

> 外部控制衝突本身可能危害患者，搬送是醫療保護。

外部醫療回答：

> 現有患者仍穩定，沒有新的獨立醫療理由便不能移動。

警方不突入病房。

先保全：

- 車輛；
- 出入口；
- 設備；
- 搬送工單；
- 值班主管確認紀錄。

澪理解：

> 第七日的第一場衝突，不是誰先破門。  
> 是誰有權把「保護」寫進工單。

---

## Scene 2：她還在這裡

**時間：06:40–08:50**  
**地點：C2 臨床隔離棟**

外部醫療、兒少保護、司法保全及院內臨床進場。

直接確認：

- 葵本人；
- 當輪生命狀態；
- 現有控制器；
- 中央閉環；
- 鎮靜及刺激參數；
- relocation 未執行。

部分 C2 醫護協助提供：

- 真實病房狀態；
- 控制器日誌；
- relocation proposal；
- 值班主管確認。

管理責任者仍主張：

> 外部接管沒有 continuity 資格。

日下部回答：

> 「這不是 continuity 接管。這是患者保全。」

外部醫師以獨立即時視訊讓佳乃看見葵。

畫面中同時存在：

- 葵；
- 外部醫師；
- 當輪時間；
- 外部生命監測。

佳乃沒有得到甦醒反應。

但她第一次不再只依賴系統說女兒還活著。

---

## Scene 3：先準備一個空的根

**時間：08:50–11:30**  
**地點：C2 病房外／外部臨床 sidecar 區／facility continuity enclave**

佳乃及患者權利代表確認：

- 不改變治療；
- 不寫入 C2 控制器；
- 不匯出模型；
- 不建立公共權限。

上午只生成：

```text
AOI-LOCAL KEY CONTAINER
STATUS            UNBOUND／PROVISIONAL
PATIENT DATA      NONE
CONTROL OUTPUT    NONE
C2 CONFIG WRITE   NONE
```

不開始 baseline，也不把容器正式標記為葵的患者根。

平行地，在完全不同的 facility continuity enclave：

- SHARE-S capsule 被核對；
- 凪原撤回被載入；
- receipt 顯示 `PRIOR RELEASE COUNT = 0`；
- release handle 被銷毀；
- C2 mirror 返回回執。

本場須清楚讓讀者知道：

> 葵患者根與國家科學授權，不在同一台設備裡。


## Scene 4：六張回執

**時間：11:30–13:25**  
**地點：C2 安全會議室／EAST-METRO 平行連線**

EAST-METRO 團隊回傳第二張新 receipt。

內部狀態：

```text
SCIENCE CAPSULE REVOCATION
ACKNOWLEDGED      6／7
PENDING           S7
```

公開文件尚未顯示數字。

澪問：

> 「六個不夠嗎？」

千田回答：

> 「那不是投票。最後一個裡面，還是一整份。」

封緘資料顯示：

- 最後一個 S7 mirror；
- 與 continuity operational authority 同一治理邊界；
- 密碼學上仍是兩個不同 HSM。

同時，函館平行團隊送來 `LEGACY／02` bench 更新。

不另開長場。

---

## Scene 5：第一次走到她身邊

**時間：13:25–15:40**  
**地點：C2 葵病房**

在醫療判斷允許下，佳乃第一次當輪走到葵床邊。

她叫女兒名字。

葵可能出現：

- 呼吸節奏變化；
- 眼瞼微動；
- 沒有可靠的有意識反應。

醫師只記錄：

> 是否與母親聲音相關，無法判定。

佳乃說：

> 「我來了。妳不用現在回答。」

外部醫師再次確認患者，佳乃才完成：

```text
AOI-LOCAL
PATIENT BINDING    G07／08／水瀨 葵
STATUS             PROVISIONAL／BOUND
BASELINE CAPTURE   START
```

她確認：

- 不匯出模型；
- 不主動切換；
- sidecar 不寫入原控制器。

佳乃對澪說：

> 「我不要你們再把她從一個系統，搬進另一個系統。」

本場為全章情感核心。


## Scene 6：營運方沒有失聯

**時間：15:40–18:10**  
**地點：公共營運安全室／法院／醫療聯盟／媒體安全編輯室**

多方完成 Public Deny Manifest 公開核心頁。

有人提出：

- 把澪記得千田兩次死亡的內容放入證據；
- 公開 R4 及她對 06:13 的跨輪記憶；
- 以此讓媒體更快相信危機。

澪拒絕：

> 「那是我知道的，不是現在所有人能共同證明的。」  
> 「不能因為這次我相信自己，就把它寫成所有人必須相信的證據。」

公開摘要：

> 普通防災警報、交通服務與保護性訊號過濾仍正常運作。  
> 被拒絕的是指定的 TOKYO-7 同步套件。  
> 公眾不需前往任何設施。

畫面：

```text
OPERATIONS STATUS             PRESENT
AUTHORIZATION                 DENIED
ORDINARY SERVICES             ACTIVE
PROTECTIVE FILTERING          ACTIVE
TOKYO-7／<HASH>               DENIED
PUBLIC ACTION REQUIRED        NONE
```

核心句：

> 「營運方沒有失聯。它正在拒絕。」

主管機關反駁文件未完成調查核實。

公共營運方以自身簽章回應：

> 普通服務仍在，被拒絕的只有指定 bundle。

媒體分裂；第七曙光內部亦爭論是否公開所有姓名。

最終選擇：

> 患者安全與共同可驗證性，優先於即時輿論效果。

這是本章標題的公共支付，也是澪本章唯一不可替代的主角選擇。


## Scene 7：最後一個 mirror

**時間：18:10–23:35**  
**地點：continuity 監看室／鏡島安全連線／法院緊急視訊**

預先遮蔽的證據包進入多點託管。

S7 撤回 envelope 被排入 cutover 更新路徑。

舊 BCP 文件出現：

```text
CUTOVER EPOCH SNAPSHOT
MAINTENANCE QUEUE APPLY／POST-SNAPSHOT
```

但實際韌體仍封緘。

團隊採取多項行動：

- 法院要求 custodian 在 snapshot 前暫停；
- 凪原重簽 emergency-priority 撤回；
- 系統安全驗證 envelope 與 exact bundle hash；
- KAGAMI-01 部署 bundle／token 告警；
- 區域節點部署 preposition 監看；
- 公共營運持續發送 `PRESENT／DENIED` heartbeat；
- 官方手機 `+7000ms` 路徑只進入監看。

S7 仍無 receipt。

23:35，日下部確認：

> 「之後它再寫失聯，就不是因為我們沒有回答。」

---

## Scene 8：拒絕被寫成失聯

**時間：23:35–23:52**  
**地點：continuity 監看室／公共世界**

人類世界：

```text
OPERATIONS STATUS       PRESENT
AUTHORIZATION           DENIED
COURT HOLD              ACTIVE
MEDICAL HOLD            ACTIVE
```

S7 science HSM：

```text
CAPSULE                 VALID／EPOCH N
SCIENCE TOKEN           ISSUED
```

continuity operational HSM：

```text
VALID SHARE-O?          NO
RECOGNIZED DENY?        NO
RESULT                  OPERATIONAL UNAVAILABLE
SHARE-CONT              ELIGIBLE
OPERATIONAL TOKEN       ISSUED
```

接受節點分別驗證兩個 token，沒有第三個隱形簽署者。

它們被組裝為：

```text
CUTOVER AUTH LEASE
BUNDLE HASH          TOKYO-7／<HASH>
SCIENCE TOKEN        <SCIENCE-SERIAL>
OPERATIONS TOKEN     <OPERATIONS-SERIAL>
ISSUED               SUN 23:50
VALID UNTIL          MON 06:20
EPOCH                N
```

之後 queued revocation 才被處理：

```text
S7 EPOCH              N+1
FUTURE RELEASE        DISABLED
CURRENT LEASE         UNAFFECTED
```

套件只在 continuity-controlled clusters 局部開始預置。

正常營運節點維持拒絕。

Evidence Vault 由 lease attestation 與兩個區域節點的同 bundle hash 共同觸發：

- 普通公眾取得 Manifest、索引、hash 與少量文件選段；
- 法院、醫療及授權媒體取得完整經遮蔽證據包；
- 夢話、第一人稱感覺與黑色海碎片仍被保留至 06:13。

章末：

> 營運方沒有失聯。  
> 醫師沒有失聯。  
> 家屬沒有失聯。  
>   
> 他們全都在說不。  
>   
> 可 23:50，系統替這個「不」，組裝出一份有效到清晨的租約。


# 14. 本章必須完成的十九項成果

## 成果一：第七日正式開始

- Chapter 25 發生於星期日；
- 所屬大章為《不要救東京》；
- 使用「悠真失蹤事件第十三日」。

## 成果二：C2 relocation 的權限缺口被鎖定

- broker 自動 proposal；
- C2 值班主管內部確認；
- 缺少獨立醫師確認，因此患者不能合法離床；
- no-move 真正阻止搬送。

## 成果三：C2 現場接管不改變治療

- 患者不移動；
- 不斷線；
- 不改參數；
- 外部醫療與患者權利取得共同控制。

## 成果四：佳乃先獨立看見葵，再完成患者綁定

- 上午即時外部視訊；
- sidecar 先建立空容器；
- 下午床邊確認後才 patient-bound；
- 不形成虛假甦醒。

## 成果五：葵患者根建立在外部 sidecar

- `C2 CONFIG WRITE = NONE`；
- 無公共權限；
- 不使用美空模型；
- 只作 Stage-0 baseline。

## 成果六：C2 science escrow 與患者設備分離

- mirror 位於 facility continuity enclave；
- 撤回不觸碰患者控制；
- 葵 root 不持有國家級授權。

## 成果七：SHARE-S 是非匯出授權膠囊

- bundle-bound；
- one-time／window-bound；
- 撤回銷毀 release capability；
- 七個 mirror 不是票數。

## 成果八：六個撤回 receipt 證明沒有預先 token

- `PRIOR RELEASE COUNT = 0`；
- `TOKEN ISSUED = NO`；
- 只有 S7 在 23:50 產生 science token。

## 成果九：七個 mirror 具有世界內運用理由

- 五個地區域；
- 一個臨床 continuity 域；
- 一個國家離線 vault。

## 成果十：Public Deny Manifest 採雙層公開

- 公開核心頁只證明拒絕、普通服務仍在及 hold；
- 封緘附件保留 6／7、S7 與內部授權細節；
- 不要求公眾採取現場行動。

## 成果十一：澪拒絕以跨輪記憶取得公共授權

- 不將前輪死亡、R4 或未來 06:13 冒充公共物證；
- 選擇較弱但可共同驗證的真相；
- 完成本章主角選擇。

## 成果十二：公開後出現現實反制

- 主管機關反駁；
- 營運方澄清普通服務；
- 媒體核驗；
- 家屬與患者隱私爭議；
- 公開不等於立即勝利。

## 成果十三：Evidence Vault 採分層發布

- 普通公眾只見 Manifest、索引與選段；
- 完整經遮蔽證據包 給核實機構；
- 第一人稱受試者碎片留至 06:13。

## 成果十四：Evidence Vault 已預先遮蔽且採多源觸發

- 不是一下午臨時完成；
- 2-of-3 attestation；
- 單一監測器不能觸發；
- 不公開患者原始資料。

## 成果十五：Science HSM 與 Operational HSM 保持密碼學分離

- 不讓同一密鑰假裝成兩份授權；
- 真正問題是同一治理邊界與同一 cutover。

## 成果十六：Lease 不創造第三個簽署者

- lease 是攜帶兩個 token 的確定性封套；
- 區域節點分別驗證；
- governance 不簽第三票。

## 成果十七：23:50 產生當輪 `CUTOVER AUTH LEASE`

- lease 綁定 exact bundle；
- 有效至 06:20；
- queued revocation 只更新下一 epoch；
- Chapter 26 需處理既有 lease。

## 成果十八：package preposition 只局部開始

- continuity-controlled clusters started；
- normal operations clusters held；
- legacy nodes pending；
- 人類努力沒有被完全抹消。

## 成果十九：Chapter 26–28 的核心支付被保留

- Chapter 26：鏡島租約接受鏈與琴音受控開啟受試者區域；
- Chapter 27：悠真節奏、05:50–06:13、七秒與第一人稱真相碎片；
- Chapter 28：第八天與人物後果。


# 15. 證據鏈與推論邊界

## 15.1 C2 接管

可成立：

- relocation proposal 由 broker 生成；
- C2 值班主管確認；
- no-move 阻止患者實際搬送；
- 外部醫療及兒少程序完成進場；
- 葵本人與生命狀態獲獨立確認；
- 原管理鏈不再能單獨更改設定。

不能成立：

- C2 全體醫護均參與非法拘束；
- relocation 一定以滅證為目的；
- 葵已能安全離開病房；
- 葵已被完全救出；
- 目的地藏有新的核心真相。

## 15.2 AOI-LOCAL sidecar

可成立：

- 上午只生成未綁定空容器；
- 下午在佳乃床邊確認後才綁定葵；
- root 位於外部 sidecar；
- 無公共權限；
- 不寫入 C2；
- 綁定後 baseline capture 才開始；
- 現行治療未改變。

不能成立：

- 葵已有可用局部影子；
- 模型已與醫療狀態相符；
- 葵可以主動切換；
- root 建立等於治療成功。

## 15.3 SHARE-S capsules

可成立：

- 七個 mirror 保存非匯出 release capability；
- 六個 release capability 已撤回；
- 六個 receipt 均證明 prior release count 為零；
- S7 仍可產生完整 science token；
- 撤回 receipt 具有密碼學意義。

不能成立：

- 6／7 是票數；
- science token 可任意複製；
- S7 一定拒絕撤回；
- custodian 已辨認；
- vault 物理位置已知。

## 15.4 Manifest

可成立：

- 營運方在場；
- exact bundle 被拒絕；
- 普通公共服務與 raw filter 仍運作；
- 法院、醫療及患者 hold 有效；
- 多方簽署已公開。

不能成立：

- Manifest 本身可令 HSM停機；
- 公眾已理解全部技術；
- 公開沒有政治或媒體反制；
- 6／7 及 S7 細節應全部公開；
- Manifest 證明 TOKYO-7 的所有心理效果。

## 15.5 Evidence Vault

可成立：

- 證據已在前章預先遮蔽；
- 多點託管；
- 由多源 attestation 觸發；
- 發布版本保護患者位置及資料；
- 普通公眾、核實機構與 06:13 第一人稱碎片具有不同發布層級。

不能成立：

- 所有秘密資料都應公開；
- 單一預置告警即可觸發；
- 未來記憶可作公共物證；
- 公開後患者不再需要保護。

## 15.6 S7 與 lease

可成立：

- science 與 operational HSM 密碼學分離；
- 同一 continuity governance 觸發兩者；
- snapshot 先於 queue；
- science token 與 operational token 被組裝成無第三簽署者的 lease；
- 接受節點分別驗證兩個 token；
- lease 有效至 06:20；
- 撤回更新下一 epoch；
- 當輪 lease 仍有效。

不能成立：

- execution commit 已完成；
- public fanout 已發出；
- lease 永遠無法取消；
- custodian 主觀上一定支持 TOKYO-7；
- queued revocation 完全沒有作用。

## 15.7 局部 preposition

可成立：

- continuity-controlled clusters 開始接受 bundle；
- normal operations clusters 維持拒絕；
- package preposition 已局部開始；
- 05:50 auto-prep 尚未到來。

不能成立：

- 全國所有節點均已接受；
- TOKYO-7 已不可阻止；
- 正常營運拒絕毫無作用；
- KAGAMI-01 已完成 warmup 或 CAL LOCK。

---

# 16. 誤導與普通解釋

| 線索 | 普通解釋 |
|---|---|
| C2 relocation | 高依存患者遇外部控制衝突時的常規醫療轉移 |
| 值班主管確認 | 真實醫療風險判斷，不必然是惡意掩蓋 |
| AOI-LOCAL sidecar | 普通患者資料簽署與外部監測 |
| science authorization capsule | 高可用關鍵配置的標準非匯出 escrow |
| S7 與 operational HSM 同 governance | 離線 BCP 的集中協調，不必然是惡意共謀 |
| Public Deny Manifest | 危機時公共合規公告 |
| 主管機關反駁 | 保護患者及基礎設施的正常風險溝通 |
| 證據庫多點託管 | 標準司法／whistleblower 保全 |
| snapshot-before-queue | 離線 BCP 避免更新中斷的普通設計 |
| cutover auth lease | 跨越夜間維護窗的標準授權租約 |
| SHARE-CONT eligible | 真正失聯時必要的持續運用措施 |
| partial preposition | 預置不等於一定執行 |
| 葵沒有明確反應 | 長期醫療狀態，不能由情感場景推定意識 |

---

# 17. 角色狀態變化

## 17.1 朝倉澪

本章開始：

- 準備整合三條終局工作；
- 仍可能因跨輪知識搶先替人決定。

本章結束：

- 在 C2 接管中沒有代替佳乃或醫師作決定；
- 看見葵從管理碼取得只綁定自己的外部患者根；
- 接受「找到」仍不等於「救出」；
- 理解 6／7 仍不是成功；
- 在有人要求公開跨輪死亡與 R4 時，主動拒絕讓只有自己能確認的全貌取得公共權威；
- 參與 Manifest，但不把未來記憶混入公共證據；
- 看見公開真相引發反駁與隱私爭議，而非立即勝利；
- 第一次看見所有人類程序明確說不，舊制度仍以 epoch snapshot 製造當輪 lease；
- 進入 Chapter 26 時，目標不再是繼續證明拒絕，而是使已形成的授權租約無法被鏡島接受。

## 17.2 水瀨佳乃

- 先透過外部即時視訊確認葵；
- 再到床邊看見女兒；
- 沒有獲得虛假團圓；
- 成為 AOI-LOCAL 及未來切換程序的法定核心；
- 明確拒絕把葵由一個中央系統搬進另一個；
- 允許經遮蔽家屬證據進入公共證據庫；
- 不公開 C2 精確位置。

## 17.3 水瀨葵

- 仍未醒或自由溝通；
- 未被移動；
- 原管理鏈不能再單獨改動設定；
- 建立外部 `AOI-LOCAL／PROVISIONAL`；
- 開始 Stage-0 baseline capture；
- C2 控制器沒有被寫入；
- 尚未取得被動相符或 failover readiness；
- 她的存在由當輪醫療、家屬與法律共同確認。

## 17.4 日下部悟

- 將 C2 進場保持為患者保全；
- 推動 Manifest 雙層公開與 Evidence Vault 多源觸發；
- 嚴格限制公開內容；
- 確認 6／7 的真實含義；
- 在 23:50 看見舊制度以 lease 固化拒絕失敗；
- Chapter 26 將同步技術阻斷、鏡島控制與公開責任。

## 17.5 千田浩介

- 協助外部 sidecar、capsule 撤回及 bundle hash 核對；
- 用「最後一個裡面還是一整份」解釋冗餘 escrow；
- 不參與患者醫療決定；
- 監看 lease、區域 preposition 及鏡島 token；
- 開始準備 Chapter 26 的 hash 阻斷及七秒末端方案。

## 17.6 凪原唯

- science capsule 撤回由 4／7 推進至 6／7；
- 她的撤回是真實、可驗證行動；
- S7 仍在 epoch N 產生當輪 token；
- queued revocation 使下一 epoch 失效；
- 不能以「撤回已送出」宣稱責任結束；
- Public Deny Manifest 顯示她曾續期確切 bundle，之後再撤回；
- Chapter 26 需協助使 lease、bundle hash 或鏡島接受鏈失效。

## 17.7 白石琴音

- 不參與 C2 技術操作；
- 透過辯護與家屬程序解釋 continuity 工單語言；
- 看見 Manifest 沒有公開美空位置或模型；
- 對澪及 R5 的有限信任略增；
- 仍需面對自身取件、回報及攔截責任。

## 17.8 第七曙光

- 從家屬證據網轉為患者語言及外部紀錄保全者；
- 沒有取得技術或患者操作權；
- 面對是否公開全部姓名的內部爭議；
- 最終支持患者安全優先的遮蔽版本；
- 為 Chapter 26–27 的公共證人同步奠定基礎。

## 17.9 C2 醫護

- 不被寫成同一意志；
- 部分人相信 relocation 更安全；
- 部分人協助外部醫療及日誌保全；
- 值班主管須面對自己確認工單的程序責任；
- 顯示制度可透過分割資訊，使好意的人維持錯誤系統。

---

# 18. 作者層真相鎖定

1. C2 relocation proposal 確由 Clinical Continuity Broker 自動產生。
2. C2 值班醫療主管在知道 no-move 存在下，以醫療緊急例外確認搬送，但缺少必要的獨立醫師確認。
3. no-move 真正阻止葵被轉往既有 continuity medical hub。
4. 葵本章不醒，也不產生可證明的意識回應。
5. 上午只建立 `AOI-LOCAL KEY CONTAINER／UNBOUND`；下午佳乃床邊確認後才完成患者綁定及 Stage-0 baseline。
6. `AOI-LOCAL` 位於外部 sidecar，只作簽章與 baseline；C2 原控制器未被修改。
7. C2 facility continuity enclave 與葵患者控制鏈物理及權限分離。
8. 七個 science escrow mirror 配置於五個地區域、一個臨床 continuity 域及一個國家離線 vault。
9. 七個 mirror 保存的是同一 SHARE-S 的非匯出 release capability。
10. 前六個 mirror 在撤回前均未釋放 token；C2 與 EAST-METRO receipt 均顯示 `PRIOR RELEASE COUNT = 0`。
11. 最後一個 S7 science capsule 才在 epoch N 產生完整 science token。
12. S7 Science Escrow HSM 與 Continuity Operational HSM 密碼學分離。
13. 兩者受同一 continuity governance 在同一 cutover 自動驅動。
14. Public Deny Manifest 內容真實、可驗證；公開核心頁不洩露 6／7、S7 及 HSM 路由。
15. 澪拒絕將跨輪記憶、前輪死亡與 R4 當成公共事實證據。
16. 主管機關反駁不會令 Manifest 失效，但會製造媒體與公共不確定。
17. Evidence Vault 已預先遮蔽；普通公眾只取得 Manifest、索引與選段，完整經遮蔽證據包 只供核實機構。
18. 受試者夢話、第一人稱感覺與黑色海片段被保留至 06:13，不在 Chapter 25 被完整公開。
19. Evidence Vault 由至少兩項獨立 preposition／lease attestation 觸發。
20. 23:50 的舊韌體先 snapshot epoch N，再處理 queued revocation。
21. science token 與 SHARE-CONT token 不經第三簽署者，而被組裝為有效至 06:20 的確定性 `CUTOVER AUTH LEASE`。
22. 接受節點分別驗證 science token 與 operational token 的簽章、bundle hash、epoch、時間窗及 nonce。
23. queued revocation 更新 S7 至 epoch N+1，阻止未來 release，卻不回溯取消當輪 lease。
24. 23:50 只開始局部 package preposition。
25. 正常營運節點因 explicit deny 與 hold 維持拒絕。
26. continuity-controlled clusters 開始接受 bundle。
27. Chapter 26 仍有約六小時阻止 lease 接受、bundle 預置、KAGAMI token 及 05:50 auto-prep。
28. `LEGACY／02` 平行轉接器仍未接上患者。
29. 最終成功不能只靠公開證據，也不能只靠技術破壞。
30. Chapter 26–28 必須保留琴音受控開啟受試者區域、悠真節奏、七秒、第一人稱真相碎片及第八天的支付。


# 19. Chapter 26 銜接

## Chapter 25 結束時已知

- C2 relocation 被阻止；
- 外部醫療、兒少及司法程序已接管患者決策；
- 葵本人與生命狀態獲獨立確認；
- 佳乃已透過外部視訊並到床邊看見葵；
- `AOI-LOCAL／PROVISIONAL` 已建立於外部 sidecar；
- 葵只進入 Stage-0 baseline capture；
- C2 原控制器未被寫入；
- science capsule 撤回達 6／7；
- 最後一個 S7 capsule 在 epoch N 產生 science token；
- Public Deny Manifest 已公開；
- 普通公共安全服務及 raw filter 仍 active；
- 公開核心頁不洩露 S7 及 mirror 內情；
- Evidence Vault 已由多源 attestation 觸發分層發布；普通公眾只取得摘要、索引與選段，完整經遮蔽證據包交由核實機構查驗；
- 主管機關已反駁，媒體與公眾正核驗；
- Science Escrow HSM 與 Operational HSM 在密碼學上分離；
- `CUTOVER AUTH LEASE` 已形成；
- queued revocation 只更新下一 epoch；
- continuity-controlled clusters 已局部開始 package preposition；
- normal operations clusters 仍 held／denied；
- KAGAMI warmup 尚未完成；
- 尚未到 05:50 auto-prep；
- 官方手機 +7000ms 路徑仍只在監看；
- 距星期一 05:50 約六小時；
- 距 06:13 約六小時二十一分。

## Chapter 26 主要任務

Chapter 26 收斂為三條主線。

### A. 鏡島接受鏈

1. 使 `CUTOVER AUTH LEASE` 綁定的 bundle hash 失效；
2. 阻止新 Domain-P token 被 `KAGAMI-01` 接受；
3. 將 distributed explicit deny 寫入鏡島本地接受規則；
4. 尋找 emergency lease cancellation 或 custodian 路徑；
5. 由琴音在多方監督下協助解除家屬／臨床 continuity 對受試者區域的制度封鎖，而不是重新給她單人操作權；
6. 不粗暴斷電；
7. 保留 protective filtering 及患者閉環。

### B. 區域預置阻斷

1. 找出 continuity-controlled clusters；
2. 隔離或撤回已預置 package；
3. 讓 normal operations nodes 維持拒絕；
4. 保全每個 package write、token 及 hash 作證據；
5. 防止 legacy nodes 在 05:50 自動接受。

### C. 05:50–06:13 末端準備

1. consensus／public branch 隔離；
2. 官方手機 `+7000ms` 最後路徑；
3. 已播廣播不可撤回；
4. 尚未送出手機 payload 可取消並保全；
5. Public Deny Manifest 作獨立人類公告；
6. 為 Chapter 27 準備悠真夢話中的共同節奏，但不在 Chapter 26 把悠真變成新 Mother Reference；
7. 保留夢話、第一人稱與黑色海碎片至 06:13；
8. C2、美空、M-00 及函館平行患者節點持續安全監看。

C2 葵線只作：

- baseline 進度；
- 防止反向改動；
- 患者安全監看。

Chapter 26 不應突然完成葵完整影子模型。

Chapter 26 的核心問題：

> 當制度已簽出一份有效至清晨的授權租約，還能否在不切斷患者生命線的前提下，讓鏡島與區域節點拒絕接受它？

---

# 20. 本章不能揭露的事

1. S7／continuity vault 的實際位置；
2. continuity custodian 真人；
3. `CONTINUITY-0` 完整實體架構；
4. 最終具名最高授權者；
5. 全部 continuity-controlled cluster 位置；
6. Chapter 26 是否能使 lease bundle hash 失效；
7. Chapter 26 是否能控制 KAGAMI-01；
8. 葵完整醫療狀態；
9. 葵是否能在星期一前取得被動相符；
10. `LEGACY／02` 完整姓名；
11. R5 主動切換完整程序；
12. emergency lease cancellation 是否存在；
13. 七秒路徑最終如何使用；
14. TOKYO-7 最終 public payload；
15. 外星訊號真正目的；
16. 父親現在下落；
17. 第三輪是否能終止循環；
18. 第八天是否真的到來。

---

# 21. 本章一句話總結

> 第七日清晨，Clinical Continuity Broker 因外部控制衝突自動提出搬送，C2 值班主管雖以患者穩定理由確認工單，卻缺少 no-move 命令要求的獨立醫師判斷；搬送車因此能被預派，水瀨葵卻不能合法離床。外部醫療、兒少保護及司法程序不移動、不斷線、不改變治療地接管患者。水瀨佳乃先透過外部醫師的獨立即時視訊看見女兒，團隊只在外部 sidecar 中建立一個不含患者資料的未綁定安全容器；下午佳乃真正走到床邊後，才將容器綁定為 `AOI-LOCAL／PROVISIONAL` 並啟動 Stage-0 baseline。C2 的科學 escrow 位於另一套 facility continuity enclave，和葵患者根完全分離。七個 mirror 保存的不是簽章檔，而是分布於五個地區域、一個臨床 continuity 域及一個國家離線 vault、綁定 exact bundle 且只能產生一次 token 的非匯出授權能力；六份撤回 receipt 均證明此前沒有釋放 token，最後一個 S7 仍保留完整 release capability。下午，營運、法院、醫療、患者權利及系統安全準備 Public Deny Manifest。有人提議將澪記得的前輪死亡與 R4 放進公開證據以增加衝擊，澪卻拒絕讓只有自己能確認的全貌取得公共權威。公開頁只讓公眾知道普通服務與保護性過濾仍在、指定 TOKYO-7 bundle 被拒，6／7 與 S7 細節只留封緘附件；普通公眾取得 Manifest、索引與文件選段，完整經遮蔽證據包 交給法院、醫療及授權媒體，受試者夢話與第一人稱碎片則保留至 06:13。主管機關反駁文件不完整，媒體分批核驗，第七曙光選擇繼續遮蔽患者。白天取得的舊 BCP 文檔已公平提示 S7 可能先作 epoch snapshot 再處理更新。23:50，密碼學上分離的 science HSM 與 operational HSM 分別產生 token；它們沒有第三個隱形簽署者，只被組裝成一份綁定 exact bundle、有效至 06:20 的確定性 `CUTOVER AUTH LEASE`。排隊撤回隨後將 S7 更新至下一 epoch，令它無法再產生第二份 science token，卻不能回溯取消現有 lease。正常營運節點繼續拒絕，只有少數 continuity-controlled clusters 開始預置。所有人類文件都寫著 `PRESENT／DENIED`，舊制度卻寫下 `OPERATIONAL UNAVAILABLE`。拒絕不是失聯；可第七日剩下的六小時，角色必須讓正在接受租約的鏡島也學會這項區別。


# 22. 最終寫作檢查表

## 時間與大章

- [ ] 章名使用《拒絕不是失聯》；
- [ ] 所屬大章為第七日《不要救東京》；
- [ ] Chapter 25 發生於星期日 05:40–23:52；
- [ ] 使用「悠真失蹤事件第十三日」；
- [ ] Chapter 24 與 25 之間安排睡眠及輪班；
- [ ] 23:50 形成授權租約，不是 execution commit；
- [ ] 05:50 與 06:13 仍未到來。

## C2 relocation

- [ ] proposal 由 Clinical Continuity Broker 自動產生；
- [ ] C2 值班醫療主管以患者穩定理由確認；
- [ ] no-move 已存在；
- [ ] 搬送工單利用醫療緊急例外；
- [ ] 搬送車抵達後被現場命令阻止；
- [ ] 患者未離床；
- [ ] 目的地為既有 continuity medical hub，不另開祕密設施謎團；
- [ ] 不把全部 C2 醫護寫成反派；
- [ ] 值班主管須面對程序責任。

## C2 接管與葵

- [ ] 不戰術突入病房；
- [ ] 不移動葵；
- [ ] 不斷線；
- [ ] 不改鎮靜、刺激及路由；
- [ ] 外部醫療獨立確認葵本人及生命狀態；
- [ ] 佳乃先透過獨立即時視訊看見葵；
- [ ] 之後才建立患者 root；
- [ ] `AOI-LOCAL` 位於外部 clinical sidecar；
- [ ] `C2 CONFIG WRITE = NONE`；
- [ ] root 無公共權限；
- [ ] root 不含美空或 M-00 模型；
- [ ] 只進入 Stage-0 baseline；
- [ ] 葵不取得被動相符；
- [ ] 葵不主動切換；
- [ ] 下午佳乃才第一次走到床邊；
- [ ] 不將眼瞼或呼吸變化寫成意識恢復；
- [ ] 支付「不要把她從一個系統搬進另一個」。

## SHARE-S capsules

- [ ] 七個 mirror 保存非匯出 authorization capsule；
- [ ] capsule 綁定 exact bundle hash；
- [ ] release one-time／window-bound；
- [ ] 撤回增加 local epoch 及銷毀 release handle；
- [ ] 七個 mirror 不是票數；
- [ ] 任一未撤回 mirror 可產生完整 science token；
- [ ] C2 mirror 位於 facility continuity enclave；
- [ ] C2 mirror 與葵患者控制鏈分離；
- [ ] C2 receipt 有效；
- [ ] EAST-METRO receipt 有效；
- [ ] 撤回達 6／7；
- [ ] 不把 6／7 寫成幾乎成功；
- [ ] 最後 mirror 為 S7 science escrow；
- [ ] 不揭露物理位置及 custodian。

## Public Deny Manifest

- [ ] 公開核心頁不顯示 6／7；
- [ ] 不公開 S7、HSM 類型及內部路由；
- [ ] 公開 exact bundle hash；
- [ ] 顯示 operations present；
- [ ] 顯示 authorization denied；
- [ ] 顯示 science revocation issued／not fully acknowledged；
- [ ] 顯示 court／medical／patient hold；
- [ ] 顯示 ordinary emergency services active；
- [ ] 顯示 protective filtering active；
- [ ] 顯示 public action required none；
- [ ] 核心句為「營運方沒有失聯。它正在拒絕」；
- [ ] 說明拒絕 TOKYO-7 不等於停止普通防災；
- [ ] Manifest 由多方簽署，不由澪單獨發布；
- [ ] 6／7 及 S7 只留封緘技術附件；
- [ ] 主管機關發布反駁；
- [ ] 營運方澄清普通服務仍在；
- [ ] 媒體分批核驗；
- [ ] 第七曙光選擇患者安全優先的遮蔽版本。

## Evidence Vault

- [ ] Chapter 21–24 已預先完成大部分遮蔽；
- [ ] Chapter 25 只加入最新 Manifest、receipt、C2 與 cutover 證據；
- [ ] 不加入未證實外星來源及未來記憶；
- [ ] 不公開患者原始神經資料；
- [ ] 不公開精確病房；
- [ ] 多點託管；
- [ ] 沒有單一發布者或刪除者；
- [ ] 使用 2-of-3 多源 attestation；
- [ ] 單一監測器不能觸發；
- [ ] 觸發來源綁定 exact bundle hash；
- [ ] 發布版本已經患者／家屬／法律審查。

## S7 與 cutover lease

- [ ] Science Escrow HSM 與 Operational HSM 密碼學分離；
- [ ] 兩者受同一 continuity governance 驅動；
- [ ] 白天舊文件提示 snapshot-before-queue；
- [ ] 實際韌體仍有不確定性；
- [ ] 團隊仍合理送撤回及準備其他阻斷；
- [ ] 23:35 operations heartbeat present／denied；
- [ ] S7 撤回 envelope 已排隊；
- [ ] S7 尚無 receipt；
- [ ] cutover 先 snapshot epoch N；
- [ ] Science HSM 產生 science token；
- [ ] Operational HSM 產生 SHARE-CONT token；
- [ ] 組合成 `CUTOVER AUTH LEASE`；
- [ ] lease 綁定 exact bundle；
- [ ] lease 有效至 06:20；
- [ ] lease 不等於 execution commit；
- [ ] queued revocation 更新 epoch N+1；
- [ ] future release disabled；
- [ ] current lease unaffected；
- [ ] 不寫成撤回完全沒用。

## 局部預置與其他線

- [ ] continuity-controlled clusters 局部開始；
- [ ] normal operations clusters held／denied；
- [ ] legacy／unknown clusters pending；
- [ ] 不寫成全國全部預置；
- [ ] KAGAMI warmup 仍 queued；
- [ ] 05:50 auto-prep 未開始；
- [ ] 06:13 未到；
- [ ] `LEGACY／02` 只作兩次簡短平行更新；
- [ ] 轉接器尚未接患者；
- [ ] 官方手機 `+7000ms` 路徑只監看；
- [ ] 七秒不能撤回已播廣播；
- [ ] 本章不完成 R5 主動切換；
- [ ] 本章不揭露 continuity custodian；
- [ ] Chapter 26 從 cutover lease 已存在、局部 preposition 已開始的狀態接續。
- [ ] 上午 sidecar 只建立 `UNBOUND KEY CONTAINER`；
- [ ] 下午床邊確認後才完成 `PATIENT-BOUND`；
- [ ] 澪拒絕將跨輪記憶列為公共事實證據；
- [ ] Public Deny Manifest 普通頁使用人類可讀語言；
- [ ] 6／7、S7 與 HSM 路由只留封緘附件；
- [ ] 普通公眾只取得 Manifest、索引、hash 與少量選段；
- [ ] 完整經遮蔽證據包 只供法院、醫療及授權媒體；
- [ ] 夢話、第一人稱感覺與黑色海碎片保留至 06:13；
- [ ] Science token 與 Operational token 分別由接受節點驗證；
- [ ] lease 不具有第三個 governance 簽章；
- [ ] 前六個撤回 receipt 均顯示 `PRIOR RELEASE COUNT = 0`；
- [ ] 七個 mirror 具有五地區＋臨床域＋國家 vault 的運用理由；
- [ ] no-move 醫療例外需要獨立醫師確認；
- [ ] C2 值班主管缺少該確認，只能啟動準備、不能合法使患者離床；
- [ ] Chapter 26 明確保留琴音打開受試者區域的受控支付；
- [ ] Chapter 27 明確保留悠真節奏、七秒及受試者真相碎片；
- [ ] Chapter 28 保留第八天及人物後果。
