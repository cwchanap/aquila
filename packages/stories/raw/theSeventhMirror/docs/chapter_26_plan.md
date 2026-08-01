# 《神鏡七日》Chapter 26 章節企劃 v2.2

## 第 26 章：租約裡沒有名字

所屬大章：**第七日：不要救東京**  
全書位置：**28 小章中的第 26 章**  
章節定位：**鏡島終局夜間行動／BCP lease 載入後才掛載的 Subject Bay／continuity 將「受中央管理」偷換成安全等價／授權 epoch 與患者 epoch 分離／八名活動人類與物理端點核對／Clinical Safety Hold 與 Public Data-Use Hold／租約本地適用性否決／新 bundle rebind 與 subject-equivalence fallback 雙重失敗／琴音撤回 G07／03 持續性委派／Witness Echo Sideband／七階段分散式換手時鐘預先簽署／05:50 前一分鐘**  
建議篇幅：**約 10,000–12,000 字**  
視角：**第三人稱限知，緊貼朝倉澪**  
主要類型感：**人工島現場控制、患者制度解封、有效授權與適用範圍分離、好友有限贖罪、醫療拒絕進入硬體閘門、終局前夜倒數**

---

# 0. 本章核心定位

Chapter 25 已完成：

1. C2 continuity relocation 被 no-move 命令及外部醫療阻止；
2. 外部醫療、兒少保護及司法程序已接管水瀨葵的患者決策；
3. 葵仍留在原病床、原治療及原中央閉環；
4. 水瀨佳乃已：
   - 經外部醫師獨立即時視訊確認葵；
   - 到床邊看見女兒；
   - 同意建立只綁定葵本人的患者根；
5. `AOI-LOCAL／PROVISIONAL` 已在外部 clinical sidecar 中完成患者綁定；
6. 葵只進入 Stage-0 baseline capture，C2 原控制器沒有被寫入；
7. 七個 SHARE-S trust domains 保存的是同一 exact bundle 的非匯出 science authorization capsule；
8. 前六個 mirror 均已撤回，且回執證明：
   - `PRIOR RELEASE COUNT = 0`
   - `TOKEN ISSUED = NO`
   - release handle 已銷毀；
9. 最後一個 S7 Science Escrow HSM 在 `AUTH_EPOCH A17` 於 23:50 產生當輪 science token；
10. Continuity Operational HSM 同時產生 SHARE-CONT token；
11. 兩份 token 被組裝成不含第三份簽章的：

```text
CUTOVER AUTH LEASE
{
  science_token,
  operational_token,
  bundle_hash,
  auth_epoch,
  subject_snapshot_epoch,
  dependency_snapshot_hash,
  issued_at,
  expires_at,
  lease_nonce
}
```

12. Lease 綁定 exact TOKYO-7 bundle，有效至星期一 06:20；
13. queued revocation 隨後將 S7 更新至 `AUTH_EPOCH A18`：
    - future release disabled；
    - 當輪 A17 lease 不回溯失效；
14. Public Deny Manifest 已公開，普通公共服務及保護性過濾仍運作；
15. 公開證據只使用可共同驗證的當輪事實，澪拒絕把跨輪記憶寫成公共物證；
16. 人類經驗層的夢話、第一人稱片段、黑色海及共同記憶仍保留至 06:13；
17. package preposition 只在少數 continuity-controlled clusters 開始；
18. normal operations clusters 仍 held／denied；
19. KAGAMI-01 warmup 尚未完成；
20. 05:50 auto-prep、CAL LOCK、consensus preparation 及 execution commit 尚未開始；
21. 官方手機 `+7000ms` 路徑仍只在監看；
22. 距 05:50 約六小時，距 06:13 約六小時二十一分。

本章必須回答：

> 一份在 science 與 operations 兩個領域都通過簽章的租約，是否因此有權使用仍未安全切離的人？  
> 為何角色只能在 23:50 lease 載入以後，才真正打開鏡島本地的患者狀態層？  
> 舊 continuity policy 是否把「仍受中央管理」偷換成「已安全處理」？  
> 若當輪 signed patient updates 與物理臨床端點均證明患者仍在，鏡島會聽從 S42 舊快照，還是聽從 S43 的當輪生命狀態？  
> 若新 bundle rebind 因 A18 無 science token 而失敗，continuity 是否仍能以「S42 與 S43 安全等價」沿用舊 lease？  
> 琴音撤回的 G07／03 persistent delegation，能否阻止這條不需新 science token 的第二 fallback？  
> public／consensus branch 被 HOLD 後，患者第一人稱碎片將經哪一條不壓成單一版本的路徑留下？  
> 哪些患者可在 Chapter 27 嘗試 handoff，哪些只能停在 HOLD／SAFE PAUSE？

本章的主要技術反轉是：

> `CUTOVER AUTH LEASE` 在密碼學上有效，卻不自動取得患者安全適用性。

KAGAMI-01 的本地接受鏈為：

```text
CUTOVER AUTH LEASE
        ↓
SCIENCE TOKEN VERIFY
        ↓
OPERATIONAL TOKEN VERIFY
        ↓
BUNDLE／LEASE NONCE VERIFY
        ↓
EXECUTION ANCHOR／KAGAMI-01
        ↓
SUBJECT SNAPSHOT VERIFY
        ↓
LIVE PATIENT-STATE MERGE
        ↓
PHYSICAL CLINICAL ENDPOINT RECONCILIATION
        ↓
CLINICAL SAFETY HOLD
        ↓
PUBLIC DATA-USE HOLD
        ↓
COMMIT-GATE
        ↓
BRANCH-SPECIFIC AUTO-PREP
```

其中：

- science 與 operations token 是兩個機構授權領域；
- KAGAMI 不是第三張票；
- KAGAMI 只負責判定：
  > 這份租約是否仍適用於當輪患者狀態，以及是否能在不傷害臨床依存者的情況下執行。

## 0.1 為何 Subject Bay 只能現在打開

`SUBJECT CONTINUITY BAY` 平時並非一個可隨時查閱的普通資料庫。

```text
NORMAL STATE
SUBJECT LEDGER          SEALED／LOCAL OFFLINE
BCP CACHE               SUMMARY ONLY
SERVICE MOUNT           UNAVAILABLE

AFTER CUTOVER LEASE LOAD
SUBJECT LEDGER          LOCAL SERVICE MOUNT
LEASE SNAPSHOT          S42 VISIBLE
DEPENDENCY HASH         VISIBLE
EXECUTION-ANCHOR PATH   ACTIVE／PREP ONLY
```

雙重限制如下：

### 技術限制

- 本地 S42 cache、dependency hash、execution-anchor service 只在：
  - cutover lease 已載入；
  - package preposition 開始；
  - KAGAMI 進入 BCP 本地維護窗；

  之後掛載；
- 23:50 以前，外部團隊只能看到中央聚合摘要，不能取得鏡島本地 S42 或執行 monotonic merge；
- 因此角色不是故意等到 lease 出生後才想起安全閂。

### 程序限制

法院在 Chapter 24–25 核准的是條件式患者安全開示：

> 只有指定 bundle 已進入本地預置／執行準備，且 distributed hold 未被 continuity 接受時，才可打開包含患者私密狀態的本地 Bay。

23:50 package preposition 開始後：

- 技術 mount 條件成立；
- 緊急司法必要性成立；
- Chapter 26 才能合法讀取 S42、signed-update queue 及本地 latch。

## 0.2 R1 安全語義與 continuity 偷換

R1／R2 原始規則：

```text
ALL ACTIVE HUMAN DEPENDENCIES
CURRENTLY ATTESTED
SEPARATED／SAFE／AUTHORIZED
        ↓
CLEAR
```

後來 continuity overlay 為離線 BCP 加入：

```text
SUBJECT REGION               SEALED
NO VISIBLE SERVICE EVENT     YES
CENTRAL MANAGEMENT           ACTIVE
        ↓
MANAGED-EQUIVALENT／CACHED
```

真正的制度錯誤不是刪除安全閂。

而是：

> 把「仍由中央控制」重新定義成「等同已安全處理」。

因此 S42 顯示的不是普通 `CLEAR`，而是：

```text
SUBJECT SAFETY
CACHED／MANAGED-EQUIVALENT
POLICY
CONTINUITY BCP
```

Chapter 26 的揭露是：

> Continuity 沒有移除父親的規則。  
> 它改寫了「安全」的意思。

## 0.3 固定患者數量與物理端點

作者層正式鎖定：

```text
CURRENT HUMAN DEPENDENCY RECORDS    9
SAFE-DETACHED／NOT ACTIVE           1  （G07／12／朝倉悠真）
ACTIVE HUMAN DEPENDENCIES           8
CRITICAL RED-ZONE                   4
OTHER ACTIVE HUMAN DEPENDENCIES     4
```

八名 active human dependencies 包括：

### 四名具名／最低必要可見紅區

1. `M-00／朝倉紗英`
2. `G07／03／藤川美空`
3. `G07／08／水瀨葵`
4. `LEGACY／02／HUMAN／ADULT`

### 四名姓名依法遮蔽的其他活動患者

以制度代碼（非姓名）可見，對應 Chapter 24 匿名準備矩陣：

- `G07／05`：16 歲、prior assent（事前同意）、proxy／rights（代理人／權利）；Stage-1／root ready；
- `LEGACY／04`：成人、limited self-consent（有限自我同意）；Stage-1／root ready；
- `ACTIVE／C`：Stage-0／compare only；
- `ACTIVE／D`：local root pending／hold。

姓名、病房及私人醫療資料仍依法遮蔽。

他們即使不在四名不可逆風險下限中，也仍屬活動人類依存者，不能被排除。

Subject ledger 合併後必須和物理臨床端點核對：

```text
PHYSICAL ACTIVE CLINICAL ENDPOINTS    8
LEDGER-RESOLVED HUMAN RECORDS         8
UNMAPPED ACTIVE HEARTBEATS             0
SAFE-DETACHED RECORDS                  1
```

若出現任何：

- 未映射 active heartbeat；
- 有臨床負載卻無患者記錄的端點；
- ledger 記錄無合法物理／遠端臨床對應；

一律：

```text
UNKNOWN／UNRESOLVED
FAIL CLOSED
```

名字不是密碼欄位。

但每一條仍承載人體依存的線，都必須能對應到一名受保護的人，或被標記為未知。

## 0.4 兩個獨立 HOLD

### A. Clinical Safety Hold

適用於全部八名 active human dependencies。

```text
ACTIVE HUMAN DEPENDENCIES       8
SAFE／SEPARATED                 0／8
PATIENT-BOUND LOCAL ROOT        6／8
ACTIVE TRANSITION AUTHORIZED    0／8
UNRESOLVED／NOT SEPARATED       8／8

CLINICAL SAFETY HOLD            HOLD
```

即使某患者不是 TOKYO-7 的資料來源，只要其生命線仍依賴 clinical topology，便能阻止 public execution。

### B. Public Data-Use Hold

TOKYO-7 bundle metadata 顯示五名實際資料來源者：

```text
DATA-SOURCE SUBJECTS            5
VALID PUBLIC-USE CONSENT        0／5
PUBLIC DATA-USE HOLD            HOLD
```

這五名包括 M-00 及四名 RESP-GRP 資料貢獻者；完整身份依患者程序保持遮蔽。

因此 public bundle 同時缺乏：

- 臨床安全適用性；
- 資料公共使用授權。

## 0.5 Signed updates 與 subject epoch

Lease 綁定：

```text
AUTH EPOCH                    A17
SUBJECT SNAPSHOT EPOCH        S42
DEPENDENCY SNAPSHOT HASH      <OLD-HASH>
CLINICAL TOPOLOGY HASH        <OLD-TOPOLOGY>
```

Chapter 23–25 的合法變更早已存在於各地：

- patient-root signed updates；
- 醫療 hold；
- 法定代理 attestation；
- active-switch deny；
- public-use deny；
- distributed hold；
- 美空 Domain-P quarantine；
- 葵 AOI-LOCAL；
- 紗英限制性用途；
- `LEGACY／02` adapter pending。

打開 Bay 不會創造新狀態。

它只會：

1. 封存 S42；
2. 匯入早已存在的 signed updates；
3. 驗證每項簽章與時間戳；
4. 依 monotonic／no rollback 規則合併；
5. 對未知格式 fail closed；
6. 和八個物理 clinical endpoints 核對；
7. 形成 `SUBJECT_EPOCH S43`；
8. 重算 live dependency hash。

## 0.6 Continuity 的兩條 fallback

### Route A：正式 rebind

S43 改變：

- patient-root manifest；
- clinical topology；
- safety／public-use status；
- exact bundle hash。

因此新 S43 bundle 需要新的 science token。

但 S7 已進入：

```text
AUTH_EPOCH A18
FUTURE RELEASE       DISABLED
NEW SCIENCE TOKEN    UNAVAILABLE
```

所以：

```text
FORMAL LEASE REBIND    DENIED
```

### Route B：Subject Snapshot Equivalence Certificate

Continuity 仍可嘗試不改 bundle hash，聲稱：

> S43 雖有行政／患者程序更新，但在 BCP 執行意義上仍與 S42 安全等價，因此 old lease 可繼續適用。

```text
SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE

LEASE SNAPSHOT      S42
CURRENT SNAPSHOT    S43
POLICY              MANAGED-EQUIVALENT／BCP
REQUIRES
- ALL UNRESOLVED CASE ACKNOWLEDGMENTS
- NO PATIENT-ROOT DENY
- NO CLINICAL SAFETY CONFLICT
- NO PATIENT-RIGHTS HOLD CONFLICT
```

此 certificate：

- 不需新 science token；
- 不改 exact bundle；
- 是 continuity 避免每次患者行政更新都重新簽 bundle 的正常 BCP fallback。

琴音的 G07／03 persistent delegation，正是這條 fallback 可要求的其中一項 case acknowledgment。

她撤回自己的 delegation，真理拒絕美空 reseal，再加上其他 unresolved patient routes，會使：

```text
SUBJECT EQUIVALENCE CERTIFICATE    DENIED
```

因此琴音的行動不是象徵。

它阻止 old lease 沿用於 S43 的第二條合法路徑。

## 0.7 琴音的權限邊界

Chapter 23 已凍結：

- 裝置 access；
- App credential；
- 一次性工單；
- 工程路線。

但 continuity policy 內仍存在：

```text
CLINICAL DELEGATION
CASE       G07／03
HOLDER     白石琴音
STATUS     SUSPENDED／NOT REVOKED
PURPOSE    FUTURE CASE ACKNOWLEDGMENT
```

它不是登入能力，而是 persistent holder consent。

Forensic clone 只可：

- 找到 role ID；
- 顯示歷史 service alias；
- 指出 server-side record；
- 解析 reseal 流程。

它不能接 production request 或代琴音簽署。

琴音本人只能撤回 G07／03。

她不能替其他七名 active human dependencies 作決定。

## 0.8 05:50 前的患者 Stage Ceiling

Chapter 26 在 05:49 前須完成每名患者／聚合群的最高允許階段：

```text
M-00／朝倉紗英
MAX STAGE       COMPARE
POST-06:13      CLINICAL TRANSITION SUPPORT RETAINED
PUBLIC／CONSENSUS FUNCTION    DISABLED

G07／03／藤川美空
MAX STAGE       COMPARE
HANDOFF         PROHIBITED／DRIFT UNRESOLVED

G07／08／水瀨葵
MAX STAGE       HOLD
HANDOFF         PROHIBITED／STAGE-0

LEGACY／02
MAX STAGE       HOLD
HANDOFF         PROHIBITED／ADAPTER PENDING

G07／05
HUMAN／MINOR（16 歲）
CONSENT          PRIOR ASSENT（事前同意）＋ PROXY／RIGHTS（代理人／權利）
MAX STAGE        CONDITIONAL HANDOFF
REQUIRE          MEDICAL GO／ENVELOPE PASS

LEGACY／04
HUMAN／ADULT
CONSENT          LIMITED SELF-CONSENT（有限自我同意）
MAX STAGE        CONDITIONAL HANDOFF
REQUIRE          MEDICAL GO／ENVELOPE PASS

ACTIVE／C
MAX STAGE        COMPARE（STAGE-0／COMPARE ONLY）

ACTIVE／D
MAX STAGE        HOLD（LOCAL ROOT PENDING）
```

Chapter 27 的成功不等於八人全部 handoff。

可能結果是：

- 兩名較成熟的匿名患者完成受控 handoff；
- 其餘患者停在 COMPARE、HOLD 或 SAFE PAUSE；
- M-00 停止 public／consensus 功能，但短期保留受限制的 clinical transition support；
- 第八天繼續真正的醫療分離。

## 0.9 七階段時鐘必須在 05:49 前預先簽署

受試者區域 03:10 開啟後，背景團隊即開始分析 historical handshake。

部署依據：

- KAGAMI historical specification；
- 多節點歷史日誌；
- 離線模擬；
- Patient Safety Envelopes；
- Network Transition Envelope；
- 醫療停止條件。

悠真夢話只提供：

- 找到協議的線索；
- 缺失 phase order；
- 一條不依賴中央文件的人類記憶交叉。

05:49 前須完成：

```text
DISTRIBUTED SWITCH CLOCK PACKAGE
CODE HASH              VERIFIED
TIMING ONLY            YES
PATIENT CONTROL DATA   NONE
SEVEN STAGES           VERIFIED
SAFE PAUSE             DEFINED
DEPLOYMENT             PRE-STAGED
ACTIVATION             PENDING MEDICAL GO
```

