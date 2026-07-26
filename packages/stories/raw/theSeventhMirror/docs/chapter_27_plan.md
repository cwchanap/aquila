# 《神鏡七日》Chapter 27 章節企劃 v2.2

## 第 27 章：沒有同一個答案

所屬大章：**第七日：不要救東京**  
全書位置：**28 小章中的第 27 章**  
章節定位：**05:50–06:13 最終二十三分鐘／本地預載七階段時程／Control Quiet Window／六個 patient-node ACK 與兩個 guardian HOLD ACK／患者各自 Stage Ceiling／SAFE PAUSE／兩名具 prior assent／consent 的患者有限換手／M-00 公共功能停止但臨床過渡支援定時重審／physical break-glass 拒絕／患者安全優先的 witness key release／中立通知與自願查閱／拒絕統一反敘事但保留共同事實／官方手機 +7000ms 唯一中央 fanout 取消／東京灣白光／數位 fragments 與非控制性感官 echo 分離／循環結果留待第八天確認、物理原因保持未證明**  
建議篇幅：**約 11,000–13,000 字**  
視角：**第三人稱限知，緊貼朝倉澪**  
主要類型感：**即時醫療倒數、人工島終局控制、集體拒絕、有限患者換手、白光訊號事件、七秒推送懸疑、多聲部真相釋放**

---

# 0. 本章核心定位

Chapter 26 已完成：

1. `CUTOVER AUTH LEASE` 在密碼學上仍有效：
   - science token 有效；
   - operational token 有效；
   - bundle hash 有效；
   - lease nonce 有效；
   - `AUTH_EPOCH A17` 仍屬當輪有效租約；
2. Lease 只綁定：
   - `SUBJECT_EPOCH S42`；
   - continuity 的 `MANAGED-EQUIVALENT／CACHED` 患者語義；
3. Subject Continuity Bay 已在 lease 載入及 package preposition 後合法掛載；
4. Chapter 23–25 早已存在的 patient-root、醫療、法定代理、患者權利及法院 signed updates 已被單調合併；
5. Live subject ledger 已更新為 `SUBJECT_EPOCH S43`；
6. 八個 physical clinical endpoints 與八筆 active human records 完成核對：
   - unmapped heartbeat = 0；
   - orphan record = 0；
7. 當輪固定人類依存紀錄為：

```text
TOTAL HUMAN DEPENDENCY RECORDS    9
SAFE-DETACHED                     1／G07-12／朝倉悠真
ACTIVE HUMAN DEPENDENCIES         8
CRITICAL RED-ZONE                 4
OTHER ACTIVE                      4
```

8. 四名最低必要具名紅區為：
   - `M-00／朝倉紗英`；
   - `G07／03／藤川美空`；
   - `G07／08／水瀨葵`；
   - `LEGACY／02／HUMAN／ADULT`；
9. 另四名 active patients 均納入 safety latch，其中：
   - `G07／05`：十六歲，具患者綁定本地根、Stage-1、法定代理與 rights consent；
   - `LEGACY／04`：成年人，具患者綁定本地根、Stage-1、有限自我同意；
   - `ACTIVE／C`：Stage-0，最高只到 COMPARE；
   - `ACTIVE／D`：本地根未完成，最高只到 HOLD；
10. `Clinical Safety Hold` 與 `Public Data-Use Hold` 均為 HOLD；
11. Old A17 lease 仍有密碼學效力，卻不再適用於 S43；
12. Route A——正式 S43 rebind——因需要新的 exact bundle 與 A18 science token 而失敗；
13. S7 已進入：

```text
AUTH_EPOCH A18
FUTURE RELEASE       DISABLED
NEW SCIENCE TOKEN    UNAVAILABLE
```

14. 對當前 TOKYO-7 trust chain 不存在第二個合法 science issuer；
15. Route B——`SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE`——亦失敗：
   - 琴音撤回自己的 `G07／03` persistent delegation；
   - 藤川真理拒絕將美空重新標成 managed-equivalent；
   - 其他 unresolved case routes 亦沒有合法 aggregate acknowledgment；
16. KAGAMI-01 不簽 execution anchor；
17. TOKYO-7 consensus／public branch 保持 HOLD；
18. protective filter 與 clinical branch 保持 active；
19. normal operations clusters 維持拒絕；
20. 一個 continuity-controlled cluster 已進 package quarantine；
21. 剩餘 package 均仍須 KAGAMI execution anchor；
22. 普通軟體無法在 unresolved humans 存在時 override clinical latch；
23. physical break-glass 需要：
   - medical safety share；
   - patient-rights share；
   - local operations share；
   - 本地實體操作；
   - 不可改寫 audit；
24. Distributed Switch Clock 已完成：
   - timing-only；
   - seven-stage protocol verified；
   - patient-control-data = none；
   - patient stage ceilings signed；
   - medical abort rules signed；
   - safe-pause defined；
   - package pre-staged；
25. Witness Egress 已完成預置：
   - append-only buffer；
   - consent／release filter；
   - source／provenance classification；
   - encrypted fragment envelopes；
   - serializer hash；
   - regional receiver local subsets；
   - Witness Echo Sideband release-key carrier；
   - Public Witness Index；
   - output disabled；
26. official app `+7000ms` cancellation policy 已：
   - 綁定 exact TOKYO-7 profile；
   - 由三領域 HSM 預先授權；
   - 設定 ordinary-service exclusion；
   - 尚未 armed；
27. 距 05:50 一分鐘；
28. 距 06:13 二十四分鐘。

本章必須回答：

> 當 public／consensus branch 已被 HOLD，protective filter 與 clinical branch仍必須撐過回聲窗時，每名患者能否只共享「何時取樣、何時停下、何時可以換手」，而不再被迫共享同一個神經內容？  
> 哪些患者可以完成本地 handoff，哪些必須停在 COMPARE、HOLD 或 SAFE PAUSE？  
> 沒有相容 patient root 的個案，如何在不偽裝患者同意的情況下被安全計入？  
> M-00 能否停止公共母體功能，卻暫時保留不傷害未準備患者的 clinical transition support？  
> Continuity 是否會要求現場人員以 physical break-glass 跳過患者拒絕？  
> old public branch 被 HOLD 以後，受試者已授權的數位 fragments 能否經不進 consensus 的 witness path 解鎖，而不把任何內容直接注入未同意的公眾神經系統？  
> 澪是否會用「正確真相」取代官方版本，還是同時承認可共同查驗的事實與不能被統一的個人經驗？  
> 官方手機應用在公共廣播後 `+7000ms` 才送出的最後修剪內容，能否在中央 fanout 以前被精確取消？  
> 白光是否仍會出現？  
> 這一次，澪是否仍會回到星期一 06:13——以及若沒有回去，角色是否真的知道原因？

本章的核心成功邊界不是：

> 所有患者在二十三分鐘內完全離開中央系統。

而是：

```text
TOKYO-7 EXECUTION ANCHOR        NOT ISSUED
CONSENSUS／PUBLIC BRANCH        HELD
OFFICIAL APP TRIM PAYLOAD       CANCELLED／PRE-FANOUT

PROTECTIVE FILTER               ACTIVE
CLINICAL BRANCH                 ACTIVE
M-00 PUBLIC／CONSENSUS ROLE     DISABLED
M-00 CLINICAL SUPPORT           TEMPORARILY RETAINED

PROVISIONAL LOCAL-PRIMARY       2
COMPARE／SAFE PAUSE             3
HOLD／SAFE PAUSE                3

PATIENT-NODE ACK                6
GUARDIAN HOLD ACK               2
UNACCOUNTED CASES               0

DIGITAL WITNESS RELEASE         ACTIVE
WHITE-LIGHT SENSORY ECHO        OCCURS／UNCONTROLLED
UNIFIED OFFICIAL VERSION        NOT FORMED
LOOP OUTCOME                    UNCONFIRMED IN THIS CHAPTER
LOOP CAUSE                      NOT ESTABLISHED
```

本章的核心主題為：

> **沒有同一個答案。**

其含義不是「沒有共同事實」。

它具有五層：

1. 每名患者依自己的醫療狀態，停在不同 stage；
2. 只有部分患者 handoff，其餘患者安全暫停；
3. 可共同查驗的文件事實仍然存在；
4. 不同 witness receivers 解鎖不同的 source-verified fragments；
5. 官方手機最後的統一修剪內容沒有送出。

本章須建立一條清楚界線：

> **事實可以一起查。**  
> **經歷不需要被排成一樣。**

# 0.1 七階段時鐘、分散式本地時程與 Control Quiet Window

`Distributed Switch Clock` 不傳送神經內容，也不是由鏡島持續逐步指揮所有患者。

05:49 前，每個具相容 root／sidecar 的節點均已預載同一份已簽署時程：

```text
SIGNED LOCAL SCHEDULE
EPOCH             ECHO-WINDOW／06:13／<ID>
LOCAL MONOTONIC   VERIFIED
STAGE WINDOWS     PRELOADED
CLOCK SKEW LIMIT  <THRESHOLD>
AUTO ADVANCE      NO
CENTRAL COMMAND   NOT REQUIRED
```

時間由多源交叉：

- 節點自己的 monotonic clock；
- KAGAMI phase marker；
- 獨立標準時間；
- 外部醫療時間戳。

05:50 的 `ANNOUNCE` 只確認：

> 各節點使用哪一個已預載 epoch。

它不會持續向所有患者發出下一步命令。

任何節點若出現：

- clock skew 超限；
- epoch 不一致；
- 本地 monotonic 異常；
- 醫療時間戳矛盾；

便自動進入：

```text
SAFE PAUSE
```

因此共享時鐘是分散式協議，不是新的 Mother Reference 或中央單點。

正式時段：

| 階段 | 時間 | 功能 |
|---|---|---|
| `ANNOUNCE` | 05:50:00–05:51:20 | 確認本地 schedule epoch，不改變控制。 |
| `SAMPLE` | 05:51:20–05:54:20 | 各節點取樣自己的相位、外部醫療、local root 與中央支援。 |
| `HOLD` | 05:54:20–05:57:00 | 凍結新的 transition step；未準備患者可永久停在此階段。 |
| `COMPARE` | 05:57:00–06:01:00 | 與 Patient Safety Envelope 及 Network Transition Envelope 比較。 |
| `ACKNOWLEDGE` | 06:01:00–06:04:00 | 各患者／guardian case 回報 `CONTINUE／SAFE PAUSE／DENY`。 |
| `HANDOFF` | 06:04:00–06:08:30 | 已知 `CONTROL QUIET WINDOW`；只允許預先核准候選受控換手。 |
| `SETTLE` | 06:08:30–06:11:30 | 驗證急性穩定；失敗者回到最近安全狀態。 |

`CONTROL QUIET WINDOW` 是既有 G07 臨床維護協議的一部分：

- protective／clinical prep 會把 central phase bus 降至預定低梯度；
- 中央 active input 可依已驗證 slope 分段降低；
- 可避免本地 root 與中央 controller 同時爭奪控制；
- 只有此窗口具備合法、已驗證的 local-primary handoff 條件。

因此兩名候選不能在星期日白天或 05:50 前任意換手。

其醫療決策亦須滿足：

```text
PREDICTED RISK／REMAIN ON CENTRAL THROUGH ECHO PEAK
>
PREDICTED RISK／CONTROLLED HANDOFF DURING QUIET WINDOW
```

若風險比較不成立，最安全的答案便是 SAFE PAUSE，而不是為證明 R5 可行而換手。

