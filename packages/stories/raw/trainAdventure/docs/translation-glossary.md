# Translation Glossary — trainAdventure

The single source for English (`en/`) and Japanese (`ja/`) names and recurring
terms. Every translator reads this before writing, and adds any new name, label
or term here (and the label to `characters.md` aliases) in the same change, so
later routes stay consistent. Mirror-tree rules live in the
`translating-stories` skill.

## Conventions

- **Name order**: surname first in both languages, as in the `characters.md`
  headings (Li Jie, Tanaka Kenta, Saito Ren). Use the same short form the zh
  text uses: `健太` → Kenta / 健太, `田中` → Tanaka / 田中.
- **Japanese names**: Japanese characters keep their kanji in modern Japanese
  forms (渡邊 → 渡辺, 佐佐木 → 佐々木, 繪 → 絵, 黑 → 黒, 惠 → 恵). Chinese
  characters keep their kanji with on'yomi readings (李杰《りけつ》). Western and
  elf names are katakana.
- **Furigana** follows the reading column below; every kanji name gets its
  reading every time it appears in dialogue or narration. Speaker labels carry
  no furigana.
- **Speaker labels** follow the zh label: while zh still calls someone by a
  description (`健談男大生`), use the matching description below, and switch to
  the name only where zh does.
- **Honorifics**: English drops -san/-kun; Japanese keeps whatever the
  speaker would naturally use (さん, くん, 先輩).
- **Japanese first person**: Li Jie 俺 (自分 where reflexive), Tanaka Kenta 俺,
  Suzuki Asuka and Takahashi Misaki あたし, Saito Ren 僕. Add a row here when
  you fix another character's pronoun.
  - Asuka keeps あたし to the end of branch_2c, epilogue included (the one
    わたし in ja act 2 is a slip). Li Jie keeps 俺, but uses 私（わたし） in
    formal speech to Shimizu Kosuke and to Asuka's parents (actFinal).
  - Lila 私（わたし）, soft です/ます. Other elves 私（わたし）. The Sacred Tree
    我（われ）, archaic and plain; it calls Li Jie 人間よ / 哀れな罪人よ.
  - Shimizu Kosuke 私（わたし）, courteous です/ます to the returnees, plain to
    his soldier. The ISPA soldier 自分（じぶん）, clipped (はっ、了解しました).
  - Suzuki Taro 私（わたし）, 父さん of himself to Asuka. Suzuki Keiko
    私（わたし）, お母さん of herself to Asuka. Suzuki Daiki 俺 (no pronoun in
    his polite self-introduction). Suzuki Miyuki 私（わたし）. Suzuki Yui わたし,
    Suzuki Yuma ぼく (in hiragana).
  - Lin Wanru 私（わたし）, 母さん of herself to Li Jie, warm plain speech.
    Uncle Zhang 俺.
  - Kobayashi mother (溫柔母親) 私（わたし）, ママ of herself to the kids; Hina
    わたし, Shota ぼく; both kids say ママ / パパ, as in ja acts 2–3. Ito Makoto
    俺, Ito Nana 私（わたし）, Nakamura Hayato 俺, as in ja acts 2–3.
- **Li Jie ↔ Asuka (branch_1b → branch_2c)**: Asuka calls him 李先生 → Mr. Li /
  李さん（りさん） from act 10 until she asks to use his name near the end of act
  30; from that line on she says 杰君 → Jie / ジエくん (katakana from the
  Mandarin Jié, so the ja never reads 杰《けつ》くん, which sounds like "butt").
  Introducing him to her family (actFinal) she says 李杰君 → Li Jie /
  李杰くん（りけつくん）. Li Jie calls her 明日香 → Asuka in English throughout;
  in Japanese 明日香さん until that act 30 exchange (his 明日香小姐 lines there
  are 明日香さん too, and 「而不是鈴木小姐」 becomes さん付けじゃなくて), plain
  明日香 after it. Narration always says 李杰 / 明日香. Other forms of address
  are rows in Places and terms, marked *address*.
- **Elves' address**: elves, Lila included, use bare names with no honorific —
  Li Jie / 李杰, Asuka / 明日香 — and keep their courtesy in the verbs. Their
  leader is 艾拉如大人 → Lord Ailaru / アイラル様.
- **Stage directions**: `(內心)` → (thinking) / （心の声）; `(小聲)` →
  (whispering) / （小声で）.

## Characters