Chapter 27 不是重新設計協議。

而是決定是否啟用已完成患者、醫療及技術審查的 timing package。

## 0.10 Witness Path 必須有完整 egress

Chapter 26 不只辨認 buffer，還要鎖定完整路徑：

```text
PATIENT WITNESS BUFFER
        ↓
CONSENT／RELEASE FILTER
        ↓
WITNESS SERIALIZER
        ↓
WITNESS ECHO SIDEBAND
        ↓
REGIONAL WITNESS RECEIVERS
        ↓
PUBLIC WITNESS INDEX／INDEPENDENT NOTICE
```

### Witness Echo Sideband

既有技術血統：

- 原用於臨床 after-action；
- 在回聲事件後回收患者／家屬碎片；
- multiplex 於 protective-filter telemetry 旁；
- 不進 TOKYO-7 consensus bundler；
- 不要求同步內容；
- 不具 public execution anchor；
- 每個區域 receiver 可收到不同的 signed fragment subset。

它輸出：

- 預先允許；
- 非 raw-neural；
- 彼此獨立簽章；
- 不被排序成單一故事；

的 fragment envelopes。

### Public Witness Index

普通網路／手機只發布：

- fragment hash；
- source tier；
- 可公開 transcript／caption；
- 驗證方式；
- 不發布 raw neural 或患者模型。

在 06:13，白光／回聲耦合可使 sideband fragments 進入不同區域的 witness receivers；一般人不會收到同一份統一內容。

這保留：

> 文件真相由 Manifest／Evidence Vault 提供；  
> 人類經驗真相由多聲部 witness fragments 提供。

本章只完成 egress 完整性驗證及 pre-stage：

```text
WITNESS EGRESS PACKAGE
CONSENSUS INPUT       NO
RAW NEURAL            NO
FRAGMENT SET          CONSENT-TIERED
SERIALIZER HASH       VERIFIED
ECHO SIDEBAND         VERIFIED／DISABLED
PUBLIC INDEX          PRE-STAGED
ACTIVATION            PENDING
```

## 0.11 Manual override 邊界

Chapter 26 必須先顯示：

```text
CLINICAL LATCH OVERRIDE

SOFTWARE／NORMAL BCP      NOT AVAILABLE
WHEN HUMAN UNRESOLVED     FAIL CLOSED

PHYSICAL BREAK-GLASS REQUIRES
- MEDICAL SAFETY SHARE
- PATIENT-RIGHTS SHARE
- LOCAL OPERATIONS SHARE
- PHYSICAL SERVICE ACTION
- IMMUTABLE AUDIT

EFFECT                   PUBLIC BRANCH ONLY
PROTECTIVE FILTER        UNAFFECTED
CLINICAL BRANCH          UNAFFECTED
```

醫療與患者權利均明確拒絕，因此合法 override 不可取得。

任何破壞性物理 bypass：

- 必然留下不可改寫證據；
- 不會成為隱藏的普通高官按鈕；
- Chapter 27 可將其作為最後威脅之一，但不能臨時創造軟體 override。

## 0.12 終局公平性鎖定

作者層正式確認：

- 對本輪 TOKYO-7 exact bundle 而言，A18 之後沒有第二條合法 science-domain release path；
- 不存在另一枚未揭露 science issuer 可重簽 S43 bundle；
- 私造 token 無法通過 KAGAMI 硬體信任鏈；
- 剩餘兩章不再新增新的 science root、患者群或主要授權層。

角色可以誠實地說：

> 無法證明世界上不存在任何秘密密鑰。

但作者層必須保證：

> 終局不會再以另一枚 science token 推翻 Chapter 25–26 的撤回成果。

本章的終點是：

> Lease 仍有效，卻不能套用於 S43；  
> formal rebind 失敗；  
> subject-equivalence fallback 亦失敗；  
> KAGAMI 不簽 execution anchor；  
> public／consensus branch 保持 HOLD；  
> protective filter 與 clinical preparation 仍將在 05:50 開始；  
> timing package、patient stage ceilings、witness egress 及手機取消命令均已預先簽署，只等待 Chapter 27 的醫療 go。

---
# 1. Chapter 25 結束狀態

| 線索／角色 | Chapter 26 開始狀態 |
|---|---|
| 朝倉澪 | 已讓公共證據只使用可共同驗證事實；目標由證明拒絕轉為讓鏡島讀取患者當輪狀態。 |
| 朝倉紗英 | 仍在中央閉環；只授權短期非語義過渡限制；Stage-1 被動相符；不得在 `LEGACY／02` 尚未橋接時完全退出 clinical support。 |
| 朝倉悠真 | 已獲救並完成安全切離，在外部醫療照護中休養（非失蹤狀態；後續於 ch27 影像現身、ch28 探視紗英）；不納入 active latch；夢話、line7 短音及睡眠節奏尚未得到終局用途。 |
| 藤川美空 | Domain-P 隔離；Domain-C 保留；Stage-1 被動相符，睡眠轉換漂移未解。 |
| 水瀨葵 | AOI-LOCAL 已綁定於外部 sidecar；Stage-0 baseline；未取得被動相符。 |
| `LEGACY／02` | 函館外部醫療已到場；患者根轉接器尚未接入。 |
| 其他四名 active human dependencies | 兩名 Stage-1／local root present；一名 Stage-0；一名 local root pending；姓名依法遮蔽。 |
| Active human dependency count | 八名 active；另有一名 safe-detached 悠真，不納入 active latch。 |
| 白石琴音 | 裝置、登入與一次性工單已凍結；G07／03 persistent clinical delegation 尚未正式撤回。 |
| 藤川真理 | 美空法定代理人；可拒絕 G07／03 subject-equivalence acknowledgment。 |
| 水瀨佳乃 | 葵法定代理程序核心；拒絕主動切換。 |
| 千田浩介 | 遠端受保護技術證人；掌握 R2、execution anchor 及 historical handshake。 |
| 日下部悟 | 掌握鏡島現場司法、證據及條件式患者安全開示程序。 |
| 凪原唯 | S7 science escrow 已更新至 `AUTH_EPOCH A18`；不能再簽新 bundle；仍協助解析 A17 lease。 |
| CUTOVER AUTH LEASE | `AUTH_EPOCH A17`；綁定 `SUBJECT_EPOCH S42`；有效至 06:20；execution 尚未發生。 |
| package preposition | 少數 continuity clusters 已開始；正常營運節點拒絕；均等待 KAGAMI execution anchor。 |
| KAGAMI-01 | lease 已載入；BCP service mount 可用；Subject Continuity Bay 仍 sealed；本地 subject ledger 尚停在 S42。 |
| Public Deny Manifest | 已公開；普通服務及 protective filtering 持續。 |
| Evidence Vault | 文件性真相已分層發布；人類經驗 fragments 仍保留至 06:13。 |
| Witness path | 既有 buffer 尚未完整映射至 egress；本章須完成 sideband 與 public index 驗證。 |
| 05:50 | protective／clinical prep 將開始；consensus／public prep 目前仍未獲 KAGAMI anchor。 |

---
# 2. 時間線與節奏

Chapter 26 發生於：

> **第三輪，星期一 00:05 至 05:49。**  
> **雖已跨過日曆午夜，七日回聲窗尚未結束；本章仍屬第七日。**

現場與遠端分工固定為：

### 鏡島現場

- 澪；
- 日下部；
- 琴音及辯護人；
- 鏡島本地營運安全；
- 獨立系統安全；
- 外部醫療代表；
- 患者權利代表；
- 司法保全。

### 遠端安全連線

- 千田：受保護技術證人；
- 凪原：主管機關與 science schema；
- 藤川真理：美空患者代理；
- 水瀨佳乃：葵患者代理；
- M-00、美空、C2、函館及其他 patient-root／醫療團隊。

千田不親自進入鏡島。

琴音不直接操作控制器，只在隔離服務區：

- 辨認 service alias；
- 解釋過去 continuity 路徑；
- 撤回自身委派。

| 時間 | 事件 |
|---|---|
| 00:05–00:40 | 拆解 lease 與 KAGAMI 本地接受鏈；現場提出破壞 bundle index／強制隔離等快速方案，澪拒絕可能傷害 filter、clinical branch 及證據的做法。 |
| 00:40–01:15 | 確認 lease 載入後 BCP local service mount 才可用；package preposition 已觸發法院條件式患者安全開示。 |
| 01:15–01:55 | 確認 `EXECUTION ANCHOR／KAGAMI-01`、Clinical Latch 及 continuity `MANAGED-EQUIVALENT` 偷換；本地 audit 顯示 Subject Bay 實體 service alias。 |
| 01:55–02:35 | 琴音只辨認 `SUBJECT-SVC／G07`、family-assist 圖示與 reseal 語言；本地技師以 R2、audit 及服務手冊映射至實體 Bay。 |
| 02:35–03:10 | 多方合法掛載 Subject Continuity Bay；S42 cache、signed-update queue、witness buffer、server-side delegation records 變得可見。 |
| 03:10–03:50 | 封存 S42；匯入 Chapter 23–25 signed updates；物理 CAL／PHASE endpoint heartbeats 與 ledger 交叉；形成 S43。 |
| 03:20–04:35 | **平行背景任務**：historical seven-stage handshake、悠真夢話停頓與 line7 交叉；建立 timing-only package、stage ceilings 及 safe-pause 模擬。 |
| 03:50–04:25 | 固定八名 active human dependencies；分開 Clinical Safety Hold 與 Public Data-Use Hold；四名紅區作最低必要具名層。 |
| 04:25–04:48 | Route A：formal S43 rebind 需 A18 science token，正式失敗。 |
| 04:48–05:15 | Route B：continuity 嘗試 `SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE`；琴音撤回 G07／03 persistent delegation，真理拒絕 reseal；certificate 失敗。 |
| 05:15–05:32 | package 路徑進一步收斂；一個 cluster quarantine；KAGAMI manual override／break-glass 邊界被鎖定。 |
| 05:20–05:42 | **平行背景任務**：Witness Buffer、consent filter、serializer 與 Witness Echo Sideband 完整 egress 驗證；輸出仍 disabled。 |
| 05:32–05:46 | timing package、患者 stage ceiling、witness fragment set、serializer hash 及手機末端取消命令完成預先簽署。 |
| 05:46–05:49 | 最終醫療／技術狀態總檢查；顯示 branch-specific 05:50 prep；本章在一分鐘倒數前結束。 |

倒數：

| 時點 | 距星期一 05:50 auto-prep | 距 06:13 回聲窗 |
|---|---:|---:|
| 00:05 | 約 5 小時 45 分 | 約 6 小時 8 分 |
| 03:10 | 約 2 小時 40 分 | 約 3 小時 3 分 |
| 04:48 | 約 1 小時 2 分 | 約 1 小時 25 分 |
| 05:15 | 約 35 分 | 約 58 分 |
| 05:32 | 約 18 分 | 約 41 分 |
| 05:46 | 約 4 分 | 約 27 分 |
| 05:49 | 約 1 分 | 約 24 分 |

---
# 3. 必須同步的跨章補丁

本章能否公平成立，取決於以下欄位是否**真正寫回早期章節正文／終端畫面**，而不只留在 Chapter 26 作者備註。

## 3.1 Chapter 21：COMMIT-GATE、execution anchor 與 subject service mount

R2 欄位正式出現：

```text
COMMIT-GATE
├── CRYPTO AUTH VERIFY
├── ROUTE／BUNDLE VERIFY
├── SUBJECT DEPENDENCY ATTESTATION
├── CLINICAL HOLD
├── BRANCH ISOLATION STATUS
└── EXECUTION COMMIT

EXECUTION ANCHOR       KAGAMI-01
REGIONAL PACKAGE       PREPOSITION ONLY
```

千田只需說：

> 「區域節點可以先收套件，最後仍要鏡島確認臨床側。」

另加入低強度欄位：

```text
SUBJECT LEDGER
NORMAL MODE       SEALED／LOCAL OFFLINE
BCP SERVICE MOUNT CUTOVER-BOUND
```

不提前揭露 Chapter 26 解法，只讓讀者知道：

> 患者側本地 ledger 平時不在線，只有 BCP 本地服務窗才掛載。

## 3.2 Chapter 22：R1 原始安全語義與 continuity overlay

共享閉環／R4 圖中補入：

- public branch 進入 final commit 前須通過本地患者依存確認；
- R4 硬切不等待該確認，而直接切共用閉環；
- R1 原始欄位：
  > `SEPARATED／SAFE／CURRENTLY ATTESTED`
- continuity 低強度欄位：
  > `CENTRALLY MANAGED → MANAGED-EQUIVALENT／BCP`

Chapter 22 不解釋偷換全貌，只讓讀者看見：

> 系統把「仍由中央管理」當成某種 safety-equivalent。

## 3.3 Chapter 24／25：lease metadata 與兩種 epoch

Bundle／lease metadata 必須包含：

```text
AUTH EPOCH                    A17
SUBJECT SNAPSHOT EPOCH        S42
DEPENDENCY SNAPSHOT HASH      <OLD-HASH>
CLINICAL TOPOLOGY HASH        <TOPOLOGY-HASH>
EXECUTION ANCHOR              KAGAMI-01
SUBJECT POLICY                MANAGED-EQUIVALENT／CACHED
```

S7 撤回後：

```text
AUTH EPOCH                    A18
FUTURE RELEASE                DISABLED
```

患者狀態則使用：

```text
SUBJECT EPOCH                 S42 → S43
```

不得再以相同 `N／N+1` 指兩種版本。

Chapter 25 的區域預置畫面須顯示：

```text
LOCAL EXECUTION    WAITING FOR KAGAMI ANCHOR
```

## 3.4 Chapter 23–25：琴音 access 與 persistent delegation 分開

Chapter 23 撤銷／凍結的是：

- device access；
- app credential；
- 一次性 work order；
- 工程 route。

但前台當時不顯示 continuity policy 內的：

```text
CLINICAL DELEGATION
HOLDER CONSENT     PERSISTENT
```

它不是登入權限，而是未來 broker 可再次詢問的 case acknowledgment。

只有 Chapter 26 的 Subject Bay／broker lineage 掛載後，團隊才知道這項 persistent delegation 尚未正式撤回。

## 3.5 Chapter 9／20：悠真節奏與模組化 handshake

Chapter 9 保持：

- 七條／七線；
- 不規則停頓；
- line7；
- 類似防災提示的短音。

Chapter 20 技術血統圖補入：

```text
G07 MULTI-NODE HANDSHAKE
├── ANNOUNCE
├── SAMPLE
├── HOLD
├── COMPARE
├── ACKNOWLEDGE
├── HANDOFF
└── SETTLE
```

並說明：

- timing 與神經內容分離；
- timing 模組可單獨回放；
- 未準備節點可停在 HOLD／SAFE PAUSE；
- 歷史控制器本來便有純 timing package。

Chapter 26 的部署依據是：

- historical specification；
- 多節點日誌；
- 離線模擬；
- 醫療停止條件。

悠真夢話只提供缺失 phase order 的人類記憶交叉。

## 3.6 Chapter 21–25：Witness Buffer 與 Echo Sideband 伏筆

R3／臨床 after-action 記錄至少出現：

```text
PATIENT WITNESS BUFFER
MODE             APPEND-ONLY
CONSENSUS INPUT  NO
RAW NEURAL       NO
PUBLIC ROUTE     NONE
```

另加入低頻 transport 欄位：

```text
WITNESS ECHO SIDEBAND
PURPOSE          CLINICAL AFTER-ACTION
CONSENSUS        NONE
CARRIER          FILTER TELEMETRY SIDEBAND
```

早期用途只被理解為：

- 回聲事件後的臨床重建；
- 患者／家屬碎片封存；
- R3 額外記憶託管的證據邊界。

Chapter 26 才辨認：

> 這條 sideband 不經 consensus，可在 Chapter 27 承載彼此獨立的 witness fragments。

## 3.7 Chapter 24–25：條件式開示命令

法院／醫療命令加入：

```text
EMERGENCY SUBJECT-STATE DISCLOSURE
TRIGGER
- SPECIFIED BUNDLE ENTERS LOCAL PREPOSITION
- DISTRIBUTED HOLD NOT RECOGNIZED BY CONTINUITY
SCOPE
- KAGAMI LOCAL SUBJECT LEDGER
- MINIMUM NECESSARY PATIENT SAFETY DATA
```

這解釋：

- 為何 23:50 前不能任意打開私密患者 ledger；
- 為何 package preposition 開始後，Chapter 26 可立即行動。

## 3.8 Chapter 24–25：全部患者與物理 endpoint 數量鎖定

作者層名冊固定為：

```text
TOTAL HUMAN DEPENDENCY RECORDS    9
SAFE-DETACHED／G07-12             1
ACTIVE HUMAN DEPENDENCIES         8
CRITICAL RED-ZONE                 4
OTHER ACTIVE                      4
```

正文早期可只顯示聚合，不提前公開全部姓名。

## 3.9 Chapter 24–25：Manual override 低強度欄位

KAGAMI service document 至少出現：

```text
CLINICAL LATCH OVERRIDE
SOFTWARE BCP      UNAVAILABLE WHEN HUMAN UNRESOLVED
PHYSICAL          BREAK-GLASS／MULTI-DOMAIN
```