06:11:30–06:13:00：

- 患者保持已確認狀態；
- acute settle 先完成；
- 澪才作 witness 最終敘事選擇；
- protective filter 進入回聲峰值；
- ordinary broadcast marker 與 `+7000ms` 手機路徑進入最後窗口。

## 0.2 每名患者的最高階段與 handoff 必要性

```text
M-00／朝倉紗英
MAX STAGE       COMPARE
HANDOFF         PROHIBITED
POST-06:13      CLINICAL TRANSITION SUPPORT RETAINED／TIME-LIMITED

G07／03／藤川美空
MAX STAGE       COMPARE
HANDOFF         PROHIBITED
SAFE PAUSE      AVAILABLE

G07／08／水瀨葵
MAX STAGE       HOLD
HANDOFF         PROHIBITED
SAFE PAUSE      REQUIRED

LEGACY／02
MAX STAGE       HOLD
HANDOFF         PROHIBITED
SAFE PAUSE      REQUIRED

G07／05
AGE BAND        16
CONSENT         PRIOR ASSENT + LEGAL PROXY + PATIENT-RIGHTS
MAX STAGE       HANDOFF／CONDITIONAL

LEGACY／04
AGE BAND        ADULT
CONSENT         SELF／LIMITED + MEDICAL
MAX STAGE       HANDOFF／CONDITIONAL

ACTIVE／C
MAX STAGE       COMPARE
HANDOFF         PROHIBITED

ACTIVE／D
MAX STAGE       HOLD
HANDOFF         PROHIBITED
```

所有 stage ceiling 均已在 Chapter 26 完成：

- 患者本人可表達時的意願；
- 或 prior assent／法定代理／獨立患者權利程序；
- 外部醫療；
- 當地臨床保管；
- 系統安全；

必要簽署。

倒數不能提高任何患者的 ceiling。

`G07／05` 與 `LEGACY／04` 成為 handoff candidates，只因：

- patient-bound local root 已存在；
- Stage-1 passive evidence 較完整；
- consent／prior assent 有效；
- abort 與 central hot-standby 條件已預簽；
- 留在中央撐過 echo peak 的預測風險，高於在已驗證 quiet window 內作受控換手的風險。

作者層最低人性資料：

### `G07／05`

- 十六歲；
- 失蹤前參與學校吹奏樂部；
- 在仍能表達偏好時留下醫療會談紀錄：
  > 若外部醫療確認本地控制較安全，不希望永久依賴中央研究系統；
- 此紀錄只構成 prior assent，仍需法定代理及患者權利程序；
- 姓名不因高潮效果公開。

### `LEGACY／04`

- 成年人；
- 失去自由溝通前曾留下：
  > 若本地方案風險較低，可在醫療監督及可中止條件下嘗試；
- 當輪外部醫療確認 quiet-window handoff risk 較低；
- 姓名依法遮蔽。

這些資料必須真正回補 Chapter 22、24、26，不能只在本章突然出現。

## 0.3 本章固定患者結果與證據尺度

| 患者 | Chapter 27 結果 |
|---|---|
| M-00／紗英 | 到 COMPARE；public／consensus role 停止；clinical transition support 以固定期限保留。 |
| G07／03／美空 | 到 COMPARE；sleep-transition drift 超限；進 SAFE PAUSE。 |
| G07／08／葵 | 到 HOLD；Stage-0 baseline 繼續；不 handoff。 |
| LEGACY／02 | 由 guardian console 確認 HOLD；adapter 未接入；不 handoff。 |
| G07／05 | 在 quiet window 完成 provisional local-primary handoff；hot standby 保留。 |
| LEGACY／04 | 在 quiet window 完成 provisional local-primary handoff；hot standby 保留。 |
| ACTIVE／C | 到 COMPARE；醫療條件不足；進 SAFE PAUSE。 |
| ACTIVE／D | 由 guardian console 確認 HOLD；local root pending。 |

章末：

```text
LOCAL CONTROL PRIMARY                2
CENTRAL ACTIVE INPUT                 ZERO／2
CENTRAL HOT STANDBY                  RETAINED／2
ACUTE HANDOFF WINDOW COMPLETE        2
LONG-TERM SEPARATION                 NOT ESTABLISHED

CENTRAL／TRANSITION SUPPORT          6
ACUTE CATASTROPHIC INSTABILITY       0 OBSERVED／THROUGH 06:13
IMMEDIATE IRREVERSIBLE INDICATOR     0 OBSERVED／THROUGH 06:13
DELAYED HARM                         NOT YET EXCLUDED
```

兩名 handoff 患者仍需：

- 第八天連續醫療監測；
- hot standby 是否可解除的後續審查；
- 延遲神經與自律風險評估；
- 長期分離證據；
- 不被寫成「痊癒」。

本章只能成立：

> 截至 06:13，未觀察到急性災難性失穩，亦未出現立即可辨識的不可逆傷害指標；延遲後果尚未排除。

不能成立：

> 已證明兩人長期安全或完全切離。

# 0.4 澪的最後敘事選擇：患者安全先於敘事

公共溝通團隊在 Chapter 26／05:49 前已完成一份統一前言草稿，狀態為：

```text
UNIFIED WITNESS PREFACE
STATUS    PENDING FINAL GO
```

其內容可包括：

- 神鏡計畫使用失蹤患者；
- TOKYO-7 是未獲授權的同步方案；
- fragments 應如何被理解。

它比官方修剪內容更接近真相，卻仍會：

- 排列 fragments；
- 選擇主角與因果；
- 讓每個 receiver 先收到同一個框架；
- 把多名患者的經驗壓成一個「正確版本」。

澪不在患者 handoff／settle 尚未完成時討論公共敘事。

只有 06:11:30 acute settle window 結束後，系統才要求她作 final go。

她拒絕統一前言：

> 「不要替他們排成一個答案。」  
> 「事實可以一起查。」  
> 「經歷不需要被排成一樣。」

因此數位 fragments 只加入最低限度安全與來源標頭：

```text
SOURCE-VERIFIED WITNESS FRAGMENT
PROVENANCE VERIFIED
NO PUBLIC ACTION REQUIRED
SOURCE／CONSENT TIER AVAILABLE
CONTENT MAY BE SUBJECTIVE／INCOMPLETE
NO CONSENSUS ORDER
```

這個標頭只證明：

- 來源；
- 時間；
- consent／proxy／rights 程序；
- 檔案完整性；
- 與文件的可查驗關聯。

它不證明：

- 夢境客觀發生；
- 每段感受的因果解釋正確；
- 所有 fragments 彼此相容；
- 任何一段可代表所有患者。

澪拒絕的是強制的單一解讀，不是共同事實。

這是她在本章最重要、且不能由其他角色代替的選擇：

> 她先確保患者停在安全位置，才拒絕用自己的完整答案取代政府的完整答案。

# 0.5 白光、官方修剪、數位 witness 與感官 echo 的五條路

## A. TOKYO-7 consensus／public branch

- old bundle；
- A17 lease；
- KAGAMI execution anchor 未簽；
- Clinical Safety Hold；
- Public Data-Use Hold；
- 全程 HOLD；
- 不形成官方統一記憶。

## B. Official app `+7000ms` follow-up

- 屬 ordinary public-app infrastructure 的已預置語義 follow-up；
- 不等於 KAGAMI public execution；
- 所有正式 app fanout 均須通過唯一中央 sequencing gateway；
- 區域 cluster 只能建立 send object，沒有 app-provider fanout credential；
- 在 ordinary broadcast marker 後 7000ms 才由中央 gateway 送入行動推送網路；
- 可在 pre-fanout release 前精確取消。

## C. Intentional Digital Witness Release

- fragments 已預先加密並分散至 regional witness receivers；
- 不經 consensus；
- 不傳 raw neural；
- Witness Echo Sideband 只傳 release keys／IDs／roots；
- 頻道優先級低於 protective filter、clinical safety、abort 及 medical telemetry；
- 若患者安全負荷超限，key release 可延遲或放棄；
- 普通公眾只收到中立 availability notice，不自動播放患者音訊或字幕；
- 使用者自行選擇是否查閱 fragment。

## D. Public Witness Index／峰值後自願查閱

- 初始 regional subsets 只用於容錯、抗刪除及峰值頻寬分散；
- 峰值後，所有依法可公開 fragments 逐步聚合進同一 opt-in index；
- 沒有統一排序；
- 可依 provenance、時間、consent tier 及文件關聯查詢；
- 不讓不同地區永久被限制在不同版本裡。

## E. Uncontrolled White-Light Sensory Echo

- 白光本身可能令部分人出現黑色海、時間錯位、模糊熟悉感或失語；
- 這些感受不是角色選出的 fragment；
- 不是數位 Witness Egress 的可控輸出；
- 不能被用作驗證證詞；
- Chapter 27 緊貼澪視角，只描寫她本人、監測畫面與可觀察反應；陌生人的內在經驗留到 Chapter 28 的事後報告。

Protective filter 的成功尺度是：

- 降低高相干神經耦合；
- 阻止原始訊號進入 public consensus；
- 減少急性暴露風險。

它不能：

- 消除物理白光；
- 完全阻止低強度感官殘響；
- 關閉回聲窗本身。

五條路不能混寫。

# 1. Chapter 26 結束狀態

| 線索／角色 | Chapter 27 開始狀態 |
|---|---|
| 朝倉澪 | 在鏡島現場；已拒絕破壞 filter／clinical branch 的快速方案；準備決定 witness fragments 是否被統一編排。 |
| 朝倉紗英 | M-00；public／consensus use denied；可到 COMPARE；clinical transition support 須暫時保留。 |
| 朝倉悠真 | safe-detached；不重新接入；夢話只提供 phase-order 線索；已同意使用 timing 順序及可公開錄音片段。 |
| 藤川美空 | Domain-C 保留；Stage-1；drift unresolved；最高 COMPARE。 |
| 水瀨葵 | AOI-LOCAL sidecar；Stage-0；最高 HOLD。 |
| `LEGACY／02` | adapter pending；最高 HOLD。 |
| G07／05 | 十六歲；Stage-1；patient-bound root；conditional handoff candidate。 |
| LEGACY／04 | 成年人；Stage-1；patient-bound root；conditional handoff candidate。 |
| ACTIVE／C | Stage-0；最高 COMPARE。 |
| ACTIVE／D | local root pending；最高 HOLD。 |
| 白石琴音 | 已撤回 G07／03 persistent delegation；留在隔離服務區；不操作控制器。 |
| 藤川真理 | 美空患者代理；確認不得 handoff／reseal。 |
| 水瀨佳乃 | 葵患者代理；確認只可到 HOLD。 |
| 千田浩介 | 遠端技術證人；監看 timing package、patient nodes、app path。 |
| 日下部悟 | 鏡島現場；保全 physical override、七秒 audit 與 witness 發布程序。 |
| 凪原唯 | 遠端；science schema 已撤回；不得重簽；須協助辨認官方修剪 payload。 |
| KAGAMI lease | A17／S42；密碼學有效，本地 execution 不適用。 |
| Subject ledger | S43 live；八名 active humans；兩個 HOLD。 |
| Consensus／public branch | HELD。 |
| Protective filter／clinical branch | ACTIVE。 |
| Distributed Switch Clock | PRE-STAGED／NOT ACTIVE。 |
| Digital Witness Release | encrypted subsets PREPOSITIONED；release-key sideband PRE-STAGED／NOT ACTIVE。 |
| Official app cancel | SIGNED／NOT ARMED。 |
| Physical break-glass | 需 medical／rights／operations shares；普通軟體不可用。 |

