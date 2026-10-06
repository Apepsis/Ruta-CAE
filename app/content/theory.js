/* Topics = the units the app tracks, teaches and schedules. */
window.TOPICS = [
 {id:"inv",name:"Inversion",grp:"Grammar",paper:"uoe",w:1.2},
 {id:"cleft",name:"Cleft sentences & emphasis",grp:"Grammar",paper:"uoe",w:.9},
 {id:"cond",name:"Conditionals & alternatives to if",grp:"Grammar",paper:"uoe",w:1.1},
 {id:"wish",name:"Wish, if only, would rather, it's time",grp:"Grammar",paper:"uoe",w:.8},
 {id:"pass",name:"Passive, causative & reporting passives",grp:"Grammar",paper:"uoe",w:1},
 {id:"modal",name:"Modal verbs (deduction, obligation, past)",grp:"Grammar",paper:"uoe",w:1},
 {id:"verbpat",name:"Verb patterns: -ing vs to-infinitive",grp:"Grammar",paper:"uoe",w:1},
 {id:"rel",name:"Relative & participle clauses",grp:"Grammar",paper:"uoe",w:.9},
 {id:"rep",name:"Reporting verbs & reported speech",grp:"Grammar",paper:"uoe",w:.8},
 {id:"comp",name:"Comparison & degree structures",grp:"Grammar",paper:"uoe",w:.8},
 {id:"quant",name:"Articles, quantifiers & determiners",grp:"Grammar",paper:"uoe",w:.8},
 {id:"link",name:"Linkers & discourse markers",grp:"Grammar",paper:"uoe",w:1.1},
 {id:"pv",name:"Phrasal verbs",grp:"Vocabulary",paper:"uoe",w:1.4},
 {id:"coll",name:"Collocations",grp:"Vocabulary",paper:"uoe",w:1.4},
 {id:"idiom",name:"Idioms & fixed expressions",grp:"Vocabulary",paper:"uoe",w:1.1},
 {id:"deppr",name:"Dependent prepositions",grp:"Vocabulary",paper:"uoe",w:1},
 {id:"confus",name:"Easily confused words",grp:"Vocabulary",paper:"uoe",w:1},
 {id:"wf",name:"Word formation",grp:"Vocabulary",paper:"uoe",w:1.3},
 {id:"tvoc",name:"Topic vocabulary (C1 word lists)",grp:"Vocabulary",paper:"uoe",w:1.1},
 {id:"read",name:"Reading skills",grp:"Skills",paper:"reading",w:1},
 {id:"listen",name:"Listening skills",grp:"Skills",paper:"listening",w:1},
 {id:"write",name:"Writing genres",grp:"Skills",paper:"writing",w:1},
 {id:"speak",name:"Speaking strategies",grp:"Skills",paper:"speaking",w:1}
];