不提前解釋所需 shares，但防止 Chapter 27 臨時出現「高官按忽略患者」的軟體按鈕。

## 3.10 高層企劃同步修改

高層企劃正式更新：

- 琴音只有低強度循環熟悉感，沒有完整輪次記憶；
- 悠真已在外部安全切離，不在鏡島 Subject Bay；
- 琴音只辨認 `SUBJECT-SVC／G07` alias，本地技師負責實體映射；
- 她打開的是患者狀態、安全閂及 witness infrastructure 的制度區域；
- 她撤回自己的 G07／03 persistent delegation，阻止 subject-equivalence fallback；
- Chapter 27 的真相碎片走 Witness Echo Sideband／Public Witness Index，不走 TOKYO-7 consensus branch；
- Chapter 27 成功不要求全部患者完成 handoff；
- M-00 可暫時保留受限制的 clinical transition support 至第八天。

---
# 4. KAGAMI-01 的既有本地接受鏈

## 4.1 區域預置不等於能執行

區域節點可以：

- 快取 bundle；
- 驗證 science／operational token；
- 建立離線 package index；
- 準備路由與時間表；
- 保全 lease 及 package write。

但最終同步仍需要：

```text
EXECUTION ANCHOR    KAGAMI-01
```

KAGAMI-01 會在：

- 05:50 branch-specific auto-prep；
- CAL／PHASE 準備；
- consensus preparation；
- execution commit；

各階段簽發本地時間錨與分支適用性。

沒有 KAGAMI execution anchor：

- 區域 package 不能自行形成 06:13 public fanout；
- 手機／公共路徑不能只靠區域快取完成同步；
- 預置資料仍需保全，但尚未播出；
- continuity-controlled clusters 只能停在 local cache／warmup waiting。

## 4.2 為何本地患者層只在 cutover 後可見

```text
SUBJECT CONTINUITY BAY

NORMAL STATE
LEDGER MOUNT          SEALED／OFFLINE
VISIBLE STATUS        AGGREGATED SUMMARY
LOCAL S42 CACHE       NOT EXPOSED

CUTOVER SERVICE WINDOW
TRIGGER               LEASE LOADED + LOCAL PREPOSITION
LEDGER MOUNT          AVAILABLE／SEALED
S42 CACHE             VISIBLE TO AUTHORIZED SERVICE
EXECUTION-ANCHOR PATH PREPARED
```

23:50 前：

- lease 尚未載入 KAGAMI 本地 service path；
- Bay 的 S42 snapshot、dependency hash 及 update queue 均未掛載；
- 角色只能看到中央聚合摘要；
- 法院條件式開示亦尚未被觸發。

23:50 後：

- 指定 bundle 已進入本地預置；
- distributed hold 未被 continuity 接受；
- 技術 mount 及緊急患者安全開示條件同時成立。

因此 Chapter 26 現在才可打開 Bay。

## 4.3 本地接受步驟

```text
STEP 1   SCIENCE TOKEN SIGNATURE
STEP 2   OPERATIONAL TOKEN SIGNATURE
STEP 3   BUNDLE HASH／LEASE NONCE
STEP 4   AUTH EPOCH／EXECUTION WINDOW
STEP 5   LOCAL HARDWARE／ROUTE ATTESTATION
STEP 6   SUBJECT SNAPSHOT EPOCH
STEP 7   CURRENT SUBJECT-STATE MERGE
STEP 8   PHYSICAL CLINICAL ENDPOINT RECONCILIATION
STEP 9   CLINICAL SAFETY HOLD
STEP 10  PUBLIC DATA-USE HOLD
STEP 11  BRANCH ISOLATION STATUS
STEP 12  COMMIT-GATE／EXECUTION ANCHOR
```

Continuity lease 通過前五項。

本章問題集中於 Step 6–12。

## 4.4 R1 原始安全語義

R1／R2 原始 latch 規定：

```text
ACTIVE HUMAN DEPENDENCIES
        ↓
CURRENT MEDICAL／PATIENT-ROOT ATTESTATION
        ↓
ALL SEPARATED／SAFE／AUTHORIZED?
        ↓
YES → CLEAR
NO／UNKNOWN → HOLD
```

它不是：

- 姓名欄；
- 澪臨時提出的倫理規則；
- 可由 science 或 operations share 代簽的欄位。

它是：

> 公共 bundle 使用 clinical topology 前，必須確認所有仍依賴該 topology 的活人已安全切離，或在當輪醫療與患者程序中明確授權相應過渡。

## 4.5 Continuity overlay 的語義偷換

為離線 BCP 可用性，後來加入：

```text
IF SUBJECT REGION SEALED
AND NO VISIBLE SERVICE EVENT
AND CENTRAL MANAGEMENT ACTIVE
THEN SUBJECT SAFETY = MANAGED-EQUIVALENT／CACHED
```

表面理由：

- 離線 root 不應取得完整患者私隱；
- 通訊故障時不能因無法查詢患者而令基礎設施永遠停擺；
- 中央臨床管理仍在線，便可視為患者狀態由醫療系統承擔。

真正缺陷：

> 「仍受中央控制」被當成「已完成安全處理」。

Continuity 沒有移除 R1 的 latch。

它改寫了「安全」的意思。

## 4.6 兩個獨立 HOLD

### Clinical Safety Hold

檢查全部八名 active human dependencies：

- 是否仍依賴 current clinical topology；
- 是否已安全切離；
- 是否有 patient-bound root；
- 是否有 active transition authorization；
- 是否 unknown／unmapped。

任一未分離或未知：

```text
CLINICAL SAFETY HOLD    HOLD
```

### Public Data-Use Hold

檢查 bundle 實際使用的五名資料來源者：

- 是否有當輪 public-use consent；
- 是否用途與 bundle 一致；
- 是否有患者／代理撤回；
- 是否存在 raw-neural prohibition。

任一無有效同意：

```text
PUBLIC DATA-USE HOLD    HOLD
```

兩者不能互相替代。

即使一名患者不是資料來源，其臨床生命線仍足以觸發 Clinical Safety Hold。

即使一名資料來源已安全離線，缺乏 public-use consent 仍足以觸發 Public Data-Use Hold。

## 4.7 澪拒絕快速破壞方案

現場提出：

- 破壞 KAGAMI bundle index；
- 強制將 lease nonce 寫入 denylist；
- 關閉 execution anchor service；
- 隔離全島網路；
- 清除區域 package cache。

風險：

- 影響 protective filtering；
- 中斷 clinical branch；
- 觸發 central fallback 或 sabotage policy；
- 破壞證據；
- 仍未解決患者如何撐過高負荷。

澪選擇較慢的 live-state path：

> 「不是把它弄壞。」  
> 「是讓它看見自己正在對誰做這件事。」

這是本章只屬於澪的選擇。

## 4.8 Manual override 邊界

```text
CLINICAL LATCH OVERRIDE

SOFTWARE／NORMAL BCP
STATUS                NOT AVAILABLE
WHEN HUMAN UNRESOLVED FAIL CLOSED

PHYSICAL BREAK-GLASS REQUIRES
- MEDICAL SAFETY SHARE
- PATIENT-RIGHTS SHARE
- LOCAL OPERATIONS SHARE
- PHYSICAL SERVICE ACTION
- IMMUTABLE AUDIT

EFFECT                 PUBLIC／CONSENSUS BRANCH ONLY
PROTECTIVE FILTER      UNAFFECTED
CLINICAL BRANCH        UNAFFECTED
```

醫療及患者權利均明確拒絕，因此合法 override 不可取得。

任何非法物理 bypass：

- 必然留下不可改寫 audit；
- 不能被遠端高官以普通軟體按鈕完成；
- 可作 Chapter 27 的最後風險之一，但不是新的隱藏授權層。

---
# 5. `SUBJECT CONTINUITY BAY`：不是病房，而是患者側安全區

## 5.1 實體／系統定位

`SUBJECT CONTINUITY BAY` 位於 KAGAMI-01 臨床服務側。

它不包含：

- 患者身體；
- 睡眠艙；
- 新受試者；
- 另一座秘密研究中心；
- 患者完整記憶資料庫。

它包含：

- 本地 subject-state ledger；
- patient-root manifest；
- remote signed-update queue；
- 共用 CAL／PHASE BUS 患者側終端；
- physical endpoint heartbeat map；
- continuity managed-equivalent cache；
- Clinical Safety Hold；
- Public Data-Use Hold；
- subject-equivalence service；
- witness buffer／release filter／serializer；
- server-side delegation records；
- 患者路徑的加密映射。

普通公共營運畫面只能看到：

```text
CLINICAL STATUS          AVAILABLE
SUBJECT POLICY           MANAGED-EQUIVALENT／CACHED
SUBJECT LEDGER           SEALED
```

看不到：

- 患者姓名；
- 法定代理；
- patient-root 狀態；
- active-switch deny；
- public-use deny；
- physical endpoint mismatch；
- unresolved human dependencies。

## 5.2 為何只能在 Chapter 26 掛載

Subject Bay 的本地 service mount 只有在：

```text
CUTOVER LEASE LOADED
+
LOCAL PACKAGE PREPOSITION ACTIVE
```

時才可見。

23:50 以前：

- KAGAMI 只保有聚合 clinical summary；
- S42 本地 snapshot 未掛載；
- external signed-update queue 不能被 merge；
- emergency disclosure order 尚未觸發。

23:50 以後：

- lease 及 bundle 進入鏡島本地預置；
- execution-anchor service 啟動準備；
- 法院條件式患者安全開示生效；
- Chapter 26 才能取得最低必要本地患者狀態。

## 5.3 琴音知道的是 alias，不是實體門

Chapter 23 的美空卡匣安裝流程包含：

- `SUBJECT-SVC／G07` service alias；
- family-assist 圖示；
- G07／03 case route；
- continuity reseal 語言；
- subject-service acknowledgement。

琴音不知道：

- Bay 的實體位置；
- 其他患者；
- live subject ledger；
- Clinical Latch；
- lease snapshot；
- witness egress。

她只能說：

> 「我認得他們以前叫這條服務路徑的名字。」

真正的實體映射由：

- 千田 R2；
- KAGAMI audit；
- 本地服務手冊；
- 鏡島技師；

共同完成。

這避免琴音因一次遠端醫療安裝經驗，突然熟悉鏡島內部構造。

## 5.4 Forensic clone 的正確用途

琴音原裝置已依法保全，不重新交還。

Forensic clone 必須：

- 離線；
- 無 production 私鑰；
- 無 live acknowledgment 能力；
- 只讀。

它只用於：

- 找到 `FAMILY-STABILITY／CASE-G07-03` role ID；
- 顯示歷史 service-route；
- 解析 reseal 流程；
- 證明琴音曾被設定為 holder；
- 指向 server-side delegation record。

真正的 live request 不送往 forensic clone。

## 5.5 受控掛載需要的領域

琴音一個人不能開 Bay。

最低必要領域：

1. KAGAMI 本地營運的物理 service key；
2. 獨立系統安全；
3. 外部醫療；
4. 患者權利代表；
5. 司法／證據保全；
6. 鏡島本地臨床保管；
7. G07／03 route discovery：
   - 琴音提供 alias；
   - 真理允許使用美空 case route，只限患者安全開示；
8. 其他患者資料由各自代理／法院程序保持加密及最低必要顯示。

琴音的功能是：

- 指認 alias；
- 解釋過去流程；
- 撤回自己的 persistent delegation。

她不是：

- 唯一鑰匙；
- 患者代表；
- 系統管理員；
- Latch 操作者；
- 免責交換的受益者。

## 5.6 現場／遠端分工

### 現場

- 鏡島本地技師操作面板；
- 系統安全驗證 route、firmware 及 audit；
- 外部醫療監看 clinical branch；
- 司法保全錄影與封存；
- 患者權利代表監督開示尺度；
- 澪、日下部與琴音只在各自程序範圍內參與。

### 遠端

- 千田解讀 R2；
- 凪原提供 bundle schema；
- 真理／佳乃處理患者代理；
- 各地 patient-root 與醫療節點準備 signed updates；
- 函館團隊保持 `LEGACY／02` hold。

## 5.7 掛載不改變患者治療

合法開示只會：

- 停止使用 sealed cached-equivalent；
- 讀取早已存在的 signed updates；
- 更新本地 ledger；
- 核對 physical endpoints；
- 重新計算 dependency hash；
- 開放最低必要 witness metadata。

它不會：

- 切斷中央閉環；
- 讓 local shadow 接管；
- 改寫患者模型；
- 修改公共 bundle；
- 讓琴音取得其他患者資料；
- 直接使任何患者安全離線。

---
# 6. 舊租約的患者語義：`MANAGED-EQUIVALENT`，不是 `CLEAR`

## 6.1 租約中的舊快照

```text
SUBJECT SNAPSHOT／S42

M-00             ACTIVE／CENTRALLY MANAGED
G07 GROUP        ACTIVE／CENTRALLY MANAGED
LEGACY GROUP     ACTIVE／CENTRALLY MANAGED

SUBJECT SAFETY   CACHED／MANAGED-EQUIVALENT
POLICY           CONTINUITY BCP
SOURCE           SEALED SUBJECT REGION
```

它沒有顯示：

- 朝倉紗英；
- 藤川美空；
- 水瀨葵；
- `LEGACY／02` 是活人；
- 另外四名活動患者；
- 法定代理；
- patient-root；
- active-switch deny；
- public-use deny；
- R5 hold；
- physical endpoint map；
- unresolved status。

這份快照並非完全虛構。

它反映：

- 八名患者的相關臨床群仍由中央管理；
- 封閉區域內沒有 continuity 可見的 service event；
- 中央 clinical summary 尚顯示「managed」。

真正的錯誤是：

> Continuity 把「仍受中央管理」當成「等同已安全處理」。

## 6.2 固定活動患者數量

作者層正式鎖定：

```text
TOTAL HUMAN DEPENDENCY RECORDS     9
SAFE-DETACHED                      1
ACTIVE HUMAN DEPENDENCIES          8
CRITICAL RED-ZONE                  4
OTHER ACTIVE                       4
```

Safe-detached record：

```text
G07／12／朝倉悠真
STATUS    SAFE-DETACHED
ACTIVE LATCH    EXCLUDED
```

八名 active human dependencies：

### Critical red-zone／4

- `M-00／朝倉紗英`
- `G07／03／藤川美空`
- `G07／08／水瀨葵`
- `LEGACY／02／HUMAN／ADULT`

### Other active／4（制度代碼可見，姓名依法遮蔽）

以制度代碼而非姓名可見，對應 Chapter 24 匿名準備矩陣：

- `G07／05`：16 歲、prior assent（事前同意）、proxy／rights（代理人／權利）；patient-bound local root present／Stage-1；
- `LEGACY／04`：成人、limited self-consent（有限自我同意）；patient-bound local root present／Stage-1；
- `ACTIVE／C`：Stage-0 baseline／compare only；
- `ACTIVE／D`：local root pending／hold。

四名紅區是不可逆風險的穩定下限。

不是全部患者。

## 6.3 物理端點與人類記錄核對

S43 形成時，系統必須比較：

```text
CLINICAL BUS RECONCILIATION

PHYSICAL ACTIVE ENDPOINTS       8
LEDGER ACTIVE HUMAN RECORDS     8
SAFE-DETACHED RECORDS           1
UNMAPPED ACTIVE HEARTBEATS      0
ORPHAN LEDGER RECORDS           0
```

任何：

- unmapped active heartbeat；
- 有臨床負載卻無 patient-root／醫療記錄的線；
- ledger 記錄無物理／合法遠端端點；
- 數量不一致；

都一律：

```text
UNKNOWN／UNRESOLVED
CLINICAL SAFETY HOLD    HOLD
```

這防止制度再次藉由「沒有把某人寫入名冊」排除患者。

## 6.4 Clinical Safety Hold

```text
CLINICAL SEPARATION／SAFETY

ACTIVE HUMAN DEPENDENCIES       8
SAFE／SEPARATED                 0／8
PATIENT-BOUND LOCAL ROOT        6／8
ACTIVE TRANSITION AUTHORIZED    0／8
UNRESOLVED／NOT SEPARATED       8／8

RESULT                          HOLD
```

它適用於全部八名 active patients。

即使某患者不是 TOKYO-7 資料來源，只要其生命線仍依賴 clinical topology，便能阻止 public execution。

## 6.5 Public Data-Use Hold

TOKYO-7 bundle metadata 顯示：

```text
PUBLIC DATA USE

DATA-SOURCE SUBJECTS            5
VALID PUBLIC-USE CONSENT        0／5
RAW-NEURAL USE AUTHORIZED       0／5

RESULT                          HOLD
```

五名實際資料來源者包括：

- M-00；
- 四名 RESP-GRP contributors。

完整身份保持患者程序遮蔽。

這項 hold 只處理：

- bundle 是否有權把患者資料用於 public／consensus；
- 不取代 clinical safety 判斷。

## 6.6 授權人類可見層

依法可見的四名關鍵紅區：