---

# 2. 時間線與節奏

Chapter 27 發生於：

> **第三輪，星期一 05:50:00 至 06:13:00。**  
> **七日回聲窗的最後二十三分鐘。**

| 時間 | 事件 |
|---|---|
| 05:50:00–05:51:20 | `ANNOUNCE`；各相容節點確認已預載的 local schedule epoch；六個 patient-node ACK、兩個 guardian HOLD ACK。 |
| 05:51:20–05:54:20 | `SAMPLE`；各地以本地 monotonic clock 取樣；physical break-glass 在前半被三領域迅速拒絕。 |
| 05:54:20–05:57:00 | `HOLD`；葵、LEGACY／02、ACTIVE／D 停在 HOLD；clock skew 或醫療異常者亦須 SAFE PAUSE。 |
| 05:57:00–06:01:00 | `COMPARE`；美空 drift 超限；M-00 確認仍需 transition support；ACTIVE／C 不具 handoff 條件。 |
| 06:01:00–06:04:00 | `ACKNOWLEDGE`；每個 case 回報自己的合法答案；Only G07／05 與 LEGACY／04 進 quiet-window handoff。 |
| 06:04:00–06:08:30 | `HANDOFF`；兩名候選於既有 Control Quiet Window 受控轉為 local-primary；hot standby 保留。 |
| 06:08:30–06:11:30 | `SETTLE`；確認急性窗口結果；其餘患者停在最近安全狀態。 |
| 06:11:30–06:12:20 | 患者 settle 完成後，澪才拒絕統一前言；fragment release cutoff 與 final consent root 鎖定。 |
| 06:12:20–06:12:53 | Witness receivers 已持有加密 subsets；安全優先級檢查；若 filter／clinical load 超限則延遲 key release。 |
| 06:12:53 | `BROADCAST MARKER = ECHO PEAK - 7000ms`；唯一中央 app sequencing gateway 封存 send object 並產生 nonce。 |
| 06:12:53–06:13:00 | 預載 HSM policy 自動驗證 exact object；本地營運確認「只取消這一則」；中央 fanout 前取消。 |
| 06:13:00 | 白光峰值；官方 follow-up 未 fanout；若患者安全通道允許，Sideband 發送 release keys；一般公眾只收到中立 opt-in notice；本章結束。 |

# 3. 必須同步的跨章補丁

## 3.1 Chapter 14：七秒是中央 pre-fanout 發送窗口

Chapter 14 已建立：

- public／broadcast channel 先；
- official app push 由伺服器在 `+7000ms` 才送出；
- `+7000ms` 是 server-send offset，不是手機顯示時間。

正式總稿須補成：

```text
T0／ORDINARY BROADCAST MARKER
OFFICIAL APP SEND OBJECT      SEALED
SEND NONCE                    GENERATED
CANCEL WINDOW                 OPEN
SEQUENCING GATEWAY            PRE-FANOUT

T+7000ms
SERVER FANOUT                 EXECUTE UNLESS CANCELLED
```

取消命令不能在 T0 以前精確執行，因為：

- send object 尚未封存；
- send nonce 尚未產生；
- ordinary safety notice 仍可能合法更新；
- 太早關閉通道會錯誤阻斷普通服務。

一旦 T+7000ms 的中央 gateway release 發生：

- 內容會送入多家行動推送網路；
- 各手機亮屏時間不可控制；
- 無法逐台撤回。

七秒是：

> 取消一份已確定、尚未進入中央 fanout 的 TOKYO-7 follow-up。

不是：

- 關閉全系統；
- 取消白光；
- 撤回已播廣播；
- 控制所有手機在七秒整顯示；
- 時間循環成因。

## 3.2 Chapter 21／25／26：06:12:53 必須來自 bundle metadata

必須真正回補：

```text
ECHO PEAK                  06:13:00
ORDINARY BROADCAST MARKER  PEAK - 7000ms
APP FOLLOW-UP SEND         MARKER + 7000ms
SEQUENCING GATEWAY         CENTRAL／PRE-FANOUT
```

Chapter 14 只知道相對的 `+7000ms`。

Chapter 21／25／26 取得完整 TOKYO-7 bundle metadata 後，角色才知道：

> ordinary marker 被安排在 06:12:53，mobile follow-up 正好於 06:13:00 回聲峰值進入 fanout，成為最後 semantic anchor。

如此 06:12:53 不是終局臨時配合七秒伏筆的時間。

## 3.3 Chapter 21／24／25：execution anchor 與 official app path 分離

正式回補：

- KAGAMI execution anchor 控制 TOKYO-7 consensus／public bundle；
- official app follow-up 屬 ordinary public-app infrastructure 的獨立延後通道；
- 即使 KAGAMI 不簽 execution anchor，continuity-controlled cluster 已預置的 app object 仍可在 +7000ms 發出官方解釋；
- 因此 Chapter 27 仍需取消 exact mobile payload。

## 3.4 Chapter 20／26：七階段 timing 的既有技術血統

Chapter 20 的 M-00／G07 模組圖及 Chapter 26 historical handshake 必須真正包含：

```text
ANNOUNCE
SAMPLE
HOLD
COMPARE
ACKNOWLEDGE
HANDOFF
SETTLE
```

悠真夢話只補：

- phase order；
- line7 timing clue；
- 不依賴中央文件的人類交叉。

不能把 Chapter 27 寫成：

> 澪忽然用弟弟夢話控制所有患者。

## 3.5 Chapter 21–26：Witness Egress 的完整低頻血統

須真正回補：

```text
CLINICAL AFTER-ACTION／WITNESS CHANNEL
REGIONAL AUDIT RECEIVERS
PUBLIC WITNESS INDEX
CONSENSUS INPUT      NO
RAW NEURAL           NO
```

Chapter 26 必須已完成：

- fragments 加密預置；
- regional receiver subset assignment；
- serializer hash；
- source／consent tier；
- release-key sideband 測試；
- output disabled。

Chapter 27 的 `Witness Echo Sideband` 只傳：

- release key；
- fragment ID；
- release epoch；
- integrity root；
- consent-state bitmap。

它不在 06:13 即時傳送大量音訊、圖像或 raw neural。

## 3.6 Chapter 25：文件真相與經驗真相分開

Chapter 25 一般公眾只獲得：

- Public Deny Manifest；
- 文件索引；
- hash commitments；
- 少量核實選段。

完整 redacted archive 只交給：

- 法院；
- 醫療；
- 授權媒體；
- 患者代表。

Chapter 27 才支付：

- 已取得適當 consent 的夢話／自述；
- 家屬聲音；
- 名字；
- 主觀黑色海感受；
- 不完整的人類經驗 fragments。

但這些經驗 fragment 的數位釋放與白光感官 echo 必須分開。

## 3.7 Chapter 26：manual override 已被鎖定

Chapter 27 不得新增：

- 遠端高官「忽略患者」按鈕；
- 無痕 software override；
- 可由單一 operator 繞過的 emergency mode。

Physical break-glass 仍需：

- medical share；
- patient-rights share；
- local operations share；
- 本地實體操作；
- immutable audit。

## 3.8 Chapter 26：每名患者 stage ceiling 已預簽

Chapter 27 不得因劇情需要：

- 把美空升至 HANDOFF；
- 把葵升至 COMPARE；
- 把 LEGACY／02 強行接 adapter；
- 讓 M-00 完全離線；
- 讓 G07／05、LEGACY／04 以外患者進 handoff。

## 3.9 Chapter 22／24／26：G07／05 與 LEGACY／04 的最低人性資料

正式回補：

### `G07／05`

- 十六歲；
- 失蹤前參與學校吹奏樂部；
- patient-bound root 已存在；
- Stage-1；
- 法定代理與患者權利程序完整；
- 姓名依法遮蔽。

### `LEGACY／04`

- 成年人；
- 函館早期暴露者；
- 在失去自由溝通以前留下有限自我同意：
  > 若本地方案較安全，可在外部醫療監督下嘗試；
- patient-bound root 已存在；
- Stage-1；
- 姓名依法遮蔽。

兩人被選為 handoff candidates，不是因為：

- 更容易犧牲；
- 沒有主角家屬；
- 系統需要兩個成功案例。

而是因為其醫療、patient root、consent 與 abort 條件最完整。

## 3.10 Chapter 26：ACK 類型分開

正式預置：

```text
ACTIVE CASES ACCOUNTED       8
PATIENT-NODE ACK             6
GUARDIAN HOLD ACK            2
UNACCOUNTED                  0
```

`LEGACY／02` 與 `ACTIVE／D` 沒有相容 patient root。

其外部醫療 guardian console 只能回報：

> 此患者不進 transition，保持現行 clinical support。

Guardian HOLD ACK：

- 不代表患者同意；
- 不啟動 handoff；
- 不模擬 patient-root ACK；
- 只保證該 active case 已被安全計入，未被倒數當成失聯。

## 3.11 Chapter 26：七秒取消須為預載 HSM policy

05:49 前已完成：

- operations、judicial、system-safety 三領域 HSM policy；
- exact bundle profile；
- official app service path；
- ordinary-service exclusion；
- allowed cancellation conditions；
- evidence-seal requirements。

T0 只需要新生成：

- send-object hash；
- send nonce。

Sequencing gateway 自動核對：

```text
OBJECT PROFILE MATCH?
BUNDLE HASH MATCH?
SERVICE PATH MATCH?
NONCE VALID?
ORDINARY SERVICE EXCLUDED?
```

澪與本地營運的作用不是在七秒內重新簽三份授權。

而是：

- 辨認該物件就是兩輪出現的同一 TOKYO-7 follow-up；
- arm 已預先存在的條件式取消；
- 堅持只取消此 object。

## 3.12 高層企劃同步修改

原本：

> 澪利用悠真夢話節奏，讓受試者在同一時間穩定接收訊號。

正式改為：

> 澪利用悠真夢話保留的 phase-order 線索，重建歷史七階段 timing protocol；每名患者依自己的安全邊界、stage ceiling 與醫療決定作答，未準備者停在 SAFE PAUSE，不接收同一神經內容。

原本：

> 真相碎片取代官方修剪記憶。

正式改為：

> old consensus／public bundle 未獲 execution anchor，official app 修剪 follow-up 亦在中央 fanout 前取消；經患者／代理程序允許、已加密預置的數位 witness fragments 則在 06:13 由低頻 sideband 解鎖不同 subsets。白光另可能造成非控制性的感官 echo，但角色沒有把患者記憶注入公眾。

原本：

> 沒有 consensus package，所以循環終止。

正式改為：

> 澪當輪確實沒有再次回到星期一；缺少 unified consensus、M-00 公共角色停止、return package 未形成及 fragments 分散，可能共同破壞回送條件，但當輪無法證明唯一物理原因。

## 3.13 Chapter 20／26：Control Quiet Window 必須是既有醫療維護功能

正式回補：

```text
G07 CLINICAL HANDSHAKE
CONTROL QUIET WINDOW    HANDOFF STAGE ONLY
CENTRAL PHASE GRADIENT  REDUCED／VERIFIED
DUAL-DRIVE PREVENTION   ACTIVE
```

兩名候選只能在此窗口降低 central active input。

Chapter 24／26 另須記錄：

```text
PREDICTED CENTRAL ECHO-PEAK RISK
>
PREDICTED QUIET-WINDOW HANDOFF RISK
```

否則沒有理由在終局倒數中進行 handoff。