| ID | zh | en | ja (reading) |
|---|---|---|---|
| `narrator` | 旁白 | Narrator | ナレーション |
| `li_jie` | 李杰 | Li Jie | 李杰（りけつ） |
| `tanaka_kenta` | 田中健太 | Tanaka Kenta | 田中健太（たなかけんた） |
| `suzuki_asuka` | 鈴木明日香 | Suzuki Asuka | 鈴木明日香（すずきあすか） |
| `sato_takumi` | 佐藤拓海 | Sato Takumi | 佐藤拓海（さとうたくみ） |
| `takahashi_misaki` | 高橋美咲 | Takahashi Misaki | 高橋美咲（たかはしみさき） |
| `saito_ren` | 斎藤蓮 | Saito Ren | 斎藤蓮（さいとうれん） |
| `yamamoto_koji` | 山本浩二 | Yamamoto Koji | 山本浩二（やまもとこうじ） |
| `ito_nana` | 伊藤奈々 | Ito Nana | 伊藤奈々（いとうなな） |
| `ito_makoto` | 伊藤誠 | Ito Makoto | 伊藤誠（いとうまこと） |
| `kobayashi_shota` | 小林翔太 | Kobayashi Shota | 小林翔太（こばやししょうた） |
| `kobayashi_tomoko` | 小林智子 | Kobayashi Tomoko | 小林智子（こばやしともこ） |
| `kobayashi_yudai` | 小林雄大 | Kobayashi Yudai | 小林雄大（こばやしゆうだい） |
| `kobayashi_hina` | 小林陽菜 | Kobayashi Hina | 小林陽菜（こばやしひな） |
| `nakamura_hayato` | 中村隼人 | Nakamura Hayato | 中村隼人（なかむらはやと） |
| `shimizu_emi` | 清水恵美 | Shimizu Emi | 清水恵美（しみずえみ） |
| `ling_mo` | 凌墨 | Ling Mo | 凌墨（りょうぼく） |
| `hasegawa_mio` | 長谷川澪 | Hasegawa Mio | 長谷川澪（はせがわみお） |
| `harada_erika` | 原田繪里花 | Harada Erika | 原田絵里花（はらだえりか） |
| `nakano_kaito` | 中野海斗 | Nakano Kaito | 中野海斗（なかのかいと） |
| `kisaragi_souma` | 如月颯真 | Kisaragi Souma | 如月颯真（きさらぎそうま） |
| `himuro_rikuto` | 氷室陸斗 | Himuro Rikuto | 氷室陸斗（ひむろりくと） |
| `nanami_shiori` | 七海詩織 | Nanami Shiori | 七海詩織（ななみしおり） |
| `watanabe_mari` | 渡邊真理 | Watanabe Mari | 渡辺真理（わたなべまり） |
| `takahashi_ayaka` | 高橋彩花 | Takahashi Ayaka | 高橋彩花（たかはしあやか） |
| `takayama_sho` | 高山翔 | Takayama Sho | 高山翔（たかやましょう） |
| `ito_riko` | 伊藤莉子 | Ito Riko | 伊藤莉子（いとうりこ） |
| `chen_yu` | 陳宇 | Chen Yu | 陳宇（ちんう） |
| `kurosawa_ryuichi` | 黑澤龍一 | Kurosawa Ryuichi | 黒澤龍一（くろさわりゅういち） |
| `zhang_wei` | 張偉 | Zhang Wei | 張偉（ちょうい） |
| `wang_hao` | 王浩 | Wang Hao | 王浩（おうこう） |
| `yamada_yumi` | 山田由美 | Yamada Yumi | 山田由美（やまだゆみ） |
| `yamada_manager` | 山田部長 | Manager Yamada | 山田部長（やまだぶちょう） |
| `suzuki_taro` | 鈴木太郎 | Suzuki Taro | 鈴木太郎（すずきたろう） |
| `suzuki_shinya` | 鈴木真也 | Suzuki Shinya | 鈴木真也（すずきしんや） |
| `suzuki_daiki` | 鈴木大輝 | Suzuki Daiki | 鈴木大輝（すずきだいき） |
| `saito_daisuke` | 斎藤大輔 | Saito Daisuke | 斎藤大輔（さいとうだいすけ） |
| `usami_seiichiro` | 宇佐美誠一郎 | Usami Seiichiro | 宇佐美誠一郎（うさみせいいちろう） |
| `shimizu_kosuke` | 清水浩介 | Shimizu Kosuke | 清水浩介（しみずこうすけ） |
| `shimizu_yukari` | 清水由香里 | Shimizu Yukari | 清水由香里（しみずゆかり） |
| `sasaki_ai` | 佐佐木愛 | Sasaki Ai | 佐々木愛（ささきあい） |
| `sasaki_yuko` | 佐佐木優子 | Sasaki Yuko | 佐々木優子（ささきゆうこ） |
| `li_mingyuan` | 李明遠 | Li Mingyuan | 李明遠（りめいえん） |
| `lin_wanru` | 林婉如 | Lin Wanru | 林婉如（りんえんじょ） |
| `saito_koichi` | 斎藤浩一 | Saito Koichi | 斎藤浩一（さいとうこういち） |
| `saito_mika` | 斎藤美香 | Saito Mika | 斎藤美香（さいとうみか） |
| `nathaniel_sterling` | 納撒尼爾·史特林 | Nathaniel Sterling | ナサニエル・スターリング |
| `kelan` | 凱蘭 | Kelan | ケラン |
| `lila` | 莉拉 | Lila | リラ |
| `ailaru` | 艾拉如 | Ailaru | アイラル |
| `elysia` | 艾莉希雅 | Elysia | エリシア |
| `seran` | 瑟蘭 | Seran | セラン |
| `iranil` | 伊蘭尼爾 | Iranil | イラニル |
| `orion` | 歐瑞恩 | Orion | オリオン |
| `nisara` | 妮莎拉 | Nisara | ニサラ |
| `serina` | 瑟琳娜 | Serina | セリナ |
| `liana` | 莉雅娜 | Liana | リアナ |
| `aether` | 艾瑟爾 | Aether | エーテル |
| `salvis` | 薩爾維斯 | Salvis | サルヴィス |
| `aderin` | 艾德林 | Aderin | アデリン |
| `sacred_tree` | 神樹 | Sacred Tree | 神樹（しんじゅ） |
| `suzuki_yui` | 鈴木結衣 | Suzuki Yui | 鈴木結衣（すずきゆい） |
| `suzuki_yuma` | 鈴木悠真 | Suzuki Yuma | 鈴木悠真（すずきゆうま） |
| `suzuki_keiko` | 鈴木惠子 | Suzuki Keiko | 鈴木恵子（すずきけいこ） |
| `suzuki_miyuki` | 鈴木美雪 | Suzuki Miyuki | 鈴木美雪（すずきみゆき） |
| `hashimoto_kenichi` | 橋本健一 | Hashimoto Kenichi | 橋本健一（はしもとけんいち） |
| `kuga` | 久我 | Kuga | 久我（くが） |
| `aiwen` | 艾文 | Aiwen | アイウェン |
| `nanao` | 七尾 | Nanao | 七尾（ななお） |
| `elf_guard` | 精靈守衛 | Elf Guard | エルフの衛兵 |
| `elf` | 精靈 | Elf | エルフ |
| `soldier` | 士兵 | Soldier | 兵士 |
| `guard` | 守衛 | Guard | 警備員 |
| `clerk` | 店員 | Clerk | 店員 |
| `maid` | 女僕 | Maid | メイド |
| `colleague` | 同事 | Colleague | 同僚 |
| `man_in_black` | 黑西裝男 | Man in Black | 黒スーツの男 |
| `police_officer` | 警察 | Police Officer | 警察官 |
| `passerby` | 路人 | Passerby | 通行人 |
| `waiter` | 服務生 | Waiter | ウェイター |
| `nurse` | 護士 | Nurse | 看護師 |
| `doctor` | 醫生 | Doctor | 医師 |
| `manager` | 經理 | Manager | マネージャー |
| `official` | 官員 | Official | 役人 |
| `passenger` | 旅客 | Passenger | 乗客 |
| `driver` | 司機 | Driver | 運転手 |
| `engineer` | 工程師 | Engineer | エンジニア |
| `message` | 訊息 | Message | メッセージ |
| `librarian` | 圖書館員 | Librarian | 司書 |
| `staff` | 工作人員 | Staff | スタッフ |
| `middle_aged_man` | 中年男子 | Middle-Aged Man | 中年の男 |
| `middle_aged_woman` | 中年女人 | Middle-Aged Woman | 中年の女性 |
| `inn_keeper` | 老闆娘 | Innkeeper | 女将 |
| `child` | 小孩 | Child | 子ども |
| `crowd` | 眾人 | Crowd | 一同 |
| `parent` | 家長 | Parent | 親 |
| `man` | 男子 | Man | 男 |
| `woman` | 女子 | Woman | 女 |
| `student` | 學生 | Student | 学生 |
| `intercom` | 對講機 | Intercom | インターホン |
| `announcement` | 廣播 | Announcement | アナウンス |
| `unknown` | ？？？ | ??? | ？？？ |
| `voice` | 聲音 | Voice | 声 |