```text
M-00
HUMAN／ADULT
NAME／AUTHORIZED VIEW          朝倉 紗英
PATIENT STATE                  STAGE-1
ACTIVE SWITCH                  NOT AUTHORIZED
PUBLIC USE                     NOT AUTHORIZED

G07／03
HUMAN／MINOR
NAME／AUTHORIZED VIEW          藤川 美空
PATIENT ROOT                   DOMAIN-C
ACTIVE SWITCH                  NOT AUTHORIZED
PUBLIC USE                     NOT AUTHORIZED

G07／08
HUMAN／MINOR
NAME／AUTHORIZED VIEW          水瀨 葵
PATIENT ROOT                   AOI-LOCAL
ACTIVE SWITCH                  NOT AUTHORIZED
PUBLIC USE                     NOT AUTHORIZED

LEGACY／02
HUMAN／ADULT
NAME                           SEALED
PATIENT ROOT                   ADAPTER PENDING
ACTIVE SWITCH                  NOT AUTHORIZED
PUBLIC USE                     NOT AUTHORIZED
```

其他四名 active patients 只顯示：

- HUMAN；
- 成人／未成年人；
- patient-root／醫療成熟度；
- unresolved；
- public-use consent。

不公開姓名、病房或私人醫療資料。

## 6.7 核心人物句

澪看見 lease 欄：

- science；
- operations；
- Tokyo；
- bundle；
- A17；
- S42。

再看八名 active human dependencies。

她說：

> 「它寫了科學，寫了營運，寫了東京。」  
> 「沒有寫誰還接在那條線上。」

此句不是要求 lease 保存患者完整姓名。

真正含義是：

> 一份要使用患者閉環的租約，沒有取得當輪患者狀態、代理、醫療安全與拒絕。

琴音看到 G07／03 旁的姓名，只讀出：

> 「藤川美空。」

她不是要求美空成為特殊例外。

她只是第一次在鏡島內，不再使用 continuity 交給她的代碼叫妹妹。

---
# 7. Signed patient updates、單調 ledger 與 `SUBJECT_EPOCH S43`

## 7.1 掛載以前，更新早已存在

Chapter 23–25 已產生：

### M-00

- active-switch prohibition；
- restricted data-use consent；
- network transition limits；
- external medical hold；
- public／consensus function deny。

### 美空

- Domain-P quarantine；
- Domain-C patient root；
- active-switch deny；
- public-use deny；
- sleep-transition drift unresolved。

### 葵

- AOI-LOCAL patient root；
- legal／medical takeover；
- Stage-0 baseline；
- active-switch deny；
- public-use deny。

### `LEGACY／02`

- external medical hold；
- adapter pending；
- active-switch deny；
- unresolved local root。

### 其他四名 active patients

- 兩名 Stage-1／patient-bound local root；
- 一名 Stage-0；
- 一名 local root pending；
- 全部均無 public-use consent；
- 全部均未授權 active transition。

這些資料均有：

- patient-root、法院、醫療或代理簽章；
- 時間戳；
- monotonic version；
- local audit；
- endpoint identity。

問題不是更新不存在。

而是它們尚未被合併進 KAGAMI 本地 subject ledger。

## 7.2 掛載後的合併流程

```text
SUBJECT LEDGER MERGE

BASE EPOCH           S42
REMOTE SIGNED EVENTS FOUND
CACHE MODE           INVALIDATED
MERGE RULE           MONOTONIC／NO ROLLBACK
UNKNOWN POLICY       FAIL CLOSED
RESULT EPOCH         S43
```

流程：

1. 封存 S42 原快照作證據；
2. 驗證每項 signed update；
3. 依患者／法院／醫療版本單調合併；
4. 任何無法理解的新 root／adapter 格式標記：
   > `UNKNOWN／UNRESOLVED`
5. 不允許 rollback；
6. 不允許回到 cached managed-equivalent；
7. 和 physical CAL／PHASE endpoints 核對；
8. 形成 S43 live dependency hash。

因此：

> 打開 Bay 沒有製造拒絕。  
> 它只讓鏡島不能再拒絕讀取早已存在的拒絕。

## 7.3 物理臨床端點核對

```text
CLINICAL BUS RECONCILIATION

PHYSICAL ACTIVE ENDPOINTS       8
LEDGER ACTIVE HUMAN RECORDS     8
UNMAPPED ACTIVE HEARTBEATS      0
ORPHAN LEDGER RECORDS           0
SAFE-DETACHED RECORDS           1
```

物理 heartbeat 只提供：

- active／inactive；
- phase link；
- local controller identity；
- clinical load；
- endpoint nonce。

它不暴露患者完整身份。

Ledger 提供人類與權利狀態。

兩者必須一致。

任何 mismatch 均 fail closed。

## 7.4 新舊狀態比較

```text
LEASE AUTH EPOCH                 A17
CURRENT SCIENCE AUTH EPOCH       A18

LEASE SUBJECT EPOCH              S42
LIVE SUBJECT EPOCH               S43

LEASE DEPENDENCY HASH            <OLD-HASH>
LIVE DEPENDENCY HASH             <CURRENT-HASH>

SUBJECT MATCH                    NO
```

Authorization 與 subject epoch 分開後，不再出現 `N／N+1` 歧義。

## 7.5 Clinical Safety Attestation

```text
CLINICAL SAFETY ATTESTATION

ACTIVE HUMAN DEPENDENCIES        8
SAFE／SEPARATED                   0／8
PATIENT-BOUND ROOT PRESENT        6／8
ACTIVE TRANSITION AUTHORIZED      0／8
UNRESOLVED／NOT SEPARATED         8／8
PHYSICAL／LEDGER MATCH             YES

STATUS                            HOLD
```

規則：

- 任一 unresolved；
- 任一未安全切離；
- 任一 physical／ledger mismatch；
- 任一 active transition 無授權；

都觸發 Clinical Safety Hold。

## 7.6 Public Data-Use Attestation

```text
PUBLIC DATA-USE ATTESTATION

DATA-SOURCE SUBJECTS             5
VALID PUBLIC-USE CONSENT         0／5
RAW-NEURAL USE                   PROHIBITED
STATUS                           HOLD
```

兩個 HOLD 均獨立成立。

## 7.7 KAGAMI 本地驗證結果

```text
SCIENCE TOKEN                   VALID
OPERATIONAL TOKEN               VALID
BUNDLE HASH                     VALID
LEASE NONCE                     VALID
AUTH EPOCH／WINDOW              VALID

SUBJECT EPOCH                   S42 ≠ S43
DEPENDENCY SNAPSHOT             STALE
PHYSICAL ENDPOINT RECONCILIATION PASS
CLINICAL SAFETY                 HOLD
PUBLIC DATA USE                 HOLD

LOCAL EXECUTION ELIGIBILITY     NO
```

## 7.8 `LOCAL EXECUTION HOLD`

效果：

- KAGAMI 不簽 execution anchor；
- consensus／public branch 不能進 final commit；
- 區域 package 仍可被保全或 quarantine；
- protective filter 保持；
- clinical bus 保持；
- evidence capture 保持；
- lease 不被刪除；
- HSM 不被破壞。

```text
CUTOVER AUTH LEASE          CRYPTOGRAPHICALLY VALID
KAGAMI ACCEPTANCE           HELD
PUBLIC EXECUTION            INELIGIBLE
PROTECTIVE FILTER           ACTIVE
CLINICAL BRANCH             ACTIVE
```

這不是：

- global lease cancellation；
- 患者已安全離線；
- package 已消失；
- 終局完成。

它是：

> 本地硬體承認，機構授權不等於患者安全或資料使用授權。

---
# 8. Continuity 的兩條 fallback：正式 rebind 與安全等價證明

## 8.1 Route A：正式 rebind

Continuity authority 看到 S43 後，首先嘗試：

```text
LEASE REBIND REQUEST

CURRENT SUBJECT EPOCH       S43
CURRENT DEPENDENCY HASH     <CURRENT-HASH>
REUSE OPERATIONAL TOKEN     REQUESTED
NEW SCIENCE TOKEN           REQUIRED
```

這是舊 policy 對「臨床狀態真正改變」的正常反應。

## 8.2 為何 S43 形成新 bundle

S43 改變：

- dependency snapshot；
- patient-root manifest；
- clinical topology；
- active-switch authorization；
- public-use authorization；
- subject safety policy；
- physical endpoint map；
- exact bundle hash。

所以不能：

- 只改 lease envelope；
- 重用 A17 science token；
- 讓 operational token 單方面重簽；
- 將患者安全視為不影響 bundle 的附註。

## 8.3 `AUTH_EPOCH A18`

23:50 queued revocation 後：

```text
S7 SCIENCE ESCROW

CURRENT AUTH EPOCH       A18
FUTURE RELEASE           DISABLED
CAPSULE HANDLE           DESTROYED
NEW SCIENCE TOKEN        UNAVAILABLE
```

作者層正式鎖定：

> 對本輪 exact TOKYO-7 bundle 及 A18 架構而言，沒有第二條合法 science-domain release path。

不會在 Chapter 27 突然出現另一枚 science root。

因此：

```text
FORMAL LEASE REBIND
SCIENCE AUTHORIZATION    MISSING
STATUS                   DENIED
```

Chapter 25 撤回工作的第一項實質支付是：

> 制度不能在知道 S43 真實患者狀態後，重新簽出一份新 bundle。

## 8.4 凪原不能個人重簽

即使凪原願意：

- 新 science token 仍需 science-domain HSM；
- distributed hold 有效；
- 她已撤回原角色 escrow；
- 個人簽章不能替代不可匯出 capsule；
- 她不能代表患者狀態。

她只能：

- 提供原 bundle schema；
- 確認 snapshot 偷換；
- 證明 S43 必須形成新 bundle；
- 協助阻止偽造 rebind；
- 對續期 A17 的責任作證。

## 8.5 Route B：`SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE`

Formal rebind 失敗後，continuity 還有一條正常 BCP fallback。

其目的原本是：

> 避免每一項患者行政更新，都迫使離線基礎設施重新簽署整套 bundle。

它嘗試生成：

```text
SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE

LEASE SNAPSHOT      S42
CURRENT SNAPSHOT    S43
POLICY              MANAGED-EQUIVALENT／BCP
CLAIM               EXECUTION-SEMANTICALLY EQUIVALENT

REQUIRES
- ALL UNRESOLVED CASE ACKNOWLEDGMENTS
- NO PATIENT-ROOT DENY
- NO CLINICAL SAFETY CONFLICT
- NO PATIENT-RIGHTS HOLD CONFLICT
- PHYSICAL ENDPOINT SET UNCHANGED／ACCOUNTED
```

若 certificate 成立：

- exact bundle hash 不變；
- 不需新 science token；
- old A17 lease 可被 KAGAMI 視為仍適用於 S43；
- local execution HOLD 可解除。

因此這不是沒有作用的附加文件。

它是 continuity 在 formal rebind 失敗後，仍可拯救 old lease 的第二條路。

## 8.6 為何 equivalence 路線也必須失敗

S43 顯示：

- 八名 active human dependencies 均未安全切離；
- active transition authorization = 0／8；
- public-use consent = 0／5；
- 美空、葵、M-00、`LEGACY／02` 及其他 case routes 均有 deny／unresolved；
- physical endpoint set 雖已完整核對，臨床安全語義不等同 S42 cached managed state。

Certificate 仍會向每個 unresolved case route 要求：

- 醫療 acknowledgment；
- 患者／代理 acknowledgment；
- 沒有 active patient-root deny。

琴音的 G07／03 persistent delegation 是其中一個可被詢問的舊 holder route。

她只能影響美空一項。

但只要 G07／03 明確拒絕：

```text
SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE    DENIED
```

其他 unresolved routes 亦各自使 aggregate proof 無法成立。

Chapter 25 撤回工作的第二項實質支付是：

> 即使 continuity 不重簽 bundle，也無法再把 S43 宣稱成 S42 的安全等價版本。

---
# 9. 琴音撤回的是自己的 persistent delegation，不是所有人的開關

## 9.1 Chapter 23 已經凍結什麼

Chapter 23 已處理：

```text
DEVICE ACCESS          SUSPENDED
APP CREDENTIAL         SEIZED
ONE-TIME WORK ORDER    CLOSED
ENGINEERING ROUTE      DISABLED
```

這些措施阻止琴音：

- 登入；
- 取得新門禁；
- 操作設備；
- 再接承包任務。

它們沒有自動撤回：

```text
CLINICAL DELEGATION
CASE               G07／03
HOLDER             白石琴音
STATUS             SUSPENDED／NOT REVOKED
PURPOSE            FUTURE CASE ACKNOWLEDGMENT
```

這不是登入能力。

它是：

> Continuity 若要為 G07／03 重新產生患者服務／安全等價狀態，可再次詢問原 holder 是否確認。

直到 Subject Bay 的 server-side record 掛載後，團隊才知道此 persistent delegation 仍存在。

## 9.2 Forensic clone 只找到 role ID

Forensic clone 顯示：

- role ID；
- holder identity；
- 歷史 service-route；
- 過去 reseal 指示；
- server-side delegation pointer。

它不能：

- 接收 live request；
- 替琴音確認；
- 產生 holder signature；
- 進入 production。

Continuity broker 的 live request 送往 server-side delegation record。

琴音本人必須以受控身份程序回覆。

## 9.3 Equivalence certificate 需要聚合 case acknowledgment

Continuity 嘗試生成：

```text
SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE
LEASE SNAPSHOT      S42
CURRENT SNAPSHOT    S43
```

它必須取得：

- 每一名 unresolved case route 的醫療／代理 acknowledgment；
- 沒有 patient-root deny；
- 沒有 Clinical Safety Hold；
- 沒有 Patient-Rights Hold；
- 物理端點與 ledger 完整一致。

琴音只能提供：

> G07／03 case acknowledgment。

她不能替：

- M-00；
- G07／08；
- `LEGACY／02`；
- 另外四名 active patients；

作決定。

她一個人也不能讓 aggregate certificate 成立。

但只要她／真理明確拒絕美空一項：

> old lease 便不能用「所有 case 仍安全等價」的說法繼續套用。

## 9.4 琴音正式撤回 G07／03 delegation

琴音在以下人員見證下撤回：

- 辯護人；
- 藤川真理；
- 外部醫療；
- 患者權利代表；
- 司法保全；
- 系統安全。

```text
CLINICAL DELEGATION
CASE              G07／03
HOLDER            白石琴音
STATUS            REVOKED BY HOLDER
PATIENT REP       DENY RESEAL
MEDICAL WITNESS   PRESENT
JUDICIAL RECORD   SEALED
```

藤川真理另行確認：

> 美空患者程序不授權以 `CENTRALLY MANAGED` 重新產生安全等價證明。

效果：

- G07／03 保持 live／unresolved；
- subject-equivalence certificate 失敗；
- old lease 無法恢復本地適用性；
- 不影響美空 Domain-C；
- 不影響琴音探視；
- 不免除琴音過去責任；
- 琴音不取得其他患者權限。

## 9.5 琴音的核心台詞

她不說：

> 我要救所有人。

她說：

> 「以前他們告訴我，門關著，美空才安全。」  
> 「可門關著的時候，租約裡連她還在都沒有。」

這是有限贖罪。

不是赦免。

---
# 10. 區域 package preposition 的進一步收斂

## 10.1 Chapter 25 結束時

```text
CONTINUITY-CONTROLLED CLUSTERS    PARTIAL／STARTED
NORMAL OPERATIONS CLUSTERS        HELD／DENIED
LEGACY／UNKNOWN CLUSTERS          PENDING
```

所有 package 都綁定：

```text
LOCAL EXECUTION    WAITING FOR KAGAMI ANCHOR
```

## 10.2 平行處理原則

公共營運與地方系統安全團隊：

- 核對 exact bundle hash；
- 保全 lease／token／package write；
- 不破壞普通警報服務；
- 將可控 package 置入：
  - read-only quarantine；
  - no-execute；
  - evidence capture；
- 不刪除證據；
- 不將普通防災節點整體下線。

## 10.3 一個 continuity cluster 進入 quarantine

Public Deny Manifest、法院命令及現場營運人員共同作用下：

```text
PACKAGE STATUS       QUARANTINE／NO EXECUTION
ORDINARY SERVICES    ACTIVE
PROTECTIVE FILTER    ACTIVE
EVIDENCE CAPTURE     ACTIVE
```

這證明：

- continuity-controlled 不等於所有現場人員支持 TOKYO-7；
- 公開拒絕與正常營運方仍有實際作用。

## 10.4 剩餘路徑收斂至 KAGAMI

另一條 continuity 路徑已完成部分快取，但：

```text
REGIONAL PACKAGE CACHE    PRESENT
LOCAL EXECUTION           WAITING FOR KAGAMI
KAGAMI ACCEPTANCE         HELD
```

因此本章不需要逐一追趕所有節點。

真正終局收斂為：

> 只要 KAGAMI 不簽 execution anchor，區域預置便不能在 06:13 形成同一份同步 public fanout。

## 10.5 Lease 與 package 仍保留

團隊不刪除：

- lease；
- token；
- package；
- audit。

原因：

- 保全證據；
- 讓營運方與法院查驗；
- 防止 continuity 聲稱非法篡改；
- 刪除一份副本不能阻止其他快取；
- 技術破壞不能替代患者安全。

本章只讓本地 gate 正確判定：

> 這份 lease 不適用於 S43。

## 10.6 Manual override 不會成為普通遠端後門

KAGAMI 顯示：

```text
CLINICAL LATCH OVERRIDE
SOFTWARE／NORMAL BCP       UNAVAILABLE
HUMAN UNRESOLVED           FAIL CLOSED
```

唯一合法 override 是 physical break-glass，且需要：

- medical safety share；
- patient-rights share；
- local operations share；
- 本地實體操作；
- immutable audit。