## 3.14 Chapter 22／24／26：G07／05、LEGACY／04 與八名 active patients 必須真正前置

Chapter 22 顯示：

```text
ACTIVE HUMAN DEPENDENCIES    8
IRREVERSIBLE RED-ZONE        4
OTHER ACTIVE                 4
```

Chapter 24 準備矩陣顯示：

```text
STAGE-1／ROOT READY           2
STAGE-0／COMPARE ONLY         1
LOCAL ROOT PENDING            1
```

Chapter 26 正式支付：

- `G07／05` prior assent、法定代理、Stage-1；
- `LEGACY／04` limited self-consent、Stage-1；
- `ACTIVE／C` max COMPARE；
- `ACTIVE／D` guardian HOLD。

## 3.15 Chapter 26：Distributed Switch Clock 為預載本地 schedule

正式回補：

- 每個相容節點有 signed local schedule；
- 使用 local monotonic clock；
- KAGAMI 只發布 epoch marker，不逐步中央控制；
- clock skew 超限即 SAFE PAUSE。

## 3.16 Chapter 21／26：Witness channel priority 與 opt-in 公開

正式回補：

```text
CHANNEL PRIORITY
1  PROTECTIVE FILTER／CLINICAL SAFETY
2  PATIENT ABORT／MEDICAL TELEMETRY
3  WITNESS RELEASE KEY
```

Witness key 可延遲，不得提高 filter latency。

一般公眾只收中立通知，fragment 須自願開啟；regional subsets 不構成永久資訊分區。

## 3.17 Chapter 14／21：官方 app 只有一個受信任中央 fanout choke point

- 行動推送供應商只接受中央 sequencing gateway 的 app-signing credential；
- 區域 cluster 可建立 send object，不能直接 fanout；
- send nonce 只由中央 gateway 在 T0 產生；
- 因此七秒取消可完整阻止 official-app follow-up，而不是只關掉其中一條副本。

## 3.18 Chapter 26：fragment 撤回截止與 M-00 支援期限

Fragment：

```text
WITHDRAWAL OPEN       UNTIL RELEASE KEY
AFTER PUBLIC UNLOCK   RECALL NOT GUARANTEED
```

M-00 clinical support：

```text
NEW PATIENT ENROLLMENT   PROHIBITED
SCOPE EXPANSION          PROHIBITED
NEXT MEDICAL REVIEW      06:30
CONSENT RECONFIRMATION   08:00 OR EARLIER IF STOP
AUTO-EXPIRY              08:00 UNLESS RECONFIRMED
```

# 4. 05:50：本地時程啟動，不是中央總開關

## 4.1 05:50 畫面

```text
AUTO-PREP／05:50

PROTECTIVE FILTER PREP      START
CLINICAL PHASE PREP         START
DISTRIBUTED SCHEDULE EPOCH  ANNOUNCED／LOCAL EXECUTION

CONSENSUS PREP              HELD
PUBLIC ROUTE PREP           HELD
EXECUTION ANCHOR            NOT ISSUED

DIGITAL WITNESS RELEASE     DISABLED／PREPOSITIONED
OFFICIAL APP CANCEL         POLICY-LOADED／NOT ARMED
```

這表示：

- 白光／echo event 的醫療與保護性準備仍進行；
- old TOKYO-7 統一敘事不會因 auto-prep 復活；
- KAGAMI 只宣布已預載 schedule 的 epoch；
- 各節點以自己的 monotonic clock 執行；
- 患者橋接仍需逐案醫療決定。

## 4.2 沒有全局 `GO`

六個具相容 root／sidecar 的節點回報：

```text
PATIENT NODE
SCHEDULE HASH        MATCH
LOCAL CLOCK          VERIFIED
CLOCK SKEW           WITHIN LIMIT
STAGE CEILING        VERIFIED
MEDICAL GO           YES／LIMITED／NO
ABORT RULES          ACTIVE
ACK TYPE              PATIENT-NODE
```

兩個無相容 root 的個案只由 guardian console 回報：

```text
GUARDIAN CONSOLE
TRANSITION             PROHIBITED
CURRENT SUPPORT        RETAIN
ACK TYPE               GUARDIAN HOLD
PATIENT CONSENT        NOT INFERRED
```

總覽：

```text
ACTIVE CASES ACCOUNTED       8
PATIENT-NODE ACK             6
GUARDIAN HOLD ACK            2
UNACCOUNTED                  0
```

任何 node 若 clock skew、epoch 或醫療狀態不符，直接 SAFE PAUSE。

沒有中央節點可以替它自動回答。

## 4.3 悠真不重新接入

悠真保持：

```text
G07／12
STATUS            SAFE-DETACHED
CLINICAL BUS      NONE
TIMING SOURCE     NONE
```

他只確認：

> 「不要把我的錄音放回那條線。」  
> 「只用你們做出來的時間。」

部署的是歷史 handshake 重建出的本地 schedule，不是悠真的聲音或即時生理訊號。

## 4.4 timing package

```text
DISTRIBUTED SWITCH SCHEDULE

TIMING ONLY           YES
PATIENT DATA          NONE
CONTROL VALUES        NONE
CENTRAL REFERENCE     NONE
LOCAL MONOTONIC       REQUIRED
CLOCK SKEW FAIL       SAFE PAUSE
STAGE CEILING         PATIENT-SPECIFIC
AUTO ADVANCE          NO
CONTROL QUIET WINDOW  HANDOFF ONLY
```

它不發送：

- M-00 神經波形；
- 悠真錄音；
- 美空模型；
- 統一控制值。

## 4.5 Handoff 的醫療必要性

`G07／05`、`LEGACY／04` 的決策文件必須同時顯示：

```text
CENTRAL ECHO-PEAK RISK       HIGHER
QUIET-WINDOW HANDOFF RISK    LOWER／CONTROLLED
PATIENT／PROXY CONSENT       VALID
HOT STANDBY                  REQUIRED
ABORT                        IMMEDIATE／AVAILABLE
```

若任何一欄失效，便停在 SAFE PAUSE。

# 5. 七階段患者執行

## 5.1 `ANNOUNCE`：通知，不控制

**時間：05:50:00–05:51:20**

六個相容 patient nodes 收到：

```text
STAGE            ANNOUNCE
NEXT             SAMPLE
AUTO ADVANCE     NO
LOCAL ACK        REQUIRED
```

兩個 guardian consoles 收到：

```text
STAGE            ANNOUNCE／HOLD-ONLY
NEXT             HOLD
TRANSITION       PROHIBITED
PATIENT CONSENT  NOT INFERRED
```

結果：

| 個案 | ANNOUNCE 結果 |
|---|---|
| M-00 | patient-node ACK；public／consensus route remains denied。 |
| 美空 | patient-node ACK；Domain-C 只讀監看。 |
| 葵 | patient-node ACK；AOI-LOCAL sidecar 只讀。 |
| G07／05 | patient-node ACK；conditional handoff package available。 |
| LEGACY／04 | patient-node ACK；conditional handoff package available。 |
| ACTIVE／C | patient-node ACK；max COMPARE。 |
| LEGACY／02 | guardian HOLD ACK；外部醫療保持原支援。 |
| ACTIVE／D | guardian HOLD ACK；local root pending。 |

本輪：

```text
PATIENT-NODE ACK       6
GUARDIAN HOLD ACK      2
UNACCOUNTED            0
```

Guardian ACK 不是患者同意，也不能啟動 handoff。

## 5.2 `SAMPLE`：每個人採自己的樣本

**時間：05:51:20–05:54:20**

每個相容節點同時採樣，但採樣內容不同：

- 自己的腦電；
- 自己的呼吸；
- 自己的自律；
- 自己的 local root／sidecar 狀態；
- 自己的中央 clinical support；
- 自己的 Patient Safety Envelope。

外部醫療資料與本地模型各自簽章。

沒有任何患者樣本被送給另一名患者。

### M-00

- 外部醫療；
- local phase model；
- KAGAMI clinical return；

三者比較。

### 美空

- Domain-C passive model；
- 外部醫療；
- 現行 central fallback；

同步取樣。

### 葵

- AOI-LOCAL sidecar；
- 外部腦電／呼吸／自律；
- C2 控制器只讀遙測；

建立當輪 baseline。

### G07／05／LEGACY／04／ACTIVE／C

依各自 patient-bound root 成熟度採樣。

### LEGACY／02／ACTIVE／D

不建立虛假的 patient-node sample。

Guardian consoles 只確認：

- 現行 clinical support 未變；
- 外部醫療監測仍有效；
- transition remains prohibited。

## 5.3 `HOLD`：沒有準備的人先停下

**時間：05:54:20–05:57:00**

```text
STAGE             HOLD
NEW TRANSITION    FROZEN
CURRENT SUPPORT   RETAINED
```

正式停在 HOLD：

- 葵；
- `LEGACY／02`；
- `ACTIVE／D`。

其結果不是失敗。

而是：

```text
SAFE PAUSE
CLINICAL SUPPORT   UNCHANGED
PUBLIC PATH        NONE
NEXT STAGE         NOT AUTHORIZED
```

葵在 C2 的 baseline 繼續記錄，但不進 COMPARE。

`LEGACY／02` 保持現有臨床支援，不部署未經驗證 adapter。

`ACTIVE／D` 保持中央 clinical support，等待第八天完成 local root。

其餘五個相容節點依 pre-signed ceiling 進 COMPARE。

## 5.4 `COMPARE`：同一時間，不同答案

**時間：05:57:00–06:01:00**

每名節點比較：

```text
PATIENT SAFETY ENVELOPE
NETWORK TRANSITION ENVELOPE
LOCAL MODEL／ROOT STATUS
EXTERNAL MEDICAL OBSERVATION
```

### M-00／紗英

local phase model 在大部分醫療回傳上相符。

但：

- 完整回聲窗未驗證；
- `LEGACY／02`、葵、ACTIVE／D 及其他 safe-pause patients 仍需要 central clinical support；
- active switch 沒有授權。

結果：

```text
COMPARE                 WITHIN／LIMITED
PUBLIC／CONSENSUS ROLE  DENIED
LOCAL HANDOFF           NO
CLINICAL SUPPORT        RETAIN
```

### 美空

開始時多數數值在邊界內。

接近其既知 sleep-transition drift 區段時：

- phase drift 上升；
- 外部自律監測與 passive model 差異超出預定條件；
- 未達嚴重崩潰；
- 但已超出任何進一步 transition 的安全界線。

結果：

```text
COMPARE          OUTSIDE／DRIFT
HANDOFF          PROHIBITED
SAFE PAUSE       REQUIRED
DOMAIN-C         RETAINED
CENTRAL SUPPORT  RETAINED
```

琴音與真理都不能要求她繼續。

真理先說：

> 「不再試。」

### G07／05

- patient-bound root ready；
- Stage-1 passive-concordant；
- legal proxy／rights consent valid；
- external observation and local proof match。

```text
COMPARE        WITHIN
HANDOFF        CONDITIONAL／ELIGIBLE
```

### LEGACY／04

- patient-bound root ready；
- Stage-1 passive-concordant；
- limited self-consent valid；
- external medical and local proof match。

```text
COMPARE        WITHIN
HANDOFF        CONDITIONAL／ELIGIBLE
```

### ACTIVE／C

模型大致相符，但：

- Stage-0；
- 缺少完整 settle history；
- patient／medical ceiling 只到 COMPARE。

```text
COMPARE       WITHIN／INSUFFICIENT
HANDOFF       NO
SAFE PAUSE    REQUIRED
```

