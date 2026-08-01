# Red-Team Review 1 — Mystery / Reasoning Fairness

> **Reviewer persona:** a dedicated mystery reader who tries to solve every puzzle before the story reveals it.
> **Scope:** `canon/05_clue_foreshadowing_map.md`, `canon/03_evidence_ledger.md`, `canon/07_open_mysteries_and_final_answers.md`; prose spot-check of clue-reveal scenes (ch1–4 train case, ch5–6 construction passage, ch7–8 Kotone breakage, ch13–16 TOKYO-7, ch22–23 Kotone identity, ch26 Subject Bay).
> **Method:** for each question I verify whether the *reader* is given the clue before it becomes load-bearing, whether any solution leans on info a character shouldn't have, and whether any endgame rule is invented late.

---

## Overall verdict: **FAIR** (one known, low-impact gap unmitigated)

The mystery is honestly constructed. Every Class-1 solution can be reached (or strongly suspected) from clues placed strictly before its reveal, and the author has built an explicit in-universe discipline — the ch22 "約束式重建" (constraint-based reconstruction) — whose entire purpose is to *prevent* a character's memory from manufacturing the answer. That the epistemology itself is dramatized is the single strongest fairness signal in the book.

The only item the canon itself flags (Subject Continuity Bay / clinical latch, `C7.3 / R1`, Gate 2 M8 FAIL) is **still unmitigated in prose** — the recommended ch24/25 back-seed was not added. Its real impact on solvability is low (see Q4 / Blockers), so it is a fairness nit, not a mystery-breaker.

---

## Answers to the five main questions

### Q1 — Can the train case be overturned using ONLY clues the reader has been given?
**Yes — completely, and early.** By the end of ch3 an attentive reader holds every physical fact needed to reject the official "密室刺殺" version:
- Blood origin sits *below* the seat, not at the collapse point (`ch3/act2` line 33: "血痕的起點比她以為的位置更低"), explicitly noticed by 澪.
- Mio's cuffs carry no splatter pattern (`ch2/act5` line 91: "袖口沒有那種噴濺出來的血點"); the body/clothes under the coat are clean (`ch3/act2` line 95) — a "silent alibi" the author never high-points but plants objectively.
- The failed 止血貼/膠布 + old, dark, already-soaked blood is shown when medics cut the coat (`ch2/act5` line 67, `ch3/act2` line 29) — 澪 herself concludes "他上車前就受傷了" in-chapter.
- The shell is shown to have gold contacts, a pried (not cut) broken edge, and *no insertion-depth mark* → it cannot be the blade the evidence tag ("刃物狀金屬片") claims (`ch3/act1`, `ch3/act2`).
- 千田's dying fragments "不是這裡" + "別先看畫面。血比較老實" (`ch2/act3`, `ch2/act5`) are given verbatim and are the cleanest possible pointer to *death-location ≠ attack-location* + *trust the blood, not the footage*.

No piece of the "how" requires information withheld until later. The +11s footage gap is seeded ch2–3; the +7s phone lag ch1. **What *cannot* be solved early is "who" — that needs ch22–23's five-way document cross-match.** That split (how=solvable ch3; who=solvable ch22) is exactly the right difficulty curve for a 28-chapter mystery.

### Q2 — Which evidence is most likely to feel like author cheating?
**The Subject Continuity Bay + `clinical latch` (`C7.3`), first appearing ch26.** It is the *only* mechanism with no prior seed: `CLINICAL HOLD` (ch21) and the HSMs (ch24) cover the "who authorizes" layer, but the *physical* containment layer — the Bay's existence and the latch primitive that ultimately refuses break-glass in ch27 — drops in at `ch26/act2–act3`. A reader who tracks mechanisms will feel a new moving part appear in the endgame.

Mitigating factors that keep it from being a true cheat: (a) ch26 act3 *stages it as a fair discovery* — the local technician traces the service alias Kotone recognizes → the physical Bay via line-mapping; the reader learns it when the cast does; (b) the ch27 break-glass actually fails on **governance** (three independent domains DENY), not on the reader having pre-known the Bay; (c) the canon itself owns this as the single FAIL.

Runner-up: **琴音 knowing the unannounced hospital name** (`ch7/act4` "灣岸中央"). At first glance a character "just knows" something. But the prose immediately supplies a low-risk verification (搬送醫院未公開; four plausible hospitals nearby) so the reader sees it *isn't* a guess, and the later explanation (神鏡支援線 fed her the data — `KOT-02`) is seeded as a non-loop source. Fair, but it is the clue most likely to make a casual reader shout "convenient" before the payoff.

