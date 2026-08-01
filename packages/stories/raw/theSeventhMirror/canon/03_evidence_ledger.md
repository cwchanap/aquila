# Bible 3 — Evidence Ledger（證據分類總帳）

> 《神鏡七日》theSeventhMirror — Phase 3 canon-lock 產物。
> **權威來源：** `docs/chapter_*_plan.md`（ch1–28）、`docs/00_high_level_plan_final.md`、`final-polish/canon_decisions.md`（D1–D8）、`docs/final_polish.md §8 / §1`。
> **用途：** 鎖定每一項證據的「性質分類 + 持有者 + 公開狀態」，供 Phase 2/5 伏筆與法律紀律（§7.2）對齊。任何 prose 編輯必須與本帳一致。
>
> ## 分類標籤（單選主標籤）
>
> | 標籤 | 意義 |
> |---|---|
> | `CURRENT-LOOP PHYSICAL` | 當輪物理證據（物件、屍體、指紋、血跡） |
> | `CURRENT-LOOP DOCUMENT` | 當輪文件、紀錄、log、螢幕截圖 |
> | `CURRENT-LOOP TESTIMONY` | 當輪證人陳述 |
> | `CROSS-LOOP MEMORY` | 角色來自前輪的記憶——當輪不可證 |
> | `AUTHOR TRUTH` | 故事現實中為真，但 in-loop 不可證 |
> | `PUBLIC` | 公開已知／將成為公開 |
> | `SEALED` | 封存證據，未公開 |
> | `SUBJECTIVE` | 角色主觀信念／感受，非客觀事實 |
>
> 每項另附「持有者／存取」與「公開狀態（public／sealed／sealed→public）」欄。
> **法律紀律（§7.2）：** 前兩輪的暴力與物件不能成為第三輪的刑事既定事實；第三輪只建立在當輪可證行為上。

---

## 目錄