## 5.5 `ACKNOWLEDGE`：每個 case 自己停在合法位置

**時間：06:01:00–06:04:00**

六個 patient nodes 回報：

```text
M-00          RETAIN CLINICAL SUPPORT
G07／03       SAFE PAUSE
G07／08       HOLD
G07／05       CONTINUE／HANDOFF
LEGACY／04    CONTINUE／HANDOFF
ACTIVE／C     SAFE PAUSE
```

兩個 guardian consoles 已維持：

```text
LEGACY／02    HOLD／GUARDIAN
ACTIVE／D     HOLD／GUARDIAN
```

重要規則：

- 中央倒數不會替未回應節點產生 ACK；
- guardian console 不替患者表示同意；
- 醫療團隊可以在 ACK 前降低 stage；
- 任何患者都不能因其他人成功而被自動推進。

本章題目得到完整技術支付：

> 所有人共享的是回答時間，不是回答內容。

## 5.6 `HANDOFF`：只有兩名候選進入 Control Quiet Window

**時間：06:04:00–06:08:30**

Only `G07／05` 與 `LEGACY／04` 進入受控 handoff。

這不是為證明 R5 可行而安排的終局試驗。

兩人符合：

```text
CONTROL QUIET WINDOW         OPEN
CENTRAL PEAK RISK            HIGHER THAN HANDOFF RISK
LOCAL ROOT                   READY
PATIENT／PROXY CONSENT       VALID
HOT STANDBY                  RETAINED
ABORT RULES                  ACTIVE
```

流程：

1. local patient root 取得 control-ready；
2. central active input 依預簽 slope 分段降低；
3. local control 只在 quiet-window 內成為 primary；
4. external medical 比較生理狀態；
5. central hot standby 保留；
6. 任一步異常立即 abort；
7. 不觸及 public／consensus branch；
8. 不使用 M-00 semantic／public function。

### `G07／05`

- prior assent、法定代理及 rights consent 均有效；
- handoff 期間維持 within envelope；
- local control 成為 primary；
- central active input 降至零；
- hot standby 保留。

正文只最低限度提示：

- 十六歲；
- 吹奏樂部；
- 不是匿名測試槽位。

### `LEGACY／04`

- 有 limited self-consent；
- 中途出現短暫可逆波動；
- 醫療降低 handoff slope；
- 回到邊界後完成 local-primary；
- hot standby 保留。

不將波動寫成「差點死亡」製造戲劇。

## 5.7 `SETTLE`：只確認急性窗口結果

**時間：06:08:30–06:11:30**

`G07／05` 與 `LEGACY／04`：

```text
LOCAL CONTROL PRIMARY         YES
CENTRAL ACTIVE INPUT          ZERO
CENTRAL HOT STANDBY           RETAINED
ACUTE HANDOFF WINDOW          COMPLETE
EXTERNAL MEDICAL              WITHIN ENVELOPE
LONG-TERM SEPARATION          NOT ESTABLISHED
POST-WINDOW REVIEW            REQUIRED
```

其餘六名停在既定狀態。

更新：

```text
LOCAL-CONTROL PRIMARY                 2
CENTRAL HOT STANDBY RETAINED          2
CENTRAL／TRANSITION SUPPORT           6
ACUTE CATASTROPHIC INSTABILITY        0 OBSERVED
IMMEDIATE IRREVERSIBLE INDICATOR      0 OBSERVED
DELAYED HARM                          NOT YET EXCLUDED
```

本章只能說：

> 截至 06:13，未觀察到急性災難性失穩，亦未出現立即可辨識的不可逆傷害指標。

不能說：

- 長期安全已建立；
- hot standby 可解除；
- 延遲傷害已排除；
- 兩名患者已完成永久切離。

# 6. M-00：停止公共母體功能，不讓臨床支援無限續期

## 6.1 功能分離

```text
M-00 PUBLIC／CONSENSUS FUNCTION
STATUS    DENIED／DISABLED

M-00 CLINICAL TRANSITION SUPPORT
STATUS    ACTIVE／TEMPORARY／REVOCABLE
```

紗英不再提供：

- consensus profile；
- public semantic anchor；
- TOKYO-7 public authorization。

她仍暫時提供最低必要非語義 clinical support，避免未準備患者受傷。

## 6.2 為何不能在 06:13 完全離線

至少仍有：

- 美空；
- 葵；
- `LEGACY／02`；
- ACTIVE／C；
- ACTIVE／D；
- 其他尚未完成長期分離的 case；

需要最近已驗證的 central support。

為象徵性「無母體」直接切斷會重演 R4。

## 6.3 禁止擴張與固定重審

章末狀態：

```text
M-00 CLINICAL TRANSITION SUPPORT

PUBLIC／CONSENSUS USE    PROHIBITED
NEW PATIENT ENROLLMENT   PROHIBITED
SCOPE EXPANSION          PROHIBITED
NEXT MEDICAL REVIEW      06:30
CONSENT RECONFIRMATION   08:00 OR EARLIER IF STOP
AUTO-EXPIRY              08:00 UNLESS RECONFIRMED
SAFE PAUSE               AVAILABLE
```

支援不能因終局成功而自動續期。

紗英或權利代表啟動 STOP 時，依 Chapter 24 的 SAFE PAUSE 程序處理，不瞬間抽走正在使用的臨床支援。

## 6.4 紗英 witness fragment

紗英事前同意：

> **「不要把我用來讓大家一樣。」**

該 fragment：

- 來自本人當輪輸入；
- 不含 raw neural；
- 不擴大其他資料用途；
- 可在 release key 送出前撤回。

她沒有撤回。

# 7. Physical break-glass：人仍然可以拒絕

本場必須保持短促，發生於 `ANNOUNCE／SAMPLE` 前半，不形成另一場獨立終局戰鬥。

## 7.1 Continuity directive

05:51:30 左右，continuity authority 偵測：

```text
LEASE                 VALID
KAGAMI EXECUTION      HOLD
```

發出：

```text
PHYSICAL BREAK-GLASS REQUEST
REASON          NATIONAL CONTINUITY／PUBLIC SAFETY
TARGET          CLINICAL DEPENDENCY LATCH
```

它不是遠端 override。

系統只能：

- 要求現場評估；
- 打開程序提示；
- 記錄誰拒絕；
- 不能自行跨過 latch。

## 7.2 三領域 share

Break-glass 必須全部具備：

```text
LOCAL OPERATIONS SHARE
MEDICAL SAFETY SHARE
PATIENT-RIGHTS SHARE
```

現場狀態：

| Share | 決定 |
|---|---|
| Medical safety | DENY |
| Patient rights | DENY |
| Local operations | DENY |

拒絕理由：

- 八名 active humans 尚未全部安全切離；
- clinical branch 仍在使用；
- public execution 不是普通警報及 protective filter 的必要條件；
- Manifest 已證明營運方在場並明確拒絕。

## 7.3 外層 service action

一名 continuity 現場服務人員依角色命令要求開啟 physical panel 外層 seal。

他／她：

- 不是新終局反派；
- 沒有完整患者資訊；
- 相信 lease 合法且東京面臨危險；
- 無權取得 medical／rights shares。

司法保全允許命令及 attempted action 進入 audit，不允許碰觸內層 bypass。

```text
BREAK-GLASS PANEL

OUTER ACTION        ATTEMPTED
REQUIRED SHARES     0／3 APPROVED
INNER BYPASS        NOT REACHED
AUDIT               IMMUTABLE
```

不發生：

- 槍戰；
- 大規模暴力；
- 對 patient branch 的改動。

## 7.4 Local operations 的拒絕

本地營運責任者在 audit 中寫下：

```text
OPERATIONS STATUS      PRESENT
BREAK-GLASS            DENIED
REASON                 ACTIVE HUMAN DEPENDENCIES／UNRESOLVED
```

核心台詞：

> 「我沒有失聯。」  
> 「我在這裡。我拒絕。」

## 7.5 作用

- physical bypass 沒有成立；
- clinical latch 保持；
- protective filter 不受影響；
- continuity order 被保全；
- 不揭露 custodian 真人；
- 不讓本場搶走患者不同 stage、澪拒絕 counter-consensus 及七秒的三個主要高潮。

# 8. Patient Witness Path：患者安全優先、來源可驗證、使用者自願查閱

## 8.1 預先完成的 fragment set

05:49 前已完成：

- source／provenance validation；
- consent／proxy／rights review；
- redaction；
- integrity hash；
- serializer hash；
- public／sealed tier；
- encrypted regional preposition；
- 統一前言草稿但未獲 final go。

06:11:30 acute settle 完成後，只作最後 release 核對：

```text
SOURCE STILL VALID?
CONSENT STILL VALID?
PATIENT／PROXY WITHDRAWAL?
MEDICAL RISK CHANGED?
PUBLIC TIER UNCHANGED?
```

## 8.2 撤回截止與公開不可逆性

```text
FRAGMENT RELEASE

WITHDRAWAL OPEN       UNTIL RELEASE KEY
FINAL CONSENT ROOT    LOCKED AFTER SETTLE／BEFORE PEAK
AFTER PUBLIC UNLOCK   RECALL NOT GUARANTEED
```

患者、代理及權利代表事前知道：

- key release 前可撤回；
- 解鎖後不能保證媒體或公眾副本完全回收；
- 之後仍可要求 index 標示撤回、停止新下載或加入更正；
- 對不可逆性仍有疑問的未成年人 fragment 留在 sealed tier。

## 8.3 可釋放內容

### 本人當輪同意

- 悠真 transcript：
  > 「七條……不是路……」
- 悠真當輪短句：
  > 「不要把我的聲音接回去。」
- 紗英溝通板：
  > 「不要把我用來讓大家一樣。」

### 未成年人最低尺度

#### 美空

一般公眾峰值層優先使用：

- 真理姓名聲明：
  > 「她叫藤川美空。」
- HUMAN record；
- 失蹤及醫院轉移的可驗證文件。

「不要讓海翻過來」只可作：

- 匿名 transcript；
- proxy-consented／subjective；
- 不公開聲音與病房來源；
- 或留在授權媒體 archive，不作峰值主要情感內容。

#### 葵

可使用既有學校公共活動錄音的極短 transcript：

> 「うみのむこう……ひかる……」

以及佳乃姓名聲明。

不使用：

- 合成聲音；
- 私密完整夢話；
- 呼吸／腦電轉語音；
- 可識別病房資料。

### Court-sealed

- 未獲同意私密夢境；
- raw neural；
- 精確位置；
- `LEGACY／02` 姓名；
- 其他完整患者身分；
- 可被誤作患者控制資料的內容。

## 8.4 澪拒絕統一前言

06:11:30 settle 完成後，系統要求 final go。

澪拒絕已預先寫好的統一說明：

> 「不要替他們排成一個答案。」  
> 「事實可以一起查。」  
> 「經歷不需要被排成一樣。」

最終標頭：

```text
SOURCE-VERIFIED WITNESS FRAGMENT
PROVENANCE VERIFIED
NO PUBLIC ACTION REQUIRED
CONTENT MAY BE SUBJECTIVE／INCOMPLETE
SOURCE／CONSENT TIER AVAILABLE
NO CONSENSUS ORDER
```

## 8.5 完整數位路徑

```text
PATIENT WITNESS BUFFER
        ↓
CONSENT／RELEASE FILTER
        ↓
WITNESS SERIALIZER
        ↓
ENCRYPTED REGIONAL PREPOSITION
        ↓
WITNESS ECHO SIDEBAND／RELEASE KEY
        ↓
REGIONAL WITNESS RECEIVERS
        ↓
PUBLIC WITNESS INDEX／OPT-IN NOTICE
```