醫療與患者權利均拒絕。

所以：

- continuity custodian 不能遠端按下「忽略患者」；
- 一名高官不能以 science／operations token替代患者權利；
- Chapter 27 若有人嘗試 bypass，只能是可見、可記錄的破壞性物理行動。

## 10.7 沒有第二個合法 science issuer

作者層鎖定：

- A18 之後，不存在第二個合法 science-domain release path；
- 私造 science token 無法通過 KAGAMI trust chain；
- Chapter 27 不會再新增另一枚 science root；
- formal rebind 與 subject-equivalence fallback 一旦失敗，old public bundle 只能靠非法 physical bypass，而不能被正常制度重新授權。

---
# 11. `PATIENT WITNESS PATH`：不經 consensus 的人類經驗路徑

## 11.1 為何需要另一條路

Chapter 26 已使：

```text
TOKYO-7 CONSENSUS／PUBLIC BRANCH    HELD
```

Chapter 27 仍需支付：

- 受試者第一人稱碎片；
- 名字；
- 家屬聲音；
- 黑色海；
- 被帶走前的生活；
- 無法被官方壓成單一版本的人類經驗。

若下一章重新使用 old TOKYO-7 public branch，便會自相矛盾。

因此正式區分：

### TOKYO-7 consensus／public branch

- 綁定 old bundle；
- 受 A17 lease 控制；
- 目的為壓成同一版本；
- 需要 KAGAMI execution anchor；
- Chapter 26 被 HOLD。

### Patient Witness Path

- 不進 consensus；
- 不要求所有接收者收到相同內容；
- 不產生統一敘事；
- 不含 raw neural stream；
- 只處理患者／代理已允許或事前保全的人類經驗碎片；
- 不由澪單獨挑選；
- 使用既有 clinical／after-action infrastructure。

## 11.2 完整四層架構

```text
PATIENT WITNESS BUFFER
        ↓
CONSENT／RELEASE FILTER
        ↓
WITNESS SERIALIZER
        ↓
WITNESS ECHO SIDEBAND
        ↓
REGIONAL WITNESS RECEIVERS
        ↓
PUBLIC WITNESS INDEX／INDEPENDENT NOTICE
```

## 11.3 Patient Witness Buffer

```text
MODE                 APPEND-ONLY
CONSENSUS INPUT      NO
RAW NEURAL           NO
SEMANTIC COMPRESSION MINIMAL
PURPOSE              CLINICAL／AFTER-ACTION
```

可包含：

- 患者可表達自述；
- 家屬聲音；
- 夢話片段；
- 事件前已保全的人類經驗；
- R3 額外記憶託管中的可公開證據碎片。

不包含：

- 即時原始腦波；
- 完整人格模型；
- 未經同意的私人內容；
- 由 consensus 選出的官方版本。

## 11.4 Consent／Release Filter

每個 fragment 分為：

```text
PATIENT-CONSENTED
PROXY-CONSENTED
PUBLIC／REDACTED
COURT-SEALED
NOT FOR RELEASE
```

規則：

- 患者本人可表達時，以本人為優先；
- 法定代理不能無限公開私人內容；
- 未成年人及無法表達者採最低必要；
- 澪不能因自己記得未來便替他人公開；
- fragment 可在 Chapter 27 前撤回；
- 未經允許的 fragment 不進 serializer。

## 11.5 Witness Serializer

Serializer 只負責：

- 將每個 fragment 包裝為獨立 envelope；
- 加入 source tier；
- 加入 consent／redaction metadata；
- 加入 integrity hash；
- 不排序成單一故事；
- 不補寫缺失內容；
- 不消除彼此矛盾；
- 不將 fragment 聚合成 consensus profile。

```text
WITNESS FRAGMENT ENVELOPE
FRAGMENT ID
SOURCE TIER
CONSENT TIER
INTEGRITY HASH
LANGUAGE／ACCESSIBILITY
NO CONSENSUS ORDER
```

## 11.6 `WITNESS ECHO SIDEBAND`

既有技術血統：

- 原用於 clinical after-action；
- multiplex 於 protective-filter telemetry 旁；
- 在回聲事件後將患者／家屬 witness markers 送至區域 audit receivers；
- 不經 TOKYO-7 consensus bundler；
- 不需 public execution anchor；
- 不具同步同一 payload 的能力；
- 每個 receiver 可收到不同 signed subset。

```text
WITNESS ECHO SIDEBAND

CARRIER              FILTER TELEMETRY SIDEBAND
CONSENSUS            NONE
SYNCHRONIZED PAYLOAD NO
RAW NEURAL           NO
REGIONAL SUBSETS     DIFFERENT／SIGNED
```

它不等於普通公共廣播。

在 06:13 回聲耦合時：

- 不同區域 audit／witness receivers 可收到不同 fragment subsets；
- exposed public clients 可能透過既有 echo／mobile notice interface 接觸相應碎片；
- 不形成所有人共享的單一版本。

## 11.7 `PUBLIC WITNESS INDEX`

普通網路／手機只發布：

- fragment hash；
- source／consent tier；
- 可公開 transcript／caption；
- 驗證方式；
- 公共索引。

它不發布：

- raw neural；
- 完整 patient model；
- sealed fragments；
- 未經同意的私密內容。

它與官方 TOKYO app payload 分離。

即使手機 `+7000ms` 最後修剪 payload 被取消，Witness Index 仍可走獨立人類公告路徑。

## 11.8 Chapter 26 的完成狀態

本章須完成：

- Buffer append-only audit；
- consent eligibility；
- serializer hash；
- sideband carrier integrity；
- regional receiver 測試；
- Public Witness Index pre-stage；
- output 保持 disabled；
- activation 只等待 Chapter 27 的患者／醫療 go。

```text
WITNESS EGRESS PACKAGE

CONSENSUS INPUT       NO
RAW NEURAL            NO
FRAGMENT SET          CONSENT-TIERED
SERIALIZER HASH       VERIFIED
ECHO SIDEBAND         VERIFIED／DISABLED
REGIONAL RECEIVERS    READY／PARTIAL
PUBLIC INDEX          PRE-STAGED
ACTIVATION            PENDING
```

## 11.9 文件真相與經驗真相

Chapter 25：

- Manifest；
- 文件索引；
- 法院／醫療證據；
- bundle／hold／營運拒絕。

Chapter 27：

- 多聲部、第一人稱、彼此不完全一致的人類經驗 fragments。

因此：

> Manifest 證明有人正在拒絕。  
> Witness fragments 才讓世界知道那些人經歷了什麼。

---
# 12. 剩餘患者橋接缺口與 Chapter 27 Stage Ceiling

## 12.1 八名活動人類依存者

作者層固定：

```text
ACTIVE HUMAN DEPENDENCIES    8
SAFE-DETACHED               1／G07-12
```

正文前景持續追蹤四名紅區患者。

另外四名保持聚合，但作者層成熟度已鎖定：

| 聚合患者 | 當輪成熟度 | Chapter 27 最高階段 |
|---|---|---|
| Other-A | Patient-bound root／Stage-1 | CONDITIONAL HANDOFF |
| Other-B | Patient-bound root／Stage-1 | CONDITIONAL HANDOFF |
| Other-C | Stage-0／baseline complete | COMPARE |
| Other-D | Local root pending | HOLD |

他們不能因未具名而被排除。

## 12.2 `M-00／朝倉紗英`

```text
PATIENT SAFETY ENVELOPE        ACTIVE
NETWORK TRANSITION LIMITS      ACTIVE／EXPIRING
LOCAL PHASE MODEL              PASSIVE-CONCORDANT／LIMITED
PUBLIC／CONSENSUS FUNCTION     DENIED
ACTIVE SWITCH                  PROHIBITED
```

Chapter 27 最高階段：

```text
MAX STAGE             COMPARE
CONDITIONAL HANDOFF   NO
POST-06:13            CLINICAL TRANSITION SUPPORT RETAINED
```

原因：

- 完整回聲窗未驗證；
- `LEGACY／02` 仍依賴 M-00；
- 其他 unresolved patients 仍需要中央 clinical support；
- 紗英不能因「無母體」口號被迫完全離線。

正確結果可能是：

> M-00 的 public／consensus 角色停止；  
> 受限制、短期、可撤回的 clinical transition support 暫時保留至第八天。

## 12.3 `G07／03／藤川美空`

```text
PATIENT ROOT         DOMAIN-C
SHADOW MODE          PASSIVE-CONCORDANT／LIMITED
DRIFT                SLEEP TRANSITION／UNRESOLVED
ACTIVE SWITCH        PROHIBITED
```

Chapter 27 最高階段：

```text
MAX STAGE       COMPARE
HANDOFF         PROHIBITED
SAFE PAUSE      AVAILABLE
```

她可：

- 參與 announce／sample／hold／compare；
- 根據 drift 結果回報 deny；
- 停在 SAFE PAUSE。

不能因倒數進入 handoff。

## 12.4 `G07／08／水瀨葵`

```text
PATIENT ROOT         AOI-LOCAL
SHADOW MODE          STAGE-0／BASELINE
MODEL                BUILDING
ACTIVE SWITCH        PROHIBITED
```

Chapter 27 最高階段：

```text
MAX STAGE       HOLD
HANDOFF         PROHIBITED
SAFE PAUSE      REQUIRED
```

她只：

- 接收 timing announce；
- 採樣外部 sidecar baseline；
- 進 HOLD；
- 維持原 clinical support。

## 12.5 `LEGACY／02`

```text
PATIENT ROOT WRAPPER    OFF-PATIENT／BENCH VALIDATED
EXTERNAL MEDICAL        ON SITE
PATIENT CONNECTION      PENDING
ACTIVE SWITCH           PROHIBITED
```

Chapter 27 最高階段：

```text
MAX STAGE       HOLD
HANDOFF         PROHIBITED
SAFE PAUSE      REQUIRED
```

`LEGACY／02` adapter 未接入前：

- M-00 clinical transition support 不可完全移除；
- 不為倒數強行部署未驗證 adapter。

## 12.6 其他四名聚合患者

### Other-A／Other-B

- Stage-1 passive-concordant；
- local patient root ready；
- patient／medical approval conditional；
- 可成為 Chapter 27 唯二 conditional handoff candidates。

### Other-C

- Stage-0；
- 可到 COMPARE；
- 不進 handoff。

### Other-D

- local root pending；
- 停在 HOLD。

這讓 R5 在終局中有真實但有限的醫療成果：

- 可能有兩名較成熟患者完成受控 handoff；
- 其餘患者安全停在不同階段；
- 主線具名患者不因戲劇需要被強行「全部成功」。

## 12.7 SAFE PAUSE 的實際含義

SAFE PAUSE 不是停止全部控制。

它表示：

- 保持最近已驗證的 clinical state；
- 不進入新的 public／consensus path；
- 不執行本地 handoff；
- 保持 protective filter；
- 保持必要 central clinical support；
- 停止新的 transition step；
- 回聲窗後由第八天醫療程序繼續。

## 12.8 為何 local HOLD 仍不足夠

`Clinical Safety Hold` 阻止 public execution。

但 05:50 仍會啟動：

- protective filter high-load preparation；
- clinical phase preparation；
- CAL／PHASE BUS 高負荷前置；
- patient bridge timing window。

若沒有共同時間框架：

- 各 local root 在不同時刻取樣／hold；
- 未準備患者可能被 fallback 拉回；
- handoff 與 safe pause互相衝突；
- 直接硬切仍不可接受。

需要的不是新生物參照。

而是：

> 一個讓每名患者自己的根知道何時取樣、何時停止、何時才可嘗試下一步的共同 timing protocol。

---
# 13. 悠真夢話節奏與七階段分散式換手時鐘

## 13.1 分析從 03:20 開始，不是最後一分鐘神諭

Subject Bay 於 03:10 掛載後，背景團隊立即取得 historical handshake logs。

| 時間 | 工作 |
|---|---|
| 03:20 | 發現 G07 handshake 使用七個 timing windows。 |
| 03:30–04:00 | 與 line7、悠真夢話停頓及多節點歷史日誌交叉。 |
| 04:00–04:35 | 重建缺失 phase order，確認 timing 與神經內容分離。 |
| 04:35–05:05 | 對八名 active patients 的成熟度作離線回放與 stage-ceiling 模擬。 |
| 05:05–05:25 | 外部醫療確認 SAFE PAUSE、停止條件及 M-00 transition-support 邊界。 |
| 05:25–05:40 | timing package code／hash／patient-control-data absence 最終審查。 |
| 05:40–05:46 | 各患者 stage ceiling、醫療 go 條件及 abort rules 完成預先簽署。 |
| 05:46–05:49 | Package pre-stage 完成；仍未啟用。 |

## 13.2 真正部署依據

候選來自：

- KAGAMI historical handshake specification；
- 多節點歷史日誌；
- 既有 G07 校準記錄；
- 離線模擬；
- Patient Safety Envelopes；
- Network Transition Envelope；
- 外部醫療停止條件。

悠真夢話只提供：

- 找到協議的入口；
- 缺失 phase order；
- 不依賴中央文件的人類記憶交叉。

不能直接播放悠真錄音給患者。

真正時鐘由獨立系統根據歷史協議生成純 timing signal。

## 13.3 七個窗口的運用理由

```text
1. ANNOUNCE
   通知 patient root 準備，不改變控制。

2. SAMPLE
   取樣現行相位、醫療狀態與 local root 狀態。

3. HOLD
   暫停新的控制變更；未準備者可停在此步。

4. COMPARE
   與 Patient Safety Envelope／Network Transition Envelope 比較。

5. ACKNOWLEDGE
   各 patient root 回報：CONTINUE／SAFE PAUSE／DENY。

6. HANDOFF
   只允許醫療、患者程序與模型條件全部成立者受控換手。

7. SETTLE
   驗證穩定；失敗者回到最近安全狀態或保持 transition support。
```

七個窗口：

- 不是七名患者；
- 不是外星要求；
- 不是悠真創造；
- 是歷史 G07 多節點校準 protocol。

## 13.4 未準備者不被強迫換手

- M-00 最多到 COMPARE，保留 clinical transition support；
- 美空最多到 COMPARE，drift 超限即 SAFE PAUSE；
- 葵停在 HOLD；
- `LEGACY／02` 停在 HOLD；
- Other-C 最多 COMPARE；
- Other-D 停在 HOLD；
- 只有 Other-A／Other-B 可在條件成立時進 HANDOFF。

共享 timing 不代表所有人完成同一動作。

它只使：

> 每名患者能在同一時間框架中，以自己的狀態決定是否繼續。

## 13.5 正確技術定位

候選：

> **`DISTRIBUTED SWITCH CLOCK／分散式換手時鐘`**

它不提供：

- 神經內容；
- 悠真波形；
- 中央參照；
- 統一答案；
- patient control values。

千田的翻譯：

> 「不是讓他們接收同一個人。」  
> 「只是讓每一個人知道，什麼時候輪到自己的機器回答。」

## 13.6 05:49 前預先簽署

```text
DISTRIBUTED SWITCH CLOCK PACKAGE

CODE HASH              VERIFIED
TIMING ONLY            YES
PATIENT CONTROL DATA   NONE
SEVEN STAGES           VERIFIED
SAFE-PAUSE             DEFINED
PATIENT STAGE CEILINGS SIGNED
MEDICAL ABORT RULES    SIGNED
DEPLOYMENT             PRE-STAGED
ACTIVATION             PENDING MEDICAL GO
```

各 patient node 已收到：

- package hash；
- 最高 stage；
- stop conditions；
- local patient-root verification rules；
- no automatic advancement。

Chapter 27 只決定：

- 是否在 05:50 發出 medical go；
- 每個節點是否按自己的狀態前進；
- 何時 abort／SAFE PAUSE。

## 13.7 手機末端命令亦須預先簽署

05:49 前：

```text
OFFICIAL APP FINAL-PATH COMMAND

TARGET BUNDLE        TOKYO-7／<HASH>
ACTION               CANCEL UNSENT PAYLOAD
TRIGGER WINDOW       +7000ms
PRIOR BROADCAST      NOT REVERSIBLE
EVIDENCE CAPTURE     REQUIRED
STATUS               SIGNED／NOT ARMED
```

七秒只負責：

- 最後尚未送出的官方手機修剪 payload；
- 取消後保全原 payload 及 audit。

不負責：

- 停止 protective filter；
- 關閉全系統；
- 撤回已播廣播；
- 啟用 Witness Path。

## 13.8 Chapter 26 結束狀態

```text
DISTRIBUTED SWITCH CLOCK
STATUS               PRE-STAGED／NOT ACTIVE

WITNESS EGRESS PACKAGE
STATUS               PRE-STAGED／NOT ACTIVE

OFFICIAL APP CANCEL COMMAND
STATUS               SIGNED／NOT ARMED
```

本章不對患者部署、不發 witness fragments，也不取消手機 payload。

所有選項均在 Chapter 27 開始前完成必要審查，避免最後二十三分鐘重新開設計會議。

---
# 14. 八場景結構

## Scene 1：不是把它弄壞

**時間：00:05–00:40**  
**地點：鏡島外部安全指揮／KAGAMI 本地驗證室**

23:50 lease 已形成。

現場提出快速方案：

- 清除 bundle index；
- 強制 deny lease nonce；
- 隔離全島網路；
- 關閉 execution anchor service；
- 破壞 local package cache。

每項都可能影響：