1. [外殼（銀色資料外殼）](#1-外殼銀色資料外殼)
2. [第七車影像（CCTV footage）](#2-第七車影像cctv-footage)
3. [施工通道（construction passage）](#3-施工通道construction-passage)
4. [琴音（Kotone——角色證據）](#4-琴音kotone角色證據)
5. [卡匣（cartridge）](#5-卡匣cartridge)
6. [R4（possible-future failure mode）](#6-r4possible-future-failure-mode)
7. [R5（subject／patient root）](#7-r5subjectpatient-root)
8. [父親（father）](#8-父親father)
9. [Witness fragments（見證路徑碎片）](#9-witness-fragments見證路徑碎片)
10. [白光報告（white-light report）](#10-白光報告white-light-report)
11. [七十年訊號（the 70-year signal）](#11-七十年訊號the-70-year-signal)
12. [跨域證據（小鏡子、G07 代碼、函館紀錄等）](#12-跨域證據)

---

## 1. 外殼（銀色資料外殼）

> 千田浩介在上車前被刺後，強行攜帶上車、企圖交給澪的銀色離線資料載體保護匣。它薄而硬、一側被硬撬出三角形破邊，沾血後從監視器看像尖銳物，但法理上不可能造成千田的深刺傷。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `SHELL-01` 銀色資料外殼本體 | ch2 | `CURRENT-LOOP PHYSICAL` | 約半手機長、薄型金屬資料匣，破邊來自千田無工具硬撬設備模組。證明：它不是凶器；血跡為轉移血非刺入血；千田有資料要交付。 | R1：澪短暫持有→被警方/控制中心收走。每輪重置後不再存在。 | SEALED（進入證物流程後被封存／改名） |
| `SHELL-02` 外殼邊緣「無刺入深度痕」 | ch2/ch3 | `CURRENT-LOOP PHYSICAL` | 法醫／推理點：破邊能割手指，但不能造成肋下/上腹深刺傷。證明澪非刺殺者。 | 法醫／警方鑑識（R1）。R3 由澪記憶指向。 | SEALED |
| `SHELL-03` 澪第一輪記下的破邊／金色接點／`T / 7` 痕跡／插槽代碼 | ch3/ch5 | `CROSS-LOOP MEMORY` | 澪在外殼被收走前記住的細節；R2 她憑記憶畫下**草圖**（早於任何同類硬體照片，為 ch15 比對基準，防「反向修改記憶」之嫌）。 | 僅澪持有（記憶＋紙本草圖）。 | SUBJECTIVE→佐證用（非獨立物證） |
| `SHELL-04` 外殼流向：病人物袋→「交通案件關聯物臨時交接箱」 | ch8 | `CURRENT-LOOP DOCUMENT` | R2 千田醫院死亡時，病人物袋保管時間與澪目擊不一致；疑似外殼被改名為「交通案件關聯物／私物一式／金屬片狀物」而不可見。證明敵方掌握的是整條流程而非單一陷阱。 | 醫院安全暫存→警方先遣／灣岸安全管理部。 | SEALED |
| `SHELL-05` 「別先看畫面。血比較老實」 | ch2 | `CURRENT-LOOP TESTIMONY` | 千田臨終殘缺提示（R1 澪在場聽見；R3 為澪記憶）。指向：影像可被整理，血跡方向才是真相。 | 千田→澪（R1 證詞；R3 為 cross-loop）。 | SUBJECTIVE（殘缺台詞，非完整證詞） |
| `SHELL-06` 「不是這裡……」 | ch2 | `CURRENT-LOOP TESTIMONY` | 千田試圖說明攻擊地點但被失血/防災測試打斷。指向死亡地點≠攻擊地點。 | 同 SHELL-05。 | SUBJECTIVE |
| `SHELL-07` 外殼真正內容＝離線資料載體保護匣（千田從災害警報/交通同步系統拷出的片段） | ch2（設定）/ch15 比對 | `AUTHOR TRUTH` | 作者層真相：外殼內含千田拷貝的系統片段；正文長期不打開、不揭露內容。 | 作者層；正文角色長期不知。 | AUTHOR TRUTH（in-loop 不可證） |

---

## 2. 第七車影像（CCTV footage）

> 當晚灣岸新交通第七車的監視器影像分**三層**：本地原始檔、控制中心即時壓縮流、官方匯出畫面。交付外殼的片段在壓縮流中被補幀／刪除，形成對澪不利的版本。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `CCTV-01` 車內本地原始檔（完整畫面） | ch2（設定） | `CURRENT-LOOP PHYSICAL` | 存於車載系統，短期不易取得；含千田交付外殼的真實片段。為後期翻案證據。 | 車載系統／控制中心。 | SEALED |
| `CCTV-02` 控制中心即時壓縮流（補幀/重組版） | ch2 | `CURRENT-LOOP DOCUMENT` | 即時安全判斷用；自動補幀與時間戳校正，先把澪標為「持尖銳物者」。 | 控制中心。 | SEALED |
| `CCTV-03` 官方匯出畫面（缺關鍵十來秒） | ch2/ch3 | `CURRENT-LOOP DOCUMENT` | 由壓縮流剪出，缺交付片段或順序被整理，形成「澪手持血跡金屬物、千田倒下」的假敘事。警方/媒體看到的就是這版。 | 警方／控制中心／神鏡協力者。 | SEALED（官方內部） |
| `CCTV-04` 「11 秒」時間碼錯位 | ch2（「十來秒」）/ch3 量化 | `CURRENT-LOOP DOCUMENT` | 防災同步測試造成本地檔、壓縮流、官方匯出三層時間碼錯位。證明影像被整理過。正文 ch2 只寫「十來秒」，ch3 正式量化為 11 秒。 | 調閱監視器時發現。 | SEALED |
| `CCTV-05` 「請放下手中的尖銳物」廣播 | ch2 | `CURRENT-LOOP DOCUMENT` | 控制中心即時壓縮流把外殼判為尖銳物，啟動安全程序。證明系統先於人類把澪定義為危險人物。 | 控制中心（車廂廣播紀錄）。 | SEALED |
| `CCTV-06` 千田上車時按肋下／血從座位下擴散／澪袖口無噴濺血 | ch2 | `CURRENT-LOOP PHYSICAL` | 公平線索組：證明攻擊發生在上車前，澪非刺殺者。 | 車廂現場／法醫。 | SEALED |

---

## 3. 施工通道（construction passage）

> 車站施工中連絡通道——千田真正被攻擊的地點。該處監視器因維修關閉，是琴音掌握千田行蹤與通道權限的所在。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `PASS-01` 21:04 千田被「維修人員」引入施工通道 | ch2（設定）/ch5 場景 | `AUTHOR TRUTH` | 作者真相：攻擊者為琴音（穿維修外套、帽、口罩），千田從側後方被攻擊，未認出她。R2 澪看見維修人員引千田入通道。 | 作者層；角色長期不知。 | AUTHOR TRUTH（當輪不可證為琴音） |
| `PASS-02` 通道監視器因維修關閉 | ch1/ch8 | `CURRENT-LOOP DOCUMENT` | 維修紀錄顯示該時段監視器停用。指向真正攻擊地點的條件。 | 車站維修建築紀錄。 | SEALED→public（維修紀錄可調） |
| `PASS-03` R2 澪追入通道、發現血跡 | ch5/ch6 | `CURRENT-LOOP PHYSICAL` | R2 澪提前到站，看見維修人員引千田入通道並追上；發現攻擊地點不在車廂。證明「死亡地點≠攻擊地點」。 | R2 澪目擊（每輪重置；R3 為記憶）。 | CROSS-LOOP MEMORY（對 R3 而言） |
| `PASS-04` 琴音的維修建築、制服、一次性門禁與工具 | ch24 | `CURRENT-LOOP DOCUMENT` | R3 當輪證據正式確認琴音為 21:04 維修服人物：她取得一次性門禁、制服與工具（由神鏡支援線提供，非其循環記憶）。**這是當輪可證行為**（§7.2 法律處理建立於此）。 | 警方／門禁與工單系統。 | SEALED→public（ch25 Public Deny Manifest） |
| `PASS-05` 「死亡地點≠攻擊地點」當輪物證鏈 | ch26/ch28 | `CURRENT-LOOP DOCUMENT` | R3 鎖定（ch28 千田聽證邊界）：`original handoff site = construction passage`、`train footage = interpolated/non-probative`、`silver shell = not weapon`。 | 法院／警方。 | sealed→public（公開審理） |
| `PASS-06` 前輪攻擊地的法律地位 | ch28 | `AUTHOR TRUTH` | `PRIOR-LOOP ASSAULT LOCATION / SOURCE: 朝倉澪 recollection / LEGAL STATUS: UNCORROBORATED／NOT ADJUDICATIVE`。千田不能把澪的 erased-loop memory 冒充成法庭事實。 | 法院（不得採為判決基礎）。 | AUTHOR TRUTH |

---

## 4. 琴音（Kotone——角色證據）

> 白石琴音為千田死亡事件的直接加害者、神鏡半受迫協力者。其角色證據多為「低強度熟悉感洩漏」與「不該知道的資訊」。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `KOT-01` 21:19 琴音已讀未回（讀據方向：琴音 ignored 澪，D4） | ch1/ch2 | `CURRENT-LOOP DOCUMENT` | 澪出發前留言，琴音 21:19 已讀未回。當輪為讀據紀錄；其**意義**（琴音當時在通道附近／陷入掙扎）為 author truth。 | 澪手機／通訊紀錄。 | SEALED（通訊調取） |
| `KOT-02` 琴音說出澪沒告訴她的醫院名稱 | ch7/ch8 | `CURRENT-LOOP TESTIMONY` | R2 琴音脫口說出不該知道的醫院名／「那些東西」。證明她有非公開資訊來源（神鏡支援線，非其循環記憶）。 | 澪目擊（R2 為 cross-loop for R3）。 | CROSS-LOOP MEMORY（對 R3） |
| `KOT-03` 琴音星期一固定不點同一款飲料 | ch1/ch23 | `SUBJECTIVE` | 低強度熟悉感的無意識確認儀式；**她本人不知行為來源**，不得出現「上一輪／這一輪／測試」字眼。 | 琴音自身（無自覺）。 | SUBJECTIVE |
| `KOT-04` 琴音對「關東青少年睡眠支援計畫」名稱停頓 | ch1 | `SUBJECTIVE` | 她知道受試者相關資訊而瞬間反應。 | 澪目擊。 | SUBJECTIVE |
| `KOT-05` 琴音為 21:04 維修服人物的當輪身分鏈 | ch23/ch24 | `CURRENT-LOOP DOCUMENT` | R3 當輪證據正式確認琴音＝21:04 維修服人物（門禁、制服、工單、支援代理濫用合法流程）。 | 警方／門禁系統。 | SEALED→public |
| `KOT-06` 琴音有限安全披露（揭露隱藏服務槽與防呆卡匣安裝流程） | ch23 | `CURRENT-LOOP TESTIMONY` | R3 五方見證下，琴音揭露隱藏服務槽及預配置防呆卡匣安裝流程；銀色載體正式確認。 | 多方見證／醫療安全會議。 | SEALED→public |
| `KOT-07` 琴音撤回 `G07／03` persistent delegation | ch26/ch28 | `CURRENT-LOOP DOCUMENT` | 終局琴音打開患者狀態資料層並撤回自己對美空的持續性委派；留在隔離服務區，不操作控制器。 | 患者狀態系統／法院。 | SEALED→public |
| `KOT-08` 琴音正式到案、陳述當輪可證行為、不求原諒 | ch28 | `CURRENT-LOOP TESTIMONY` | 終局琴音到案，只陳述當輪可證行為，不要求澪原諒。前兩輪暴力只存在於 author truth／澪記憶。 | 司法機關。 | public（公開審理） |

---

## 5. 卡匣（cartridge）

> R3 才正式定位的「銀色原始簽署卡匣」——美空床側控制器的預配置防呆卡匣。與外殼（§1）共用硬體家族序號，但角色與安裝位置不同。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `CART-01` 美空床側預配置防呆卡匣 | ch23 | `CURRENT-LOOP PHYSICAL` | 琴音插入預配置防呆卡匣，遠端代理完成 `Domain-C` 綁定（美空病人專屬局部影子參照）。 | 美空醫療設施床側控制器。 | SEALED |
| `CART-02` 銀色原始簽署卡匣（被琴音取走並安裝） | ch24 | `CURRENT-LOOP PHYSICAL` | R3 當輪確認：琴音取得一次性門禁/制服/工具，取走銀色原始簽署卡匣並安裝於美空床側。採**五方原位共同控制**。 | 五方共同控制（本地、醫療、法定代理、患者權利、司法）。 | SEALED |
| `CART-03` 卡匣雙安全域（公共授權域／臨床根域） | ch24 | `CURRENT-LOOP DOCUMENT` | 卡匣具彼此隔離的兩域：`Domain-P`（公共，本地不可遠端逆轉隔離）與 `Domain-C`（臨床，綁定美空局部影子）。 | 五方共同控制。 | SEALED |
| `CART-04` 缺失原始簽署載體（硬體序號追蹤） | ch22 | `CURRENT-LOOP DOCUMENT` | 載體在 ch18 失蹤後才出現在美空節點；同一硬體序號曾在 `G07／03` 遠端臨床節點出現。 | 醫療系統 log。 | SEALED |
| `CART-05` SHARE-S 非匯出授權膠囊撤回（6/7） | ch25 | `CURRENT-LOOP DOCUMENT` | 七個 trust domain 保存同一 exact bundle 的非匯出 science authorization capsule；`PRIOR RELEASE COUNT = 0`。ch25 撤回 6/7。 | 七個 trust domain（分散式）。 | SEALED |

---

## 6. R4（possible-future failure mode）

> R4 是從當前第三輪延伸、在下一個星期一 06:13 前完成的**可能未來澪**的 failure-mode，**不是已發生的隱藏第四輪**。標記 `NOT PRE-AUTHORIZED／FAILURE-MODE ONLY`。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `R4-01` R4 回聲警告（經紗英託管記憶送回） | ch21/ch22 | `CROSS-LOOP MEMORY` | 可能未來的澪接受「必要犧牲」並失敗；其回聲經下一次白光送回本週星期一，由紗英（`M-00`）託管承接。不是完整答案，而是現在的澪重新審判它的權利。 | 紗英託管→澪接收。 | CROSS-LOOP MEMORY（當輪不可證） |
| `R4-02` 紗英輸出 `R4／AUTHOR／MIO` 與臨時禁止預授權 | ch22 | `CURRENT-LOOP DOCUMENT` | 紗英主動輸出 R4 標記，並限定：完整 R4 套件不得透過額外託管回聲送回；R4 不得成為預設/預先批准/自動執行方案。 | 多方安全會議／系統紀錄。 | SEALED |
| `R4-03` R4 高可信重建（`R4／RECONSTRUCTED`） | ch22 | `AUTHOR TRUTH` | R4 在 `CONSENSUS COMMIT` 即將完成時切斷 M-00、遠端臨床與公共輸出共用的雙向穩定閉環；可能阻止部分失敗但代價含 M-00、美空等未安全切離者。R4 沒有正文，不能被「找回」。 | 多方會議重建（作者層為真，in-loop 為推論）。 | AUTHOR TRUTH |
| `R4-04` R4 的代價含母親與未成年人 | ch22 | `AUTHOR TRUTH` | 可能未來中的澪知道母親及未成年人仍在代價內卻仍接受 R4。這是當前澪拒絕預先授權的關鍵。 | 作者層。 | AUTHOR TRUTH |
| `R4-05` 澪出示經遮蔽的 R4 決議、證明已拒絕該失敗路線 | ch23/ch25 | `CURRENT-LOOP DOCUMENT` | 澪在有限醫療安全披露中支付「自己拒絕 R4」的事實；拒絕把跨輪記憶寫入公共證據（`PUBLIC DENY MANIFEST`）。 | 澪／多方見證。 | SEALED（遮蔽版） |

---

## 7. R5（subject／patient root）

> R5 = `KAGAMI-SAFE／R5`，provisional 過渡規格。目標：在不複製美空、不再用紗英為永久母體、不對患者新斷線試驗的前提下，建立安全橋接。**R5 PUBLIC PRIVILEGE = NONE**（當輪 TOKYO 公共域仍由外部 hold 控制）。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `R5-01` `KAGAMI-SAFE／R5` 規格登錄 | ch24/ch25 | `CURRENT-LOOP DOCUMENT` | 區分兩種安全邊界：每名患者自己的 `PATIENT SAFETY ENVELOPE` 與多源 `NETWORK TRANSITION ENVELOPE`。M-00 只作有限端點、可撤回。 | 多方／患者權利程序。 | SEALED |
| `R5-02` 患者綁定本地臨床根（原位生成 + 雙重觀察驗證） | ch24 | `CURRENT-LOOP DOCUMENT` | 患者模型只在本地生成；`Domain-P` 不可遠端逆轉隔離。美空 `LOCAL SHADOW REF = G07／03` 只保存生理/神經/相位穩定模型，**不保存人格、記憶、意識**。 | 本地臨床 sidecar／五方。 | SEALED |
| `R5-03` 紗英限制性同意、可操作撤回與安全暫停 | ch24/ch25 | `CURRENT-LOOP TESTIMONY` | 紗英以家屬身分陳述、指出 R4 偏見、參與公開證據及患者具名程序；只授權短期非語義過渡用途，可撤回。不單獨成為 R5 作者。 | 紗英／獨立判斷人。 | SEALED→public（患者具名程序） |
| `R5-04` R5 distributed patient-safety hold（分散式明確否決） | ch25/ch26 | `CURRENT-LOOP DOCUMENT` | 法律/醫療/患者權利有效 hold；continuity HSM 尚不認得。`CUTOVER AUTH LEASE` 密碼學有效但不自動取得患者安全適用性。 | 分布式多方／法院。 | SEALED→public |
| `R5-05` 八名活動患者矩陣（含 `G07／03 = 藤川美空`） | ch22/ch26 | `CURRENT-LOOP DOCUMENT` | 固定 8 名活動人類依存者（`TOTAL HUMAN RECORDS = 9`，悠真 safe-detached 1，active 8）；美空 = `REMOTE CAL ACTIVE` 高依存。不得在 ch27 突然冒出方便成功的患者。 | 醫療系統／`SUBJECT LEDGER`。 | SEALED（`SEALED／LOCAL OFFLINE`） |
| `R5-06` Subject Bay 只在 lease 載入後才掛載 | ch26 | `CURRENT-LOOP DOCUMENT` | `SUBJECT LEDGER = SEALED／LOCAL OFFLINE`；只有指定 bundle 進入本地預置且 distributed hold 未被 continuity 接受時，才打開含患者私密狀態的本地 Bay。 | 鏡島本地／法院監督。 | SEALED |

---

## 8. 父親（father）

> 朝倉父親（刑警）為澪/悠真之父、日下部舊同事。因調查神鏡/紗英而失蹤多年。其遺留的規則與程序痕跡是終局機制的公平伏筆。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `FAT-01` 父親調查神鏡/紗英後失蹤（七年前） | ch1（暗示）/ch19 | `AUTHOR TRUTH` | 七年前父親發現紗英可能仍活著，重新調查 TOKYO／筑波後失蹤；法律狀態複雜未完全宣告死亡。 | 作者層；日下部知部分。 | AUTHOR TRUTH |
| `FAT-02` 日下部記得父親舊筆記的「鏡」關鍵字 | ch1 | `CROSS-LOOP MEMORY` | 日下部看見小鏡子時微小停頓——他想起朝倉父親舊案曾出現「鏡」。第 1 章不解釋。 | 日下部（記憶）。 | SUBJECTIVE |
| `FAT-03` `KAGAMI-SAFE／R1` 規定（M-00 醫療與訊號校準必須分離） | ch22 | `CURRENT-LOOP DOCUMENT` | 父親留下的早期患者安全保全規則；R1–R3 系列中 R1 為父親所設。 | 系統設定檔／多方。 | SEALED |
| `FAT-04` 父親的 patient-safety order（被轉入國安 docket） | ch20/ch28 | `CURRENT-LOOP DOCUMENT` | 父親原 patient-safety order 在被轉入國安 docket 時未遷移；continuity 沒有移除父親的規則。 | 國安 docket／法院。 | SEALED→public（ch28 解封） |
| `FAT-05` 父親下落的「雙證據程序痕跡」 | ch28 | `CURRENT-LOOP DOCUMENT` | ch28 父親取得有限程序痕跡：`MAR-CONT／PROTECTIVE TRANSFER CLASS／MARITIME CONTINUITY ROUTE`——父親曾被轉入既有海上 continuity 程序。醫療 clearance 與 maritime handoff 紀錄被交叉解封。 | 法院／海事程序。 | sealed→public（三個月左右解封） |
| `FAT-06` 「妳父親以前也以為，只要查清楚就夠了」 | ch1 | `CURRENT-LOOP TESTIMONY` | 日下部對澪的台詞；前期像威脅/冷嘲，後期回收：他想阻止澪重蹈父親覆轍。 | 日下部→澪。 | SUBJECTIVE |

---

## 9. Witness fragments（見證路徑碎片）

> Patient Witness Path：受試者已授權的第一人稱碎片（夢話、黑色海經驗等）經不進 consensus 的 witness path 解鎖，只送 release keys／IDs／integrity roots，不注入未同意公眾神經系統。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `WIT-01` Witness Echo Sideband（release-key carrier） | ch26/ch27 | `CURRENT-LOOP DOCUMENT` | 低頻 sideband 只送 keys／IDs／roots；encrypted fragment envelopes 預置。`DIGITAL WITNESS RELEASE = ACTIVE`。 | 鏡島／分散式。 | SEALED（keys 受控釋放） |
| `WIT-02` Public Witness Index（opt-in） | ch27/ch28 | `PUBLIC` | 公眾只能透過 opt-in Public Witness Index 自願查閱依法可公開 fragments；初始 public notice／hash 可用，完整 fragments 逐步開放。不含 raw neural stream。 | 公眾（opt-in）／法院監督。 | public（opt-in） |
| `WIT-03` 受試者第一人稱碎片（夢話／黑色海等） | ch11（家屬保存）/ch27 釋放 | `CURRENT-LOOP DOCUMENT` | 家屬（第七曙光）早在家屬群成立前已將部分夢話/圖像交給學校/醫院留下外部日期紀錄（強/中/弱三級證據）。終局以 opt-in 數位形式釋放。 | 家屬／學校／醫院系統→Witness Path。 | sealed→public（opt-in） |
| `WIT-04` witness key release（患者安全優先） | ch27 | `CURRENT-LOOP DOCUMENT` | 只在 patient/clinical 安全 latch 成立時釋放；不同 witness receivers 解鎖不同 source-verified fragments。 | 患者權利程序／法院。 | SEALED→public（受控） |
| `WIT-05` 拒絕統一反敘事但保留共同事實 | ch27/ch28 | `AUTHOR TRUTH` | fragments 不壓成單一版本；公開後不保證全世界相信同一版本。`TOKYO-7 unified public version` 並未形成。 | 作者層／制度。 | AUTHOR TRUTH |

---

## 10. 白光報告（white-light report）

> 06:13 東京灣白光的事後報告。白光＝訊號放大／回送現象（非爆炸）；protective filter 降低高相干耦合卻不消除物理白光與低強度 sensory echo。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `WL-01` 白光 sensory echo（不可控現象） | ch27/ch28 | `AUTHOR TRUTH` | sensory echo 不受角色控制，不能被挑選/編碼/當作獎勵；與 witness fragments 分離。**不得**當患者證詞。 | 作者層／現象。 | AUTHOR TRUTH |
| `WL-02` 白光事後報告（文件真相） | ch25/ch28 | `CURRENT-LOOP DOCUMENT` | ch25 文件真相與 06:13 人類經驗真相分流；ch28 白光報告與 Witness Index、文件真相遭爭奪/切割，形成共同真相。 | 監測網／法院／媒體。 | sealed→public（爭議中公開） |
| `WL-03` 物理白光濾波記錄（protective filter 未關閉） | ch27 | `CURRENT-LOOP DOCUMENT` | protective filter 與 clinical branch 保持 active；filter 阻止高相干統一神經輸出，卻不消除物理白光與低強度感官殘響。 | 系統 log／監測。 | SEALED |
| `WL-04` 「06:13 白光」與手機 +7000ms 中央 fanout 取消 | ch27 | `CURRENT-LOOP DOCUMENT` | `TOKYO-7 unified public version` 未形成；官方手機 follow-up 在中央 fanout 前被取消；普通警報與服務繼續。 | 系統／官方。 | sealed→public |
| `WL-05` 白光物理原因保持未證明 | ch28/high-level §5 | `AUTHOR TRUTH` | 白光為何觸發回送、循環完整物理原因到全書結束仍未被證明。角色與敘事不得過度宣稱已解。 | 作者層。 | AUTHOR TRUTH |

---

## 11. 七十年訊號（the 70-year signal）

> 結尾：朝倉家的 wideband analog receiver（母親遺物改裝）與其他台站共同接收到一輪低功率窄帶多音。多組模型暫定解讀為星圖與約七十年後的時間/位置窗口；`CONTACT WINDOW = PROBABLE／NOT PROVEN`。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `SIG-01` wideband analog comparison receiver（母親遺物改裝） | ch1（種子）/ch28 | `CURRENT-LOOP PHYSICAL` | 以舊短波機外殼改裝；母親死後家中無人丟掉。具前期技術血統（獨立類比監測）。 | 朝倉家／澪。 | private（個人持有） |
| `SIG-02` 新訊號（窄帶多音） | ch28 | `CURRENT-LOOP PHYSICAL` | 在既定 prior-source observation window 收到一輪低功率窄帶多音；同一時段其他台站報告相同 RF pattern。訊號來源家族與函館一致；**無**舊事件高相干 phase、KAGAMI amplification 或已知 neural coupling。 | 公開監測網／朝倉家 receiver。 | public（第一時間公開 hash） |
| `SIG-03` 公開 hash／頻譜／acquisition metadata | ch28 | `PUBLIC` | 第一時間公開 hash、acquisition time、頻譜 metadata、receiver configuration 與不可重建 preview；原始 RF／IQ／waveform 進 `DISTRIBUTED SAFETY QUARANTINE`，不自動播放。 | 公開監測網。 | public |
| `SIG-04` 暫定解讀（pulsar-relative map／七十年窗口） | ch28 | `AUTHOR TRUTH` | 多組獨立模型得「相近但非絕對」解讀：可能是一張 pulsar-relative map，指向約七十年後的時間/位置窗口。**沒有已辨認命令，沒有把未來送回任何人的腦中。** | 科學社群（暫定）。 | AUTHOR TRUTH（probable／not proven） |
| `SIG-05` 函館夜潮原始訊號紀錄（訊號家族源頭） | ch20 | `CURRENT-LOOP DOCUMENT` | 十年前函館近郊舊觀測站（轉天文/通訊監測）留下第一份完整原始訊號紀錄；用三組有獨立日期的封存材料建立時間鏈。 | 函館岸站／舊觀測站封存。 | SEALED→public（公開審理） |
| `SIG-06` 訊號本質：意圖始終未知 | high-level §6/ch28 | `AUTHOR TRUTH` | 「警告」是高可信人類解讀，非訊號證實立場；外星意圖始終未知。不得寫成訊號源守護/偏袒人類。 | 作者層。 | AUTHOR TRUTH |

---

## 12. 跨域證據

> 跨越多個 domain 的核心證據，集中列出以避免重複。

| 證據 ID | 首現章 | 主標籤 | 內容／證明 | 持有者／存取 | 公開狀態 |
|---|---|---|---|---|---|
| `X-01` 小鏡子（悠真留給澪）背面受試者編號 `G07／12` | ch1（情感物）/ch13 比對 | `CURRENT-LOOP PHYSICAL` | 鏡背人為刻痕與悠真第二階段預約頁代碼 `G07／12` 局部相符（不能單由刻痕判定完整字串）。悠真＝受試者 `G07／12`。 | 澪持有原件；警方 R1 短暫保管。 | private→SEALED（進入程序時） |
| `X-02` 悠真第二階段預約頁截圖（清晰 `G07／12`） | ch13/ch17 | `CURRENT-LOOP DOCUMENT` | 清晰可讀的 `G07／12` 來自預約頁截圖（非鏡背刻痕）；R3 澪從家庭共享備份重新取得。為 ch17 比對主證據。 | 澪／家庭備份。 | private |
| `X-03` `G07` 與 TKS-SYNC「同步群/端點」地址語義錯位 | ch13/ch14 | `CURRENT-LOOP DOCUMENT` | `G07／12` 高度近似 TKS-SYNC 的「第七同步群／第十二端點」格式；多份研究文件頁尾帶 TKS 標記。供應商小野寺意見明定為「供應商說明」非獨立鑑定。 | 兼職辦公室追查／警方文件。 | SEALED |
| `X-04` 「東京，不指涉地名。東京為最終同步方案」文件 | ch14 | `CURRENT-LOOP DOCUMENT` | 澪查到的關鍵文件；首次反轉「不要救東京」的真正意思（`TOKYO-7` 為同步方案名稱）。 | 澪追查取得。 | SEALED→public |
| `X-05` 匿名訊息（千田延遲訊息） | ch1 | `CURRENT-LOOP DOCUMENT` | 千田事先設定的延遲訊息，指定第七車與「那件東西」；刻意不寫「鏡子」（D5）。作者真相為千田所發。 | 澪手機（截圖）。 | private（作者層知來源） |
| `X-06` 悠真「想冷靜幾天」偽造簡訊 | ch1/ch2 | `CURRENT-LOOP DOCUMENT` | 警方誤導資料；千田指出「那封訊息不是他打的」。證明悠真非自願離家。 | 警方紀錄／悠真手機。 | public（警方方向）→反駁 |
| `X-07` 災害警報/交通推送 7 秒延遲 | ch1/ch2 | `CURRENT-LOOP DOCUMENT` | 澪手機接收防災警報/交通通知比官方看板慢約 7 秒（非時鐘慢）。為東京方案同步機制破綻，終盤破解關鍵。 | 澪手機／系統 log。 | private→public |
| `X-08` 日下部循環碎片的中性測試 | ch17 | `CURRENT-LOOP TESTIMONY` | R3 澪用與案件無關的荒謬句+案件句測試日下部；確認其腦中留有本輪不應存在的碎片（語言/方向/危險碎片，不完整記得第二輪）。 | 澪／日下部。 | CROSS-LOOP MEMORY |
| `X-09` 紗英跨個體異常資訊匹配（低負荷盲測） | ch22 | `CURRENT-LOOP TESTIMONY` | 紗英在盲測中辨認來自澪與日下部兩名隔離保管者的資訊、拒絕誘餌；出現跨個體無已知普通渠道的異常匹配，來源未定。 | 多方見證。 | SEALED |
| `X-10` 公開文件（神鏡文件、受試者名單、交通紀錄、監視器原始檔） | ch28 | `PUBLIC` | 終局後神鏡計畫文件、受試者名單、交通紀錄、監視器原始檔被公開；多國政府否認參與、互相切割。 | 公眾／媒體。 | public |
| `X-11` 凪原與 continuity 具體決策公開審理 | ch28 | `CURRENT-LOOP TESTIMONY` | 凪原、C2、continuity duty roles 與 policy committee 進入公開調查與刑事程序（判決未定）。沒有單一 mastermind。 | 司法／公開審理。 | public |

---

## 附：分類速記原則

1. **每輪重置：** 物理證據（外殼、血衣、監視器、屍體）不能跨輪攜帶；只有記憶能回到過去。R3 的法律處理只建立在當輪可證行為（§7.2）。
2. **CROSS-LOOP MEMORY vs AUTHOR TRUTH：** 前者是某角色主觀持有但當輪不可證的記憶；後者是故事現實為真但任何角色 in-loop 都無法證明的事實。同一事件在不同輪次可能落不同標籤（如「施工通道為攻擊地」對 R2 澪是 cross-loop memory，對作者層是 author truth，對 R3 法院是當輪物證鏈）。
3. **SEALED→public：** 終局（ch25–28）後，大量封存證據經法院/患者程序/公開審理解封，但「公開≠全世界相信同一版本」（Witness fragments 為 opt-in，不壓成單一版本）。
4. **不得過度宣稱：** 訊號意圖、白光物理原因、七十年窗口皆為 probable／not proven；角色與敘事不得宣稱已解（§7.5、§5）。
