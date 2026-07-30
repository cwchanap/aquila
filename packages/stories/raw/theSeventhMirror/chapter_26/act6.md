# 第六幕：有效，但不適用

```bg
KAGAMI commit-gate verification room, reinforced booth with local trust chain display, cold blue-white screen glow on operator console, remote patient node feeds visible as small tiled panels along the upper wall, deep night shadows, muted cool palette, visual-novel background art, wide shot
```

**旁白**：04:25。KAGAMI commit-gate。不是 Bay。是另一個房間。更窄。一面牆是 KAGAMI 本地驗證面板。另一面牆——遠端 patient nodes 的平行畫面。八個小窗格。每個窗格——一名患者的本地節點狀態。有些亮著。有些暗著。都在等。

**朝倉澪** [exhausted]：（內心）04:25。距 05:50——一小時二十五分。距 06:13——一小時四十八分。租約還在。HOLD 還在。現在——要讓 KAGAMI 自己判斷。這份租約——能不能用在 S43 上面。

**旁白**：04:27。獨立系統安全人員站在 KAGAMI 面板前。他的手指在鍵盤上。很慢。不是猶豫——是每一個動作都進 immutable audit。

**獨立系統安全人員**：KAGAMI 本地驗證。租約密碼學完整性。auth epoch——A17。簽章——VALID。token serial——匹配。bundle hash——匹配。

**旁白**：螢幕上展開。一行一行。

**旁白**：密碼學有效性——YES。AUTH EPOCH——A17／VALID。租約主體紀元——S42。即時主體紀元——S43。主體匹配——NO。

**朝倉澪** [exhausted]：（內心）密碼學上——有效。A17。簽章是真的。token 是真的。bundle hash 是真的。可是——租約綁定的是 S42。現在活著的是 S43。S42 不等於 S43。中間——隔了所有早已存在的 signed updates。隔了 monotonic merge。隔了八個人的真實狀態。租約是真的。可是——它綁定的人，已經不是現在的人。

**旁白**：04:29。螢幕繼續。兩個 HOLD 的結果也送進來了。

**旁白**：CLINICAL SAFETY——HOLD。PUBLIC DATA USE——HOLD。LOCAL EXECUTION——NO。

**朝倉澪** [exhausted]：（內心）NO。不是 DENIED。不是 REJECTED。是——NO。不適用。租約有效。可是——它不能在這裡執行。因為——它綁定的人不在了。它綁定的是 S42。S42 已經被封存了。現在的人是 S43。S43 有自己的狀態。有自己的 HOLD。有自己的名字。

**旁白**：04:30。KAGAMI 面板上出現一行字。很慢。

**旁白**：EXECUTION ANCHOR——NOT ISSUED。

**朝倉澪** [exhausted]：（內心）KAGAMI 不簽。它不簽 execution anchor。沒有 anchor——區域預置不能在 06:13 形成同一份同步 public fanout。租約還在。token 還在。可是——KAGAMI 說——這份租約不適用於現在的人。所以——它不簽。

**旁白**：04:32。千田的音訊連線還在。他的聲音從喇叭傳出來。很平。

**千田浩介**：KAGAMI 不是在否決租約。它是在判定——租約綁定的 subject epoch 與當前 subject epoch 不匹配。S42 與 S43。密碼學有效。主體不匹配。所以——local execution 不適用。

**旁白**：他頓了一下。

**千田浩介**：continuity 還有兩條 fallback。第一條——formal rebind。重新把租約綁定到 S43。

```bg
KAGAMI commit-gate verification room, center panel now showing CONTINUITY ROUTE A formal rebind request, S43 dependency hash displayed alongside old S42 hash, A18 science escrow status panel glowing red on lower right, cold blue-white glow, deep night shadows, muted cool palette, visual-novel background art, close shot on center panel
```

**旁白**：04:35。螢幕中間。Continuity Route A。正式 rebind。

**旁白**：螢幕上展開。租約重新綁定請求。當前主體紀元——S43。當前依賴雜湊——<CURRENT-HASH>。重用營運代幣——REQUESTED。新科學代幣——REQUIRED。

**朝倉澪** [exhausted]：（內心）rebind。把舊租約重新綁到 S43。可是——S43 改變了太多東西。patient-root manifest 變了。clinical topology 變了。safety status 變了。public-use status 變了。exact bundle hash 變了。所以——不能只改封套。不能重用 A17 的 science token。需要——新的 science token。新的 A18。

**旁白**：04:36。螢幕右下角。S7 science escrow。A18。

**旁白**：S7 AUTH EPOCH——A18。未來發布——DISABLED。新科學代幣——UNAVAILABLE。正式重新綁定——DENIED。