- protective filter；
- clinical branch；
- 正常公共服務；
- 證據；
- 患者高負荷準備。

澪拒絕。

> 「不是把它弄壞。」  
> 「是讓它看見自己正在對誰做這件事。」

千田遠端拆解 lease：

```text
AUTH EPOCH               A17
SUBJECT SNAPSHOT EPOCH   S42
DEPENDENCY HASH          <OLD-HASH>
EXECUTION ANCHOR         KAGAMI-01
```

澪問：

> 「S42 是誰的狀態？」

回答：

> 是調查以前，被封存在鏡島本地的患者狀態。

本場目的：

- 給澪不可替代的主角選擇；
- 將目標由破壞 lease 改成判定 lease 不適用；
- 不讓終局重演 R4 式技術暴力。

---

## Scene 2：只有租約載入後才看得見

**時間：00:40–01:15**  
**地點：KAGAMI BCP service monitor／法院安全連線**

畫面顯示：

```text
SUBJECT LEDGER
NORMAL STATE       SEALED／LOCAL OFFLINE
BCP SERVICE MOUNT  AVAILABLE／LEASE LOADED
```

日下部說明：

- 23:50 前，外部團隊只能看見中央摘要；
- lease 載入及 package preposition 才掛載 S42；
- 法院條件式開示亦在此時生效。

區域狀態仍是：

```text
LOCAL EXECUTION    WAITING FOR KAGAMI ANCHOR
```

千田重新指出：

- `SUBJECT DEPENDENCY ATTESTATION`；
- `CLINICAL HOLD`；
- `EXECUTION ANCHOR／KAGAMI-01`。

他說：

> 「鏡島不是第三票。」  
> 「它只是最後一台必須確認臨床側仍然成立的機器。」

Continuity overlay 的低強度欄位被展開：

```text
CENTRALLY MANAGED
→ MANAGED-EQUIVALENT／BCP
```

本場解決：

> 為何角色不能在 23:50 前先打開 Bay。

---

## Scene 3：琴音認得的是路徑名字

**時間：01:15–02:35**  
**地點：司法／醫療技術協助室／鏡島服務手冊室**

琴音在辯護人在場下被告知：

- 協助不等於免責；
- 不交還原裝置；
- 不讓她操作控制器；
- 美空 Domain-C 不向 public branch 開放；
- 真理只允許 G07／03 route 作患者安全開示。

Forensic clone 找到：

```text
SUBJECT-SVC／G07
CLINICAL DELEGATION
CASE       G07／03
HOLDER     白石琴音
STATUS     SUSPENDED／NOT REVOKED
```

琴音只確認：

- service alias；
- family-assist 圖示；
- reseal 語言；
- 過去支援員使用的 route name。

她說：

> 「我不知道實體門在哪裡。」  
> 「我只認得他們以前叫這條路的名字。」

本地技師利用：

- R2；
- audit；
- 服務手冊；
- 實體線路；

將 alias 映射至 Subject Continuity Bay。

琴音不是鑰匙。

她只是曾被制度用來關門，所以認得關門流程的名稱。

---

## Scene 4：受試者區域

**時間：02:35–03:50**  
**地點：KAGAMI-01／SUBJECT CONTINUITY BAY**

多方完成條件式開示。

本地技師掛載 Bay。

沒有病床，也沒有新患者。

只有：

- subject ledger；
- patient-root manifest；
- signed-update queue；
- physical endpoint heartbeat map；
- managed-equivalent cache；
- Clinical／Public Data Holds；
- subject-equivalence service；
- witness buffer；
- delegation records；
- historical handshake logs。

初始畫面：

```text
CACHED POLICY         MANAGED-EQUIVALENT／S42
REMOTE SIGNED EVENTS  PRESENT
PHYSICAL ENDPOINTS    PRESENT
LIVE MERGE            REQUIRED
```

系統封存 S42。

匯入早已存在的 updates。

```text
SUBJECT LEDGER
BASE       S42
MERGE      MONOTONIC
RESULT     S43
```

同時：

- 背景 A 組開始分析 historical seven-stage handshake；
- 背景 B 組開始驗證 Witness Buffer／Echo Sideband；
- forensic clone 指向 server-side delegation record。

開門不改變任何患者治療。

---

## Scene 5：租約裡沒有名字

**時間：03:50–04:25**  
**地點：SUBJECT CONTINUITY BAY**

系統先核對：

```text
PHYSICAL ACTIVE ENDPOINTS       8
LEDGER ACTIVE HUMAN RECORDS     8
UNMAPPED HEARTBEATS             0
```

再顯示：

```text
CLINICAL SAFETY
ACTIVE HUMAN DEPENDENCIES       8
SAFE／SEPARATED                 0／8
ACTIVE TRANSITION AUTHORIZED    0／8
RESULT                          HOLD

PUBLIC DATA USE
DATA-SOURCE SUBJECTS            5
VALID PUBLIC-USE CONSENT        0／5
RESULT                          HOLD
```

授權人類畫面還原四名紅區：

- 朝倉紗英；
- 藤川美空；
- 水瀨葵；
- `LEGACY／02／HUMAN`。

其他四名保持聚合，但同樣進入 latch。

澪看向 lease：

> 「它寫了科學，寫了營運，寫了東京。」  
> 「沒有寫誰還接在那條線上。」

琴音只讀出：

> 「藤川美空。」

本場為主題與情感高潮。

---

## Scene 6：有效，但不適用

**時間：04:25–04:48**  
**地點：KAGAMI COMMIT-GATE／遠端 patient nodes**

驗證結果：

```text
CRYPTOGRAPHIC VALIDITY       YES
AUTH EPOCH                    A17／VALID
LEASE SUBJECT EPOCH          S42
LIVE SUBJECT EPOCH           S43
SUBJECT MATCH                NO
CLINICAL SAFETY              HOLD
PUBLIC DATA USE              HOLD
LOCAL EXECUTION              NO
```

KAGAMI 不簽 execution anchor。

Continuity Route A 嘗試 formal rebind。

但 S43 形成新 exact bundle hash，需要 A18 science token。

```text
S7 AUTH EPOCH          A18
FUTURE RELEASE         DISABLED
NEW SCIENCE TOKEN      UNAVAILABLE
FORMAL REBIND          DENIED
```

千田說：

> 「舊租約還在。」  
> 「可是它已經不能替現在的人簽名。」

平行背景：

- seven-stage timing package 進入離線模擬；
- Witness Echo Sideband 驗證 carrier integrity；
- 一個 continuity cluster 進 package quarantine。

---

## Scene 7：把自己的名字從舊角色裡撤回

**時間：04:48–05:15**  
**地點：SUBJECT CONTINUITY BAY／受控身份程序**

Continuity Route B 嘗試：

```text
SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE
S42 → S43
POLICY    MANAGED-EQUIVALENT／BCP
```

若成立，old lease 可不改 bundle hash地繼續適用。

Broker 向每個 unresolved case route要求 acknowledgment。

G07／03 server-side record 向琴音提出 holder confirmation。

Forensic clone 只能顯示 role ID，不能回覆。

琴音本人在：

- 辯護人；
- 真理；
- 外部醫療；
- 患者權利；
- 司法保全；

見證下撤回 persistent delegation。

真理拒絕美空 reseal。

```text
G07／03 ACKNOWLEDGMENT       DENIED
SUBJECT EQUIVALENCE CERT     DENIED
OLD LEASE APPLICABILITY      NOT RESTORED
```

琴音說：

> 「以前他們告訴我，門關著，美空才安全。」  
> 「可門關著的時候，租約裡連她還在都沒有。」

Scene 7 只聚焦琴音的有限贖罪，不加入新的大型技術揭露。

---

## Scene 8：05:49

**時間：05:15–05:49**  
**地點：KAGAMI 指揮／各 patient nodes 平行畫面**

背景團隊回報：

### Timing package

```text
DISTRIBUTED SWITCH CLOCK
CODE HASH              VERIFIED
TIMING ONLY            YES
SEVEN STAGES           VERIFIED
SAFE PAUSE             DEFINED
DEPLOYMENT             PRE-STAGED
ACTIVATION             PENDING MEDICAL GO
```

### Patient stage ceilings

```text
M-00         MAX COMPARE／CLINICAL SUPPORT RETAINED
G07／03      MAX COMPARE
G07／08      MAX HOLD
LEGACY／02   MAX HOLD
OTHER-A／B   CONDITIONAL HANDOFF
OTHER-C      MAX COMPARE
OTHER-D      MAX HOLD
```

### Witness egress

```text
WITNESS ECHO SIDEBAND
CONSENSUS INPUT       NO
RAW NEURAL            NO
SERIALIZER HASH       VERIFIED
REGIONAL RECEIVERS    READY／PARTIAL
PUBLIC INDEX          PRE-STAGED
ACTIVATION            PENDING
```

### Official app command

```text
CANCEL UNSENT TOKYO PAYLOAD
WINDOW                +7000ms
STATUS                SIGNED／NOT ARMED
```

### Manual override

```text
SOFTWARE OVERRIDE     UNAVAILABLE
PHYSICAL BREAK-GLASS  REQUIRES MEDICAL + RIGHTS + OPERATIONS
VALID SHARES          NOT AVAILABLE
```

章末 05:50 分支畫面：

```text
AUTO-PREP／05:50

PROTECTIVE FILTER PREP      START AT T0
CLINICAL PHASE PREP         START AT T0
PATIENT BRIDGE CLOCK        PRE-STAGED／PENDING GO

CONSENSUS PREP              HELD
PUBLIC ROUTE PREP           HELD
EXECUTION ANCHOR            NOT ISSUED
```

澪問：

> 「如果每個人仍然用自己的模型呢？」

千田回答：

> 「那它只告訴他們，什麼時候輪到自己的機器回答。」

05:49。

章末：

> 租約裡沒有名字。  
>   
> 05:49，鏡島第一次停下來，等待那些名字自己的系統回答。

---
# 15. 本章必須完成的二十二項成果

## 成果一：Subject Bay 現在才可用的因果成立

- Bay 平時 sealed／offline；
- 只有 cutover lease 載入及 package preposition 後才掛載；
- 法院條件式開示同時生效；
- 角色不能合理地在 23:50 前先合併 S43。

## 成果二：lease 有效與 lease 適用正式分開

- science／operational token 保持有效；
- patient-state precondition 可否決本地執行；
- 不把機構授權等同患者授權。

## 成果三：本地 latch 得到前期伏筆支付

- Chapter 21 有 dependency attestation；
- Chapter 22 有 clinical hold 及 managed-equivalent 伏筆；
- Chapter 24–25 有 execution anchor、subject snapshot metadata 及 local mount 條件；
- 不在終局臨時創造安全開關。

## 成果四：揭露 continuity 的語義偷換

- R1 原始條件是 separated／safe／current；
- overlay 把 centrally managed 改成 managed-equivalent；
- continuity 沒刪除 R1，而是改寫「安全」。

## 成果五：授權與患者 epoch 分離

- `AUTH_EPOCH A17 → A18`；
- `SUBJECT_EPOCH S42 → S43`；
- 技術語義不再混淆。

## 成果六：開門只合併早已存在的 signed updates

- S42 封存；
- monotonic merge；
- no rollback；
- unknown fail closed；
- 不憑空製造 deny。

## 成果七：固定患者數量

- 九筆 human dependency records；
- 一名悠真 safe-detached；
- 八名 active human dependencies；
- 四名 red-zone＋四名其他 active；
- 不用佔位符。

## 成果八：物理端點與人類 ledger 核對

- 八個 active clinical endpoints；
- 八筆 active human records；
- unmapped = 0；
- 任一 mismatch 即 fail closed。

## 成果九：Clinical Safety 與 Public Data Use 分開

- 全部八名患者進 Clinical Safety Hold；
- 五名 bundle data sources 進 Public Data-Use Hold；
- 兩者不可互相替代。

## 成果十：姓名回到人類畫面，但不成為密碼欄位

- 紗英、美空、葵具名；
- `LEGACY／02` 明確 HUMAN；
- 其他患者保持隱私；
- 真正缺口是當輪狀態與拒絕。

## 成果十一：KAGAMI local execution HOLD 成立

- public／consensus branch held；
- protective filter／clinical branch active；
- lease、token、package 保留作證據；
- 不粗暴斷電。

## 成果十二：Formal rebind 失敗

- S43 形成新 exact bundle；
- 需要 A18 science token；
- A18 future release disabled；
- 沒有第二個合法 science issuer。

## 成果十三：Subject-equivalence fallback 被正式建立並失敗

- old lease 原可透過安全等價 certificate 繼續適用；
- certificate 不需新 science token；
- 必須取得全部 unresolved case acknowledgments；
- 琴音／真理拒絕 G07／03；
- 其他 unresolved routes 亦阻止 aggregate proof。

## 成果十四：琴音的 forensic clone 與 live delegation 分開

- clone 只找 role ID；
- live request 來自 server-side record；
- 不讓取證副本接 production。

## 成果十五：琴音只能撤回 G07／03

- 不代表其他七名 active patients；
- 撤回使 equivalence certificate 失敗；
- 不影響 Domain-C、探視或患者醫療；
- 不免責。

## 成果十六：區域 package 收斂至 KAGAMI anchor

- normal operations nodes 仍拒絕；
- 一個 continuity cluster quarantine；
- 剩餘 path waiting for KAGAMI；
- 不逐一追趕所有節點。

## 成果十七：Manual override 邊界被鎖定

- 軟體 override 在 unresolved humans 時不可用；
- physical break-glass 需 medical／rights／operations shares；
- immutable audit；
- Chapter 27 不會突然出現普通高官按鈕。

## 成果十八：Witness Path 具備完整 egress

- Buffer；
- consent filter；
- serializer；
- Echo Sideband；
- regional receivers；
- Public Witness Index；
- 不經 consensus、不輸出 raw neural。

## 成果十九：七階段 timing 提前完成審查

- 03:20 起分析；
- 歷史 handshake 是部署依據；
- 悠真夢話只補 phase order；
- 05:49 前 package、hash、停止條件完成預簽。

## 成果二十：患者 Stage Ceiling 鎖定

- M-00 max COMPARE；
- 美空 max COMPARE；
- 葵／Legacy max HOLD；
- 兩名匿名患者 conditional handoff；
- 未準備者 SAFE PAUSE；
- 不要求全體 handoff。

## 成果二十一：M-00 不被戲劇性完全離線

- public／consensus function 可停止；
- clinical transition support 可受限制保留至第八天；
- 不重演 R4 對 Legacy 等患者的傷害。

## 成果二十二：Chapter 27 所需命令在 05:49 前預先簽署

- timing package；
- patient stage ceilings；
- medical abort rules；
- witness fragment set；
- serializer hash；
- mobile +7000ms cancel command；
- Chapter 27 只作醫療 go 與執行，不重新設計。

---
# 16. 證據鏈與推論邊界

## 16.1 Subject Bay 可用時間

可成立：

- Bay 正常狀態 sealed／local offline；
- 23:50 lease 載入及 local preposition 使 BCP service mount 可用；
- package preposition 觸發法院條件式患者安全開示；
- Chapter 26 現在才可取得 S42 本地 snapshot 及 signed-update queue。

不能成立：

- 團隊在 23:50 前早已可任意開啟；
- 延遲只是角色疏忽；
- 開 Bay 自動改變患者治療。

## 16.2 Continuity 安全語義

可成立：

- R1 原始語義要求 separated／safe／current；
- continuity overlay 將 centrally managed 視為 managed-equivalent；
- S42 是 cached BCP policy，不是 live patient safety。

不能成立：

- S42 患者名單完全虛構；
- continuity 刪除了所有安全規則；
- 所有參與設計者都明知會傷害患者。

## 16.3 活動患者數量

可成立：

- 九筆 human dependency records；
- 悠真一筆 safe-detached；
- 八名 active human dependencies；
- 四名 red-zone；
- 四名其他 active；
- physical endpoints 與 ledger records 均為八，沒有 unmapped heartbeat。

不能成立：

- 四名紅區是全部患者；
- 未具名患者可被忽略；
- 其他四名姓名應向澪或公眾公開；
- 八這個數字來自故事象徵而非當輪名冊。

## 16.4 Signed update merge

可成立：

- Chapter 23–25 updates 早已存在；
- Bay 掛載後才被 KAGAMI 本地 ledger 合併；
- S42 封存；
- monotonic merge 形成 S43；
- unknown fail closed。

不能成立：

- 開門憑空創造新患者狀態；
- 澪或琴音手動修改 subject epoch；
- 任何一項無法驗證的資料自動被視為安全。

## 16.5 Physical endpoint reconciliation

可成立：

- 八個 physical active endpoints 與八筆 active human records 一致；
- endpoint heartbeat 不暴露完整身份；
- 任一 unmapped／orphan mismatch 會 HOLD。

不能成立：

- 只相信中央名冊便足夠；
- 無名端點可被當作設備排除；
- heartbeat 本身證明患者醫療安全。

## 16.6 兩個 HOLD

可成立：

- Clinical Safety Hold 檢查全部八名 active patients；
- Public Data-Use Hold 檢查五名 bundle data sources；
- 兩者都為 HOLD；
- 任一一項便足以阻止 public execution。

不能成立：

- 所有患者都是 public data source；
- 非資料來源患者無權阻止 public execution；
- 臨床安全可以由 public-use consent 取代。

## 16.7 Formal rebind

可成立：

