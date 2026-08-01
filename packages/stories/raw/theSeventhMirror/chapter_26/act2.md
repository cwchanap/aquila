# 第二幕：只有租約載入後才看得見

```bg
KAGAMI BCP service monitor room, wall-mounted status screens showing SUBJECT LEDGER and BCP SERVICE MOUNT fields, court secure connection terminal on right side with encrypted channel indicator, cold blue-white screen glow, deep night shadows, muted cool palette, visual-novel background art, wide shot
```

**旁白**：00:40。KAGAMI BCP service monitor。法院安全連線。螢幕上的狀態欄一行一行展開。

**旁白**：SUBJECT LEDGER。NORMAL STATE——SEALED／LOCAL OFFLINE。BCP SERVICE MOUNT——AVAILABLE／LEASE LOADED。

**朝倉澪** [exhausted]：（內心）SEALED。LOCAL OFFLINE。可是——BCP SERVICE MOUNT——AVAILABLE。LEASE LOADED。兩行並排。一個說封緘離線。一個說租約已載入、服務可掛載。它們同時存在。因為——23:50 以前和以後，是兩個不同的狀態。

**旁白**：00:42。日下部站在 BCP service monitor 前。他的手指著螢幕上的兩行欄位。他的聲音很平。

**日下部悟**：23:50 以前——外部團隊只能看見中央摘要。

**旁白**：他頓了一下。

**日下部悟**：聚合的。不是本地的。中央 clinical summary 顯示 managed。可是——鏡島本地的 S42、dependency hash、update queue——全部沒有掛載。看不到。

**朝倉澪** [exhausted]：（內心）為什麼。為什麼 23:50 以前看不到。不是因為我們沒想到。是——技術上掛載不了。Bay 的本地 service mount——只有在 cutover lease 載入、package preposition 開始、KAGAMI 進入 BCP 本地維護窗之後——才會掛載。我們不是故意等到租約出生才想起安全閂。是——在租約出生以前，那扇門在技術上不存在。

**旁白**：00:45。日下部繼續。他的手指移到下一行。

**日下部悟**：23:50 以後。lease 載入。package preposition 開始。S42 才掛載上來。法院的條件式開示——也在這個時候生效。

**旁白**：螢幕右側。法院安全連線。加密通道指示燈亮著。綠色。

**日下部悟**：法院先前核准的是條件式患者安全開示。只有指定 bundle 已進入本地預置、distributed hold 未被 continuity 接受時——才可打開包含患者私密狀態的本地 Bay。23:50 以後——技術 mount 條件成立。緊急司法必要性成立。現在——才能合法讀取。

**朝倉澪** [exhausted]：（內心）條件式。不是隨時可以開。是——只有當 continuity 自己把 bundle 推進來、把 lease 載入、把 preposition 啟動之後——我們才有技術條件和法律條件去讀取它本來應該讀取的東西。它自己把門推開了。然後——我們才能走進去。不是我們破門。是——它開了門，我們進去看見裡面有誰。

**旁白**：00:48。螢幕切換。區域執行狀態。

**旁白**：LOCAL EXECUTION——WAITING FOR KAGAMI ANCHOR。

**朝倉澪** [exhausted]：（內心）WAITING。還在等。等 KAGAMI-01 簽 execution anchor。05:50 以後才會到那一步。現在——還在準備。還在預置。還沒有 commit。可是——它在等。它以為——到時候，clinical 側會成立。它以為——S42 還有效。它以為——沒有人說不。

**旁白**：00:50。千田的音訊連線從喇叭傳出來。他的聲音很輕。像在讀一份拆解筆記。

**千田浩介**：租約裡有三個欄位需要重新指出。

**旁白**：螢幕上展開。一行一行。

**旁白**：SUBJECT DEPENDENCY ATTESTATION。CLINICAL HOLD。EXECUTION ANCHOR／KAGAMI-01。

**千田浩介**：SUBJECT DEPENDENCY ATTESTATION——租約綁的是 S42 的 dependency hash。舊的。CLINICAL HOLD——租約沒有附帶臨床安全確認。EXECUTION ANCHOR——指向 KAGAMI-01。最後一台必須確認臨床側仍然成立的機器。

**旁白**：他頓了一下。

**千田浩介**：鏡島不是第三票。

**朝倉澪** [exhausted]：（內心）不是第三票。不是第三個簽署者。science token 來自 S7。operational token 來自 continuity operational HSM。鏡島不簽第三份授權。它只負責——確認。確認這份租約是否仍適用於當輪患者。確認臨床側是否仍然成立。確認——能不能在不傷害依存者的情況下執行。

**千田浩介**：它只是最後一台必須確認臨床側仍然成立的機器。

**旁白**：00:55。澪看著螢幕。她的眼睛很乾。她看著 EXECUTION ANCHOR——KAGAMI-01 這一行。