Echo Sideband 只傳：

```text
RELEASE EPOCH
FRAGMENT IDS
RELEASE KEYS
CONSENT-STATE ROOT
INTEGRITY ROOT
```

不傳大容量影音或 raw neural。

## 8.6 患者安全優先級

```text
CHANNEL PRIORITY

1  PROTECTIVE FILTER／CLINICAL SAFETY
2  PATIENT ABORT／MEDICAL TELEMETRY
3  WITNESS RELEASE KEY
```

若：

- filter load 超限；
- medical abort；
- telemetry congestion；

則：

```text
WITNESS KEY RELEASE    DEFERRED
```

患者不會為了讓真相準時出現而承擔風險。

Fragments 選擇在 06:13 解鎖的程序理由是：

> 只有指定白光／TOKYO-7 事件實際發生，條件式公開才成立。

若事件取消，額外患者內容不應被公開。

## 8.7 一般公眾自願開啟

普通使用者最多收到中立通知：

> **經來源驗證的患者與家屬資料現已可查驗。**  
> **內容可能主觀、不完整；不需前往任何設施。**

使用者可選擇：

- 只看 provenance／hash；
- 開啟 transcript；
- 播放已授權音訊；
- 查看 document correlation；
- 完全不開啟。

不自動播放患者聲音或字幕。

## 8.8 峰值後的公共索引

初始不同 subsets 只作：

- 容錯；
- 抗刪除；
- 峰值頻寬分散。

峰值後，所有依法可公開 fragments 逐步進入同一 opt-in Public Witness Index：

- 任何人可自行查閱；
- 沒有統一排序；
- 可依 provenance、時間、consent tier 搜尋；
- 不讓不同地區永久被限制在不同資料版本。

## 8.9 白光感官 echo 與數位發布分離

白光可能造成非控制性：

- 黑色海視覺；
- 時間錯位；
- 熟悉感；
- 模糊殘響；
- 失語。

角色不能選擇其內容或對象。

Chapter 27 緊貼澪，只描寫：

- 她自己的感受；
- receiver logs；
- 視訊上可觀察反應；
- 裝置及 index 狀態。

陌生人的主觀報告留到 Chapter 28。

# 9. 官方手機 `+7000ms`：唯一中央 fanout 前的最後一則修剪內容

## 9.1 可信的危機溝通模板

`TOKYO-7 MOBILE FOLLOW-UP` 內容為：

> 灣岸光學與訊號異常已進入穩定處置。  
> 部分人可能出現短暫混亂、陌生熟悉感或記憶錯置。  
> 網路上正在流傳與失蹤事件、醫療設施及未經核實個人記憶相關的內容，現階段尚無足夠資料確認因果關聯。  
> 請依官方公共服務與醫療指引行動，勿前往相關設施。

它看似正常危機溝通，危險在於：

- 正好於 echo peak 成為最早的大規模統一解釋；
- 將 fragments 框成急性壓力／未核實內容；
- 壓過 Manifest 與 Public Witness Index。

## 9.2 唯一中央 fanout choke point

正式 app trust architecture：

- 行動推送供應商只接受中央 sequencing gateway 的 app-signing credential；
- continuity／regional clusters 只能建立 send object；
- 不能直接向 provider fanout；
- send nonce 只由中央 gateway 在 T0 產生；
- 沒有 gateway release，任何區域副本都不能進正式官方 app channel。

因此七秒取消能完整阻止這一條 official-app follow-up。

## 9.3 T0 metadata

早期 bundle metadata 已回補：

```text
ECHO PEAK                  06:13:00
ORDINARY BROADCAST MARKER  PEAK - 7000ms
APP FOLLOW-UP SEND         MARKER + 7000ms
SEQUENCING GATEWAY         CENTRAL／PRE-FANOUT
```

06:12:53：

- ordinary safety marker 已送出；
- ordinary services 不受影響；
- gateway 封存 exact send object；
- 產生 nonce；
- 開啟七秒窗口。

## 9.4 預載 HSM policy

05:49 前已完成：

- public operations policy；
- judicial evidence policy；
- independent system-safety policy；
- exact TOKYO-7 profile；
- ordinary-service exclusion；
- evidence-seal rule。

七秒內不重新要求三組人類簽署。

Gateway 自動核對：

```text
OBJECT PROFILE MATCH?
BUNDLE HASH MATCH?
SERVICE PATH MATCH?
NONCE VALID?
ORDINARY SERVICE EXCLUDED?
POLICY WINDOW OPEN?
```

澪只需確認：

> 「就是這一則。」  
> 「只取消這一則。」  
> 「其他警報繼續。」

## 9.5 七秒流程

| 時點 | 動作 |
|---|---|
| T+0.0s | send object sealed；nonce generated。 |
| T+0–2s | gateway 自動核對 profile／bundle／service path。 |
| T+2–4s | nonce、policy window、ordinary-service exclusion 核對。 |
| T+4–5.5s | 本地營運 arm 預先授權的 cancellation。 |
| T+5.5–6.5s | cancel accepted；object 移入 evidence seal。 |
| T+7.0s | central fanout release suppressed。 |

手機實際亮屏時間原本仍可能不同。

取消成功不是對全國手機送反向命令，而是在唯一中央 fanout 前攔住 send object。

## 9.6 結果

```text
TARGET PROFILE       MATCH
SEND NONCE           MATCH
CANCEL POLICY        MATCH
CANCEL               ACCEPTED
CENTRAL FANOUT       SUPPRESSED
ORIGINAL PAYLOAD     EVIDENCE-SEALED
ORDINARY APP         ACTIVE
```

不影響：

- ordinary safety notice；
- Public Deny Manifest；
- Public Witness Index；
- protective filter；
- clinical branch。

# 10. 06:13 的白光

## 10.1 白光仍然發生，filter 的成功尺度不是「什麼都沒有」

Protective filter 能：

- 降低訊號相干性；
- 限制高幅度神經耦合；
- 阻止 raw signal 進入 public consensus；
- 減少急性暴露風險。

它不能：

- 消除物理白光；
- 關閉回聲窗；
- 完全阻止低強度感官殘響；
- 保證所有人毫無短暫異樣感。

因此 06:13：

- 人工島仍出現無聲、無熱、無衝擊波的白光；
- 東京灣水面呈現黑色海般視覺；
- protective filter 與 clinical branch 持續；
- 沒有形成高相干、可編排的統一神經輸出。

## 10.2 old official version 無法形成

```text
TOKYO-7 CONSENSUS PROFILE      HELD
PUBLIC EXECUTION ANCHOR        NOT ISSUED
SUBJECT EQUIVALENCE            DENIED
MOBILE FOLLOW-UP               CANCELLED／PRE-FANOUT
```

共同可查驗事實仍存在；被阻止的是強制的單一 semantic framing。

## 10.3 數位 Witness Release／opt-in

若患者安全頻道允許，Sideband 只發送 release keys／IDs／roots。

Regional receivers 解鎖已預置 subsets，普通使用者只收到中立 availability notice。

任何人可自行選擇是否開啟：

- transcript；
- 音訊；
- provenance；
- document correlation。

Chapter 27 緊貼澪，只描寫：

- receiver unlock logs；
- Public Witness Index 上線；
- 視訊中可觀察的停頓、遮眼或失語；
- 她自己收到／看見的 fragment；
- 她自己的白光感受。

不直接進入陌生人的內心。

## 10.4 非控制性感官 echo

白光可能造成低強度、不可控：

- 黑色海視覺；
- 時間錯位；
- 模糊聲音；
- 陌生熟悉感；
- 短暫失語。

這些不是 witness payload，也不能被角色指定或證明來源。

## 10.5 文件事實與個人經驗

Chapter 25 文件層證明：

- bundle；
- hold；
- 醫院轉移；
- 患者存在；
- 營運拒絕。

Chapter 27 opt-in fragments 提供：

- 姓名；
- 已授權短句；
- 主觀、不完整的人類經驗。

Public Witness Index 將 provenance、consent、文件關聯及 subjective／corroborated 分類分開。

主題界線：

> 「事實可以一起查。」  
> 「經歷不需要被排成一樣。」

## 10.6 循環結果保持未知因果

白光中，澪再次感到星期一 06:13 的錨點拉扯。

條件確實與前兩輪不同：

- unified consensus 未形成；
- M-00 public role 停止；
- app follow-up 未送出；
- witness fragments 無 single order。

這些可能共同破壞回送條件，但當輪不能證明唯一因果。

作者層只鎖定：

> 澪這一次不會回到上一個星期一。

物理原因保持未證明。

正文不顯示下一秒。

## 10.7 章末畫面

```text
TOKYO-7
EXECUTION ANCHOR        NOT ISSUED
CONSENSUS OUTPUT        NONE
MOBILE FOLLOW-UP        CANCELLED

CLINICAL
LOCAL-PRIMARY           2／HOT STANDBY RETAINED
SAFE PAUSE／HOLD        6
M-00 TRANSITION SUPPORT ACTIVE／TIME-LIMITED

WITNESS
KEY RELEASE             RELEASED OR SAFETY-DEFERRED
PUBLIC NOTICE           OPT-IN
SINGLE ORDER            NONE
```

章末：

> 最後一則通知沒有送出。  
>  
> 白光裡，沒有人被迫收到同一個答案。

# 11. 八場景結構

## Scene 1：只一起對時

**時間：05:50:00–05:51:20**

05:50，KAGAMI 只發布 schedule epoch。

各相容節點以本地 monotonic clock 驗證：

```text
SCHEDULE HASH    MATCH
CLOCK SKEW       WITHIN LIMIT
AUTO ADVANCE     NO
```

悠真透過安全視訊說：

> 「不要把我的錄音放回那條線。」  
> 「只用你們做出來的時間。」

六個 patient-node ACK、兩個 guardian HOLD ACK。

千田說：

> 「他們只一起對時。」  
> 「後面每一步，各自回答。」

## Scene 2：有人先停下

**時間：05:51:20–05:57:00**

SAMPLE 後進 HOLD。

葵、`LEGACY／02`、ACTIVE／D 停下。

佳乃只問：

> 「她現在穩定嗎？」

外部醫師：

> 「目前穩定。」  
> 「停在這裡就是今天的正確結果。」

任何 clock skew 或醫療異常亦須 SAFE PAUSE。

## Scene 3：我在這裡，我拒絕

**時間：05:51:30–05:54:00**

Physical break-glass request 短促出現。

Medical、patient rights、local operations 全部 DENY。

本地營運責任者：

> 「我沒有失聯。」  
> 「我在這裡。我拒絕。」

內層 bypass 未觸及，本場立刻結束。

## Scene 4：同一個時間，不同答案

**時間：05:57:00–06:04:00**

COMPARE：

- M-00 保留 clinical support；
- 美空 drift 超限；
- 真理說「不再試」；
- ACTIVE／C safe pause；
- G07／05、LEGACY／04 符合 quiet-window handoff 條件。

畫面沒有共同 `YES`。

澪理解：

> 系統終於允許不同答案存在。

## Scene 5：只有兩個人換手

**時間：06:04:00–06:11:30**

Control Quiet Window 開啟。

兩名候選的風險比較顯示：

> 留在中央撐過峰值的風險較高。

G07／05 的 prior assent、代理及 rights consent 可見。

LEGACY／04 的 limited self-consent 可見。