### Q3 — Is Kotone's identity reveal too early or too late?
**Neither — well-paced.** The breakage escalates in three deliberate steps the reader can re-verify:
1. ch1 — drinks a different beverage than usual; micro-pauses at the sleep-study name (extremely faint, "only stings on re-read" — correct low intensity).
2. ch7 — slips "灣岸中央" (hospital name Mio never sent); ch4 she asks "悠真留給妳的東西還在嗎" (she knows the object mattered).
3. ch22 (patient matrix: 美空's sister = Kotone) → ch23 (five-way current-loop cross-match: FAMILY-ASSIST request + contractor work order + one-time access + maintenance clothes + device 2FA = the 21:04 figure; she admits the clothes/access/item).

A reader *could* suspect Kotone by ch7–8 — but "suspect" is the intended state, and confirming it requires the ch23 documents. Crucially the reveal is built on **current-loop provable behavior** (`PASS-04`, `KOT-05`), never on her loop-memory, so it never feels like the author pulled a name from a hat. Not early enough to be guessed chapters ahead with certainty; not late enough to feel unclued.

### Q4 — Are the CCTV and casing evidence contaminated by cross-loop knowledge?
**No — the memory-only-loop discipline holds, and there is a built-in guard against reverse-contamination.** Canon locks it (`§7.2`, evidence ledger §速記 1): physical evidence cannot cross loops; only memory does; R3 legal handling rests on current-loop provable acts. The casing specifically carries an anti-cheat device: `SHELL-03` has 澪 draw her **paper sketch in R2 *before* any comparable hardware photo exists** (`canon/05` C1.3, `03` SHELL-03), preempting the "she 'remembered' details that match later hardware" objection. The 21:04 attacker identity in R3 is established by **fresh current-loop documents** (門禁、工單、支援代理濫用), not by anyone's prior-loop memory of the assault (`PASS-04`, `KOT-05`). The cross-loop assault is explicitly demoted to `PRIOR-LOOP ASSAULT LOCATION / UNCORROBORATED / NOT ADJUDICATIVE` (`PASS-06`). Clean.

### Q5 — Does loop 2 (R2) genuinely provide NEW information, or just replay loop 1?
**Genuinely new.** R1 gives only the *result* (千田 already bleeding on the train + dying clues). R2 lets 澪 arrive early and **witness the mechanism**: she sees the maintenance-clad figure social-engineer 千田 into the construction passage at 21:02–21:04 (`ch5/act7–act8`) — a card flashed, "中央流…第七車…月台不安全," 千田 nodding and following voluntarily — and she follows them in, discovering the attack *site* (the passage) and its CCTV-off condition. That is fresh visual evidence (the lure method, the location, 千田's voluntary compliance), not a replay. R2 is what converts the ch3 hypothesis ("attacked before boarding") into a *witnessed* event.

---

## Additional mystery-reader checks

- **Does any mystery get solved by a character suddenly receiving data they shouldn't have?** No. Kotone's non-public knowledge is sourced to the 神鏡支援線 (transport/case data), explicitly *not* loop memory (`KOT-02`, `07` §1.5). 紗英's cross-individual blind-test match (`X-09`) is deliberately left "來源未定" (source undetermined) — the author refuses to explain it away, so it never becomes a convenient answer-machine. The R4 echo arrives only through the seeded M-00 hosting channel (`C4.8`, `R4-01`).
- **Does any solution depend on an endgame (ch25–28) rule that wasn't seeded earlier?** No new *reasoning* rule is invented late. Lease/HOLD/distributed-patient-safety are seeded ch21–25 (`C7.1/7.4/7.5`); KAGAMI-01 ch20; Witness sideband ch20; R4 ch21–22; MAR-CONT ch15. **The lone exception is the *physical* Subject Continuity Bay / latch (`C7.3`) — a setting element, not a reasoning rule — first seen ch26.** See Q2/Q4.
- **Is the 千田 death puzzle solvable by an attentive reader before ch23?** **Yes** — the *what/how* (official version is falsified; attack preceded boarding; shell isn't the weapon) is fully solvable by ch3–4 from the five physical clues above. The *who* is intentionally held to ch22–23. This is the correct layering.
- **Is the TOKYO-7 reveal (ch14–16) fairly foreshadowed?** **Yes.** T/7 scratch under blood (`ch3/act1`); 千田's "大規模災害警報同步介面" job cache (`ch4/act5`); "不要救東京" + "他們會說那是救援" (`ch2/act5`). The ch14 payoff lands on **paper council documents** (配布日期, 委員會章, 收件戳, 申請編號) showing `TOKYO` config → `G07` mapping and the `+7000ms` channel offset — and the prose even dramatizes 澪 *almost* misreading 7000 as 700, then re-checking the original, a staged anti-"convenient number" guard. The four-channel offset table (0/1200/7000/9500ms) presents 7000 as ordinary engineering, not a magic constant. Exemplary fair-play.

---

## BLOCKER fairness issues
**None.** No mystery is unsolvable from given clues, no solution rests on unearned character knowledge, and no endgame *reasoning* rule is invented late.

## Non-blocking issues to consider (ordered by impact)
1. **Subject Continuity Bay / `clinical latch` (ch26 intro, unmitigated).** Implement the canon's own recommendation: a one-line low-intensity back-seed in ch24 or ch25 (e.g., 日下部 or an independent system-safety staffer notes the HOLD resolves to a "Subject Continuity Bay" whose door is governed by a clinical latch — giving *status*, not geography/IDs). This closes the only flag the canon already owns. **Low actual solvability impact** (ch27 denial runs on governance, not on the Bay), but it is the single item most likely to read as "new rule in the endgame."
2. **"座標在唱" seed → ch28 payoff is ~19 chapters long and goes quiet after ch10 (`R2`).** Not unfair (seed is correctly low-intensity), but the payoff's surprise may be diluted. A one-word echo of "座標" during the ch20 Hakodate analysis would keep the chain warm. Cosmetic.
3. **父親 line goes near-dormant ch4–ch20 (`R7`).** Not a fairness risk (father is emotional/thematic, not a deduction line), but a light ch17 or ch20 callback would strengthen the MAR-CONT → father link that ch28 cashes in.

> The book's strongest fairness asset is that it makes its own anti-cheating rule a plot point: 澪's memory is sealed out of the R4 reconstruction precisely so the answer must come from the system's constraints, not from a protagonist's convenient recall. A mystery reader who notices this trusts the author for the rest.