## Descriptive speaker labels

Used before a character is named. All are registered as aliases in
`characters.md`.

| zh | en | ja | ID |
|---|---|---|---|
| 健談男大生 | Loudmouth Student | おしゃべりな男子大学生 | `tanaka_kenta` |
| 活潑女大生 | Bubbly Student | 元気な女子大生 | `suzuki_asuka` |
| 沉穩男大生 | Steady Student | 落ち着いた男子大学生 | `sato_takumi` |
| 多話女大生 | Chatterbox Student | 話好きな女子大生 | `takahashi_misaki` |
| 膽小眼鏡男 | Timid Guy in Glasses | 気弱な眼鏡の青年 | `saito_ren` |
| 慷慨大叔 | Generous Older Man | 気前のいいおじさん | `yamamoto_koji` |
| 焦慮妻子 | Anxious Wife | 不安げな妻 | `ito_nana` |
| 煩躁丈夫 | Irritable Husband | 苛立った夫 | `ito_makoto` |
| 天真弟弟 | Innocent Little Brother | 無邪気な弟 | `kobayashi_shota` |
| 溫柔母親 | Gentle Mother | 優しい母親 | `kobayashi_tomoko` |
| 沉穩父親 | Steady Father | 落ち着いた父親 | `kobayashi_yudai` |
| 懂事姐姐 | Sensible Big Sister | しっかり者の姉 | `kobayashi_hina` |
| 自私中年男 | Selfish Middle-Aged Man | 身勝手な中年男 | `nakamura_hayato` |
| 文靜少女 | Quiet Girl | 物静かな少女 | `shimizu_emi` |
| 神秘黑衣男 | Mysterious Man in Black | 黒衣の謎の男 | `ling_mo` |
| 白袍劍士 | White-Robed Swordsman | 白いローブの剣士 | `takayama_sho` |
| 斎藤父親 | Saito's Father | 斎藤の父 | `saito_koichi` |
| 斎藤母親 | Saito's Mother | 斎藤の母 | `saito_mika` |
| 精靈女性 | Elf Woman | エルフの女性 | `elf` |
| 年長精靈 | Elder Elf | 年長のエルフ | `elf` |
| 精靈劍士 | Elf Swordsman | エルフの剣士 | `elf_guard` |
| 張伯伯 | Uncle Zhang | 張おじさん | `man` |
| 女將 | Innkeeper | 女将 | `inn_keeper` |

