# Bible 5 — Clue／Foreshadowing Map（伏筆／線索地圖）

> **Story:** 《神鏡七日》(theSeventhMirror)
> **Phase:** 2 → 3 正式版
> **來源權威：** `docs/chapter_*_plan.md`（ch1–28）、`docs/00_high_level_plan_final.md`、`final-polish/gate2_fairness_audit.md`、`final-polish/canon_decisions.md`（D1–D8）。
> **與 Gate 2 的關係：** Gate 2 已驗證 10 條 endgame mechanism 的首現章與公平性（9 PASS / 1 FAIL）。本檔以其為種子，補入「表層誤導→中段回收→終局回收」的完整鏈條，並標注 Gate 2 未覆蓋的風險。
> **用語：** 繁體中文；系統術語保留英文（如 `TOKYO-7`、`KAGAMI-01`、`M-00`、`Subject Continuity Bay`）。
> **縮寫：** R1=第一輪(ch1–4)、R2=第二輪(ch5–16)、R3=第三輪(ch17–28)。

---

## 目錄

1. [電車謎案（千田之死）](#1-電車謎案千田之死)
2. [琴音（Kotone 的破綻與真正角色）](#2-琴音kotone-的破綻與真正角色)
3. [悠真／G07](#3-悠真g07)
4. [母親／M-00](#4-母親m-00)
5. [TOKYO／七秒](#5-tokyo七秒)
6. [R1–R5（五條版本根）](#6-r1r5五條版本根)
7. [Continuity（治理／Subject Bay）](#7-continuity治理subject-bay)
8. [Witness（見證路徑碎片）](#8-witness見證路徑碎片)
9. [收音機／七十年](#9-收音機七十年)
10. [種子→回收鏈缺口與公平風險（待 Phase 5 處理）](#10-種子回收鏈缺口與公平風險待-phase-5-處理)

---

## 1. 電車謎案（千田之死）

### C1.1　千田上車時一直按著外套內側／肋下

```
SEED CHAPTER          ch2（Scene 1–2，千田第一印象：手按外套內側、不站起來、說話前吸氣忍痛）
ORDINARY EXPLANATION  緊張、胃痛、中年男人身體不適
SECONDARY PAYOFF      ch5–6 澪提前抵達車站，追進施工通道發現血跡；ch6「死亡地點不等於攻擊地點」命題成立
FINAL PAYOFF          ch22–23 琴音被確認為 21:04 施工通道的維修服攻擊者；千田上車前已被刺傷
MISDIRECTION RISK     公平。讀者第一次只會覺得千田是可疑的疲憊中年人；傷勢線索（臉色灰白、消毒味、座位血痕起點低）分布於 ch2–3 多個獨立感官，可被重讀驗證
```

### C1.2　血從座位下方／外套內側滲出＋白色膠布一瞥

```
SEED CHAPTER          ch2（座位邊緣暗色濕痕）／ch3 Scene 2（救護剪開外套，澪瞥見內側早有膠布、血浸痕）
ORDINARY EXPLANATION  倒下後才流血；膠布是救護混亂中的一瞥
SECONDARY PAYOFF      ch4 澪把「血不是從他倒下後才出現的」列為三大矛盾之一；ch6 施工通道血跡對照
FINAL PAYOFF          ch22–23 攻擊發生於上車前；止血貼失效才在車內致命
MISDIRECTION RISK     公平。ch3 明確給出「座位血痕起點比她以為的位置更低」的客觀線索，不靠事後解說
```

### C1.3　銀色外殼破邊＋金色接點（非真凶器）

```
SEED CHAPTER          ch2（外殼交付）／ch3 Scene 1（澪放下外殼時短暫看見破邊、金色接點、撬開缺口）
ORDINARY EXPLANATION  金屬尖銳物＝凶器；證物袋初始標籤寫「刃物狀金屬片」
SECONDARY PAYOFF      ch4 澪推理「外殼不像刀，裡面有金色接點」；ch13–15 離線設定載體形制與外殼高度相似
FINAL PAYOFF          ch22 銀色原始簽署載體（具唯一硬體 attestation）；ch28 千田以活人身分拆解外殼
MISDIRECTION RISK     公平且刻意。監視器、廣播、證物袋、控制中心全部先把外殼判讀成尖銳物——這是「第一個被制度相信的版本錯了」的主題示範，不是作者作弊
```

### C1.4　血下露出「T」和像「7」的痕跡

```
SEED CHAPTER          ch3 Scene 1（澪放下外殼時看見血下面一個像 T 和 7 的痕跡）
ORDINARY EXPLANATION  意義不明的刮痕
SECONDARY PAYOFF      ch13–15 澪查到 TKS-SYNC／07、TOKYO-7 維護別名；外殼形制與離線設定載體吻合
FINAL PAYOFF          ch16「東京不指涉地名」；TOKYO-7 為最終同步方案
MISDIRECTION RISK     公平。讀者在 ch3 無法解碼，但痕跡被明確記下；ch4 澪把它列為記憶線索之一
```

### C1.5　監視器「十來秒」時間碼錯位（後量化為 11 秒／+7000ms）

```
SEED CHAPTER          ch2 Scene 4（防災同步測試造成時間碼錯位，只寫「十來秒」）
ORDINARY EXPLANATION  設備故障、同步測試的背景雜訊
SECONDARY PAYOFF      ch3 控制中心壓縮流缺「交付片段」；ch4 澪追查車載原始檔；ch13–15 +7000ms 配置指紋浮現
FINAL PAYOFF          ch21 ECHO PEAK／7000ms／FANOUT GATEWAY 技術骨架命名；ch27 官方 app +7000ms 唯一中央 fanout 在 pre-fanout sequencing gateway 被精確取消（06:12:53）
MISDIRECTION RISK     公平（Gate 2 M7 PASS，首現 ch4）。注意 ch2 不寫「11 秒」、ch21 才出現技術名、ch27 才出現 06:12:53 精確時間戳——三段式延遲是刻意安排的公平遞進
```

### C1.6　澪袖口沒有噴濺血

```
SEED CHAPTER          ch2–3（澪急救後雙手沾血，但袖口無噴濺型態）
ORDINARY EXPLANATION  急救時未注意的細節
SECONDARY PAYOFF      ch4 澪推理「血跡不能直接等於攻擊」
FINAL PAYOFF          血跡分布反證急救而非刺殺；第三輪法律處理只建立在當輪可證行為上
MISDIRECTION RISK     公平。這是一條「沉默的在場證據」，從未被作者高調點名，但客觀存在於現場採樣紀錄
```

### C1.7　千田殘缺台詞「不是這裡⋯⋯」「別先看畫面。血比較老實。」

```
SEED CHAPTER          ch2 Scene 5（千田失血狀態下的殘缺提示）
ORDINARY EXPLANATION  失血亂語、臨終囈語
SECONDARY PAYOFF      ch5–6 澪改變問題：「千田為什麼帶著傷上車？」；ch6 施工通道血跡
FINAL PAYOFF          攻擊地點（施工通道）≠死亡地點（第七車）；「血比較老實」＝影像可被整理，血跡方向才是真相
MISDIRECTION RISK     公平。千田確實在說，但被防災測試、失血、疼痛打斷——這解決了「他為何不直接說上車前被刺」的合理性
```

### C1.8　「不要在警局打開。」

```
SEED CHAPTER          ch2 Scene 4（千田交出外殼時的唯一一句）
ORDINARY EXPLANATION  警局不安全、吹哨者的偏執
SECONDARY PAYOFF      ch4 澪查公開資料受阻、日下部警告「公開入口只會留下妳查過的紀錄」
FINAL PAYOFF          官方系統有國安標記，資料進入流程會被神鏡計畫攔截／改寫；呼應「畫面會被剪成只剩一種真相」
MISDIRECTION RISK     公平。前期像偏執警告，後期被制度行為逐一證實
```

### C1.9　千田「那件東西。背面給我看。」（不說「鏡子」）

```
SEED CHAPTER          ch2 Scene 2（D5 鎖定：千田全程被監控，只說「那件東西」）
ORDINARY EXPLANATION  神秘、謹慎的吹哨者用語
SECONDARY PAYOFF      ch3 匿名訊息只寫「悠真留下的那件東西」，警方無法立刻鎖定小鏡子；ch12 鏡背 G07／12
FINAL PAYOFF          ch12 悠真受試者編號 G07／12 刻於鏡背；小鏡子是悠真刻意留給澪的驗證物
MISDIRECTION RISK     公平（D5 鎖定）。刻意不讓車廂對話暴露物件類型，保住 Task 1 公平性——匿名訊息的物件不可被讀者或警方從對話推斷
```

### C1.10　千田「那封『想冷靜幾天』不是他打的。」

```
SEED CHAPTER          ch2 Scene 2（第一句硬線索）
ORDINARY EXPLANATION  悠真失蹤案的新方向、陌生男子的片面之詞
SECONDARY PAYOFF      ch4 警方把悠真案與千田案切開；澪必須自己連線
FINAL PAYOFF          警方被偽造／壓力下發出的誤導資料導向「自願離家」；神鏡計畫事前餵給警方的誤導資料鏈
MISDIRECTION RISK     公平。讀者與澪同時獲得這條線索，沒有資訊落差
```

### C1.11　車站施工通道監視器維修

```
SEED CHAPTER          ch1–4（背景資訊：第七車靠近維修通道連接口；夜間通訊維修窗口）
ORDINARY EXPLANATION  普通的車站維修背景
SECONDARY PAYOFF      ch5–6 澪追進施工通道、發現血跡與維修建築痕跡
FINAL PAYOFF          ch23 琴音穿維修外套、帽子、口罩，於施工通道燈光死角刺傷千田；神鏡方透過支援線提供交通資料與臨時權限
MISDIRECTION RISK     公平。施工通道在 ch1–4 只是地理細節，沒有被作者過度強調；ch5–6 才讓它進入推理
```

### C1.12　琴音 21:19 已讀未回（跨域：亦見 §2）

```
SEED CHAPTER          ch1（澪傳安全訊息）／ch2 Scene 4（手機短暫顯示「琴音：已讀。21:19」）
ORDINARY EXPLANATION  朋友太晚回覆、手機沒電
SECONDARY PAYOFF      ch4 琴音事後問「悠真留給妳的東西還在嗎」——重讀會痛
FINAL PAYOFF          ch23 21:19 琴音正在灣岸線施工通道附近／剛離開；她知道澪會上車卻無法或不願阻止
MISDIRECTION RISK     公平但極輕。D4 鎖定方向為「琴音 ignored 澪」；ch2–3 只一閃而過，不讓澪當場深究
```

---

## 2. 琴音（Kotone 的破綻與真正角色）

### C2.1　琴音 21:19 已讀未回

```
（與 C1.12 同一條；此處聚焦琴音角色弧）
SEED CHAPTER          ch1–2
ORDINARY EXPLANATION  朋友太累睡著、手機靜音（ch4 琴音事後如此解釋）
SECONDARY PAYOFF      ch4 琴音問「悠真留給妳的東西還在嗎」——她知道那物件在會面中有作用
FINAL PAYOFF          ch23 琴音為第三輪 21:04 維修服人物；21:19 她正在行動現場或剛離開
MISDIRECTION RISK     公平。D4 鎖定為「琴音 ignored 澪」。風險在於 ch6 prose 曾反向（澪 ignored 琴音）——canon_decisions A 級修正已要求 ch6 act8 對齊 ch5
```

### C2.2　琴音固定不點同一款飲料（改喝綠茶）

```
SEED CHAPTER          ch1 Scene 3（琴音平常喝黑罐咖啡，這天改喝綠茶，說胃不舒服）
ORDINARY EXPLANATION  胃不舒服、壓力習慣、味覺小怪癖
SECONDARY PAYOFF      ch7–8 琴音行為破綻升級（醫院名、「那些東西」）
FINAL PAYOFF          ch23 低強度循環熟悉感的無意識確認儀式；琴音本人不知道行為來源，不能出現「上一輪／這一輪／測試」字眼
MISDIRECTION RISK     公平（§7.2 去循環測試化）。極淡，只到「重讀時才刺眼」的程度
```

### C2.3　琴音看到「關東青少年睡眠支援計畫」名稱時停頓

```
SEED CHAPTER          ch1 Scene 3
ORDINARY EXPLANATION  擔心澪、對失蹤案的敏感反應
SECONDARY PAYOFF      ch7–8 琴音資訊破綻
FINAL PAYOFF          ch23 她知道受試者相關資訊（妹妹美空為 G07／03）
MISDIRECTION RISK     公平。極微弱，不破壞前期安全港形象
```

### C2.4　琴音固定探視／醫院來電（不說妹妹姓名）

```
SEED CHAPTER          ch1 act4（「妹妹那邊的探視，順路」）／ch4 act3（第二次，確立為反覆 canon 節拍）
ORDINARY EXPLANATION  朋友固定去探視住院家人
SECONDARY PAYOFF      ch11 藤川美空「回來但未醒」案例浮現（ch10 預告被 D8 順延至此）
FINAL PAYOFF          ch22 琴音為美空（G07／03）的姊姊；同母異父姊妹關係；ch23 琴音取走銀色卡匣安裝於美空床側
MISDIRECTION RISK     公平。ch1／ch4 只說「妹妹那邊的探視」不點名，ch22 才正式連結
```

### C2.5　琴音失言「灣岸中央」（醫院名）

```
SEED CHAPTER          ch7 Scene 4（23:50–00:15，琴音失言說出搬送醫院名）
ORDINARY EXPLANATION  猜測常見急救搬送醫院、「那附近通常送那裡」
SECONDARY PAYOFF      ch8「那些東西」進一步破綻；ch9 澪想起「灣岸中央」與「那些東西」
FINAL PAYOFF          ch23 神鏡支援線向琴音提供交通／個案資料，不是她自己的循環記憶；高權限「家屬穩定支援」角色代理
MISDIRECTION RISK     公平。ch7 已讓澪低風險查證「搬送醫院尚未公開且附近有多個可能急救點」，證明琴音不是簡單猜中
```

### C2.6　琴音前期「安全港」整體形象

```
SEED CHAPTER          ch1–8（琴音帶食物、整理時間線、陪澪逃亡、幫她查資料）
ORDINARY EXPLANATION  最可靠的朋友、讀者的安心來源
SECONDARY PAYOFF      ch7–8 安全港第一次裂開（醫院名、「那些東西」）
FINAL PAYOFF          ch22–23 琴音為千田死亡事件的直接加害者；核心矛盾：「她真的愛澪，也真的犯下不可原諒的事」
MISDIRECTION RISK     公平且是全書最重要的誤導。破綻從 ch1 即開始埋（極淡），逐步升級，不是突然黑化（§16 原則 6）
```

---

## 3. 悠真／G07

### C3.1　小鏡子背面刮痕

```
SEED CHAPTER          ch1 Scene 1（便宜扭蛋鏡，背面像被鑰匙磨過；悠真送的姐弟物件）
ORDINARY EXPLANATION  姐弟紀念品、便宜玩具的磨損
SECONDARY PAYOFF      ch2 千田只看背面即確認澪身份；ch3 小鏡子因「那件東西」用語未被扣押
FINAL PAYOFF          ch12 鏡背 G07／12 受試者編號（與美空藥盒刻痕同類人為標記）；悠真選擇了較難被系統清除的載體
MISDIRECTION RISK     公平。ch1 鏡子先是情感物（「妳每次都看別人哪裡不對，偶爾也看看自己吧」），後期才變線索——揭露時會傷害讀者情感
```

### C3.2　悠真遊戲帳號裡的座標

```
SEED CHAPTER          ch1（背景筆記，未分析）
ORDINARY EXPLANATION  少年的遊戲紀錄
SECONDARY PAYOFF      ch9–10 澪登入遊戲帳號，座標指向筑波
FINAL PAYOFF          ch17 澪在公共道路上拍下 G07／12 搬送車駛入筑波訪客地圖未標示的地下服務路線
MISDIRECTION RISK     公平。ch1 不分析、不出座標數值，只提有錄音
```

### C3.3　悠真夢見黑色海／倒月與七條線

```
SEED CHAPTER          ch1 Scene 1（澪的黑色海夢境）／悠真學校筆記本反覆畫出的「黑色海」
ORDINARY EXPLANATION  少年壓力或惡夢
SECONDARY PAYOFF      ch9–11 第七曙光家屬互助圈；多名失蹤孩子共同夢見黑色海、畫過倒月與七條線；ch12 共同後台
FINAL PAYOFF          ch20 黑色海是外星訊號在接收者夢中的形象——更精確地，是紗英的大腦替人類建立的翻譯層
MISDIRECTION RISK     公平。夢境在 ch1 只像壓力反應；ch9–11 擴大為集體現象；ch20 才給出終局解讀。注意 §7.5：訊號意圖始終未知，黑色海是「翻譯層」不是「訊號原貌」
```

### C3.4　悠真夢話錄音中的奇怪節奏

```
SEED CHAPTER          ch1（只提有錄音，不分析）
ORDINARY EXPLANATION  少年的睡眠錄音
SECONDARY PAYOFF      ch9–11 第七曙光播放孩子夢話錄音；拼湊孩子夢中真相
FINAL PAYOFF          訊號在接收者夢中的節拍結構；ch20 函館暴露者只留下分散元素，M-00 投入後才有標準化版本
MISDIRECTION RISK     公平。ch1 明確標示「可暫時只提有錄音，不分析」
```

### C3.5　悠真沒帶走備用眼鏡／充電器／零用錢

```
SEED CHAPTER          ch1 Scene 2（澪反駁警方「自願離家」的細節清單）
ORDINARY EXPLANATION  反駁自願離家的生活矛盾
SECONDARY PAYOFF      ch2 千田「那封訊息不是他打的」呼應
FINAL PAYOFF          悠真不是普通離家；被誘導前往研究中心相關地點
MISDIRECTION RISK     公平。這是澪的調查能力展示，不是超自然線索
```

### C3.6　關東青少年睡眠支援計畫（研究外皮）

```
SEED CHAPTER          ch1 Scene 4（說明單、預約提醒、月牙／睡眠波形淡藍色標誌）
ORDINARY EXPLANATION  學校合作的睡眠與災害壓力反應研究
SECONDARY PAYOFF      ch9–12 不同名稱的研究使用相同資料條款、後台格式、管理群欄位；ch12 共同後台＋G07
FINAL PAYOFF          ch12 G07 管理群＝神鏡計畫篩選外皮；ch19 G07／12＝悠真；ch20 受試者篩選流程
MISDIRECTION RISK     公平。ch1 標誌不稱「倒月」，後期才讓讀者發現它和孩子夢裡畫的倒月很像
```

### C3.7　`G07／12` 編號（患者矩陣種子）

```
SEED CHAPTER          ch9（悠真舊截圖第二階段預約頁頁尾，Task 5／Task 8 前置補丁）→ ch12 act1 完全建立
ORDINARY EXPLANATION  文件欄位、管理碼
SECONDARY PAYOFF      ch12 共同後台、G07 管理群、06:13 系統事件；千田雇主 TKS 在公司層交會
FINAL PAYOFF          ch19 G07／12 正式客觀確認為朝倉悠真；ch22 patient matrix（TOTAL HUMAN RECORDS）；ch26 規範化 IDs（G07／05、LEGACY／02／04、ACTIVE／C／D）
MISDIRECTION RISK     公平（Gate 2 M5 PASS，首現 ch12）。ch22 才建立分類框架，ch24 才有 KAGAMI-SAFE／R5 版本，ch26 的 canonical IDs 是 payoff 而非 introduction
```

### C3.8　悠真故意把交通卡借給朋友

```
SEED CHAPTER          高層企劃 §9 角色設定（讓研究中心追蹤錯人一天）
ORDINARY EXPLANATION  少年日常
SECONDARY PAYOFF      （顯示悠真比澪更早察覺研究中心不對勁）
FINAL PAYOFF          悠真不是單純等待被救的人；他失蹤前主動留下多組線索
MISDIRECTION RISK     ⚠️ 潛在風險（見 §10 R4）：高層企劃列為悠真主動線索之一，但未見明確章節歸屬，可能僅為設定層未落地 prose
```

### C3.9　藤川美空「回來但未醒」

```
SEED CHAPTER          ch11 Scene 5（藤川真理引出美空案例 Case C；ch10 預告被 D8 順延至此）
ORDINARY EXPLANATION  不明醫療個案、另一名失蹤者
SECONDARY PAYOFF      ch11–12 美空藥盒刻痕與悠真鏡背同類；ch12 G07 共同後台
FINAL PAYOFF          ch22 G07／03＝藤川美空當輪正式確認；琴音為其姊姊；ch27 美空在 COMPARE 出現 drift → SAFE PAUSE
MISDIRECTION RISK     公平（D8 鎖定：ch10 移除琴音實體現身，避免提前十餘章預告姊妹連結）
```

### C3.10　悠真對收音機靜電聲的日常反應（跨域：亦見 §9）

```
SEED CHAPTER          ch1 act2（悠真側頭聽接收器靜電）
ORDINARY EXPLANATION  少年對舊收音機靜電的怪習慣，他自己也說不上來
SECONDARY PAYOFF      ch9 錄音清單裡悠真常錄這種聲音當睡眠背景
FINAL PAYOFF          悠真作為 G07 受試者對訊號的反應
MISDIRECTION RISK     公平（Task 8 低強度種子）
```

---

## 4. 母親／M-00

### C4.1　母親病歷缺頁

```
SEED CHAPTER          高層企劃 §12（設定層線索；待確認 prose 落地章節）
ORDINARY EXPLANATION  醫院疏失、檔案管理混亂
SECONDARY PAYOFF      ch19 日下部查證：同名、同生日的同一人已於十年前被官方登記死亡
FINAL PAYOFF          ch20 病歷被改，紗英從未真正死亡；她是第一代穩定接收者 M-00，被維持在半昏迷狀態
MISDIRECTION RISK     ⚠️ 潛在風險（見 §10 R5）：高層企劃 §12 列有此條，但計畫檔中未見獨立章節明確承載「病歷缺頁」這個具體線索。需確認是否在 ch17–19 prose 中落地
```

### C4.2　母親留下的改裝短波接收器

```
SEED CHAPTER          ch1 act2（走廊舊層架角落，外殼發黃、天線用膠帶纏過——Task 8 低強度種子）
ORDINARY EXPLANATION  母親遺物、沒人要的舊物、收不到幾個台的舊收音機
SECONDARY PAYOFF      ch9「座標在唱」音序（Task 10）；悠真常錄其靜電聲
FINAL PAYOFF          ch20 紗英與訊號研究的關聯、獨立類比監測（analog monitor）血統；ch28 母親留下的 wideband receiver 與其他台站共同接收新信號
MISDIRECTION RISK     公平（Gate 2 M10 PASS，首現 ch1）。ch1 不連結外星／M-00／七十年窗口，只作生活細節
```

### C4.3　紗英腦波／睡眠研究入門書

```
SEED CHAPTER          ch1 act2（舊層架上《腦波與睡眠研究入門》，書背脫膠）
ORDINARY EXPLANATION  母親生前的專業書
SECONDARY PAYOFF      ch17–19 研究中心刺激即時校準參照 M-00
FINAL PAYOFF          ch20 紗英的睡眠／腦波研究背景；M-00（Mother Reference）來源——第一份可供後續模型引用的穩定基準
MISDIRECTION RISK     公平（Task 8 低強度種子）
```

### C4.4　北海道研究會照片

```
SEED CHAPTER          ch1 act2（舊層架上褪色合照，母親只說「很早以前的工作」）
ORDINARY EXPLANATION  母親早年工作合照
SECONDARY PAYOFF      ch20 函館夜潮事件——北海道舊天文台
FINAL PAYOFF          ch20 紗英早年研究會；訊號觀測血統；函館近郊改作天文／通訊監測用途的舊觀測站留下第一份完整原始訊號紀錄
MISDIRECTION RISK     公平（Task 8 低強度種子）
```

### C4.5　「夢要先寫日期」家庭習慣

```
SEED CHAPTER          ch1 act1（醒來後寫夢的小筆記本，母親定的家規）
ORDINARY EXPLANATION  母親家規：夢忘得快，先寫日期才分得清是哪一晚
SECONDARY PAYOFF      ch9–11 夢境紀錄與訊號的關聯浮現
FINAL PAYOFF          夢的日期線索；紗英作為長期接收者的紀錄紀律
MISDIRECTION RISK     ⚠️ 弱鏈（見 §10 R6）：種子在 ch1 明確，但中段與終局的「日期」回收較為擴散，沒有單一尖銳 payoff 時刻。不構成不公平，但回收感較弱
```

### C4.6　朝倉紗英官方紀錄已病逝

```
SEED CHAPTER          ch1 Scene 1／§0.3（母親在官方紀錄中已病逝）
ORDINARY EXPLANATION  澪的母親多年前病逝
SECONDARY PAYOFF      ch19 澪隔著緊急觀察窗看見母親仍在呼吸；M-00 房間；緊急醫療身分模組顯示「朝倉紗英」
FINAL PAYOFF          ch20 第一代穩定接收者 M-00；「母體」源自 Mother Reference；被維持在半昏迷狀態十年
MISDIRECTION RISK     公平（Gate 2 M1 PASS，首現 ch19）。讀者在 ch19 才正式遇見「紗英未死」，前期所有「母親病逝」皆為誤導，但 ch1 的遺物種子（接收器、研究書、照片）已鋪墊
```

### C4.7　澪反覆夢見自己在鏡島

```
SEED CHAPTER          高層企劃 §12（設定層；ch4 黑色海／白光夢境強化）
ORDINARY EXPLANATION  創傷夢境
SECONDARY PAYOFF      ch16 R2 白光；ch17–20 鏡島為 TOKYO-7 參考部署點
FINAL PAYOFF          ch21–22 R4 回聲——來自一條可能未來的澪送回的破碎回聲（R4／AUTHOR／MIO）
MISDIRECTION RISK     公平。夢境是 R4 託管回聲的感性外顯，不是穩定預言
```

### C4.8　紗英跨輪回應／短暫清醒

```
SEED CHAPTER          ch20（紗英在低負荷盲測中辨認資訊；沿用既有低負荷發聲閥程序）
ORDINARY EXPLANATION  植物人狀態的偶然反應
SECONDARY PAYOFF      ch21 紗英主動輸出 R4／AUTHOR／MIO；託管回聲承接者
FINAL PAYOFF          ch28 紗英脫離系統後出現一段原因未能單獨證明的短暫清醒，問「第八天了嗎」；澪說「已經快一個月了」，她答「那就別再數了」
MISDIRECTION RISK     公平。紗英保存大量 fragments 但不等於全知；她是 R4 回聲的託管者，不是全知敘述者
```

---

## 5. TOKYO／七秒

### C5.1　「不要救東京」遺言

```
SEED CHAPTER          ch2 Scene 5（千田最終遺言）
ORDINARY EXPLANATION  恐怖宣言、東京即將被毀滅、千田是瘋子
SECONDARY PAYOFF      ch4 澪暫以為與災害警報／恐攻有關；ch13–16 澪沿 TOKYO-7 追查千田生前工作
FINAL PAYOFF          ch16「東京不指涉地名」——東京為最終同步方案名稱；ch27 鏡島終局；ch28 TOKYO-7 lease 到期未執行
MISDIRECTION RISK     公平且是全書最大前期誤導（§13）。讀者與澪同步被誤導；ch16 才翻轉，ch13–15 鋪設了 TKS-SYNC／07 的技術鏈
```

### C5.2　「他們會說那是救援。」

```
SEED CHAPTER          ch2 Scene 5（緊接遺言前一句）
ORDINARY EXPLANATION  意義不明的臨終囈語
SECONDARY PAYOFF      ch4 澪連結兩句；ch13–16 災害警報同步系統
FINAL PAYOFF          東京方案以「災害警報演習／救援」之名進行大規模訊號同步；手機、電視、警報只是同步工具
MISDIRECTION RISK     公平。前期完全不可解，後期被精準回收
```

### C5.3　7 秒延遲（防災／交通同步推送晚約 7 秒）

```
SEED CHAPTER          ch1 Scene 5（月台廣播先響，澪手機隔幾秒才跳出通知）
ORDINARY EXPLANATION  系統延遲、網路 lag、推送延遲——教科書級 fair-play seed
SECONDARY PAYOFF      ch2–4 每次防災同步測試重現；ch4 白光前最後一次；ch4 澪把它列為記憶線索
FINAL PAYOFF          ch21 ECHO PEAK／7000ms／FANOUT GATEWAY 技術骨架命名（T11）；ch27 官方 app +7000ms 唯一中央 fanout 在 06:12:53 pre-fanout sequencing gateway 被精確取消
MISDIRECTION RISK     公平（Gate 2 M7 PASS，首現 ch4）。三段式延遲：ch4 現象 → ch21 技術名 → ch27 精確時間戳
```

### C5.4　防災同步測試越來越頻繁

```
SEED CHAPTER          ch1–4（城市背景資訊）
ORDINARY EXPLANATION  例行的城市防災測試
SECONDARY PAYOFF      ch13–16 TKS-SYNC 離線設定；ch15 BCP CUTOVER 23:50
FINAL PAYOFF          ch15–16 東京方案前置測試；ch21 BCP/MAR-CONT chain；ch27 終局時鐘
MISDIRECTION RISK     公平。背景資訊逐步升級為陰謀基礎設施
```

### C5.5　銀色外殼血下「T」與「7」（同 C1.4）

```
SEED CHAPTER          ch3 Scene 1
ORDINARY EXPLANATION  意義不明的刮痕
SECONDARY PAYOFF      ch13–15 TKS-SYNC／07；TOKYO-7 維護別名
FINAL PAYOFF          ch16 東京方案
MISDIRECTION RISK     公平（見 C1.4）
```

### C5.6　千田舊講座／災害警報同步介面

```
SEED CHAPTER          ch4 Scene 5（舊網頁快取、技術講座名單殘留）
ORDINARY EXPLANATION  工程師的普通技術背景
SECONDARY PAYOFF      ch13–15 千田雇主 TKS；TKS-SYNC 離線設定載體形制與第一輪外殼高度相似
FINAL PAYOFF          ch16 東京方案使用同步機制；ch22 千田具備操作離線復舊載體的職務能力
MISDIRECTION RISK     公平。ch4 只得到模糊連線：「千田、災害警報、灣岸新交通、防災同步測試、悠真的睡眠研究，可能不是巧合」
```

### C5.7　7-CAM／T-? 標籤

```
SEED CHAPTER          ch4 Scene 4（有明車輛基地外遠遠看到封存箱／維修標籤）
ORDINARY EXPLANATION  第七車攝影機或封存箱代碼
SECONDARY PAYOFF      ch13–15 TOKYO-7 維護別名
FINAL PAYOFF          ch16 東京方案
MISDIRECTION RISK     公平。ch4 澪無法確認完整代碼，只看到部分
```

### C5.8　東京灣白光（無聲、無熱、無衝擊波）

```
SEED CHAPTER          ch4 Scene 8（首次白光）
ORDINARY EXPLANATION  神秘災難、爆炸、恐攻、外星攻擊
SECONDARY PAYOFF      ch16 R2 白光（不是簡單失敗重複）
FINAL PAYOFF          ch27 白光仍於 06:13 出現，但 protective filter 降低高相干耦合，不消除物理白光及低強度 sensory echo；ch28 白光事後報告
MISDIRECTION RISK     公平（§13 誤導二）。白光是訊號放大／回送現象，不是破壞城市的爆炸
```

### C5.9　黑色海夢境（同 C3.3）

```
SEED CHAPTER          ch1 Scene 1
ORDINARY EXPLANATION  壓力惡夢
SECONDARY PAYOFF      ch9–11 集體夢境；ch12 共同後台
FINAL PAYOFF          ch20 外星訊號在接收者夢中的形象；紗英的大腦替人類建立的翻譯層
MISDIRECTION RISK     公平（見 C3.3）
```

### C5.10　倒月與七條線／睡眠標誌像月牙

```
SEED CHAPTER          ch1 Scene 4（宣傳單角落像月牙、又像睡眠波形的淡藍色標誌）
ORDINARY EXPLANATION  普通 LOGO
SECONDARY PAYOFF      ch9–11 孩子畫作中的倒月與七條線
FINAL PAYOFF          ch20 函館暴露者的分散元素之一（七次亮脈衝）；M-00 投入後才有標準化版本
MISDIRECTION RISK     公平。ch1 標誌不稱「倒月」
```

### C5.11　星期一 6:13（循環錨點）

```
SEED CHAPTER          ch1 Scene 1（澪醒來時間）
ORDINARY EXPLANATION  澪的起床時間
SECONDARY PAYOFF      ch4 章末澪醒回 6:13，循環錨點確認
FINAL PAYOFF          ch27 06:13:00 ECHO PEAK／WHITE LIGHT；ch28 06:13:01 循環結果確認——澪沒有醒回上週一
MISDIRECTION RISK     公平。6:13 貫穿全書作為「7」符號系統的一環
```

---

## 6. R1–R5（五條版本根）

### C6.1　KAGAMI／執行錨點（K-01）

```
SEED CHAPTER          ch20 act2（T13 種子；KAGAMI／執行錨點／K-01）
ORDINARY EXPLANATION  系統術語，讀者此時尚不理解
SECONDARY PAYOFF      ch21 act2 COMMIT-GATE 銜接；離線原始簽署載體
FINAL PAYOFF          ch26–27 KAGAMI-01 不簽 execution anchor；TOKYO-7 consensus／public branch 保持 HOLD；execution anchor 從未簽發
MISDIRECTION RISK     公平（Gate 2 M2 PASS，首現 ch20）。ch26／27 是執行而非引入
```

### C6.2　父親 `KAGAMI-SAFE／R1` 規定

```
SEED CHAPTER          ch21（紗英託管回聲中的 R1 原則）
ORDINARY EXPLANATION  父親（朝倉刑警）留下的早期安全規範
SECONDARY PAYOFF      ch22 R4 約束式重建的約束之一
FINAL PAYOFF          R1 內容：M-00 醫療與訊號校準必須分離；所有活動接收者完成安全切離前不得硬切；不得以新接收者永久替代舊接收者；無法安全切離時不得啟動 TOKYO
MISDIRECTION RISK     公平。父親的舊案線從 ch1（日下部看鏡子停頓、「妳父親以前也以為查清楚就夠了」）即鋪設
```

### C6.3　千田 `R2` 補上 KAGAMI-01／COMMIT-GATE

```
SEED CHAPTER          ch21（千田的 R2 補充）
ORDINARY EXPLANATION  千田生前參與的技術規範
SECONDARY PAYOFF      ch22 缺失原始簽署載體
FINAL PAYOFF          R2 內容：KAGAMI-01、COMMIT-GATE、離線原始簽署載體、原始過濾／一致性層／公共輸出的分段切離
MISDIRECTION RISK     公平。千田的工程師背景在 ch4 已鋪設
```

### C6.4　紗英 `R3` 部分原則

```
SEED CHAPTER          ch21
ORDINARY EXPLANATION  紗英的託管原則
SECONDARY PAYOFF      ch22 R4 重建的約束
FINAL PAYOFF          R3：完整 R4 套件不得透過額外託管回聲送回；現在的澪只應收到足以重新審判方案的安全錨點
MISDIRECTION RISK     公平。與 §7.4「R4 為可能未來，非已發生隱藏第四輪」一致
```

### C6.5　R4（failure-mode 可能未來）

```
SEED CHAPTER          ch21（紗英輸出 R4／AUTHOR／MIO）
ORDINARY EXPLANATION  一個被送回的「未來澪的決定」
SECONDARY PAYOFF      ch22 約束式重建；方案家族比較；四個紅區下限（含紗英與美空）
FINAL PAYOFF          ch22 R4 標記為 NOT PRE-AUTHORIZED／FAILURE-MODE ONLY；現在的澪拒絕預先授權 R4 是時間線偏離那條失敗未來的關鍵
MISDIRECTION RISK     公平（§7.4 重框）。R4 不是已發生的隱藏第四輪，而是一條由當前第三輪延伸、在下一個星期一 06:13 前完成的可能未來
```

### C6.6　`KAGAMI-SAFE／R5`

```
SEED CHAPTER          ch12（patient matrix 種子）→ ch22（分類框架）→ ch24 act1（R5 版本）
ORDINARY EXPLANATION  系統版本規範
SECONDARY PAYOFF      ch24 無中央動態 Mother Reference 的目標架構與過渡規格；患者綁定本地臨床根；Domain-P／Domain-C 雙安全域
FINAL PAYOFF          ch26 R5 分散式明確否決；ch27 患者各自 stage ceiling；不靠單一中央動態母體完成過渡
MISDIRECTION RISK     公平（Gate 2 M5 PASS）。ch24 的 R5 設計目標不含中央母體，但當輪所有人仍須走完離開母體的過渡——誠實定義，不假裝已完全脫離
```

### C6.7　凪原反覆說「穩定」

```
SEED CHAPTER          ch20（凪原正式登場，反覆強調穩定、備援、不能斷開）
ORDINARY EXPLANATION  科學家冷血、技術官僚的保守修辭
SECONDARY PAYOFF      ch20 兩種「不能斷開」的嚴格拆分（醫療事實 vs 凪原主張的公共風險）
FINAL PAYOFF          她把人類自由視為風險；她的極端立場有真實基礎（函館夜潮恐懼），但選擇仍不可原諒
MISDIRECTION RISK     公平（§16 原則 5）。凪原不是為權力而邪惡，而是因恐懼而變得殘酷
```

### C6.8　悠真回憶 G07 孩子觀看同一危機的多個結局

```
SEED CHAPTER          ch21（悠真回憶：「星期一，大家會收到同一個版本。」）
ORDINARY EXPLANATION  受試者的混淆記憶
SECONDARY PAYOFF      ch22 方案家族比較
FINAL PAYOFF          TOKYO-7 同步的本質——讓大量人口在同一瞬間置於同一組聲音與圖像之下
MISDIRECTION RISK     公平。悠真是未來 fragments，不是穩定預言者
```

---

## 7. Continuity（治理／Subject Bay）

### C7.1　MAR-CONT／23:50 BCP CUTOVER

```
SEED CHAPTER          ch15 act4（T12 種子：BCP CUTOVER 23:50／PREPOSITION WINDOW 23:50–05:50／MAR-CONT PROTECTIVE TRANSFER CLASS）
ORDINARY EXPLANATION  災害復舊的業務持續營運計畫術語
SECONDARY PAYOFF      ch21 act5、ch24 act8、ch25 強化
FINAL PAYOFF          ch26 執行 ch15／21／24 的 cutoff；CONTINUITY CUTOVER／LEASE 時間點
MISDIRECTION RISK     公平（Gate 2 M6 PASS，首現 ch15）。注意 ch7 act4 的 23:50 是無關的急診室環境時間戳，非 BCP 機制
```

### C7.2　CONTINUITY HSM／七個離線區域 HSM

```
SEED CHAPTER          ch24 act7／act8（T13／T16 種子：CONTINUITY HSM＋七個離線區域 HSM）
ORDINARY EXPLANATION  硬體安全模組的容錯設計
SECONDARY PAYOFF      ch25 act4 trust domain＋5 個區域網域（T16）
FINAL PAYOFF          ch26 操作 ch24／25 的 auth chain；授權膠囊／trust domains 的實體基礎
MISDIRECTION RISK     公平（Gate 2 M9 PASS，首現 ch24）。注意：字面術語「授權膠囊／capsule」不出現於 prose，機制完全由 HSM＋trust-domain 承載
```

### C7.3　Subject Continuity Bay／clinical latch

```
SEED CHAPTER          ch26 act2／act3（❌ Gate 2 M8 FAIL——首現於 ch26）
ORDINARY EXPLANATION  （ch26 才出現，前期無 ordinary explanation 可言）
SECONDARY PAYOFF      CLINICAL HOLD 作為 COMMIT-GATE 狀態欄位（ch21 act3）是部分緩解，但屬「誰授權」而非「實體在哪」
FINAL PAYOFF          ch27 physical break-glass 被三領域（medical safety／patient rights／local operations）明確拒絕；TARGET CLINICAL DEPENDENCY LATCH 無法跨越
MISDIRECTION RISK     ❌ 不公平（Gate 2 唯一 FAIL）。見 §10 R1。建議 Phase 5 在 ch24／25 補一行低強度 back-seed（如日下部或獨立系統安全人員提及 hold 解析到一個 Subject Continuity Bay，門由 clinical latch 治理，只給狀態不給地理／IDs）
```

### C7.4　CLINICAL HOLD（COMMIT-GATE 狀態欄位）

```
SEED CHAPTER          ch21 act3（COMMIT-GATE 狀態欄位）
ORDINARY EXPLANATION  系統狀態欄位
SECONDARY PAYOFF      ch24 Clinical Safety Hold 與 Public Data-Use Hold
FINAL PAYOFF          ch27 兩者均為 HOLD；physical break-glass 的「誰授權」層
MISDIRECTION RISK     公平。屬 C7.3 的授權層親戚，不涵蓋實體層
```

### C7.5　Domain-P／Domain-C 雙安全域

```
SEED CHAPTER          ch24（銀色卡匣兩個隔離的安全域）
ORDINARY EXPLANATION  硬體安全分區設計
SECONDARY PAYOFF      ch24 Domain-P 可在鏡島重建公共授權；Domain-C 綁定美空病人專屬局部影子參照
FINAL PAYOFF          ch26–27 隔離 Domain-P、保留 Domain-C；clinical latch 的不可遠端逆轉
MISDIRECTION RISK     公平。ch24 明確建立，ch26／27 操作
```

### C7.6　CONTINUITY-0 仍可能重新建立公共授權

```
SEED CHAPTER          ch24（當輪現況：CONTINUITY-0 仍可能重新建立公共授權）
ORDINARY EXPLANATION  系統的殘留權限
SECONDARY PAYOFF      ch25 trust domains 治理
FINAL PAYOFF          ch26 old A17 lease 仍有密碼學效力卻不再適用於 S43；Route A（正式 S43 rebind）因需新 exact bundle 與 A18 science token 而失敗；ch28 CUTOVER lease 以 EXPIRED／UNEXECUTED 到期
MISDIRECTION RISK     公平。continuity 的威脅不是被一次關閉，而是被多方凍結與拒絕
```

### C7.7　凪原的函館夜潮恐懼

```
SEED CHAPTER          ch20（函館夜潮第一層揭露）
ORDINARY EXPLANATION  歷史事故背景
SECONDARY PAYOFF      ch20 訊號先污染沿岸與觀測感測資料，被組合成不存在的航跡，差點引發國際軍事誤判
FINAL PAYOFF          凪原因此相信「人類沒有準備好自由面對未來」；她的殘酷有真實基礎；ch28 凪原與 continuity 具體決策進入公開審理
MISDIRECTION RISK     公平。反派立場有真實恐懼支撐（§16 原則 5）
```

---

## 8. Witness（見證路徑碎片）

### C8.1　Witness sideband（事後標記）

```
SEED CHAPTER          ch20 act2（T13 種子：sideband／witness／事後標記）
ORDINARY EXPLANATION  系統的附帶紀錄機制
SECONDARY PAYOFF      ch25 Witness Egress 預置
FINAL PAYOFF          ch26–28 egress／audit；Patient Witness Path 只發送數位 release keys／IDs／integrity roots；SOURCE-VERIFIED 只證明來源、同意、時間與完整性，不證明主觀內容客觀正確
MISDIRECTION RISK     公平（Gate 2 M3 PASS，首現 ch20）。ch26／27／28 是 payoff
```

### C8.2　Patient Witness Path（永久分開的技術路徑）

```
SEED CHAPTER          ch20–24（技術血統建立時同步確立為獨立路徑）
ORDINARY EXPLANATION  與公共同步方案分開的紀錄通道
SECONDARY PAYOFF      ch25 append-only buffer、consent／release filter、encrypted fragment envelopes
FINAL PAYOFF          ch27 Witness fragments 為 opt-in 數位發布；公眾只透過 opt-in Public Witness Index 自願查閱；不含 raw neural stream
MISDIRECTION RISK     公平。Witness 與 TOKYO-7 unified public version 永久分開（§1.5）；結局不保證全世界相信同一版本
```

### C8.3　失踪者家屬播放孩子夢話（第七曙光）

```
SEED CHAPTER          ch9–11（第七曙光前期像邪教，播放孩子夢話錄音）
ORDINARY EXPLANATION  像邪教儀式、令人不安的秘密聚會
SECONDARY PAYOFF      ch11 揭露他們只是被制度拋棄的家屬，在拼湊孩子夢中的真相
FINAL PAYOFF          家屬的夢話紀錄成為 Witness fragments 的民間前身；ch27 opt-in 數位發布是制度化的家屬互助
MISDIRECTION RISK     公平（§13 誤導二）。從邪教外觀到家屬真相的翻轉有完整鋪墊
```

### C8.4　悠真「星期一大家會收到同一個版本」（同 C6.8）

```
SEED CHAPTER          ch21
ORDINARY EXPLANATION  受試者的混淆記憶
SECONDARY PAYOFF      ch22 方案家族
FINAL PAYOFF          Witness Path 與 TOKYO-7 public branch 的永久分離——「同一個版本」正是被拒絕的事
MISDIRECTION RISK     公平。悠真的預言被用來定義「必須拒絕的東西」
```

---

## 9. 收音機／七十年

### C9.1　短波接收器／收音機靜電

```
SEED CHAPTER          ch1 act2（T8 種子：走廊舊層架的改裝短波接收器，外殼發黃、天線用膠帶纏過）
ORDINARY EXPLANATION  母親遺物、收不到幾個台的舊收音機
SECONDARY PAYOFF      ch9 悠真常錄其靜電聲當睡眠背景
FINAL PAYOFF          ch28 母親留下的 wideband receiver 與其他台站共同接收到一輪低功率窄帶多音
MISDIRECTION RISK     公平（Gate 2 M10 PASS，首現 ch1）。ch1 不連結外星／星圖／答案
```

### C9.2　「座標在唱」音序

```
SEED CHAPTER          ch9（T10 種子：澪聽舊接收器靜電幾秒，心裡閃過「不像語音，像座標在唱」，沒追下去）
ORDINARY EXPLANATION  少年的音訊實驗、睡眠背景聲
SECONDARY PAYOFF      ch10（音序線延續）
FINAL PAYOFF          ch20 函館訊號的非地球已知系統來源；ch28 多組獨立模型解讀為 pulsar-relative map，指向約七十年後的時間／位置窗口；「不是語音。像座標在唱。」（ch28 回聲）
MISDIRECTION RISK     公平但鏈條長（ch9→ch28）。種子極低強度，符合 Task 10 規範；但讀者重讀時才會把 ch9 的閃念連到 ch28 的星圖。不算不公平，但 payoff 距離極遠
```

### C9.3　悠真對收音機靜電聲的日常反應（同 C3.10）

```
SEED CHAPTER          ch1 act2
ORDINARY EXPLANATION  少年怪習慣
SECONDARY PAYOFF      ch9 錄音
FINAL PAYOFF          G07 受試者對訊號的反應；ch28 新信號出現時悠真已 safe-detached，殘留未來碎片
MISDIRECTION RISK     公平（Task 8）
```

### C9.4　七十年窗口

```
SEED CHAPTER          ch20（函館訊號分析中浮現的時間窗口雛形）／ch23（強化）
ORDINARY EXPLANATION  訊號分析的一種解讀
SECONDARY PAYOFF      ch20 非地球已知系統來源；弱訊號方向相對星空固定
FINAL PAYOFF          ch28 CONTACT WINDOW = PROBABLE／NOT PROVEN；多組獨立模型得到「相近但非絕對」的解讀；可能是 pulsar-relative map，指向約七十年後；沒有已辨認命令，沒有把未來送回任何人的腦中
MISDIRECTION RISK     公平（§7.5 敘事紀律）。七十年是 probable／not proven，不是已證接觸；不得寫成訊號源認可／守護人類
```

### C9.5　函館夜潮／舊天文台（同 C7.7、C4.4）

```
SEED CHAPTER          ch1 act2（北海道研究會照片）→ ch20（函館夜潮完整揭露）
ORDINARY EXPLANATION  母親早年工作／歷史事故
SECONDARY PAYOFF      ch20 函館近郊改作天文／通訊監測用途的舊觀測站留下第一份完整原始訊號紀錄
FINAL PAYOFF          ch28 新信號沒有舊事件式高相干 phase、沒有 KAGAMI amplification、沒有已知 neural coupling——與函館事件本質不同；人類第一次在不被推送答案的情況下自己接收到座標
MISDIRECTION RISK     公平。函館是「被推送」的創傷，新信號是「自己接收」的希望，兩者對照明確
```

### C9.6　「收音機裡沒有倒數／必須用七十年走到的座標」

```
SEED CHAPTER          （這是終局收束句，非獨立種子）
ORDINARY EXPLANATION  ——
SECONDARY PAYOFF      ——
FINAL PAYOFF          ch28 鎖定最終句：「收音機裡沒有倒數。／只有一個必須用七十年走到的座標。／未來第一次留在前面。」——七十年不是新急迫倒數，而是人類第一次用普通時間走向的答案
MISDIRECTION RISK     公平。此句回收了 ch1 的接收器、ch9 的「座標在唱」、ch20 的七十年窗口，全部有前期種子
```

---

## 10. 種子→回收鏈缺口與公平風險（待 Phase 5 處理）

> 以下為本檔在比對 Gate 2 審計與各章計畫後，發現的額外缺口或弱鏈。**僅標注，不修改**——交由 Phase 5 決定是否 back-seed 或調整。

### R1　Subject Continuity Bay／clinical latch（Gate 2 已標 FAIL）

- **狀態：** Gate 2 M8 唯一 FAIL。首現 ch26 act2／act3。
- **缺口：** 實體收容機制（Bay 位置＋clinical latch 原語）在 ch26 前完全未出現；ch21 的 CLINICAL HOLD 與 ch24 的 HSM 只覆蓋「誰授權」，不覆蓋「實體在哪」。
- **Gate 2 建議：** ch24／25 補一行低強度 back-seed（日下部或獨立系統安全人員提及 hold 解析到 Subject Continuity Bay，門由 clinical latch 治理，只給狀態不給地理／IDs）。
- **本檔標注：** 採納 Gate 2 建議方向。此為全書唯一明確不公平的伏筆缺口。

### R2　「座標在唱」種子→終局 payoff 距離極長

- **狀態：** Gate 2 M10 PASS（首現 ch1 的接收器）。但「座標在唱」這個**具體音序隱喻**首現 ch9，終局 payoff 在 ch28。
- **缺口：** ch9 與 ch28 之間近 19 章，沒有中段 escalation 讓讀者維持對這個隱喻的記憶。ch10 之後音序線基本沉寂，直到 ch28 才回聲。
- **風險評估：** 不構成不公平（種子極低強度，符合「重讀時才發光」原則）。但 payoff 的「驚喜感」可能因讀者已忘記 ch9 的閃念而減弱。Phase 5 可考慮在 ch20（函館訊號分析）讓澪或敘事極輕地呼應一次「座標」用語，維持鏈條溫度。

### R3　悠真「故意把交通卡借給朋友」——章節歸屬不明

- **狀態：** 高層企劃 §9 列為悠真主動留下的線索之一（讓研究中心追蹤錯人一天）。
- **缺口：** 在 ch1–28 計畫檔中未見此細節的明確章節承載。可能僅為設定層未落地。
- **風險評估：** 不構成公平性風險（這是人物塑造細節，非推理線索）。但若要發揮「悠真不是單純人質」的主題功能，建議在 ch9–12（悠真線索集中揭露期）以回憶或紀錄形式落地。

### R5　母親「病歷缺頁」——章節承載不明

- **狀態：** 高層企劃 §12 列為伏筆（前期：醫院疏失；後期：病歷被改，她從未真正死亡）。
- **缺口：** 在 ch1–28 計畫檔中未見「病歷缺頁」這個**具體線索**的獨立章節承載。ch17–19 澪發現 M-00＝紗英，但是否經由「病歷缺頁」路徑，需確認 prose。
- **風險評估：** 若 ch17–19 的「紗英未死」揭露不依賴此線索，則 §12 的這條伏筆實質未落地，屬 dead seed。Phase 5 可選擇在 ch17–18 補入病歷缺頁細節，或從 §12 移除此條。

### R6　「夢要先寫日期」家庭習慣——回收擴散

- **狀態：** ch1 act1 種子明確（Task 8）。
- **缺口：** 中段（ch9–11 夢境紀錄）與終局（夢的日期線索）的回收較為擴散，沒有單一尖銳的 payoff 時刻讓讀者明確感覺「這條線索被用了」。
- **風險評估：** 不構成不公平。但作為伏筆，其「回收感」偏弱，讀者可能不會意識到它被回收。可接受的低強度種子，無需強制修改。

### R7　父親下落——雙證據程序痕跡的「種子」偏晚

- **狀態：** ch1 即鋪設父親舊案（日下部看鏡子停頓、「妳父親以前也以為查清楚就夠了」）。ch28 以 independent medical clearance 與既有 MAR-CONT handoff record 雙證據證明父親在官方失蹤十一日後仍活著並完成一次實際轉送。
- **缺口：** 父親線在 ch4–ch20 之間幾乎沉寂（日下部的保護者身份是間接繼承）。父親的 MAR-CONT 關聯（C7.1）要到 ch15 才出現，ch28 才連回父親。
- **風險評估：** 不構成不公平（父親不是核心推理線索，是情感／主題線）。但鏈條中段較薄，Phase 5 可考慮在 ch17（日下部碎片測試）或 ch20（函館）讓日下部或紗英極輕地呼應父親的舊案角色。

---

## 附錄：與 Gate 2 審計的對照

| Gate 2 # | 機制 | 首現章 | Gate 2 | 本檔對應條目 | 備註 |
|---|---|---|---|---|---|
| M1 | M-00／Mother Reference | ch19 | ✅ | C4.6 | 母親遺物種子 ch1（Task 8）提前鋪墊 |
| M2 | KAGAMI／執行錨點 | ch20 | ✅ | C6.1 | — |
| M3 | Witness sideband | ch20 | ✅ | C8.1 | — |
| M4 | Independent Analog Monitor | ch20 | ✅ | C4.2 | 接收器種子 ch1（Task 8）鋪墊 analog 血統 |
| M5 | Patient matrix／R5 | ch12→ch22→ch24 | ✅ | C3.7／C6.6 | — |
| M6 | MAR-CONT／23:50 BCP | ch15 | ✅ | C7.1 | 注意 ch7 的 23:50 無關 |
| M7 | Seven-second／ECHO PEAK | ch4 | ✅ | C5.3／C1.5 | 三段式延遲：ch4 現象→ch21 技術名→ch27 時間戳 |
| M8 | Subject Bay／latch | ch26 | ❌ | C7.3／R1 | 唯一 FAIL；見 §10 R1 |
| M9 | Authorization capsules／trust domains | ch24 | ✅ | C7.2 | 字面「capsule」不出現於 prose |
| M10 | Radio／70-year signal | ch1 | ✅ | C9.1–C9.6 | 「座標在唱」ch9→ch28 距離長（見 R2） |

---

> **維護原則：** 本檔為 canon 鎖定文件。任何 Phase 5 對上述種子的 back-seed 或調整，必須同步更新對應條目的 SEED CHAPTER 與本檔附錄的 Gate 2 對照表。新增線索須完整填寫五欄（SEED／ORDINARY／SECONDARY／FINAL／MISDIRECTION）。