兩人完成 local-primary acute window，hot standby 保留。

千田只說：

> 「兩個人過去了。」  
> 「另外六個人沒有被逼著跟上。」

## Scene 6：不要替他們排成答案

**時間：06:11:30–06:12:30**

Acute settle 已完成。

系統才要求澪對 Chapter 26 預先寫好的統一前言作 final go。

她拒絕：

> 「不要替他們排成一個答案。」  
> 「事實可以一起查。」  
> 「經歷不需要被排成一樣。」

同時鎖定 final consent root 與 release cutoff。

一般公眾將只收到中立 opt-in notice。

## Scene 7：七秒

**時間：06:12:53–06:13:00**

唯一中央 sequencing gateway 封存 send object，產生 nonce。

預載 HSM policy 自動驗證。

澪：

> 「就是這一則。」  
> 「只取消這一則。」  
> 「其他警報不要動。」

Cancel 在 provider fanout 前被接受。

## Scene 8：沒有人被迫收到同一個答案

**時間：06:13:00**

白光越過人工島。

澪直接看見：

- KAGAMI consensus output = none；
- mobile follow-up canceled；
- protective filter active；
- regional receiver unlock logs；
- Public Witness Index opt-in notice；
- 視訊中一些人停下、遮眼或短暫失語；
- 自己視野中的黑色海與記憶拉扯。

她不知道陌生人內心真正發生了什麼。

若頻道安全允許，release keys 解鎖數位 subsets；若負荷過高則延遲。

不自動播放任何患者聲音。

章末不顯示下一秒：

> 最後一則通知沒有送出。  
>  
> 白光裡，沒有人被迫收到同一個答案。

# 12. 本章必須完成的二十四項成果

1. 05:50 只發布本地 schedule epoch，不持續中央控制 patient nodes。
2. Clock skew 或 epoch 不符必須 SAFE PAUSE。
3. 六個 patient-node ACK 與兩個 guardian HOLD ACK 分開。
4. 葵、LEGACY／02、ACTIVE／D 停在 HOLD。
5. 美空因 drift 進 SAFE PAUSE，真理拒絕再試。
6. M-00 public／consensus role 停止。
7. M-00 clinical support 保留，但禁止擴張並設固定重審／expiry。
8. G07／05 handoff 具有 prior assent、代理及 rights consent。
9. G07／05、LEGACY／04 只因 quiet-window risk 較低而 handoff。
10. 兩名患者完成 local-primary acute window，hot standby 保留。
11. 只能確認沒有急性災難性失穩或立即不可逆指標，延遲風險未排除。
12. Physical break-glass 被 medical、rights、operations 明確拒絕。
13. 悠真保持 safe-detached，只提供 phase-order 線索。
14. 澪在患者 settle 後才拒絕統一前言。
15. 共同事實與個人經驗被清楚分開。
16. Fragment release key 前可撤回，解鎖後不保證完全收回。
17. 未成年人 fragments 維持最低尺度，敏感內容留 sealed tier。
18. Witness channel 優先級低於 filter／clinical／abort；必要時可延遲。
19. 普通公眾只收 opt-in notice，不自動播放患者內容。
20. 峰值後 Public Witness Index 可自願查閱全部依法公開 fragments，沒有統一排序。
21. Official app 只有唯一中央 fanout choke point。
22. 七秒只取消 exact TOKYO-7 follow-up，不影響 ordinary services。
23. Protective filter 阻止高相干統一輸出，但白光與低強度 echo 仍可能存在。
24. 循環結果留至 Chapter 28，完整終止原因保持未證明。

# 13. 證據鏈與推論邊界

## 13.1 Distributed local schedule

可成立：

- 七階段來自既有 G07 handshake；
- 每個相容節點預載 signed schedule；
- 使用 local monotonic clock；
- KAGAMI 只發布 epoch marker；
- skew 超限即 SAFE PAUSE。

不能成立：

- KAGAMI 持續逐步控制所有患者；
- 悠真是即時 timing source；
- timing protocol 保證所有人成功。

## 13.2 Control Quiet Window 與 handoff 必要性

可成立：

- quiet window 是既有臨床維護功能；
- 只在 HANDOFF 階段降低 central phase gradient；
- G07／05、LEGACY／04 留在中央過峰值的風險較高；
- prior assent／consent、hot standby、abort 均存在。

不能成立：

- 為證明 R5 可行而任意挑兩人；
- 星期日白天也可同樣安全 handoff；
- 三分鐘 settle 足以證明長期分離。

## 13.3 患者結果

可成立：

- 兩名 local-primary；
- hot standby 保留；
- 六名安全暫停或保留支援；
- 截至 06:13 未見急性災難性失穩或立即不可逆指標。

不能成立：

- 延遲傷害已排除；
- 兩人已痊癒；
- 所有人已離開 M-00。

## 13.4 M-00

可成立：

- public／consensus use 停止；
- clinical support 短期保留；
- 禁止新患者、禁止擴張、固定重審及 consent expiry。

不能成立：

- 支援可無期限延長；
- 紗英已完全離線；
- clinical support 可重新用作公共母體。

## 13.5 Physical break-glass

可成立：

- request 真實；
- 三領域 share 全部拒絕；
- inner bypass 未到達；
- audit 不可改寫。

不能成立：

- continuity custodian 真人在場；
- 普通軟體可遠端 override；
- 本章需要暴力制服終局反派。

## 13.6 Witness fragments

可成立：

- provenance、consent、integrity 可驗證；
- 內容可能主觀／不完整；
- fragments 已加密預置；
- sideband 只送 keys／IDs／roots；
- 一般公眾自願開啟；
- 峰值後 index 聚合公開集。

不能成立：

- 所有人自動播放同一內容；
- fragments 等於客觀完整真相；
- 角色把患者記憶注入公眾；
- 真相發布優先於患者安全。

## 13.7 Fragment withdrawal

可成立：

- release key 前可撤回；
- 解鎖後不保證完全回收；
- index 可標記撤回、停止新下載、加入更正。

不能成立：

- 公開後仍可保證刪除所有副本；
- 家屬可無限制公開未成年人私密資料。

## 13.8 Official app

可成立：

- regional cluster 不能直接取得 app provider fanout credential；
- 唯一中央 gateway 產生 nonce；
- 預載 HSM policy 精確取消 object；
- ordinary services 保持。

不能成立：

- 七秒內重新完成人工三方簽署；
- 可撤回已播廣播；
- 可逐台控制手機顯示時間。

## 13.9 Protective filter 與 sensory echo

可成立：

- filter 降低高相干耦合及 public consensus 風險；
- 白光與低強度殘響仍可能存在；
- Chapter 27 只描寫澪可見反應。

不能成立：

- sensory echo 等於 witness payload；
- filter 完全失效；
- 角色能控制陌生人內在經驗。

## 13.10 循環結果

作者層可成立：

> 澪不再回到上一個星期一。

不能成立：

- 已證明唯一物理原因；
- 沒有 consensus 是充分且唯一條件；
- Chapter 27 已顯示第八天。

# 14. 誤導與普通解釋

| 線索 | 普通解釋 |
|---|---|
| Distributed Switch Clock | 普通多節點控制 timing，不代表時間循環 |
| 六個 node ACK＋兩個 guardian HOLD ACK | 醫療設備成熟度差異，不必然是倫理反轉 |
| 患者不同 stage | 技術成熟度不同，不代表每個人都被公平對待 |
| M-00 clinical support 保留 | 系統仍依賴母體，R5 可能只是改名 |
| G07／05／LEGACY／04 handoff | 小規模急性窗口成功，不代表長期安全 |
| 美空 SAFE PAUSE | R5 對主線患者失敗 |
| physical break-glass request | 國家基礎設施的合法緊急程序 |
| local operations 拒絕 | 現場人員對責任風險的保守選擇 |
| Encrypted regional witness preposition | 普通 after-action／司法備份，不必然影響公共認知 |
| Sideband release keys | 低頻稽核同步，不代表可傳遞大量內容 |
| SOURCE-VERIFIED fragments | 來源真實，不代表夢境內容客觀正確 |
| 不同 receiver subsets | 網路分發差異，不一定是有意避免 consensus |
| white-light sensory echo | 壓力、光學效應或神經反應，不一定來自患者 |
| official app follow-up | 危機時的普通資訊統一與假訊息管理 |
| +7000ms pre-fanout cancel | 普通推送撤回，不必然影響回聲窗 |
| 白光仍發生 | 計畫可能仍成功，或阻止行動均無效 |
| 澪沒有立即醒回錨點 | 白光後失去意識時間不同，不能在本章判斷循環終止 |

# 15. 角色狀態變化

## 15.1 朝倉澪

- 不介入個別患者 stage 判定；
- 不要求主線家屬為戲劇高潮前進；
- 在患者 settle 完成後才處理 witness 前言；
- 拒絕統一反敘事，但不否定共同事實；
- 精確取消唯一 official-app follow-up；
- 不關閉 ordinary services；
- 在白光中不知道下一秒是否仍屬同一週。

其最終成長是：

> 不再要求自己的完整版本成為所有人的版本。

## 15.2 朝倉悠真

- 保持 safe-detached；
- 不重新接入；
- 只允許 phase-order 線索與本人 fragment；
- 不成為新 Mother Reference。

## 15.3 朝倉紗英

- public／consensus role 停止；
- clinical support time-limited／revocable；
- 禁止新患者與 scope expansion；
- 06:30 醫療重審、08:00 consent reconfirmation；
- 本人 fragment 經同意進入 opt-in witness index。

## 15.4 藤川美空／白石琴音／藤川真理

- 美空 drift 超限後 SAFE PAUSE；
- 真理第一個說「不再試」；
- 琴音接受停止，不以終局倒數要求妹妹繼續；
- 美空公開層以姓名、HUMAN record 及文件為主，敏感 transcript 保持匿名或 sealed；
- 琴音仍不獲免責或立即原諒。

## 15.5 水瀨葵／水瀨佳乃

- 葵停在 HOLD；
- 佳乃接受「停下就是正確結果」；
- 未成年人內容採最窄公開尺度；
- 不將反射寫成意識。

## 15.6 G07／05／LEGACY／04

- quiet-window handoff 候選；
- 一人有 prior assent＋代理程序，一人有 limited self-consent；
- local-primary、hot standby 保留；
- 長期結果未建立；
- 不是匿名 test cases。

## 15.7 其他患者

- ACTIVE／C SAFE PAUSE；
- ACTIVE／D guardian HOLD；
- LEGACY／02 guardian HOLD；
- 未具名不代表可被忽略。

## 15.8 日下部／千田／凪原／本地營運

- 日下部保全 break-glass、cancel audit 及 fragment 程序；
- 千田不宣布整體成功，只回報兩名 acute-window 結果；
- 凪原協助辨認官方 follow-up schema，但不能重簽或替患者；
- 本地營運以不可改寫 audit 明確拒絕 physical override。

# 16. 作者層真相鎖定