**朝倉澪** [exhausted]：（內心）A18。23:50 的撤回生效了。S7 不會再產生第二份 science token。未來的 release 被關掉了。capsule handle 被銷毀了。沒有新的 science token。沒有——rebind 需要的那把鑰匙。先前那場撤回——在這裡付了第一筆。制度不能在知道 S43 真實患者狀態後，重新簽出一份新 bundle。不是我們擋的。是——S7 自己被撤回了。是——六個 mirror 的 release handle 被銷毀了。是——A18 之後，不存在第二個合法 science-domain release path。

**旁白**：04:38。千田的聲音從喇叭傳出來。很輕。像在讀一份他已經讀過很多次的文件。

**千田浩介**：舊租約還在。

**旁白**：他停了一下。

**千田浩介**：可是它已經不能替現在的人簽名。

**朝倉澪** [exhausted]：（內心）舊租約還在。密碼學上有效。A17。兩個 token。一份封套。有效到清晨六點二十。可是——它綁定的是 S42。S42 已經被封存了。現在的人是 S43。S43 需要新的 bundle。新的 bundle 需要新的 science token。新的 science token——不存在。A18。DISABLED。UNAVAILABLE。所以——rebind 被拒絕了。租約還在。可是——它不能替現在的人簽名。它只能替 S42 簽名。S42——已經過去了。

**旁白**：04:40。日下部站在門邊。他的手插在外套口袋裡。他的眼睛看著螢幕上的 DENIED。

**日下部悟**：rebind 失敗。還有第二條路嗎。

**旁白**：千田的聲音從喇叭傳出來。

**千田浩介**：有。Route B。主體快照等價證明。不重簽 bundle。不改 hash。聲稱 S43 與 S42 在執行意義上安全等價。讓舊租約繼續適用。

**朝倉澪** [exhausted]：（內心）Route B。不重簽。不改 hash。聲稱——S43 雖然有行政更新，可是——在 BCP 執行意義上，跟 S42 一樣安全。所以——舊租約可以繼續用。不需要新的 science token。不需要 A18。只需要——一份等價證明。可是——這份證明需要所有 unresolved case 的 acknowledgment。需要——每一個還掛在線上的人說——我同意，我跟以前一樣安全。

```bg
KAGAMI commit-gate verification room, upper wall of remote patient node panels now showing parallel background activity, left panel displaying seven-stage timing package offline simulation progress, right panel showing Witness Echo Sideband carrier integrity verification, one node panel flashing quarantine status, cold blue-white glow, deep night shadows, muted cool palette, visual-novel background art, wide shot
```

**旁白**：04:42。背景團隊的畫面也在跑。不是前景。是平行。一直在跑。

**旁白**：左邊面板。背景 A 組。歷史七階段握手。03:10 Bay 掛載後就開始了。現在——進入離線模擬。七個時序窗口。ANNOUNCE。SAMPLE。HOLD。COMPARE。ACKNOWLEDGE。HANDOFF。SETTLE。不是七名患者。是——歷史 G07 多節點校準協定。僅時序。沒有神經內容。沒有患者控制數據。

**旁白**：右邊面板。背景 B 組。見證緩衝區。回音側帶。載波完整性驗證。多路複用於保護過濾遙測旁。不進共識捆綁器。不要求同步內容。每個區域接收器收到不同的簽署片段子集。

**旁白**：04:45。其中一個 patient node 窗格閃了一下。不是紅色。是——黃色。quarantine。

**旁白**：套件狀態——QUARANTINE／NO EXECUTION。一般服務——ACTIVE。保護過濾——ACTIVE。證據擷取——ACTIVE。

**朝倉澪** [exhausted]：（內心）一個 continuity cluster 進了 quarantine。不是我們關的。是——Public Deny Manifest、法院命令、現場營運人員共同作用的。continuity-controlled 不等於所有現場人員支持 TOKYO-7。公開拒絕——仍有實際作用。普通服務還在跑。保護性過濾還在跑。證據保全還在跑。只是——那個 cluster 的 package 被隔離了。no execution。不能跑。

**旁白**：04:46。千田的聲音從喇叭傳出來。很平。

**千田浩介**：Route A 失敗。rebind 被拒絕。沒有新的 science token。A18 已經鎖死。Route B——等價證明——是 continuity 最後一條可以拯救舊租約的路。

**旁白**：他頓了一下。

**千田浩介**：它需要每一個 unresolved case 的 acknowledgment。包括——G07／03。

**朝倉澪** [exhausted]：（內心）G07／03。藤川美空。琴音的妹妹。琴音——還有一個 persistent delegation。SUSPENDED。NOT REVOKED。不是登入能力。是——continuity 可以再問她一次：妳確認嗎？妳確認 G07／03 仍然安全等價嗎？她可以回答。她可以——拒絕。

**旁白**：04:48。KAGAMI commit-gate。螢幕上的 DENIED 還亮著。FORMAL REBIND——DENIED。EXECUTION ANCHOR——NOT ISSUED。八個 patient node 窗格——還在等。一個——quarantine。其他——HOLD。

**旁白**：租約有效。

**旁白**：可是——不適用。