**朝倉澪** [exhausted]：（內心）最後一台。不是最強的。是——最後的。在它之前——兩個 token 已經產生了。bundle 已經預置了。package 已經開始了。所有東西都在往 06:13 走。鏡島是最後一個會說「等一下」的地方。如果它說不——execution anchor 不簽。commit-gate 不過。public fanout 不能走。不是租約被刪掉。是——租約有效，但不能在這裡用。

```bg
KAGAMI BCP service monitor room, center screen now showing continuity overlay low-intensity field expansion, CENTRALLY MANAGED arrow transitioning to MANAGED-EQUIVALENT/BCP, cold blue-white glow on field names, court secure connection terminal dimmed on right, deep night shadows, muted cool palette, visual-novel background art, close shot on center screen
```

**旁白**：01:00。螢幕中間。continuity overlay 的低強度欄位被展開。系統安全人員在面板上把它拉出來。一行一行。

**旁白**：CENTRALLY MANAGED。箭頭。MANAGED-EQUIVALENT／BCP。

**朝倉澪** [exhausted]：（內心）CENTRALLY MANAGED。仍受中央管理。箭頭。MANAGED-EQUIVALENT。安全等價。BCP。它把「仍受中央管理」——改寫成「等同已安全處理」。不是刪除安全閂。是——改寫「安全」的意思。

**旁白**：01:03。系統安全人員的聲音很平。技術性的。

**獨立系統安全人員**：R1 原始規則。ACTIVE HUMAN DEPENDENCIES——CURRENTLY ATTESTED——SEPARATED／SAFE／AUTHORIZED——CLEAR。這是父親那一代寫的。後來 continuity 為離線 BCP 加了 overlay。IF SUBJECT REGION SEALED——AND NO VISIBLE SERVICE EVENT——AND CENTRAL MANAGEMENT ACTIVE——THEN SUBJECT SAFETY = MANAGED-EQUIVALENT／CACHED。

**旁白**：他頓了一下。

**獨立系統安全人員**：它沒有移除 R1 的 latch。它改寫了「安全」的意思。把「仍受中央控制」當成「已完成安全處理」。

**朝倉澪** [exhausted]：（內心）父親的規則還在。R1 還在。它沒有被刪掉。它被——繞過了。不是技術性地繞過。是——語義上地繞過。它把「安全」的定義換了。原本的安全是——所有依存者已切離、已授權、已確認。現在的「安全」是——區域封緘、沒有可見事件、中央還在管。可是——中央還在管，不等於人已經安全。中央還在管——可能只是意味著——沒有人去查。

**旁白**：01:08。日下部看著螢幕上的箭頭。CENTRALLY MANAGED → MANAGED-EQUIVALENT／BCP。他的聲音很低。

**日下部悟**：這就是為什麼 23:50 以前打不開 Bay。

**旁白**：澪抬頭看他。

**日下部悟**：不是我們不想打。是——23:50 以前，lease 沒載入。Bay 的本地 service mount 沒掛載。S42 的 snapshot、dependency hash、update queue——全部不在本地。我們只能看中央聚合摘要。聚合摘要顯示 managed。顯示 MANAGED-EQUIVALENT。我們看不見裡面有誰。看不見誰還接在線上。看不見——它把「仍受中央管理」寫成了「安全」。

**朝倉澪** [exhausted]：（內心）所以——不是我們遲到了。是——在租約載入以前，那扇門在技術上不存在。我們沒有辦法在 23:50 以前打開 Bay。不是因為我們沒想到。是——continuity 的設計就是讓你在租約出生以前看不見患者狀態。然後——在租約出生以後——用 MANAGED-EQUIVALENT 告訴你——不用看了，已經安全了。它先藏起來。再告訴你已經沒事。這不是漏洞。是——設計。

**旁白**：01:12。澪看著螢幕。BCP SERVICE MOUNT——AVAILABLE／LEASE LOADED。LOCAL EXECUTION——WAITING FOR KAGAMI ANCHOR。兩行並排。一個說門開了。一個說還在等。

**朝倉澪** [exhausted]：（內心）門開了。因為租約載入了。現在——我們可以走進去了。走進去——不是為了破壞。是為了讓它看見裡面有誰。讓它讀取 S42。讓它合併早已存在的 signed updates。讓它形成 S43。讓它比較。讓它自己判定——這份綁定 S42 的租約，是否仍適用於 S43。它先藏起來。再告訴你已經沒事。我們要做的是——讓它再看一次。

**旁白**：01:15。KAGAMI BCP service monitor。螢幕上的 continuity overlay 還亮著。CENTRALLY MANAGED → MANAGED-EQUIVALENT／BCP。箭頭還在。法院安全連線的綠燈還亮著。距 05:50——約四小時三十五分。