- S43 會形成新 exact bundle hash；
- 新 bundle 需 A18 science token；
- A18 future release disabled；
- formal rebind denied；
- 沒有第二個合法 science issuer。

不能成立：

- old operational token 可單獨重簽；
- 凪原個人可產生新 science token；
- Chapter 27 會再出現另一枚合法 science root。

## 16.8 Subject-equivalence certificate

可成立：

- continuity 有一條不需新 science token 的安全等價 fallback；
- 若全部 case routes 證明 S43 與 S42 execution-semantically equivalent，old lease 可繼續適用；
- 琴音只能影響 G07／03；
- 她／真理拒絕美空 acknowledgment；
- 其他 unresolved cases 亦阻止 certificate；
- certificate denied。

不能成立：

- 琴音一人掌握全體患者；
- rebind 失敗後琴音撤回只是象徵；
- continuity 可回滾 S43 至 S42。

## 16.9 Local execution HOLD

可成立：

- lease cryptographically valid；
- local execution applicability = no；
- KAGAMI 不簽 execution anchor；
- consensus／public branch held；
- protective filter／clinical branch active。

不能成立：

- lease 已取消；
- package 已刪除；
- 患者已安全離線；
- 06:13 已沒有風險。

## 16.10 Manual override

可成立：

- unresolved humans 時沒有正常軟體 override；
- physical break-glass 需 medical、patient-rights、local operations 及 immutable audit；
- 合法 shares 不存在。

不能成立：

- 任一高官可遠端忽略 latch；
- science／operations lease 本身可代替患者權利；
- Chapter 27 可臨時新增無痕 override。

## 16.11 Distributed Switch Clock

可成立：

- historical G07 handshake 有七個 timing stages；
- 悠真夢話只提供 phase-order clue；
- timing package 無 patient control data；
- stage ceilings、safe pause 及 medical abort rules 已預簽；
- 本章尚未啟用。

不能成立：

- 悠真是新 Mother Reference；
- 直接播放夢話可控制患者；
- 所有患者都會 handoff；
- 七個窗口代表七名患者。

## 16.12 Witness Egress

可成立：

- Witness Buffer、release filter、serializer、Echo Sideband、regional receivers 及 Public Witness Index 已驗證；
- 不進 consensus；
- 不含 raw neural；
- fragment 各自簽章並可不同區域收到不同 subset；
- output 仍 disabled。

不能成立：

- witness path 已向公眾發送；
- 它是另一個 consensus public branch；
- 澪可單獨選擇全部 fragments；
- 白光如何使 fragments 被人類感知已完全驗證。

## 16.13 患者 Stage Ceiling

可成立：

- 只有兩名匿名 Stage-1 patients 是 conditional handoff candidates；
- M-00／美空最多 COMPARE；
- 葵／Legacy 最多 HOLD；
- 未準備者保留 clinical support 並 SAFE PAUSE。

不能成立：

- Chapter 27 可讓全體患者在二十三分鐘內安全離線；
- M-00 可在 Legacy adapter pending 時完全退出 clinical support；
- SAFE PAUSE 等於停止生命支持。

---
# 17. 誤導與普通解釋

| 線索 | 普通解釋 |
|---|---|
| Subject Bay 平時 sealed／offline | 保護患者隱私及降低離線 BCP 複雜度 |
| cutover 後才掛載 ledger | 關鍵基礎設施只在本地維護窗讀取完整狀態 |
| `MANAGED-EQUIVALENT` | 通訊失聯時由中央醫療承擔患者責任的普通 BCP 簡化 |
| 八名 active patients | 當輪醫療依存名冊，未必代表全部歷史受試者 |
| physical endpoint reconciliation | 防止孤兒設備與錯誤名冊的標準安全措施 |
| Clinical Safety Hold | 高依存醫療系統的正常執行前提 |
| Public Data-Use Hold | 研究資料再利用的合規要求 |
| Subject Snapshot Equivalence Certificate | 避免純行政更新迫使大型 BCP bundle 每次重簽的普通機制 |
| 琴音 persistent delegation | 長期照護家屬的持續服務確認，不必然是惡意後門 |
| KAGAMI execution anchor | 跨區同步需要單一時間錨的普通設計 |
| Physical break-glass | 災害時避免軟體死鎖的標準實體備援 |
| Seven-stage handshake | 多節點安全換手的普通 timing protocol |
| Witness Echo Sideband | 臨床 after-action 與事件後稽核通道 |
| 不同區域收到不同 fragments | 非同步稽核資料，不等於公共記憶傳播 |
| M-00 保留 clinical support | 避免未完成橋接患者受傷的短期醫療需要 |
| 匿名患者 conditional handoff | 部分較成熟節點先行驗證，不代表偏袒主線以外的人 |
| 琴音撤回 delegation | 她只取消自己的持續性同意，不代表承認全部指控 |

---
# 18. 角色狀態變化

## 18.1 朝倉澪

本章開始：

- 已證明人類在拒絕；
- 容易因倒數再次接受破壞性快方案。

本章結束：

- 主動拒絕可能影響 protective filter 與 clinical branch 的破壞做法；
- 堅持讓鏡島讀取患者當輪狀態，而不是以另一項必要犧牲解決租約；
- 看見八名 active human dependencies，而非只看四名主線紅區；
- 理解名字不是密碼欄位，但每條人體依存線必須對應到受保護的人；
- 接受 old lease 仍有效，卻無權套用於 S43；
- 不把 subject-equivalence certificate 的失敗歸功於自己；
- 在 05:49 前完成可選方案的預先審查，而不是把所有決定留到最後二十三分鐘；
- Chapter 27 的任務不再是找答案，而是在已設定的患者界線內作最終 go／stop。

## 18.2 白石琴音

本章開始：

- 裝置與登入被凍結；
- persistent G07／03 delegation 尚未被發現；
- 只能提供過去 service-route 語言。

本章結束：

- 只辨認 `SUBJECT-SVC／G07` alias，沒有直接操作鏡島；
- 知道自己過去的家屬 holder consent 仍可被 continuity 利用；
- 正式撤回 G07／03 persistent delegation；
- 阻止 subject-equivalence certificate 將美空重新寫成 managed-equivalent；
- 不代表其他患者；
- 不取得免責、探視特權或系統權限；
- 完成有限贖罪：
  > 不再同意讓門關著替妹妹製造一份「已安全」證明。

## 18.3 藤川真理

- 只代表美空；
- 同意 G07／03 route 作最低必要患者安全開示；
- 拒絕美空 reseal／managed-equivalent acknowledgment；
- 確認琴音撤回不影響美空 Domain-C 或家屬探視；
- 不替其他患者作決定。

## 18.4 朝倉紗英

- 仍在中央 clinical topology；
- public／consensus use 保持拒絕；
- network transition limits 仍短期有效；
- Stage-1；
- Chapter 27 最高只到 COMPARE；
- 因 Legacy 及其他 unresolved patients，clinical transition support 可能保留至第八天；
- 不因標題「無母體」被迫完全離線。

## 18.5 藤川美空

- Domain-C 保留；
- sleep-transition drift unresolved；
- Stage-1；
- 最高到 COMPARE；
- G07／03 persistent delegation 被撤回；
- 不再可被 continuity 以琴音舊 holder consent 重新封成 managed-equivalent；
- 仍未醒，也未完成 handoff。

## 18.6 水瀨葵

- AOI-LOCAL 維持 Stage-0；
- 最高只到 HOLD；
- 不因鏡島終局而被強迫加速；
- 其患者 root／代理 deny 已被合併進 S43；
- 她仍需要第八天後續建模與醫療分離。

## 18.7 `LEGACY／02`

- 明確作為八名 active human dependencies 之一；
- patient root adapter pending；
- 最高只到 HOLD；
- 其存在阻止 M-00 完全退出 clinical support；
- 不因未具名而被忽略。

## 18.8 其他四名 active patients

- 姓名保持遮蔽；
- 兩名可在 Chapter 27 成為 conditional handoff candidates；
- 一名最多 COMPARE；
- 一名最多 HOLD；
- 他們的成熟度由 patient-root／醫療資料決定，不由主角關係決定。

## 18.9 千田浩介

- 保持遠端受保護技術證人；
- 解釋 R2、Bay mount、latch、兩條 continuity fallback 及 historical handshake；
- 不操作患者或成為單一決策者；
- 確認沒有第二條合法 science issuer；
- 將 Chapter 27 技術工作預先收斂成 timing、stage ceilings、witness egress 及手機末端命令。

## 18.10 日下部悟

- 使條件式患者安全開示合法生效；
- 保全 S42、S43、lease、certificate attempt 及 delegation 撤回；
- 防止 forensic clone 接 production；
- 確保琴音合作不等於免責；
- 將 manual override 的物理／法律邊界留在不可改寫 audit；
- Chapter 27 負責讓所有 go／stop 都有證據與責任歸屬。

## 18.11 凪原唯

- 協助確認 A17／A18、bundle schema 及 continuity overlay；
- 不能重簽 S43 bundle；
- 不能用個人 science role 覆蓋患者狀態；
- 必須見證自己曾接受的 managed-equivalent 政策如何偷換 R1；
- Chapter 27 不再成為最後善惡按鈕，但仍需面對 physical bypass／public policy 的責任。

## 18.12 朝倉悠真

- 仍安全切離，不重新接入；
- 夢話只提供 phase-order clue；
- 其 timing 不包含神經內容；
- 不成為新 Mother Reference；
- Chapter 27 是否啟用 clock，須由歷史協議、醫療及各患者自己的 root 決定。

---
# 19. 作者層真相鎖定

1. `CUTOVER AUTH LEASE` 在 A17 及有效窗內密碼學有效。
2. Lease 綁定的 S42 是 continuity cached managed-equivalent，不是 live patient safety。
3. Subject Continuity Bay 平時 sealed／local offline，只有 lease 載入與 local preposition 後掛載。
4. 法院條件式患者安全開示只有在指定 bundle 進入本地預置後生效。
5. 因此角色無法合理地在 23:50 前完成 S42 live merge。
6. R1 原始 Clinical Latch 要求 separated／safe／current。
7. Continuity overlay 將 centrally managed 改寫為 managed-equivalent。
8. 當輪 human dependency records 共九筆：
   - 悠真一筆 safe-detached；
   - 八名 active human dependencies。
9. 八名 active 包含四名 red-zone 及四名其他患者。
10. 八個 physical active clinical endpoints 與八筆 active human records 完整對應；沒有 unmapped heartbeat。
11. 四名 red-zone 不是全部患者。
12. Bundle 的實際 public data-source subjects 共五名，public-use consent 為 0／5。
13. Chapter 23–25 patient-root、醫療、代理與法院 updates 早已存在。
14. Bay 開啟只將它們 monotonic merge 至 S43，不創造新拒絕。
15. Clinical Safety Hold 與 Public Data-Use Hold 均獨立成立。
16. Lease 在 A17 仍有效，但 S42／S43 不符，local execution applicability 不成立。
17. KAGAMI 不簽 execution anchor，old consensus／public bundle 無法在 06:13 完成同步執行。
18. Formal S43 rebind 會形成新 exact bundle，需要 A18 science token。
19. A18 已禁止 future release。
20. 對本輪 exact TOKYO-7 bundle 而言，不存在第二個合法 science-domain issuer。
21. 私造 token 無法通過 KAGAMI trust chain。
22. Subject Snapshot Equivalence Certificate 是 continuity 的正常 BCP fallback，可在不重簽 bundle 的情況下使 old lease 繼續適用。
23. Certificate 必須取得全部 unresolved case acknowledgments，且不得有 patient-root／clinical／rights conflict。
24. 琴音只能控制 G07／03 acknowledgement。
25. 琴音原裝置與登入已在 Chapter 23 凍結，但 server-side persistent delegation 當時尚未被發現。
26. Forensic clone 只能找 role ID，不能回覆 production。
27. 琴音與真理拒絕 G07／03 reseal，足以使 subject-equivalence certificate 失敗。
28. 其他 unresolved cases 亦各自阻止 aggregate certificate。
29. 琴音合作不免除其前輪及當輪責任。
30. 一個 continuity cluster 被隔離；剩餘有效 package 路徑仍等待 KAGAMI anchor。
31. unresolved human 狀態下沒有正常軟體 Clinical Latch override。
32. 合法 physical break-glass 需要 medical、patient-rights、local operations 及 immutable audit。
33. Chapter 27 不會突然出現無痕高官 override。
34. Historical G07 handshake 確實使用七個 timing stages。
35. 悠真夢話及 line7 保留 phase-order 線索，但不是完整操作指令。
36. 真正 timing package 由歷史規格、多節點日誌、離線模擬及醫療停止條件生成。
37. 七階段允許未準備患者停在 HOLD／SAFE PAUSE。
38. M-00 與美空最高只到 COMPARE。
39. 葵與 `LEGACY／02` 最高只到 HOLD。
40. 兩名匿名 Stage-1 patients 是 conditional handoff candidates。
41. M-00 public／consensus function 可停止，但受限制 clinical transition support 可能保留至第八天。
42. Witness Buffer、Consent Filter、Serializer、Echo Sideband、Regional Receivers 及 Public Witness Index 均為既有或可由既有 infrastructure 合法組合的路徑。
43. Witness Echo Sideband 不進 consensus，不傳 raw neural，不向所有區域送同一內容。
44. Chapter 26 不啟用 witness output。
45. Timing package、patient stage ceilings、medical abort rules、witness serializer 及手機取消命令都在 05:49 前完成預先簽署。
46. 05:50 protective／clinical preparation 仍會開始；consensus／public prep 保持 HOLD。
47. Chapter 27 將使用 timing clock 協調各患者自己的 root，不要求全部 handoff。
48. Chapter 27 的人類經驗真相碎片走 Witness Echo Sideband／Public Witness Index，不走 TOKYO-7 consensus branch。
49. Chapter 27 仍需支付七秒手機末端路徑、白光、physical bypass 風險與最終選擇。
50. Chapter 28 仍保留第八天、持續 clinical separation 及人物後果。

---
# 20. Chapter 27 銜接

## Chapter 26 結束時已知

- `CUTOVER AUTH LEASE` 在密碼學上仍有效；
- lease 使用 `AUTH_EPOCH A17`；
- S7 已在 `AUTH_EPOCH A18` 禁止 future release；
- 對 exact TOKYO-7 bundle 不存在第二個合法 science issuer；
- lease 綁定 `SUBJECT_EPOCH S42`；
- KAGAMI live ledger 已更新至 `S43`；
- old dependency hash 與 current hash 不符；
- continuity managed-equivalent cache 已失效；
- 八名 active human dependencies 全部進入 live latch；
- physical active endpoints = 8；
- ledger active human records = 8；
- unmapped heartbeat = 0；
- Clinical Safety Hold = HOLD；
- Public Data-Use Hold = HOLD；
- Subject Continuity Bay 保持 live／local；
- 琴音 G07／03 persistent delegation 已撤回；
- Subject Snapshot Equivalence Certificate 失敗；
- formal lease rebind 因缺少 A18 science token 而失敗；
- KAGAMI local execution HOLD 成立；
- KAGAMI 尚未簽 execution anchor；
- consensus／public branch held；
- protective filter 與 clinical branch active；
- 一個 continuity cluster 已進 package quarantine；
- 剩餘區域 package 仍需 KAGAMI；
- unresolved humans 時沒有普通軟體 override；
- legal physical break-glass 需要 medical／rights／operations shares，而這些 shares 不存在；
- M-00 最高 COMPARE，clinical transition support 暫時保留；
- 美空最高 COMPARE；
- 葵、`LEGACY／02` 及一名匿名患者最高 HOLD；
- 一名匿名患者最高 COMPARE；
- 兩名匿名 Stage-1 patients 是 conditional handoff candidates；
- Distributed Switch Clock package 已：
  - timing-only；
  - code hash verified；
  - seven stages verified；
  - safe-pause defined；
  - stage ceilings signed；
  - deployment pre-staged；
- Witness Egress package 已：
  - consent-tiered；
  - serializer hash verified；
  - Echo Sideband verified／disabled；
  - regional receivers ready／partial；
  - Public Witness Index pre-staged；
- official app `+7000ms` cancel command 已簽署但未 armed；
- 距 05:50 一分鐘；
- 距 06:13 二十四分鐘。

## Chapter 27 主要任務

Chapter 27 應完整涵蓋：

> **星期一 05:50–06:13**

### A. Branch-specific 05:50 preparation

```text
PROTECTIVE FILTER PREP      START
CLINICAL PHASE PREP         START
PATIENT BRIDGE CLOCK        MEDICAL GO／NO-GO

CONSENSUS PREP              HELD
PUBLIC ROUTE PREP           HELD
EXECUTION ANCHOR            NOT ISSUED
```

### B. 執行七階段 timing，而非共享神經內容

1. 發出 timing-only package；
2. 不讓悠真重新接入；
3. 不建立 Mother Reference；
4. 每名患者使用自己的 Patient Safety Envelope；
5. 每名患者受各自 stage ceiling 約束；
6. 未達條件者停在 HOLD／SAFE PAUSE；
7. 只有 Other-A／Other-B 可成為 conditional handoff candidates；
8. 任何醫療停止條件優先於倒數。

### C. 保持 M-00 clinical transition support

1. 停止 M-00 public／consensus function；
2. 不在 `LEGACY／02` adapter pending 時完全離線；
3. 將 M-00 限定為短期、非語義、可撤回的 clinical transition support；
4. 第八天繼續真正分離。