/* Short lesson cards shown at the start of a study session (the "mini-lesson"). */
window.LESSONS = {
 inv:["After a negative or restrictive adverbial at the START of a clause, use question word order: <b>Never have I seen</b>…, <b>Not until</b> she left <b>did I</b> realise…","Watch the position: with <i>Not until / Only when / Only after / Only by</i> the inversion goes in the SECOND clause.","Conditionals can invert and drop <i>if</i>: <b>Had I known</b> = If I had known; <b>Should you need</b> = If you need; <b>Were it not for</b> = If it weren't for."],
 cleft:["<b>What</b> I need is a break. / <b>All</b> I did was ask. (focus on the thing)","<b>It was</b> Sarah <b>who</b> called. / <b>It wasn't until</b> 2010 <b>that</b>… (focus on person/time)","The <b>reason (why)</b> / The <b>thing</b> / The <b>last thing</b> I want is…"],
 rep:["Reporting verbs carry the pattern: <b>accuse sb of</b> -ing, <b>blame sb for</b>, <b>deny</b> -ing, <b>promise/refuse/offer to</b>, <b>advise/warn/urge sb to</b>, <b>suggest</b> -ing / that sb (should) do.","<b>insist on</b> -ing, <b>apologise for</b>, <b>congratulate sb on</b>, <b>admit (to)</b> -ing, <b>threaten to</b>.","Backshift is optional when the fact is still true; time words change (tomorrow → the next day)."],
 cond:["Mixed: <b>If I had studied</b> medicine (past), <b>I would be</b> a doctor now (present).","Alternatives to <i>if</i>: <b>provided/providing (that), as long as, on condition that, unless, suppose/supposing, otherwise, but for, in case</b>.","<b>But for</b> + noun = if it hadn't been for. <b>Otherwise</b> = if not."],
 wish:["Present regret → past simple: I wish I <b>knew</b>. Past regret → past perfect: I wish I <b>had known</b>.","Annoyance about others → would: I wish you <b>would stop</b> (not for yourself: ✗I wish I would).","<b>It's (high) time</b> we <b>left</b>. <b>I'd rather</b> you <b>didn't</b> smoke. (past form, present meaning)"],
 pass:["Reporting passive: <b>It is said that</b> he is rich → <b>He is said to be</b> rich / <b>to have been</b> rich (past).","Causative: <b>have/get something done</b>; <b>have someone do</b>; <b>get someone to do</b>.","Passive with two objects: She <b>was given</b> a prize. Prepositional verbs keep the preposition: He was <b>looked up to</b>."],
 modal:["Past deduction: <b>must have</b> (certain yes), <b>can't/couldn't have</b> (certain no), <b>may/might/could have</b> (possible).","<b>needn't have done</b> (did it, unnecessary) vs <b>didn't need to do</b> (probably didn't do it).","<b>should have / ought to have</b> = past criticism; <b>was supposed to</b> = expected but didn't happen."],
 verbpat:["Meaning changes: <b>remember/forget/stop/try/regret/go on/mean</b> + -ing vs to-inf.","<b>to</b> as preposition + -ing: look forward to, object to, be used to, when it comes to, in addition to, with a view to.","After <b>prevent/stop/discourage sb from</b> -ing; <b>succeed in</b> -ing; <b>insist on</b> -ing."],
 rel:["Non-defining (commas): no <i>that</i>; <b>which</b> can refer to a whole clause: He was late, <b>which</b> annoyed me.","Prepositions: the person <b>to whom</b> I spoke; <b>some of which</b>, <b>none of whom</b>, <b>by which time</b>.","Participle clauses: <b>Having finished</b>, she left. <b>Built</b> in 1900, the house… <b>Not knowing</b> what to do…"],
 comp:["<b>The more</b> you practise, <b>the better</b> you get.","Degree: <b>nowhere near as</b> / <b>not nearly as</b> / <b>by far the</b> / <b>considerably more</b> / <b>every bit as</b>.","<b>so</b> + adj + <b>that</b>; <b>such (a)</b> + adj + noun + <b>that</b>; <b>too</b> adj <b>for</b> sb <b>to</b> do; adj <b>enough to</b>."],
 quant:["<b>few</b> (negative) vs <b>a few</b> (positive); <b>little</b> vs <b>a little</b>.","<b>each</b> (individually) / <b>every</b> (all, ≥3) / <b>either</b> / <b>neither</b> + singular verb.","<b>all of whom</b>, <b>much as</b> (= although), <b>such as</b>; zero article for general plurals/uncountables."],
 link:["Contrast: <b>although, even though, whereas, while, despite / in spite of + noun/-ing, nevertheless, nonetheless, much as</b>.","Purpose/result: <b>so as (not) to, in order (not) to, so that, consequently, hence, thereby</b>.","Addition/time: <b>moreover, furthermore, not to mention, as well as</b> + -ing; <b>no sooner… than, hardly… when</b>."],
 pv:["Phrasal verbs are tested in Part 1 (choose the verb), Part 2 (missing particle) and Part 4 (paraphrase).","Learn them by MEANING groups: e.g. <i>reduce</i> → cut back on, scale down; <i>tolerate</i> → put up with; <i>discover</i> → find out, come across.","Watch the particle: <b>come up with</b> (an idea) vs <b>come up against</b> (a problem) vs <b>come down with</b> (an illness)."],
 coll:["C1 collocations are about which verb/adjective goes with a noun: <b>pay attention, take into account, draw a conclusion, raise awareness</b>.","Part 1 options are often near-synonyms; only one collocates: <b>heavy</b> traffic, <b>strong</b> coffee, <b>bitterly</b> disappointed.","Record whole chunks, never single words."],
 idiom:["Idioms in UoE are mostly fixed phrases: <b>at a loss, by no means, on the verge of, in the long run</b>.","Avoid old-fashioned idioms in writing; use neutral, current ones.","One word is usually fixed: you <b>take</b> something for granted, never ✗make."],
 deppr:["Adjective + prep: <b>capable of, aware of, keen on, responsible for, prone to, familiar with</b>.","Verb + prep: <b>account for, comply with, consist of, insist on, object to, result in/from</b>.","Noun + prep: <b>demand for, increase in, access to, reason for, solution to, threat to</b>."],
 confus:["Near-synonyms differ in collocation or grammar: <b>raise</b> (transitive) vs <b>rise</b>; <b>affect</b> (v) vs <b>effect</b> (n).","Read the whole sentence: what comes AFTER the gap (preposition, that-clause, -ing) decides it.","Typical sets: <i>lack/shortage/absence</i>, <i>job/work/career</i>, <i>prevent/avoid/protect</i>."],
 wf:["Decide the PART OF SPEECH first (look left and right of the gap), then the meaning (positive/negative), then number (plural?).","Expect 2+ changes: prefix + suffix (<b>un</b>believ<b>ably</b>), internal changes (<b>long → length</b>, <b>deep → depth</b>).","Common negatives: un-, in-, im-, il-, ir-, dis-, mis-, non-, under-, over-."],
 tvoc:["Learn words in TOPIC sets (environment, work, health…): the exam, especially Writing and Speaking, rewards precise topic vocabulary.","For every word learn its <b>part of speech</b> and one <b>collocation</b>: <i>cut emissions</i>, <i>meet a deadline</i>, <i>alleviate symptoms</i>.","Use new words actively: put two of today's words into your next essay or speaking answer."],
 read:["Part 5: the answer paraphrases the text; options that copy words from the text are often traps.","Part 6: identify each writer's opinion on the topic BEFORE reading the questions.","Part 7: check reference words (this, these, such, however) on BOTH sides of the gap. Part 8: scan for paraphrase, not keywords."],
 listen:["You hear everything twice: first listen = gist + candidates; second = confirm.","Distractors: the speaker mentions an option and then rejects/qualifies it (but, actually, not that…).","Part 2: write the exact words you hear; spelling must be correct. Part 4: do Task 1 on first listening, Task 2 on second."],
 write:["Part 1 = ESSAY (compulsory, 220–260 words): discuss 2 of the 3 points, say which is more important and WHY.","Part 2: letter/email, proposal, report, review. Register and layout are marked (Communicative Achievement).","Plan 5 min: paragraph per idea, topic sentence, linkers, one complex structure per paragraph (inversion, cleft, participle)."],
 speak:["Part 1: extend answers (2–3 sentences, reason + example). Part 2: COMPARE and SPECULATE, don't describe; 1 minute.","Part 3: interact — ask your partner, build on their ideas, don't rush to decide. Part 4: give opinions with justification.","Fillers that buy time: <i>That's an interesting question… On reflection I'd say…</i>"]
};

