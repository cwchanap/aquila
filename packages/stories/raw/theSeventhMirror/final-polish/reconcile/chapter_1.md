# Chapter 1 Reconciliation

Scope: `docs/chapter_1_plan.md` (canon) vs `chapter_1/act1.md`–`act7.md`. Authority: plan is canon.

## A. Plan↔Prose discrepancies (P0/P1-relevant)

- [act title leaks object type] — plan says the anonymous message must read "帶上悠真留下的那件東西。不要報警。" and that "讀者不能從匿名訊息直接推斷物件類型" (`docs/chapter_1_plan.md:534`, Task 1 acceptance `final_polish.md:213`); prose act title is literally `# 第六幕：帶上鏡子` (`chapter_1/act6.md:1`). The act TITLE puts the banned P0 keyword `帶上鏡子` in front of the reader as a scene heading, defeating Task 1. The message body itself (`act6.md:25`) is correctly sanitised. Impact: final_polish.md Task 1 / Gate 1 keyword scan (`帶上鏡子` must be zero).

- [Kotone foreshadow payoff still uses banned "testing" framing] — plan foreshadow table row says `琴音改喝綠茶 | 胃不舒服 | 她在測試是否進入新一輪` (`docs/chapter_1_plan.md:627`); the Scene-3 content direction (`docs/chapter_1_plan.md:436`) and the prose (`chapter_1/act4.md:113-115`, "胃有點不舒服，就改喝茶了") are both correctly de-looped, but the plan's own "後期回收" cell still describes Kotone as consciously testing the loop. This plan-doc staleness directly contradicts Task 2 ("刪除「琴音在測試是否進入新一輪」"; "琴音本人不能知道行為來源", `final_polish.md:219-221`). Prose is compliant; plan metadata is not. Impact: final_polish.md Task 2 — if the plan table is not fixed, the Ch23 recovery risks inheriting the violation.

- [mirror back-scratch description refined] — plan says the mirror back "也像被鑰匙磨過" (`docs/chapter_1_plan.md:285`); prose says the marks are "不像磨的，像用什麼尖物一筆一筆劃上去的，歪歪斜斜的" (`chapter_1/act2.md:33`). Prose makes the marks look deliberate (correctly foreshadowing the engraved test-subject number); plan says key-wear. Impact: non-spec (prose is better-aligned with the later payoff than the plan's wording).

- [Yuma's gift-line wording differs] — plan quotes Yuma: "妳每次都看別人哪裡不對，偶爾也看看自己吧" (`docs/chapter_1_plan.md:281`); prose Yuma says "整天嫌這嫌那，照照鏡子吧" (`chapter_1/act2.md:21`). Impact: non-spec (trivial wording; ch4 act2.md:21 re-paraphrases it a third way — see ch4 report).

## B. Prose-only good details (fold-forward candidates)

- [Kotone notices the mirror in Mio's bag] — prose has Kotone's gaze pause on the mirror poking out of Mio's bag "不到一秒" (`chapter_1/act4.md:135-141`); plan Scene 3 / foreshadow table only lists "琴音看到研究名稱停頓" (`docs/chapter_1_plan.md:627`). Worth folding into plan: Y — a subtle, canon-consistent seed (Kotone-as-interceptor recognises the object) that strengthens reread payoff without exposing her early.

- [Kotone's fixed hospital visit] — prose has Kotone say "我等下還要繞去一趟——妹妹那邊的探視，順路" without naming the sister (`chapter_1/act4.md:161`); plan lacks it. Worth folding into plan: Y — this is exactly Task 8's "琴音固定探視／醫院來電，但不說妹妹姓名" seed (`final_polish.md:332`), already correctly executed in prose; the plan should record it so it is not lost.

- [father's given name] — prose names him 朝倉源一郎 (`chapter_1/act3.md:89,97`); plan ch1 only says "朝倉刑警" (`docs/chapter_1_plan.md:48`). Canonical per `docs/characters.md:183`. Worth folding into plan: Y — name is locked in the registry; recording it in the plan prevents drift.

- [Kusakabe's two-stop warning beats] — prose gives Kusakabe a clean two-beat ("妳是朝倉源一郎的女兒吧" → "妳父親以前也是這麼想的", `chapter_1/act3.md:89-99`) where the plan only suggested the second line (`docs/chapter_1_plan.md:373`). Worth folding into plan: N — execution detail, not canon.

- [Mio messages Kotone a 22:00 safety deadline] — prose has Mio send "如果 22:00 前我沒回覆你，就照約定的方式聯絡我" (`chapter_1/act6.md:81`); plan Scene 5 mentions the message but not the exact 22:00 anchor (`docs/chapter_1_plan.md:550`). Worth folding into plan: Y — this timestamp becomes the hook the Ch2/Ch3 "21:19 已讀未回" payoff hangs on; pinning it prevents the corruption seen in ch4 act1 (see ch4 report).

## C. P0 keyword scan (this chapter only)

Sources scanned: `docs/chapter_1_plan.md` + `chapter_1/act*.md`.

- `帶上鏡子` — **1 hit.** `chapter_1/act6.md:1` (act title `# 第六幕：帶上鏡子`). ⚠️ P0 violation in a scene heading. The message body at `act6.md:25` is clean ("帶上悠真留下的那件東西"). Plan has zero hits.
- `這一輪|上一輪` — **0 hits.** (No loop language; chapter is loop-1 and correctly unaware.) ✔
- `藤川琴音` — **0 hits.** Prose uses 白石琴音 throughout (`act4.md:11` etc.). ✔
- `悠真手機相簿|手機相簿` — **0 hits.** ✔ (Task 3 is ch9/12/17; not yet relevant.)
- `日下部完整記得|完整記得第二輪` — **0 hits.** ✔
- `千田證明前輪` — **0 hits.** ✔

Attribution note: no Kotone loop-language to attribute (zero `這一輪/上一輪` hits, and Kotone's green-tea beat carries no loop wording in prose).

## D. Phase 2 foreshadow seed check (this chapter)

Task 8 (Ch1 family/object foreshadow, `final_polish.md:328-339`) — item status:

- Task 8 短波接收器 (mother's modified shortwave receiver): **MISSING** — absent from plan and prose.
- Task 8 收音機靜電 (Yuma's daily reaction to radio static): **MISSING** — absent from plan and prose.
- Task 8 北海道研究會照片: **MISSING** — absent from plan and prose.
- Task 8 紗英腦波/睡眠研究書: **MISSING** — the prose only has the *cover-story* leaflet "關東青少年睡眠支援計畫" (`act1.md:85`); Sae's home research book is not present.
- Task 8 夢要先寫日期 (family habit of dating dreams): **MISSING** — absent from plan and prose (the black-sea dream is present, `act1.md:13-23`, but no date-writing habit).
- Task 8 琴音固定探視 (without naming sister): **present-in-prose** (`act4.md:161`), **MISSING-in-plan**.

Other Phase 2 seeds (Tasks 9–16) are not due until ch5+; none appear early in ch1 except the Task 11 *precursor* "7秒 push delay" which ch1 correctly plants as "晚了幾秒" (`act7.md:35-37`) without the number — consistent with plan §0.7. No Task 11 *peak-metadata* (06:12:53 / 06:13:00) present, correctly.