### D. 防止 physical break-glass bypass

1. 保全 Clinical Safety Hold；
2. 監看 physical service panel；
3. 防止有人以非法方式取得／偽造 medical、rights 或 operations shares；
4. 任何 tamper 進 immutable audit；
5. 不因 sabotage threat 關閉 protective filter。

### E. 啟用 Witness Egress，而不是 old public branch

1. Patient Witness Buffer → Consent Filter → Serializer；
2. Echo Sideband 傳不同 signed subsets；
3. Public Witness Index 發布 hashes／transcripts；
4. 不輸出 raw neural；
5. 不產生 consensus order；
6. 不由澪單獨選 fragment；
7. 讓人類經驗碎片保持不完整、多聲部及可能彼此矛盾。

### F. 使用七秒末端手機路徑

1. 已播廣播不能回收；
2. official app payload 在 `+7000ms` 前可取消；
3. 取消尚未送出的 TOKYO-7 修剪內容；
4. 保全原 payload 及 audit；
5. 七秒不是全系統關機；
6. Public Witness Index／Manifest 走獨立人類公告路徑。

### G. 白光與最終選擇

Chapter 27 的成功邊界應是：

- old TOKYO-7 consensus／public bundle 無法取得 execution anchor；
- official app 未送出的修剪 payload 被取消；
- protective filter 持續；
- clinical branch 撐過回聲窗；
- 兩名較成熟患者可能完成受控 handoff；
- 其餘患者安全停在 COMPARE／HOLD／SAFE PAUSE；
- M-00 仍短期保留 clinical transition support；
- Witness fragments 經非 consensus 路徑留下；
- 不宣稱所有患者已完全無母體化。

Chapter 27 的核心問題：

> 當每名患者都必須用自己的節奏活下來時，他們能否只共享「什麼時候換手」，而不再被迫共享同一個答案？

---
# 21. 本章不能揭露的事

1. Chapter 27 最終是否啟用 Distributed Switch Clock；
2. Other-A／Other-B 是否完成 conditional handoff；
3. 美空是否因 drift 停在 SAFE PAUSE；
4. M-00 在 06:13 後保留 clinical support 的具體時間；
5. Witness Echo Sideband 如何與白光／回聲耦合；
6. 哪些第一人稱 fragments 最終被留下；
7. 哪些區域 receiver 收到哪些 fragment subset；
8. official app 七秒最終取消哪一份 payload；
9. TOKYO-7 官方修剪內容全文；
10. 是否有人嘗試 physical break-glass；
11. 白光是否仍會爆發；
12. M-00 是否完全退出 public／consensus function；
13. 美空是否醒來；
14. 葵是否出現可靠意識反應；
15. `LEGACY／02` 第八天後續結果；
16. 另外四名 active patients 的完整姓名；
17. continuity custodian 真人；
18. 父親現在下落；
19. 外星訊號真正目的；
20. 第三輪是否終止循環；
21. 第八天是否真的到來。

---
# 22. 本章一句話總結

> 23:50 形成的 `CUTOVER AUTH LEASE` 在 science 與 operations 兩個領域仍有有效簽章，卻只綁定 `AUTH_EPOCH A17／SUBJECT_EPOCH S42` 的舊世界。角色不是故意等到租約出生後才尋找患者安全閂：鏡島的 Subject Continuity Bay 平時封閉且本地離線，只有 lease 載入、package preposition 開始並觸發法院條件式患者安全開示後，S42 cache、dependency hash 與 execution-anchor service 才能掛載。此前章節已低強度建立，區域 package 最終仍須 `KAGAMI-01` execution anchor，R1／R2 的 COMMIT-GATE 亦要求全部活動人類依存者通過當輪安全確認；Chapter 26 發現 continuity overlay 沒有刪除這條規則，而是把 `CENTRALLY MANAGED` 偷換成 `MANAGED-EQUIVALENT／CACHED`。澪拒絕破壞 bundle index、強制斷網或關閉可能同時影響 protective filter 與 clinical branch 的設備，堅持讓鏡島讀取現在的人。琴音只辨認自己曾見過的 `SUBJECT-SVC／G07` alias，鏡島技師再以 R2、audit 及服務手冊找到實體 Bay；forensic clone 只定位 server-side delegation，不能接 production。Bay 掛載後，系統不是憑空創造新拒絕，而是匯入 Chapter 23–25 早已存在的 patient-root、醫療、代理及法院 signed updates，並將八個 physical clinical endpoints 與八筆 active human records 交叉，確認沒有未映射心跳。當輪共有九筆 human dependency records：悠真一筆已安全切離，八名仍 active；四名紅區只作最低必要具名層，另四名保持聚合。Subject ledger 由 S42 單調更新至 S43，Clinical Safety Hold 顯示八人皆未完成安全切離，Public Data-Use Hold 則顯示五名實際資料來源者均無 public-use consent。Lease 仍在 A17 密碼學有效，卻不再適用於 S43；formal rebind 需要新 exact bundle 及 A18 science token，而 S7 future release 已被撤回，故正式失敗。Continuity 隨後嘗試不改 bundle 的 `SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE`，聲稱 S43 與 S42 在 BCP 執行上仍安全等價；此 fallback 必須取得所有 unresolved case routes 的醫療／代理確認。琴音只控制 G07／03 一項，並在真理、醫療、患者權利及司法見證下撤回 persistent delegation；美空一項明確拒絕，加上其餘 unresolved routes，使安全等價證明失敗。Old lease 與 package 沒有被刪除，但 KAGAMI 不簽 execution anchor，old consensus／public branch 保持 HOLD，protective filter 與 clinical branch 繼續運作。背景團隊從 03:20 起便重建既有七階段 G07 handshake；悠真夢話只補上 phase order，真正 timing package 由歷史規格、離線模擬與醫療停止條件生成。05:49 前，每名患者的最高 stage 已預先簽署：M-00 與美空最多 COMPARE，葵與 `LEGACY／02` 只能 HOLD，兩名較成熟的匿名患者才是 conditional handoff candidates；M-00 的 public／consensus 功能可停止，但 clinical transition support 必須暫時保留。Subject Bay 亦完成 `Buffer → Consent Filter → Serializer → Witness Echo Sideband → Regional Receivers → Public Witness Index` 的完整驗證，使 Chapter 27 的人類經驗碎片不必重新打開 TOKYO-7 consensus branch。Timing package、witness egress、醫療 abort rules 及官方手機 `+7000ms` 取消命令均已 pre-stage，只等待 05:50 的醫療 go。租約裡沒有名字，不是因為機器必須保存每個人的全名，而是因為它從未取得當輪每一名仍連在線上的人的狀態、醫療安全與拒絕。

---
# 23. 最終寫作檢查表

## 時間、人物與定位

- [ ] 章名使用《租約裡沒有名字》；
- [ ] 所屬大章維持第七日《不要救東京》；
- [ ] 本章發生於星期一 00:05–05:49；
- [ ] 說明跨過午夜但七日回聲窗尚未結束；
- [ ] Chapter 27 才涵蓋 05:50–06:13；
- [ ] 千田保持遠端受保護技術證人；
- [ ] 鏡島現場與遠端角色分工清楚；
- [ ] 琴音不直接操作控制器。

## Subject Bay 為何現在才可開

- [ ] Chapter 21 已回補 Subject Ledger 平時 sealed／local offline；
- [ ] Bay 只有 lease loaded＋local preposition 後才掛載；
- [ ] 23:50 前外部團隊只能看中央聚合摘要；
- [ ] Chapter 24–25 已有條件式患者安全開示命令；
- [ ] package preposition 觸發司法開示；
- [ ] 不讓角色看似故意等到 lease 形成後才行動。

## 前期伏筆與 execution anchor

- [ ] Chapter 21 正式出現 `SUBJECT DEPENDENCY ATTESTATION`；
- [ ] Chapter 21 正式出現 `CLINICAL HOLD`；
- [ ] Chapter 21／24 正式出現 `EXECUTION ANCHOR／KAGAMI-01`；
- [ ] Chapter 25 regional package 顯示 waiting for KAGAMI anchor；
- [ ] Chapter 22 回補 `MANAGED-EQUIVALENT／BCP`；
- [ ] Chapter 24／25 lease metadata 包含 A17、S42、dependency hash 及 topology hash；
- [ ] Chapter 21–25 回補 Witness Buffer／Echo Sideband；
- [ ] Chapter 20 回補七階段 historical handshake；
- [ ] 高層企劃同步更新琴音、悠真與 Subject Bay 定義。

## Continuity 安全語義

- [ ] R1 原始語義為 separated／safe／currently attested；
- [ ] continuity 將 centrally managed 偷換成 managed-equivalent；
- [ ] S42 不寫普通 CLEAR；
- [ ] 顯示 `CACHED／MANAGED-EQUIVALENT`；
- [ ] 解釋 continuity 沒刪除安全閂，而是改寫「安全」。

## 澪的主角選擇

- [ ] 有人提出破壞 bundle index、斷網或強制 deny 的快方案；
- [ ] 這些方案可能影響 protective filter、clinical branch 及證據；
- [ ] 澪拒絕破壞方案；
- [ ] 核心台詞為「不是把它弄壞，是讓它看見自己正在對誰做這件事」。

## Subject Continuity Bay

- [ ] Bay 不包含患者身體；
- [ ] 不新增病房或研究設施；
- [ ] 包含 ledger、update queue、physical heartbeat map、兩個 hold、equivalence service、witness infrastructure 與 delegation records；
- [ ] 琴音只辨認 `SUBJECT-SVC／G07` alias；
- [ ] 實體映射由 R2、audit、本地手冊及技師完成；
- [ ] Forensic clone 離線、無 production 權限；
- [ ] 本地技師實際操作；
- [ ] 開 Bay 不改變患者治療；
- [ ] 真理只允許 G07／03 route 作最低必要開示。

## 固定患者數量

- [ ] human dependency records 固定為九筆；
- [ ] 悠真一筆 safe-detached；
- [ ] active human dependencies 固定為八名；
- [ ] 四名 red-zone；
- [ ] 四名其他 active；
- [ ] 其他四名成熟度及 stage ceiling 固定；
- [ ] 不使用 `<N-ACTIVE>` 佔位符；
- [ ] 不因主題「七」強行設定七名患者。

## 物理端點與 ledger

- [ ] physical active endpoints = 8；
- [ ] ledger active human records = 8；
- [ ] unmapped heartbeat = 0；
- [ ] orphan ledger record = 0；
- [ ] safe-detached records = 1；
- [ ] heartbeat 不暴露完整身份；
- [ ] 任一 mismatch fail closed；
- [ ] 沒有名冊的人不能被當成設備忽略。

## Signed updates 與 S43

- [ ] Chapter 23–25 updates 早已存在；
- [ ] Bay 掛載只匯入既有 signed updates；
- [ ] S42 原快照被封存；
- [ ] monotonic merge 產生 S43；
- [ ] no rollback；
- [ ] unknown format fail closed；
- [ ] 開門沒有魔法般創造 deny。

## 兩個 HOLD

- [ ] Clinical Safety Hold 檢查全部八名 active patients；
- [ ] safe／separated = 0／8；
- [ ] active transition authorized = 0／8；
- [ ] Public Data-Use Hold 檢查五名實際 data-source subjects；
- [ ] valid public-use consent = 0／5；
- [ ] 臨床安全與資料同意不混為一體；
- [ ] 任一一項 HOLD 便阻止 public execution。

## 姓名與隱私

- [ ] 四名紅區只作授權人類最低必要具名層；
- [ ] `LEGACY／02` 明確 HUMAN；
- [ ] 其他四名保持姓名遮蔽；
- [ ] 姓名不是密碼欄位；
- [ ] 真正缺口是當輪狀態、醫療安全與拒絕。

## Local HOLD 與 Formal rebind

- [ ] token／bundle／nonce／A17 保持 valid；
- [ ] lease subject epoch S42 ≠ live S43；
- [ ] Clinical Safety Hold；
- [ ] Public Data-Use Hold；
- [ ] KAGAMI 不簽 execution anchor；
- [ ] consensus／public branch held；
- [ ] protective filter／clinical branch active；
- [ ] lease 保留作證據；
- [ ] S43 形成新 exact bundle；
- [ ] formal rebind 需要 A18 science token；
- [ ] A18 future release disabled；
- [ ] 沒有第二個合法 science issuer；
- [ ] formal rebind denied。

## Subject-equivalence fallback

- [ ] 正式建立 `SUBJECT SNAPSHOT EQUIVALENCE CERTIFICATE`；
- [ ] 它不需新 science token；
- [ ] 若成立可讓 old lease 沿用於 S43；
- [ ] 需要全部 unresolved case acknowledgments；
- [ ] 不得有 patient-root deny、clinical conflict 或 rights hold；
- [ ] 琴音只能影響 G07／03；
- [ ] 琴音／真理拒絕 G07／03；
- [ ] 其他 unresolved routes 亦阻止 certificate；
- [ ] certificate denied；
- [ ] 琴音撤回具有真正技術必要性。

## 琴音 delegation

- [ ] Chapter 23 device access 與 persistent delegation 分開；
- [ ] forensic clone 只找 role ID；
- [ ] live request 來自 server-side record；
- [ ] 琴音只能撤回 G07／03；
- [ ] 不代表其他七名 active patients；
- [ ] 真理拒絕美空 reseal；
- [ ] 撤回不影響 Domain-C 或探視；
- [ ] 撤回不等於免責或原諒；
- [ ] 核心台詞保留「門關著時，租約裡連她還在都沒有」。

## Manual override

- [ ] unresolved human 時普通軟體 override 不可用；
- [ ] physical break-glass 需 medical、patient-rights、local operations；
- [ ] 需本地實體操作與 immutable audit；
- [ ] effect 只限 public／consensus branch；
- [ ] protective filter／clinical branch 不受影響；
- [ ] Chapter 27 不臨時新增無痕高官 override。

## 區域 package

- [ ] normal operations nodes 持續拒絕；
- [ ] 一個 continuity cluster package quarantine；
- [ ] 不刪除 package 證據；
- [ ] 普通服務保持；
- [ ] 剩餘路徑等待 KAGAMI anchor；
- [ ] 不新增新 HSM、組織或反派。

## Witness Egress

- [ ] Buffer 有早期伏筆；
- [ ] Consent／Release Filter 明確；
- [ ] Serializer 只包裝獨立 fragments；
- [ ] Witness Echo Sideband 有既有 clinical after-action 血統；
- [ ] Sideband multiplex 於 filter telemetry 旁；
- [ ] 不經 consensus；
- [ ] 不輸出 raw neural；
- [ ] 不要求所有區域收到同一內容；
- [ ] regional receivers 收不同 signed subsets；
- [ ] Public Witness Index 只發布 hashes、transcripts 及驗證方式；
- [ ] 本章 output disabled；
- [ ] 05:49 前 egress package pre-staged；
- [ ] Chapter 27 才決定 activation。

## 患者 Stage Ceiling 與 SAFE PAUSE

- [ ] M-00 max COMPARE；
- [ ] M-00 public／consensus function 可停止；
- [ ] M-00 clinical transition support 可保留至第八天；
- [ ] 美空 max COMPARE；
- [ ] 葵 max HOLD；
- [ ] `LEGACY／02` max HOLD；
- [ ] Other-A／B conditional handoff；
- [ ] Other-C max COMPARE；
- [ ] Other-D max HOLD；
- [ ] SAFE PAUSE 不等於停止生命支持；
- [ ] Chapter 27 不要求八名全部 handoff。

## 悠真節奏

- [ ] Subject Bay 03:10 掛載後立即開始背景分析；
- [ ] 不等到最後十分鐘才發現；
- [ ] historical handshake 是部署依據；
- [ ] 悠真夢話只提供線索與 phase order；
- [ ] 不播放悠真錄音給患者；
- [ ] 七階段為 announce、sample、hold、compare、acknowledge、handoff、settle；
- [ ] timing 不含 patient control data；
- [ ] 未準備患者可 SAFE PAUSE；
- [ ] 不把悠真變成 Mother Reference；
- [ ] 05:49 前 package hash、stage ceilings 及 abort rules 完成預簽；
- [ ] 本章仍不啟用。

## 手機七秒命令

- [ ] 05:49 前 cancel command 已簽署；
- [ ] 綁定 exact TOKYO-7 bundle；
- [ ] 只取消尚未送出的 official app payload；
- [ ] 已播廣播不可回收；
- [ ] 七秒不是全系統關機；
- [ ] Evidence capture required；
- [ ] 本章 not armed。

## 05:50 與終局保留

- [ ] 05:49 顯示 branch-specific prep；
- [ ] protective filter prep 會開始；
- [ ] clinical phase prep 會開始；
- [ ] patient bridge clock pre-staged／pending go；
- [ ] consensus prep held；
- [ ] public route prep held；
- [ ] execution anchor 未簽發；
- [ ] Chapter 27 保留完整 05:50–06:13；
- [ ] Chapter 27 保留 physical bypass 風險；
- [ ] Chapter 27 保留七秒、Witness fragments、白光與最終選擇；
- [ ] Chapter 28 保留第八天及人物後果；
- [ ] 本章不揭露 continuity custodian；
- [ ] 本章不揭露父親位置；
- [ ] 本章不解釋外星訊號真正目的；
- [ ] 本章不宣告循環已終止。