## Places and terms

| zh | en | ja (reading) |
|---|---|---|
| 寂海（站） | Jakkai (Station) | 寂海駅（じゃっかいえき） |
| 新宿車站 | Shinjuku Station | 新宿駅（しんじゅくえき） |
| 中央線 | Chuo Line | 中央線（ちゅうおうせん） |
| 高尾 | Takao | 高尾（たかお） |
| 末班車 | the last train | 終電（しゅうでん）; station announcements say 最終電車（さいしゅうでんしゃ） |
| 月台 | platform | ホーム |
| 兩輪紫月 / 紫色殘月 | the two violet moons / violet crescent moons | 二つの紫の月（ふたつのむらさきのつき） |
| 精靈 | elf, elves | エルフ |
| 精靈語 | Elvish | エルフ語（えるふご） |
| 神樹 | the Sacred Tree | 神樹（しんじゅ） |
| 異世界 | another world | 異世界（いせかい） |
| 強零 | Strong Zero | ストロングゼロ |
| 全家 | FamilyMart | ファミマ |
| 円 | yen | 円（えん） |
| 迷霧之森 | the Misty Forest | 迷霧の森（めいむのもり） |
| 銀月湖 | Silver Moon Lake | 銀月湖（ぎんげつこ） |
| 亡者峽谷 | the Canyon of the Dead | 亡者の峡谷（もうじゃのきょうこく） |
| 永恆之森 | the Eternal Forest | 永遠の森（えいえんのもり） |
| 魔族之島 | the Demon Isle | 魔族の島（まぞくのしま） |
| 神劍 | the holy sword | 神剣（しんけん） |
| 珠海 | Zhuhai | 珠海（しゅかい） |
| 圖騰（恵美の絵） | pattern, symbol | 紋様（もんよう） |
| 緊急通話鈕 | emergency call button | 非常ボタン（ひじょうぼたん） |
| 沒有服務 / 圈外 | no signal | 圏外（けんがい） |
| 幽冥之都（站） | the City of the Netherworld (station) | 幽冥の都（ゆうめいのみやこ）; the station 幽冥の都駅（ゆうめいのみやこえき） |
| 亡者峽谷車站 | the Canyon of the Dead station | 亡者の峡谷駅（もうじゃのきょうこくえき） |
| 時刻表：上一班列車／本班列車／下一班列車 | Previous train / This train / Next train | 前の列車（まえのれっしゃ）／この列車（このれっしゃ）／次の列車（つぎのれっしゃ） |
| 獻祭 / 獻祭理論 | sacrifice / the sacrifice theory | 生贄（いけにえ） / 生贄説（いけにえせつ） |
| 鏽劍 | the rusty sword | 錆びた剣（さびたけん） |
| 咔噠、咔噠 | clack-clack | カタン、カタン |
| 異界 | the otherworld | 異界（いかい） |
| 雙月 | the twin moons | 二つの月（ふたつのつき） |
| 紫夜 / 永恆的紫夜 | the violet night / the endless violet night | 紫の夜（むらさきのよる） / 永遠の紫の夜（えいえんのむらさきのよる） |
| RPG的隱藏路線 | a hidden route in an RPG | RPGの隠しルート（あーるぴーじーのかくしるーと） |
| 羊皮紙（地圖） | parchment (map) | 羊皮紙（ようひし） |
| 精靈冊子 / 冊子 | the elven booklet | エルフの冊子（えるふのさっし） |
| 精靈文字 | Elvish script | エルフ文字（えるふもじ） |
| 精靈族 | the elves, the elven people | エルフ族（えるふぞく） |
| 族人 | our people, kin | 同胞（どうほう） |
| 主大陸 | the mainland | 主大陸（しゅたいりく） |
| 碧翠之島 | the Jade Isle | 碧翠の島（へきすいのしま） |
| 永恆森林（= 永恆之森） | the Eternal Forest | 永遠の森（えいえんのもり） |
| 生命之樹 | the Tree of Life | 生命の樹（せいめいのき） |
| 神聖（的）古樹 | the sacred ancient tree | 神聖な古樹（しんせいなこじゅ） |
| 聖樹（the Sacred Tree of itself） | the holy tree | 聖樹（せいじゅ） |
| 曦光之庭 | Dawnlight Court | 曦光の庭（きこうのにわ） |
| 月光林地 | Moonlight Glade | 月光の林（げっこうのはやし） |
| 星辰谷 | the Vale of Stars | 星辰の谷（せいしんのたに） |
| 精靈曆（五千年） | the Elven Calendar (the year 5000 of the Elven Calendar) | エルフ暦（えるふれき）; エルフ暦五千年（えるふれきごせんねん） |
| 雙紫之月（冊子） | the twin violet moons | 双紫の月（そうしのつき） |
| 門扉（碧翠之島南端） | the gate | 門（もん） |
| 森林果實 | forest fruit | 森の果実（もりのかじつ） |
| 月光草 | moonlight grass | 月光草（げっこうそう） |
| 銀露蘑菇 | silver-dew mushrooms | 銀露茸（ぎんろだけ） |
| 星露燉肉 / 星露香草 | star-dew stew / star-dew herb | 星露の煮込み（せいろのにこみ） / 星露草（せいろそう） |
| 春生祭 | the Springbirth Festival | 春生祭（しゅんせいさい） |
| 月華慶典 | the Moonglow Festival | 月華祭（げっかさい） |
| 星辰之夜 | the Night of Stars | 星辰の夜（せいしんのよる） |
| 終焉祭壇 | the Altar of the End | 終焉の祭壇（しゅうえんのさいだん） |
| 劍士（精靈） | swordsmen | 剣士（けんし） |
| 巡邏隊 / 哨站 | patrol / outpost | 巡回隊（じゅんかいたい） / 哨所（しょうしょ） |
| 高台（月光林地） | the lookout | 物見台（ものみだい） |
| 安魂曲 | requiem | 鎮魂歌（ちんこんか） |
| 願月光守護你們（的旅程）/ 願月光守護妳 | May the moonlight watch over you (on your journey). | 月光のご加護がありますように（げっこうのごかごがありますように） |
| 月光之水 | moonlight water | 月光の水（げっこうのみず） |
| 精靈姐姐（Asuka's word for the elf woman） | the elf lady | エルフのお姉さん（えるふのおねえさん） |
| 黑劍 | the black sword | 黒い剣（くろいけん） |
| 黑劍男 / 持黑劍的年輕人 | the black-sword man / the young man with the black sword | 黒剣の男（こっけんのおとこ） / 黒い剣を持った若者（くろいけんをもったわかもの） |
| 黑衣男（Ling Mo, unnamed in this route; not 黑劍男） | the man in black | 黒衣の男（こくいのおとこ） |
| 神樹的幻境 / 灰色空間 | the Sacred Tree's vision / the grey void | 神樹の幻境（しんじゅのげんきょう） / 灰色の空間（はいいろのくうかん） |
| 可悲的罪人 | pitiful sinner | 哀れな罪人（あわれなざいにん） |
| 那扇門，需要代價 | That door demands a price. | その扉には、代償が要る（そのとびらには、だいしょうがいる） |
| 那扇門（the glowing door behind the altar） | the door | 扉（とびら） |
| 指引（the Tree's pull Li Jie feels） | guidance, the pull | 導き（みちびき） |
| 長廊（終焉祭壇） | the corridor | 回廊（かいろう） |
| 符文 | runes | ルーン |
| 石門 | the stone doors | 石の扉（いしのとびら） |
| 聖地（the altar chamber） | the sanctum | 聖域（せいいき） |
| 沉睡者 / 祭壇上的男子 | the sleeper on the altar | 祭壇に眠る者（さいだんにねむるもの） |
| ISPA / 國際超自然現象調查局 | ISPA, the International Supernatural Phenomena Agency | ISPA、国際超自然現象調査局（こくさいちょうしぜんげんしょうちょうさきょく） |
| 組織（ISPA） / 其他組織 / 神秘的組織 | the agency / other organizations / the mysterious organizations | 組織（そしき） / ほかの組織（ほかのそしき） / 謎の組織（なぞのそしき） |
| 高級官員 | senior official | 高官（こうかん） |
| 隔離設施 / 檢疫室 | isolation facility / quarantine room | 隔離施設（かくりしせつ） / 検疫室（けんえきしつ） |
| 失蹤人口 / 失蹤者 | missing persons | 行方不明者（ゆくえふめいしゃ） |
| 在醫院接受治療，失去了記憶（the cover story） | in hospital being treated, with no memory of it | 病院で治療を受けていて、記憶をなくした（びょういんでちりょうをうけていて、きおくをなくした） |
| 北海道 / 溫泉小鎮 | Hokkaido / hot-spring town | 北海道（ほっかいどう） / 温泉町（おんせんまち） |
| 湯之宿（on the noren） | Yu no Yado | 湯の宿（ゆのやど）; 暖簾（のれん） |
| 露天溫泉 / 男湯 / 浴衣 | open-air bath / men's bath / yukata | 露天風呂（ろてんぶろ） / 男湯（おとこゆ） / 浴衣（ゆかた） |
| 懷石料理 | kaiseki dinner | 懐石料理（かいせきりょうり） |
| 拉勾勾 | pinky promise | 指切り（ゆびきり） |
| 生活補助（每月四十萬日圓） | living allowance (400,000 yen a month) | 生活補助金（せいかつほじょきん）、月四十万円（つきよんじゅうまんえん） |
| GPhone 35 Pro Max / GPhone 16 | GPhone 35 Pro Max / GPhone 16 | GPhone 35 Pro Max / GPhone 16 |
| 新千歲機場 / 札幌 | New Chitose Airport / Sapporo | 新千歳空港（しんちとせくうこう） / 札幌（さっぽろ） |
| 福岡（機場） | Fukuoka (Airport) | 福岡（ふくおか）; 福岡空港（ふくおかくうこう） |
| 東京 / 大阪 | Tokyo / Osaka | 東京（とうきょう） / 大阪（おおさか） |
| 京都、金閣寺、清水寺、奈良、富士山 | Kyoto, Kinkaku-ji, Kiyomizu-dera, Nara, Mount Fuji | 京都（きょうと）、金閣寺（きんかくじ）、清水寺（きよみずでら, not しみず）、奈良（なら）、富士山（ふじさん） |
| 珠海機場 | Zhuhai Airport | 珠海空港（しゅかいくうこう） |
| NA 1847 航班 / 5號登機口 | flight NA 1847 / Gate 5 | NA1847便（便＝びん） / 5番搭乗口（ごばんとうじょうぐち） |
| 那個安靜的女孩 / 文靜少女（= 清水恵美, named only in act 28） | the quiet girl | 物静かな少女（ものしずかなしょうじょ） |
| （那個沉穩的）大叔 / 慷慨大叔（= 山本浩二） | the (steady) older man | （落ち着いた）おじさん（おちついたおじさん） |
| （膽小）眼鏡男（= 斎藤蓮） | the (timid) guy in glasses | （気弱な）眼鏡の青年（きよわなめがねのせいねん） |
| 很膽小的叔叔 / 提出獻祭理論的男人（Hina's words = 自私中年男） | the scaredy-cat man / the man with the sacrifice theory | 臆病なおじさん（おくびょうなおじさん） / 生贄説を言い出した男（いけにえせつをいいだしたおとこ） |
| 很兇的胖叔叔（Hina's words = 煩躁丈夫） | the scary fat man | 怖い太ったおじさん（こわいふとったおじさん） |
| 李先生 (*address*: Asuka until act 30; Kosuke; Daiki, Taro, Keiko) | Mr. Li | 李さん（りさん） |
| 杰君 (*address*: Asuka from act 30) | Jie | ジエくん |
| 李杰君 (*address*: Asuka introducing him, actFinal) | Li Jie | 李杰くん（りけつくん） |
| 杰兒 (*address*: Lin Wanru, Uncle Zhang) | Jie | ジエ |
| 明日香 / 明日香小姐 (*address*: Li Jie → Asuka) | Asuka | 明日香さん（あすかさん） until act 30's name exchange, then 明日香 |
| 鈴木小姐 / 鈴木明日香小姐 (*address*) | Miss Suzuki / Miss Suzuki Asuka | 鈴木さん（すずきさん） / 鈴木明日香さん |
| 李杰先生 (*address*: the soldier) | Mr. Li Jie | 李杰さん（りけつさん） |
| 清水先生 / 清水小姐（Emi） (*address*) | Mr. Shimizu / Miss Shimizu | 清水さん（しみずさん） |
| 清水長官 (*address*: the soldier → Kosuke) | Director Shimizu | 清水長官（しみずちょうかん） |
| 姊姊 / 令姊 (*address*: Kosuke's Emi; Daiki's Asuka) | my sister / your sister | 姉（あね）, 姉さん（ねえさん） / お姉さん（おねえさん） |
| 鈴木先生和鈴木太太 (*address*) | Mr. and Mrs. Suzuki | 鈴木さんご夫妻（すずきさんごふさい） |
| 艾拉如大人 (*address*) | Lord Ailaru | アイラル様（さま） |
| 大哥哥 (*address*: Kobayashi kids → Li Jie) | mister | お兄ちゃん（おにいちゃん） |
| 小兄弟 (*address*: Yamamoto → Li Jie) | son | 兄ちゃん（にいちゃん） |
| 寶貝 / 寶寶 (*address*: the Kobayashi mother → kids) | sweetie | いい子（いいこ） |
| 伯父 (*address*: Li Jie → Taro) | Mr. Suzuki | お父さん（おとうさん） |
| 伯母 (*address*: Asuka → Lin Wanru) | your mom (act 29) / Auntie (actEpilogue) | お母さん（おかあさん） (act 29) / お義母さん（おかあさん） (actEpilogue, after the wedding) |
| 阿姨 / 明日香阿姨 (*address*: Yui, Yuma; Asuka of herself) | Auntie / Aunt Asuka | おばちゃん / 明日香おばちゃん（あすかおばちゃん） |
| 媽 / 媽媽 / 爸爸 (*address*) | Mom / Dad | お母さん / お父さん (the Suzukis); 母さん（かあさん） (Li Jie ↔ Lin Wanru); ママ / パパ (Kobayashi kids) |
| 張伯伯 (*address*) | Uncle Zhang | 張おじさん（ちょうおじさん） |