/* Full theory pages (Theory tab). Each section belongs to a topic id. */
window.THEORY = [
{id:"exam",title:"The exam at a glance",html:`
<p>C1 Advanced has four papers; Speaking is separate. Each paper is reported on the <b>Cambridge English Scale</b> (160–210); your overall score is the average of the five skills.</p>
<div class="tablewrap"><table class="t"><thead><tr><th>Paper</th><th>Time</th><th>Parts</th><th>What it tests</th></tr></thead><tbody>
<tr><td>Reading &amp; Use of English</td><td>1 h 30</td><td>8 parts · 56 questions</td><td>P1 multiple-choice cloze (8) · P2 open cloze (8) · P3 word formation (8) · P4 key word transformations (6, 2 marks each) · P5 multiple choice (6) · P6 cross-text matching (4) · P7 gapped text (6) · P8 multiple matching (10)</td></tr>
<tr><td>Writing</td><td>1 h 30</td><td>2 tasks</td><td>P1 essay (compulsory) · P2 one of: letter/email, proposal, report, review · 220–260 words each</td></tr>
<tr><td>Listening</td><td>~40 min</td><td>4 parts · 30 questions</td><td>P1 3 extracts MC (6) · P2 sentence completion (8) · P3 interview MC (6) · P4 multiple matching, two tasks (10)</td></tr>
<tr><td>Speaking</td><td>15 min (pairs)</td><td>4 parts</td><td>P1 interview · P2 long turn with pictures · P3 collaborative task · P4 discussion</td></tr>
</tbody></table></div>
<h3>Scale and grades</h3>
<div class="tablewrap"><table class="t"><thead><tr><th>Scale score</th><th>Result</th><th>CEFR</th></tr></thead><tbody>
<tr><td class="n">200–210</td><td>Grade A</td><td>C2</td></tr><tr><td class="n">193–199</td><td>Grade B</td><td>C1</td></tr><tr><td class="n">180–192</td><td>Grade C</td><td>C1</td></tr><tr><td class="n">160–179</td><td>Level B2</td><td>B2</td></tr></tbody></table></div>
<p>Rule of thumb: about <b>60%</b> of the marks in a paper ≈ <b>180</b>; about <b>80%</b> ≈ <b>200</b>. Ruta C2 uses the same curve to estimate your scores.</p>
<h3>Tips from a C2 candidate (your project notes)</h3>
<ul><li>Do full mock tests, then attack the parts where you fail most.</li><li>Many people do Reading &amp; UoE in the order 4 → 1, then 5 → 8. Leave a margin: nerves slow you down.</li><li>Writing: master the structure of at least two Part 2 genres. Formal letter: <i>Dear Sir or Madam … Yours faithfully</i>; named person: <i>Dear Mr Smith … Yours sincerely</i>.</li><li>Speaking: always extend, compare and speculate in Part 2, interact with your partner in Part 3.</li></ul>`},
{id:"inv",title:"Inversion",html:`
<p>Inversion = auxiliary before subject, as in a question. It adds emphasis and is typical of formal writing and Part 4 transformations.</p>
<h3>1. Negative and restrictive adverbials</h3>
<div class="tablewrap"><table class="t"><tbody>
<tr><td><b>Never (before) / Rarely / Seldom / Hardly ever</b></td><td><i>Seldom have I</i> met such a generous person.</td></tr>
<tr><td><b>Not only … but (also)</b></td><td><i>Not only did he</i> apologise, <i>but he also</i> paid for the damage.</td></tr>
<tr><td><b>No sooner … than / Hardly / Scarcely / Barely … when</b></td><td><i>No sooner had we</i> arrived <i>than</i> it started to rain. <i>Hardly had I</i> sat down <i>when</i> the phone rang.</td></tr>
<tr><td><b>Under no circumstances / On no account / In no way</b></td><td><i>On no account should you</i> open this door.</td></tr>
<tr><td><b>Not until / Only when / Only after / Only by / Only then</b></td><td><i>Not until</i> I got home <i>did I</i> notice. (inversion in the 2nd clause)</td></tr>
<tr><td><b>Little</b></td><td><i>Little did she know</i> that she was being watched.</td></tr>
<tr><td><b>At no time / Nowhere / Not once / Not a single</b></td><td><i>At no time was</i> the public in danger. <i>Not a word did</i> he say.</td></tr>
<tr><td><b>So / Such</b></td><td><i>So great was</i> the demand that… <i>Such was</i> his anger that…</td></tr>
</tbody></table></div>
<h3>2. Inverted conditionals (no <i>if</i>)</h3>
<ul><li><b>Had</b> I known = If I had known (3rd)</li><li><b>Were</b> I you / <b>Were</b> it not for = If I were / If it weren't for (2nd)</li><li><b>Should</b> you need help = If you (happen to) need help (1st, formal)</li><li><b>Had it not been for</b> his help = But for his help</li></ul>
<h3>3. Common traps</h3>
<ul><li>✗ <i>Not until I got home I noticed</i> → ✓ <i>did I notice</i>.</li><li>✗ <i>Never I have seen</i> → ✓ <i>Never have I seen</i>.</li><li>After <i>Only</i> + subject alone there is NO inversion in that clause: <i>Only John knew</i> (subject focus).</li><li>Negatives in the middle of a sentence don't invert: <i>I have never seen…</i></li></ul>`},
{id:"cleft",title:"Cleft sentences & emphasis",html:`
<h3>It-clefts</h3><p><b>It + be + focus + that/who</b> clause. <i>It was the noise that kept me awake.</i> <i>It wasn't until midnight that she called.</i> <i>It is you who are responsible.</i></p>
<h3>Wh-clefts (pseudo-clefts)</h3><p><b>What + clause + be + focus</b>. <i>What I can't stand is rudeness.</i> <i>What happened was (that) the car broke down.</i> <i>What he did was (to) call the police.</i></p>
<h3>Other emphasising frames</h3><ul><li><b>All</b> I want is some peace. (= the only thing)</li><li><b>The thing/reason/place/person</b> (that)… <i>The reason why I left was…</i></li><li><b>The last thing</b> I expected was an apology.</li><li><b>Do/does/did</b> for emphasis: <i>I did warn you!</i></li><li><b>Whatever / However</b> + <b>much</b>: <i>However hard I try…</i></li></ul>
<h3>Part 4 patterns</h3><ul><li>“I only realised when I read the letter.” → <b>It was only when I read</b> the letter <b>that I realised</b>.</li><li>“He just wanted to help.” → <b>All he wanted was to</b> help.</li></ul>`},
{id:"cond",title:"Conditionals & alternatives to if",html:`
<div class="tablewrap"><table class="t"><tbody>
<tr><td>Zero</td><td>If you heat ice, it melts.</td></tr><tr><td>1st</td><td>If it rains, we'll stay in.</td></tr><tr><td>2nd</td><td>If I had more time, I'd travel.</td></tr><tr><td>3rd</td><td>If she had left earlier, she would have caught the train.</td></tr>
<tr><td>Mixed (past→present)</td><td>If I <b>had accepted</b> that job, I <b>would be living</b> in Paris now.</td></tr>
<tr><td>Mixed (present→past)</td><td>If I <b>weren't</b> so shy, I <b>would have spoken</b> to her.</td></tr></tbody></table></div>
<h3>Words that replace <i>if</i></h3><ul>
<li><b>Unless</b> = if … not. <i>Unless you hurry, you'll miss it.</i></li>
<li><b>Provided / providing (that), as long as, on condition (that)</b> = only if.</li>
<li><b>Suppose / supposing / imagine</b> = what if.</li>
<li><b>In case</b> = as a precaution (NOT = if). <i>Take an umbrella in case it rains.</i></li>
<li><b>Otherwise / or else</b> = if not. <i>Leave now, otherwise you'll be late.</i></li>
<li><b>But for</b> + noun = if it hadn't been for. <i>But for your help, I would have failed.</i></li>
<li><b>Even if</b> (no difference) vs <b>even though</b> (fact).</li>
<li><b>If it hadn't been for / Had it not been for / Without</b> + noun.</li>
<li><b>If so / if not / if anything</b>: <i>Prices haven't fallen; if anything, they've risen.</i></li></ul>`},
{id:"wish",title:"Wish, if only, would rather, it's time",html:`
<div class="tablewrap"><table class="t"><tbody>
<tr><td>Present wish</td><td>wish/if only + <b>past simple / continuous</b></td><td>I wish I <b>lived</b> nearer.</td></tr>
<tr><td>Past regret</td><td>wish/if only + <b>past perfect</b></td><td>If only I <b>hadn't said</b> that.</td></tr>
<tr><td>Annoyance / desire for change (others)</td><td>wish + <b>would</b></td><td>I wish he <b>would stop</b> interrupting.</td></tr>
<tr><td>Ability</td><td>wish + <b>could</b></td><td>I wish I <b>could</b> swim.</td></tr>
<tr><td>It's (high/about) time</td><td>+ subject + <b>past simple</b> / + <b>to</b> inf</td><td>It's high time you <b>got</b> a job.</td></tr>
<tr><td>Would rather / would sooner</td><td>+ subject + <b>past</b> (other person) / + bare inf (same)</td><td>I'd rather you <b>didn't</b> tell her. I'd rather <b>stay</b>.</td></tr>
<tr><td>As if / as though</td><td>+ past for unreal</td><td>He acts as if he <b>owned</b> the place.</td></tr>
</tbody></table></div>
<p>Part 4 favourite: “I regret not studying harder.” → <b>I wish I had studied</b> harder. / “You should go home now.” → <b>It's time you went</b> home.</p>`},
{id:"pass",title:"Passive, causative & reporting passives",html:`
<h3>Reporting passive (say, believe, think, report, expect, consider, know, claim)</h3>
<ul><li><b>It is believed that</b> the thieves escaped by car.</li><li>→ <b>The thieves are believed to have escaped</b> by car. (past action → <i>to have + pp</i>)</li><li>→ <b>He is thought to be living</b> abroad. (ongoing → <i>to be + -ing</i>)</li><li><b>There is said to be</b> a ghost in the castle.</li></ul>
<h3>Causative</h3><ul><li><b>have/get + object + past participle</b>: I had my car repaired. I got my hair cut.</li><li>Unpleasant experience: She <b>had her bag stolen</b>.</li><li><b>have + person + bare inf</b>: I'll have the porter carry it. <b>get + person + to inf</b>: I got him to help me.</li></ul>
<h3>Other points</h3><ul><li>Infinitive/gerund passive: <i>He hates <b>being told</b> what to do. She expects <b>to be promoted</b>.</i></li><li><b>be due to / be bound to / be set to</b> often appear in formal reports.</li><li>Keep prepositions: <i>The matter is being <b>dealt with</b>. She was <b>looked after</b>.</i></li><li><b>Make</b> in passive takes <b>to</b>: <i>We were made <b>to</b> wait.</i></li></ul>`},
{id:"modal",title:"Modal verbs",html:`
<div class="tablewrap"><table class="t"><thead><tr><th>Meaning</th><th>Present</th><th>Past</th></tr></thead><tbody>
<tr><td>Certainty (yes)</td><td>must be</td><td><b>must have been</b></td></tr>
<tr><td>Certainty (no)</td><td>can't / couldn't be</td><td><b>can't / couldn't have been</b></td></tr>
<tr><td>Possibility</td><td>may / might / could be</td><td><b>may / might / could have been</b></td></tr>
<tr><td>Criticism / advice</td><td>should / ought to</td><td><b>should have / ought to have</b> (but didn't)</td></tr>
<tr><td>Unnecessary</td><td>needn't / don't have to</td><td><b>needn't have done</b> (did it anyway) · <b>didn't need to</b> (didn't do it)</td></tr>
<tr><td>Expectation</td><td>be supposed to</td><td><b>was supposed to</b> (didn't happen)</td></tr>
<tr><td>Ability</td><td>can / be able to</td><td>could (general) · <b>was able to / managed to</b> (one occasion)</td></tr></tbody></table></div>
<p>Useful C1 extras: <b>be bound to</b> (certain), <b>there's no point in</b> -ing, <b>you might as well</b>, <b>it's (not) worth</b> -ing, <b>be liable to</b>, <b>had better (not)</b>.</p>`},
{id:"verbpat",title:"Verb patterns: -ing vs infinitive",html:`
<h3>Meaning changes</h3><div class="tablewrap"><table class="t"><tbody>
<tr><td>remember / forget + -ing</td><td>memory of past action</td><td>+ to inf: action you must do</td></tr>
<tr><td>stop + -ing</td><td>finish the activity</td><td>+ to inf: stop in order to do something</td></tr>
<tr><td>try + -ing</td><td>experiment</td><td>+ to inf: make an effort</td></tr>
<tr><td>regret + -ing</td><td>sorry about past</td><td>+ to inf: sorry to announce</td></tr>
<tr><td>go on + -ing</td><td>continue</td><td>+ to inf: move on to next thing</td></tr>
<tr><td>mean + -ing</td><td>involve</td><td>+ to inf: intend</td></tr></tbody></table></div>
<h3>Always -ing</h3><p>avoid, deny, risk, resent, consider, involve, postpone, can't help, can't stand, it's no use, there's no point in, feel like, be worth, look forward to, object to, be/get used to, admit (to), confess to, in addition to, with a view to.</p>
<h3>Always to-infinitive</h3><p>afford, agree, aim, arrange, attempt, decline, deserve, fail, manage, offer, pretend, refuse, tend, threaten, be likely/bound/due to, the first/last to.</p>
<h3>Object + to-infinitive</h3><p>advise, allow, encourage, force, persuade, remind, urge, warn sb (not) to; <b>prevent/stop/discourage/prohibit sb from</b> -ing; <b>accuse sb of</b>; <b>congratulate sb on</b>; <b>blame sb for</b>.</p>`},
{id:"rel",title:"Relative & participle clauses",html:`
<ul><li>Defining (no commas): <i>The book <b>that/which</b> I lent you.</i> Object pronoun can be omitted.</li>
<li>Non-defining (commas): <i>My sister, <b>who</b> lives in Lima, …</i> — never <i>that</i>, never omitted.</li>
<li><b>which</b> referring to a whole clause: <i>He passed, <b>which</b> surprised everyone.</i></li>
<li>Formal prepositions: <i>the person <b>to whom</b> it may concern</i>, <i>the extent <b>to which</b></i>, <i><b>by which time</b></i>, <i><b>in which case</b></i>.</li>
<li>Quantifier + of + whom/which: <i>forty students, <b>most of whom</b> passed</i>.</li>
<li><b>whose</b> for possession (people and things); <b>whereby</b> = by which (formal: a system whereby…).</li></ul>
<h3>Participle clauses</h3><ul><li>Active, same time: <i><b>Walking</b> home, I saw…</i></li><li>Completed before: <i><b>Having finished</b> the report, she left.</i></li><li>Passive: <i><b>Built</b> in 1900, the bridge… / <b>Having been told</b>…</i></li><li>Negative: <i><b>Not knowing</b> the way, we…</i></li><li>Reduced relatives: <i>the people <b>living</b> next door, the money <b>raised</b> by the event</i>.</li><li>Dangling participle trap: ✗ <i>Walking home, the rain started.</i></li></ul>`},
{id:"comp",title:"Comparison & degree",html:`
<ul><li><b>The + comparative, the + comparative</b>: <i>The sooner, the better. The longer I wait, the angrier I get.</i></li>
<li>Big difference: <b>far, much, a great deal, considerably, significantly, by far (the best)</b>. Small: <b>slightly, a bit, marginally</b>.</li>
<li><b>nowhere near as / not nearly as / not anything like as</b> = much less.</li>
<li><b>every bit as … as</b> = equally. <b>just as</b>. <b>twice as … as</b>.</li>
<li><b>no + comparative + than</b>: <i>It's no bigger than a coin.</i></li>
<li><b>so + adj + that</b> / <b>such + (a) + adj + noun + that</b> / <b>so many/much/few/little</b>.</li>
<li><b>too … to</b>, <b>not … enough to</b>, <b>enough + noun</b>, <b>adj + enough</b>.</li>
<li><b>as … as possible / as … as ever</b>; <b>more often than not</b>; <b>none the wiser</b>.</li></ul>`},
{id:"quant",title:"Articles, quantifiers & determiners",html:`
<ul><li><b>few/little</b> = not enough (negative); <b>a few / a little</b> = some (positive); <b>quite a few</b> = many.</li>
<li><b>each</b> (2+, individually) / <b>every</b> (3+, as a group) + singular; <b>either / neither</b> (of two).</li>
<li><b>a great deal of</b> + uncountable; <b>a large number of</b> + plural; <b>plenty of, a lack of, a wealth of</b>.</li>
<li><b>no</b> + noun = not any; <b>none of</b> + the/my…; <b>not a single</b>.</li>
<li><b>whatever, whichever, whoever</b> (any … that); <b>such</b> (+ a/an) vs <b>so</b>.</li>
<li>Articles: zero for general plural/uncountables (<i>Crime is rising</i>), <i>the</i> for specific/unique, <i>a</i> for one of many and jobs (<i>she's an engineer</i>).</li>
<li>Fixed: <i>on the whole, at a loss, in the end, by the way, to a certain extent</i>.</li></ul>`},
{id:"link",title:"Linkers & discourse markers",html:`
<div class="tablewrap"><table class="t"><tbody>
<tr><td><b>Contrast (+ clause)</b></td><td>although, even though, though, whereas, while, much as, however + adj/adv</td></tr>
<tr><td><b>Contrast (+ noun/-ing)</b></td><td>despite, in spite of, notwithstanding, regardless of</td></tr>
<tr><td><b>Contrast (sentence adverbs)</b></td><td>however, nevertheless, nonetheless, even so, on the other hand, conversely</td></tr>
<tr><td><b>Addition</b></td><td>moreover, furthermore, in addition (to), besides, not to mention, what is more, as well as + -ing</td></tr>
<tr><td><b>Cause</b></td><td>because of, due to, owing to, on account of, as, since, in view of, given (that)</td></tr>
<tr><td><b>Result</b></td><td>so, consequently, as a result, therefore, hence, thus, thereby, accordingly</td></tr>
<tr><td><b>Purpose</b></td><td>so as (not) to, in order (not) to, so that, with a view to -ing, for fear of / lest</td></tr>
<tr><td><b>Concession/qualification</b></td><td>admittedly, granted, to some extent, as far as … is concerned, in terms of</td></tr>
<tr><td><b>Time</b></td><td>as soon as, no sooner … than, once, by the time, until, whereupon</td></tr></tbody></table></div>
<p>Part 2 favourites: <b>whereby, albeit, insofar as, let alone, as though, so as, such that, whether or not, if anything</b>.</p>`},
{id:"pv",title:"Phrasal verbs",html:`<p>The complete list (with meanings and examples) is in the <b>Phrasal verbs</b> section below and in the flashcard deck. Strategy:</p><ul><li>Learn particle meanings: <b>up</b> = completion/increase (use up, step up), <b>down</b> = reduction/stop (cut down, die down), <b>off</b> = departure/separation (call off, set off), <b>out</b> = to the end/away (run out, sort out), <b>over</b> = control/review (take over, look over), <b>through</b> = to completion (see through, fall through).</li><li>Three-part verbs never lose their preposition: <i>put up <b>with</b>, come up <b>with</b>, look down <b>on</b>, get round <b>to</b></i>.</li></ul>`},
{id:"coll",title:"Collocations",html:`<p>See the <b>Collocations</b> list below. High-frequency C1 verb + noun patterns:</p><ul><li><b>make</b>: an effort, a contribution, a living, progress, allowances for, a point of</li><li><b>take</b>: into account, for granted, advantage of, the initiative, a toll on, issue with</li><li><b>do</b>: harm, justice to, research, one's best, without</li><li><b>pay</b>: attention, tribute, a compliment, lip service</li><li><b>bear</b>: in mind, the brunt of, a resemblance to, responsibility</li><li><b>draw</b>: a conclusion, attention to, a distinction, the line</li><li><b>raise / meet / pose</b>: awareness, a concern / a deadline, a demand / a threat, a question</li></ul>`},
{id:"wf",title:"Word formation",html:`
<h3>Method</h3><ol><li>What part of speech? (after an article → noun; before a noun → adjective; after a verb → adverb)</li><li>Positive or negative? (read the whole sentence)</li><li>Singular or plural? Spelling!</li></ol>
<div class="tablewrap"><table class="t"><thead><tr><th>Type</th><th>Suffixes / prefixes</th><th>Examples</th></tr></thead><tbody>
<tr><td>Noun</td><td>-tion, -sion, -ment, -ness, -ity, -ance/-ence, -ship, -hood, -dom, -al, -ure, -th</td><td>reluctance, scarcity, hardship, withdrawal, depth, failure</td></tr>
<tr><td>Person</td><td>-er/-or, -ist, -ant/-ent, -ee, -ian</td><td>applicant, opponent, trainee, historian</td></tr>
<tr><td>Adjective</td><td>-able/-ible, -ful, -less, -ous, -ive, -al, -ic, -ish, -ent/-ant</td><td>noticeable, ambitious, decisive, sceptical, hesitant</td></tr>
<tr><td>Verb</td><td>-ise/-ize, -en, -ify, en-, be-</td><td>broaden, simplify, enable, endanger</td></tr>
<tr><td>Negative prefix</td><td>un-, in-, im-, il-, ir-, dis-, mis-, non-</td><td>irreversible, illegible, misleading, non-existent</td></tr>
<tr><td>Degree prefix</td><td>over-, under-, out-, re-, co-, inter-, counter-</td><td>underestimate, outnumber, counterproductive</td></tr></tbody></table></div>
<h3>Tricky spellings</h3><p>argue → argument · maintain → maintenance · pronounce → pronunciation · explain → explanation · repeat → repetition · deep → depth · long → length · strong → strength · wide → width · high → height · hero → heroism · courage → courageous · vary → variety/various · origin → originality · admit → admission · persuade → persuasive · compete → competitive/competition · sacrifice → sacrificial · apply → applicant/applicable · resist → irresistible.</p>`},
{id:"read",title:"Reading strategies (Parts 5–8)",html:`
<ul><li><b>Part 5 (multiple choice)</b>: read the stem, find the relevant paragraph, answer in your own words BEFORE reading the options. Wrong options often (a) use words from the text with a different meaning, (b) are true but don't answer the question, (c) are too strong.</li>
<li><b>Part 6 (cross-text)</b>: four writers on one topic. Summarise each writer's view on each sub-topic in 3 words in the margin. Questions ask who agrees/disagrees with whom.</li>
<li><b>Part 7 (gapped text)</b>: one extra paragraph. Use reference (this/these/such/it/they), lexical links (synonyms), time sequence, and contrast markers. Check both before AND after the gap.</li>
<li><b>Part 8 (multiple matching)</b>: read the questions first, scan the sections for paraphrases. Underline evidence; one section may answer several questions.</li>
<li>Timing: Parts 5–8 deserve ~55 minutes in total. Don't spend more than 2 minutes on any single UoE item.</li></ul>`},
{id:"listen",title:"Listening strategies",html:`
<ul><li><b>Part 1</b>: questions target attitude, opinion, purpose, agreement. Listen for <i>Both speakers… / What does the man imply…</i>; the answer often comes after a turn: “Actually…”, “Well, to be honest…”.</li>
<li><b>Part 2</b>: read the sentences and predict the type of word (noun? number? place?). The words you write are in the recording, but the sentence on the page paraphrases the rest. Traps: the speaker mentions 2–3 candidates and rejects some (“I expected it to be <i>interesting</i>, but it was <i>thrilling</i>”).</li>
<li><b>Part 3</b>: one question per 'chunk' of the interview, in order. Options paraphrase; the correct one is rarely the one with matching words.</li>
<li><b>Part 4</b>: two tasks. First listening: Task 1 for all five speakers. Second: Task 2 and checks. Three options in each task are distractors.</li>
<li>Signal words of rejection/qualification: <i>but, actually, in fact, not that…, though, if anything, that's not to say…</i></li></ul>`},
{id:"write",title:"Writing: genres, structure, phrases",html:`
<p>Each task is marked 0–5 on four criteria (max 20 per task, 40 in total):</p>
<ul><li><b>Content</b> – all points of the task covered, relevant, reader fully informed.</li><li><b>Communicative Achievement</b> – right genre conventions and register; holds the reader's attention; straightforward and complex ideas.</li><li><b>Organisation</b> – coherent paragraphs, varied cohesive devices and organisational patterns.</li><li><b>Language</b> – range of vocabulary (incl. less common lexis) and grammar used with control; errors don't impede.</li></ul>
<h3>Essay (Part 1, compulsory)</h3><p>Intro (paraphrase the issue) → point 1 → point 2 (choose 2 of 3) → conclusion: which is <b>more important/effective</b> and WHY. Use your own opinions from the notes, rephrased. Neutral/formal register.</p>
<p><i>It is often argued that… · A compelling case can be made for… · While it is true that…, it should be borne in mind that… · On balance, I would contend that… · The most pressing issue is undoubtedly…</i></p>
<h3>Proposal</h3><p>Headings. Purpose → current situation → suggestions → expected benefits/conclusion. Persuasive, formal. <i>The aim of this proposal is to… · I would therefore recommend… · It is anticipated that… · Should these measures be implemented…</i></p>
<h3>Report</h3><p>Headings. Introduction → findings → recommendations. Impersonal, factual. <i>This report sets out to… · It emerged that… · A significant proportion of respondents… · In light of the above, it is advisable that…</i></p>
<h3>Review</h3><p>Catchy title, engage the reader, describe briefly, evaluate, recommend. Semi-formal, vivid vocabulary. <i>If you're looking for… look no further · What sets it apart is… · My only reservation would be… · I would wholeheartedly recommend…</i></p>
<h3>Letter / email</h3><p>Dear Sir or Madam → Yours faithfully; Dear Mr Lee → Yours sincerely; friend → Best wishes. State purpose, cover each point in its own paragraph, close with expected action. <i>I am writing with regard to… · I would be grateful if you could… · I look forward to hearing from you.</i></p>`},
{id:"speak",title:"Speaking: parts & phrases",html:`
<ul><li><b>Part 1 (2 min)</b>: personal questions. Answer + reason + example. <i>I was born and raised in… / These days I'm mostly into… / I particularly cherish…</i></li>
<li><b>Part 2 (1 min each)</b>: choose 2 of 3 pictures, <b>compare</b> and <b>speculate</b>; answer both printed questions. <i>Whereas the first picture…, the second… · They might well be feeling… · It's hard to say for sure, but I'd imagine… · Judging by their expressions…</i> Then 30 sec reply to your partner's pictures.</li>
<li><b>Part 3 (2 min + 1 min)</b>: discuss prompts with your partner, then reach a decision. <i>Shall we start with…? · What's your take on…? · I see your point, but… · Building on what you said… · Shall we agree on…?</i></li>
<li><b>Part 4 (5 min)</b>: deeper opinions. Justify, give examples, consider both sides. <i>That's something I've never really considered, but on reflection… · It depends to a large extent on… · One could argue that…</i></li>
<li>Rich descriptors: <i>paramount, multifaceted, a stark contrast, picturesque, mentally taxing, overwhelmed, under the weather, content</i>.</li></ul>`}
];