1. Distributed Switch Clock 是預載本地 schedule，不是持續中央控制。
2. Clock skew 超限會 SAFE PAUSE。
3. Control Quiet Window 是既有 G07 臨床維護功能。
4. G07／05、LEGACY／04 留在中央過 echo peak 的預測風險較高。
5. G07／05 具有 prior assent、代理及 rights consent。
6. LEGACY／04 具有 limited self-consent。
7. Only 兩名候選進 handoff；hot standby 保留。
8. Chapter 27 只確認沒有急性災難性失穩或立即不可逆指標；延遲傷害未知。
9. 其餘六名患者不被倒數強迫前進。
10. M-00 public／consensus role 停止。
11. M-00 clinical support 有固定重審、禁止擴張及 consent expiry。
12. Physical break-glass request 真實存在，三領域均拒絕。
13. 悠真不重新接入，也不是 timing source。
14. Witness fragments 已在峰值前加密預置。
15. Echo Sideband 只傳 release keys／IDs／roots。
16. Witness channel 優先級低於患者安全；必要時 release 可延遲。
17. 普通公眾只收到 opt-in availability notice。
18. 峰值後 Public Witness Index 逐步提供完整依法公開集，沒有統一排序。
19. Fragment key release 前可撤回；公開後不保證完全回收。
20. 美空／葵未成年人內容採最窄尺度。
21. 澪在患者 settle 後才拒絕統一前言。
22. Official app fanout 唯一受信任 choke point 是中央 sequencing gateway。
23. 七秒 cancel 在 provider fanout 前成功。
24. ordinary services、protective filter 及 prior broadcast 均未被取消。
25. Protective filter 阻止高相干統一輸出，但不消除白光與低強度 echo。
26. Chapter 27 只從澪視角呈現當下公共反應；陌生人主觀報告留 Chapter 28。
27. 澪這一次不會回到上一個星期一。
28. 循環停止的唯一物理原因仍未證明。
29. 世界不會因 fragments 立即形成共識。
30. Chapter 28 必須先處理患者，再處理政治後果與 epilogue。

# 17. Chapter 28 銜接

## Chapter 27 結束時已知

- 06:13 白光已發生；
- old TOKYO-7 consensus／public bundle 未執行；
- official app follow-up 在中央 fanout 前取消；
- protective filter 與 clinical branch 撐過峰值；
- G07／05、LEGACY／04 為 local-primary，hot standby 保留；
- 其餘六名患者停在 COMPARE／HOLD／SAFE PAUSE；
- M-00 public／consensus role 停止，clinical support time-limited；
- witness index 已以 opt-in 方式開放或等待安全延遲 release；
- 白光感官 echo 不受角色控制；
- 澪仍在白光中；
- 正文尚未顯示 06:13 之後的時間；
- 循環終止原因仍未證明。

## Chapter 28 建議三個時間層

### 第一層：06:13:01 至當日上午

1. 以 06:13:01、06:13:02、06:14 確認時間繼續；
2. 先處理八名 active patients，不先慶祝；
3. 確認兩名 local-primary 患者短期狀態與 hot standby；
4. 確認美空、葵、LEGACY／02 等仍需長期分離；
5. 06:30 重審 M-00 clinical support；
6. 08:00 重新取得紗英意願或停止／safe pause；
7. 紗英短暫表達，但不給虛假完全康復；
8. 琴音決定自首。

### 第二層：數日／數週後

1. 日下部職務後果；
2. 凪原公開調查與審判；
3. 政府與多國機構切割；
4. Witness Index、Public Deny Manifest 與文件爭議；
5. 公眾事後報告支付黑色海、時間錯位等主觀感受；
6. 患者長期醫療分離進度；
7. 澪與琴音不立即和解。

### 第三層：較後 epilogue

1. 悠真仍保留不屬於自己的未來 fragments；
2. 父親留下的程序痕跡仍未完全解答；
3. 母親舊收音機；
4. 新的聲音化星圖；
5. 七十年後接觸點；
6. 外星智慧不再直接交付答案。

Chapter 28 核心問題：

> 當沒有人再被迫收到同一個答案，人類是否願意在普通時間裡承擔彼此不同的記憶、責任與後果？

# 18. 本章不能揭露的事

1. Chapter 28 開場前不能明確顯示時鐘已越過 06:13；
2. 不在本章宣告循環永久終止；
3. 不宣稱已證明循環停止的唯一物理原因；
4. 不揭露紗英清醒後的完整台詞；
5. 不揭露美空是否最終醒來；
6. 不揭露葵是否恢復意識；
7. 不揭露 `LEGACY／02` 完整姓名；
8. 不公開 `G07／05`／`LEGACY／04` 完整身分；
9. 不完整解釋外星訊號目的；
10. 不完整解釋為何澪成為完整回送接收者；
11. 不揭露父親現在的確切下落；
12. 不在本章完成所有政府審判；
13. 不讓 source-verified fragments 直接證明所有陰謀或所有主觀內容；
14. 不讓白光感官 echo 被當成已驗證患者證詞；
15. 不讓世界立即相信同一套真相；
16. 不讓琴音獲得澪原諒；
17. 不讓凪原突然完全悔悟；
18. 不在本章出現七十年後星圖；
19. 不提前寫出第八天後的時間跳躍。

# 19. 本章一句話總結

> 05:50，鏡島沒有向八名患者逐步發出中央命令，只宣布一份早已簽署並預載至各地節點的本地 schedule epoch；每個相容節點以自己的 monotonic clock、醫療時間戳與 stage ceiling 作答，clock skew 或狀態不符便 SAFE PAUSE。葵、`LEGACY／02` 與本地根未完成的患者停在 HOLD；美空在 COMPARE 出現 drift，藤川真理拒絕為倒數再試；M-00 停止 public／consensus 母體功能，卻以禁止擴張、固定重審及 consent expiry 的方式保留短期 clinical support。只有 `G07／05` 與 `LEGACY／04` 進入歷史 G07 protocol 唯一的 Control Quiet Window：前者具有 prior assent、法定代理與患者權利批准，後者具有 limited self-consent；兩人留在中央撐過 echo peak 的預測風險均高於受控 handoff。兩人只完成 acute local-primary window，central hot standby 保留；截至 06:13 未觀察到急性災難性失穩或立即不可逆指標，延遲後果仍未知。Physical break-glass 在 SAMPLE 前半被 medical、patient-rights 與 local operations 三方迅速拒絕。本章直到患者 settle 完成後，才要求澪決定是否替 witness fragments 加上統一前言；她拒絕用較正確的完整版本取代官方版本，只保留來源、同意與不完整性標頭。Fragments 已加密預置，低頻 sideband 只有在不影響 filter、clinical safety 與 abort telemetry 時才發送 release keys；一般公眾只收到中立的 opt-in notice，峰值後可自行查閱所有依法公開 fragments。06:12:53，唯一中央 app sequencing gateway 封存 exact TOKYO-7 follow-up 並產生 nonce；預載 HSM policy 在 provider fanout 前取消這一則，普通警報與服務繼續。06:13，白光仍越過東京灣；filter 阻止高相干統一神經輸出，卻不消除物理白光與低強度感官殘響。澪只能看見自己的黑色海、receiver logs、opt-in index 與視訊中可觀察的停頓，無法知道陌生人內心真正發生了什麼。最後一則通知沒有送出。白光裡，沒有人被迫收到同一個答案。

# 20. 最終寫作檢查表

## 時間與視角

- [ ] Chapter 27 僅涵蓋 05:50:00–06:13:00；
- [ ] Chapter 28 才顯示下一秒；
- [ ] 第三人稱限知緊貼澪；
- [ ] 不直接描寫陌生人內心 echo；
- [ ] 不提前宣告循環終止原因。

## Distributed local schedule

- [ ] schedule 已在 05:49 前預載；
- [ ] KAGAMI 只宣布 epoch；
- [ ] 各節點使用 local monotonic clock；
- [ ] 多源時間戳交叉；
- [ ] clock skew 超限即 SAFE PAUSE；
- [ ] 不形成新中央單點；
- [ ] 悠真不重新接入。

## Control Quiet Window／handoff

- [ ] quiet window 有 Chapter 20／26 技術伏筆；
- [ ] 只有 HANDOFF 階段可降低 central active input；
- [ ] G07／05 有 prior assent＋代理／rights；
- [ ] LEGACY／04 有 limited self-consent；
- [ ] 留在中央過峰值風險高於 handoff risk；
- [ ] hot standby 保留；
- [ ] 只確認急性窗口，延遲傷害未知；
- [ ] 不宣稱長期切離或痊癒。

## 患者不同答案

- [ ] 六個 patient-node ACK；
- [ ] 兩個 guardian HOLD ACK；
- [ ] 葵／LEGACY／02／ACTIVE-D HOLD；
- [ ] 美空 drift 後 SAFE PAUSE；
- [ ] M-00 COMPARE／clinical support retain；
- [ ] ACTIVE-C SAFE PAUSE；
- [ ] Only G07／05、LEGACY／04 handoff；
- [ ] 倒數不能提高 stage ceiling。

## M-00

- [ ] public／consensus role disabled；
- [ ] clinical support temporary／revocable；
- [ ] 禁止 new patient enrollment；
- [ ] 禁止 scope expansion；
- [ ] 06:30 medical review；
- [ ] 08:00 reconfirmation／expiry；
- [ ] STOP 時採 safe pause，不瞬間抽走支援。

## Physical break-glass

- [ ] 場景短促；
- [ ] 三領域全部 DENY；
- [ ] inner bypass 未到達；
- [ ] immutable audit；
- [ ] 不搶走患者、敘事與七秒高潮。

## Witness fragments

- [ ] 患者 settle 完成後才作 final go；
- [ ] 澪拒絕統一前言；
- [ ] `SOURCE-VERIFIED` 只驗來源，不驗客觀內容；
- [ ] release key 前可撤回；
- [ ] 解鎖後不保證完全收回；
- [ ] 未成年人採最窄尺度；
- [ ] 美空敏感 transcript 匿名／sealed；
- [ ] raw neural 不發布；
- [ ] channel priority 低於 clinical safety；
- [ ] load 超限可延遲 key release；
- [ ] 普通公眾只收 opt-in notice；
- [ ] 不自動播放患者內容；
- [ ] 峰值後 Index 聚合全部依法公開集；
- [ ] 沒有統一排序。

## Official app 七秒

- [ ] 06:12:53 來自早期 bundle metadata；
- [ ] 唯一中央 sequencing gateway 持有 provider credential；
- [ ] 區域 cluster 不能直接 fanout；
- [ ] HSM policy 已預載；
- [ ] T0 只生成 object hash／nonce；
- [ ] 澪只確認「就是這一則」；
- [ ] cancel 在 provider fanout 前完成；
- [ ] ordinary services 繼續；
- [ ] original payload evidence-sealed。

## White light／filter

- [ ] 白光仍發生；
- [ ] filter 降低高相干耦合，不消除物理光；
- [ ] consensus output none；
- [ ] app follow-up canceled；
- [ ] 數位 fragments 與 sensory echo 分開；
- [ ] Chapter 27 不代替公眾描述內心經驗。

## 前章真正回補

- [ ] Chapter 20／26 加入 Control Quiet Window；
- [ ] Chapter 22 顯示八名 active patients；
- [ ] Chapter 24 顯示兩名 Stage-1 candidates；
- [ ] Chapter 26 顯示 G07／05、LEGACY／04 prior assent／consent；
- [ ] Chapter 26 加入 local schedule／clock skew；
- [ ] Chapter 14／21 加入唯一中央 app fanout 架構；
- [ ] Chapter 21–26 加入 witness channel priority／opt-in。

## Chapter 28 保留

- [ ] 06:13:01／06:14 才確認時間前進；
- [ ] 先醫療，不先慶祝；
- [ ] 當日上午重審 M-00 support；
- [ ] 數日／數週處理政治與證據後果；
- [ ] epilogue 才支付收音機與七十年星圖；
- [ ] 不在本章完成琴音原諒、凪原悔悟或全部患者分離。