## Route notes: branch_1b → branch_2c

- **Shape**: acts 4–8 (shared branch_1b) — the train sheds passengers at each
  stop (15 → 8 at Jakkai, 8 → 4 at the City of the Netherworld) and leaves Li
  Jie on that platform with the Kobayashi mother and children, who are never
  named in this route (keep their descriptive labels). Act 9: he sends them
  north and walks west alone; 9–26 Li Jie and Asuka in the other world; 27–32
  Earth in 2043 (ISPA, a Hokkaido hot-spring inn); actFinal the reunion and the
  flight to Fukuoka; actEpilogue 2048, married in Fukuoka.
- **Who is who in act 7–8 kid-speak**: Hina's "timid uncle" who proposes the
  sacrifice theory is the Selfish Middle-Aged Man (Nakamura), not the Timid Guy
  in Glasses (he already got off at Jakkai); her "scary fat uncle" is the
  Irritable Husband. 黑衣男 (the man in black, Ling Mo) and 黑劍男 (the
  black-sword man) stay two separate terms even where readers may suspect one
  person.
- **Language barrier**: Li Jie can mysteriously read and speak Elvish; Asuka
  understands none of it. Lila and the elves speak Elvish, Li Jie relays to
  Asuka in Japanese — `(對明日香說)` → (to Asuka) / （明日香に） — and zh
  日語 is Japanese. Keep every "she couldn't understand, but…" beat.
- **Li Jie and Asuka**: strangers who share a bed out of fear (10–11, 15; Li
  Jie's running gag is that he is 28 and has never had a girlfriend), grief and
  dependence (18–22), 「⋯⋯不只是同伴」 "...more than that" (19), the confession
  and the name switch at the hot-spring inn (30), "my boyfriend" (actFinal),
  married (actEpilogue). Keep him dry and understated and her bright, impulsive
  and quick to cry; no endearments before zh has them.
- **Lila** admits she shot Misaki on Lord Ailaru's orders (17), stays
  remorseful, then becomes their protector and friend. Her refrain
  艾拉如大人從來不說謊 → "Lord Ailaru never lies" / アイラル様は嘘をつかない.
- **The Sacred Tree's words** come back verbatim in 25–26: 可悲的罪人 "pitiful
  sinner" / 哀れな罪人 and 那扇門，需要代價 "That door demands a price." /
  その扉には、代償が要る. Use the same wording every time; Li Jie hides both
  from Asuka.
- **Echoed lines** must match wherever they recur: 如果沒有你，我根本撐不到現在
  "I'd never have made it this far without you" / あなたがいなかったら、
  あたし、ここまで来られなかった (address him by name instead of あなた if
  the line wants it); 應該是我要謝謝妳才對 "I should be the one thanking you" /
  お礼を言うのは俺のほうだよ; 我會一直陪著妳 "I'll stay with you" / ずっと
  そばにいる. The travel wish list (Kyoto — Kinkaku-ji, Kiyomizu-dera — the
  deer in Nara, sunrise on Mount Fuji) is set in 31 and recalled in actFinal;
  是妳讓我的人生，重新有了色彩 (31) and 是妳讓我的人生，有了新的意義 (actFinal)
  stay parallel.
- **Time**: the other world has no sun, and zh keeps hedging its "mornings" and
  "days" (雖然這裡沒有真正的清晨) — keep the hedges. On Earth 18 years have
  passed (2025 → 2043): Li Jie is "28 on the outside, really 46"; Asuka is
  still 20 and has become an aunt (Daiki was 15, now 33), which pays off in the
  "Auntie" and "magic" lines of actFinal and actEpilogue.
- **Numbers** stay exactly as zh even where they do not add up: 7 vs 8 who got
  off at Jakkai, Li Jie's 15 vs ISPA's 16 passengers, Emi missing 38 years yet
  "one of the sixteen", act 29 saying Ailaru killed the black-sword man. Do not
  fix them; report them.
- **ISPA** is "the agency" / 組織 to its people. Kosuke calls his soldier 小林
  (Kobayashi) in act 29 — no relation to the Kobayashi family; his label stays
  Soldier / 兵士. The cover story (hospital treatment, memory loss) recurs in
  32 and actEpilogue with the same wording.
- **Tone**: claustrophobic horror (4–8), survival and shy romance (9–15),
  grief (16–22), hopeful fairy tale (23–26), bittersweet homecoming and gentle
  slice of life (27–actEpilogue). The late acts are runs of one-sentence
  narration blocks: keep each one its own short block; do not pad them.
- **Act-boundary repeats**: act 9 opens by repeating the mother's question from
  the end of act 8, and act 31 with act 30's last line; translate each pair
  identically. zh slips to keep but
  report: 「Prot」 in act 6 (比「Prot」要大得多) stands for Jakkai Station, and
  雩膀 in act 27 is 肩膀 (shoulder).
- **The final line** `**—— 全劇終 ——**` is a speakerless paragraph:
  `**— The End —**` / `**―― 完 ――**` — bold, no colon, no speaker.
