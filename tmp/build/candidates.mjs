import fs from "node:fs";
import { pathToFileURL } from "node:url";

const YEARS = Array.from({ length: 10 }, (_, i) => 2010 + i);

const TEXTS = {
  "2010-2013": [
    "Sons and Daughters",
    "Romeo and Juliet",
    "The Old Man and the Medal",
    "The Joys of Motherhood",
    "Nineteen Eighty-Four",
    "Selected Poems",
  ],
  "2014": [
    "Women of Owu",
    "The Tempest",
    "Purple Hibiscus",
    "The Old Man and the Sea",
    "A Woman in Her Prime",
    "Selected Poems",
  ],
  "2016-2019": [
    "Harvest of Corruption",
    "Othello",
    "Faceless",
    "Lonely Days",
    "Native Son",
    "Selected Poems",
  ],
};

function allowedTexts(year) {
  if (year <= 2013) return TEXTS["2010-2013"];
  if (year === 2014) return TEXTS["2014"];
  if (year === 2015) return TEXTS["2010-2013"];
  return TEXTS["2016-2019"];
}

const ALIASES = [
  [/sons?\s*(?:and|&)\s*daughters?/i, "Sons and Daughters"],
  [/romeo\s*(?:and|&)\s*juliet/i, "Romeo and Juliet"],
  [/old\s*man\s*(?:and|&)\s*the\s*medal/i, "The Old Man and the Medal"],
  [/joys?\s*of\s*motherhood/i, "The Joys of Motherhood"],
  [/nine?teen\s*eighty[-\s]?four|1984/i, "Nineteen Eighty-Four"],
  [/women\s*of\s*owu/i, "Women of Owu"],
  [/\btempest\b/i, "The Tempest"],
  [/purple\s*hibiscus/i, "Purple Hibiscus"],
  [/old\s*man\s*(?:and|&)\s*the\s*sea/i, "The Old Man and the Sea"],
  [/woman\s*in\s*her\s*prime/i, "A Woman in Her Prime"],
  [/harvest\s*of\s*corruption/i, "Harvest of Corruption"],
  [/\bothello\b/i, "Othello"],
  [/\bfaceless\b/i, "Faceless"],
  [/lonely\s*days/i, "Lonely Days"],
  [/native\s*son/i, "Native Son"],
  [
    /selected\s*(?:african\s*)?poems?|african\s*(?:and|&)\s*non-?african\s*poetry|non-?african\s*poetry|poems?\s*of\s*black\s*africa|new\s*poetry\s*from\s*africa|selection\s*of\s*african\s*poetry/i,
    "Selected Poems",
  ],
  // Texts used in other cycles; detected so they are excluded from a year.
  [/she\s*stoops\s*to\s*conquer/i, "She Stoops to Conquer"],
  [/raisin\s*in\s*the\s*sun/i, "A Raisin in the Sun"],
  [/blood\s*of\s*a\s*stranger/i, "The Blood of a Stranger"],
  [/wives'?\s*revolt/i, "The Wives' Revolt"],
  [/twelfth\s*night/i, "Twelfth Night"],
  [/gods\s*are\s*not\s*to\s*blame/i, "The Gods Are Not to Blame"],
  [/midsummer\s*night'?s?\s*dream/i, "A Midsummer Night's Dream"],
  [/invisible\s*man/i, "Invisible Man"],
  [/proud\s*king/i, "The Proud King"],
  [/school\s*boy/i, "The School Boy"],
  [/\bthe\s*pulley\b/i, "The Pulley"],
  [/crossing\s*the\s*bar/i, "Crossing the Bar"],
  [/\bambush\b/i, "Ambush"],
  [/dining\s*table/i, "The Dining Table"],
  [/panic\s*of\s*growing\s*older/i, "The Panic of Growing Older"],
  [/\bbirches\b/i, "Birches"],
  [/things\s*fall\s*apart/i, "Things Fall Apart"],
];

// Strong in-question signals for prescribed texts (used when the source did
// not tag the novel or name it in the instruction).
const CONTENT = {
  "Sons and Daughters":
    /\bsons?\s*(?:and|&)\s*daughters?\b|\bde\s*graft\b|\baaron\b|\bmaanan\b|lawyer\s+bonu|\bjames\s+ofosu\b|\bawere\b/i,
  "Romeo and Juliet":
    /\bromeo\b|\bjuliet\b|\bmercutio\b|\btybalt\b|\bcapulet\b|\bmontague\b|\bbenvolio\b|friar\s+laurence/i,
  "The Old Man and the Medal":
    /\bmeka\b|\bmvondo\b|\bnti\b|\bkelara\b|vandermey?er|\bgullet\b|old\s+man\s+and\s+the\s+medal|\boyono\b/i,
  "The Joys of Motherhood":
    /nnu\s*ego|\bnnaife\b|\bagbadi\b|\bona\b|\badaku\b|\bibuza\b|joys?\s+of\s+motherhood|\bemecheta\b/i,
  "Nineteen Eighty-Four":
    /\bwinston\b|big\s+brother|\boceania\b|\bminipax\b|\bnewspeak\b|room\s*101|1984|nineteen\s+eighty[-\s]?four|ministry\s+of\s+(truth|love|peace|plenty)|thought\s+police|\bproles?\b|doublethink|\beurasia\b|\beastasia\b/i,
  "Women of Owu":
    /women\s+of\s+owu|\berelu\b|akinjobi|\bowu\b|\bosofisan\b/i,
  "The Tempest":
    /\bprospero\b|\bariel\b|\bcaliban\b|\bmiranda\b|\bferdinand\b|\btempest\b/i,
  "Purple Hibiscus":
    /\bkambili\b|\bjaja\b|purple\s+hibiscus|papa-?nukwu|\badichie\b/i,
  "The Old Man and the Sea":
    /\bsantiago\b|\bmanolin\b|\bmarlin\b|old\s+man\s+and\s+the\s+sea|\bhemingway\b/i,
  "A Woman in Her Prime":
    /\babenaa\b|woman\s+in\s+her\s+prime|\bkonadu\b|\bmensah\b/i,
  "Harvest of Corruption":
    /\baloho\b|\bochuole\b|ade-?amaka|harvest\s+of\s+corruption|\bogbeche\b/i,
  Othello:
    /\bothello\b|\biago\b|\bdesdemona\b|\bcassio\b|\bemilia\b|\bbrabantio\b|\broderigo\b/i,
  Faceless: /\bfofo\b|\bkabria\b|baby\s*t|maa\s+tsuru|\bfaceless\b|\bdarko\b/i,
  "Lonely Days": /\byaremi\b|\bkufi\b|lonely\s+days|\badebowale\b/i,
  "Native Son": /\bbigger\b|mary\s+dalton|\bbessie\b|native\s+son|richard\s+wright/i,
};

export function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export function plain(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function detectText(s) {
  const t = plain(s);
  for (const [re, title] of ALIASES) {
    if (re.test(t)) return title;
  }
  return null;
}

function detectContentText(str, allowed) {
  const t = plain(str);
  for (const title of allowed) {
    if (title === "Selected Poems") continue;
    const re = CONTENT[title];
    if (re && re.test(t)) return title;
  }
  return null;
}

const BANNED_RE =
  /the\s+proud\s+king|the\s+pulley|\bbirches\b|school\s+boy|crossing\s+the\s+bar|\bambush\b|dining\s+table|\bvanity\b|panic\s+of\s+growing\s+older|she\s+stoops|raisin\s+in\s+the\s+sun|blood\s+of\s+a\s+stranger|wives'?\s+revolt|twelfth\s+night|gods\s+are\s+not\s+to\s+blame|invisible\s+man|midsummer/i;

const PASSAGE_HINT =
  /(excerpt|extract|passage|\babove\b|as\s+used|these\s+lines|the\s+lines|from\s+the\s+poem|in\s+the\s+poem|the\s+speaker|the\s+persona|the\s+poet|the\s+writer|the\s+narrator|the\s+quotation|the\s+stanza)/i;

function optionSet(options) {
  const out = {};
  let answer = null;
  for (const o of options || []) {
    const tag = String(o.tag || "").toLowerCase();
    if (!"abcde".includes(tag)) continue;
    out[tag] = decodeEntities(o.description || "").trim();
    if (Number(o.is_correct) === 1) answer = tag;
  }
  return { option: out, answer };
}

function validOption(option, answer) {
  if (
    !["a", "b", "c", "d"].every(
      (k) => typeof option[k] === "string" && option[k].trim(),
    ) ||
    !["a", "b", "c", "d"].includes(answer)
  ) {
    return false;
  }
  const values = ["a", "b", "c", "d"].map((k) =>
    plain(option[k]).toLowerCase(),
  );
  return new Set(values).size === 4;
}

function classify({
  allowed,
  instruction,
  question,
  novelTitle,
  hasPassage,
}) {
  const instr = plain(instruction).toLowerCase();
  const q = plain(question);
  const explicitPrinciples = /general\s*lit\w*\s*principles?/i.test(instr);
  const explicitAppreciation =
    /lit(?:er|era)cy\s*appreciations?|literary\s*appreciation/i.test(instr);

  const named =
    (novelTitle ? detectText(novelTitle) : null) ||
    detectText(plain(instruction).slice(0, 320));
  // The question itself is the strongest signal (a section can list several
  // texts, e.g. "The Old Man and the Medal and The Joys of Motherhood").
  const byContent = detectContentText(question, allowed);
  const bySectionContent = detectContentText(instruction, allowed);
  const detected =
    byContent ||
    (named && allowed.includes(named) ? named : null) ||
    bySectionContent ||
    null;

  if (named && !allowed.includes(named)) return named; // out-of-cycle text
  if (explicitPrinciples && !detected) return "General Literary Principles";
  if (detected) return detected;
  if (explicitAppreciation || hasPassage || PASSAGE_HINT.test(q)) {
    return "Literary Appreciation";
  }
  return "General Literary Principles";
}

function myschoolCandidates(year) {
  const d = JSON.parse(fs.readFileSync(`tmp/ms/lit-${year}.json`, "utf8"));
  const allowed = allowedTexts(year);
  return d.questions.map((q) => {
    const { option, answer } = optionSet(q.options);
    const raw = q.question || "";
    const hasPassage = Boolean(q.ref?.description && plain(q.ref.description));
    const category = classify({
      allowed,
      instruction: q.novel?.title || raw,
      question: raw,
      novelTitle: q.novel?.title || null,
      hasPassage,
    });
    return {
      source: "myschool",
      sourceId: q.id,
      year,
      raw,
      refHtml: q.ref?.description || null,
      option,
      answer,
      category,
      text: allowed.includes(category) ? category : null,
      novelRaw: q.novel?.title || null,
      valid: validOption(option, answer),
    };
  });
}

function groupSize(section) {
  const t = plain(section);
  const m = t.match(/questions?\s+(\d+)\s*(?:to|and|-)\s*(\d+)/i);
  if (m) return Math.max(1, Number(m[2]) - Number(m[1]) + 1);
  if (/question\s+\d+/i.test(t)) return 1;
  return 2;
}

function alocCandidates() {
  const pool = JSON.parse(fs.readFileSync("tmp/aloc/pool.json", "utf8"));
  const sorted = [...pool].sort(
    (a, b) =>
      Number(a.examyear) - Number(b.examyear) || Number(a.id) - Number(b.id),
  );
  const state = new Map();
  return sorted.map((q) => {
    const section = q.section || "";
    const raw = q.question || "";
    const year = Number(q.examyear);
    const allowed = allowedTexts(year);
    const option = {};
    for (const k of ["a", "b", "c", "d"]) {
      if (q.option?.[k] != null) option[k] = decodeEntities(q.option[k]).trim();
    }
    const answer = String(q.answer || "").toLowerCase();
    const hasPassage = plain(section).length > 140;

    if (!state.has(year)) state.set(year, { text: null, generic: null, left: 0 });
    const st = state.get(year);

    // A new group header resets the context; otherwise continue the group.
    if (st.left > 0) st.left--;

    const secText = detectText(section);
    const secPlain = plain(section).toLowerCase();
    const explicitPrinciples = /general\s*lit\w*\s*principles?/i.test(secPlain);
    const explicitAppreciation =
      /lit(?:er|era)cy\s*appreciations?|literary\s*appreciation/i.test(secPlain);

    if (secText) {
      st.text = secText;
      st.generic = null;
      st.left = groupSize(section);
    } else if (explicitPrinciples) {
      st.text = null;
      st.generic = "General Literary Principles";
      st.left = groupSize(section);
    } else if (explicitAppreciation) {
      st.text = null;
      st.generic = "Literary Appreciation";
      st.left = groupSize(section);
    } else if (st.left <= 0) {
      st.text = null;
      st.generic = null;
    }

    let category;
    if (secText) category = secText;
    else if (st.text) category = st.text;
    else if (explicitPrinciples) category = "General Literary Principles";
    else if (explicitAppreciation) category = "Literary Appreciation";
    else if (st.generic) category = st.generic;
    else {
      category = classify({
        allowed,
        instruction: section,
        question: raw,
        novelTitle: null,
        hasPassage,
      });
    }

    // The question's own wording is stronger than a possibly stale group tag.
    const contentText = detectContentText(raw, allowed);
    if (contentText) category = contentText;

    const isGeneric =
      category === "General Literary Principles" ||
      category === "Literary Appreciation";
    const quoteish = /[“”"]/.test(raw);
    const passageish = /above|excerpt|extract|passage|stanza|lines/i.test(raw);
    const nameLike =
      /\b[A-Z][a-z]{2,}(?:'s)?\s+[A-Z][a-z]{2,}\b/.test(raw) ||
      /\b[A-Z][a-z]{2,}\s+(?:and|or)\s+[A-Z][a-z]{2,}\b/.test(raw) ||
      /\b[A-Z][a-z]{2,}'s\b/.test(raw);
    const genericSafe =
      isGeneric &&
      !BANNED_RE.test(`${raw} ${section}`) &&
      !quoteish &&
      !nameLike &&
      (category === "General Literary Principles" ? !passageish : true);
    return {
      source: "aloc",
      sourceId: q.id,
      year,
      raw,
      refHtml: null,
      option,
      answer,
      category,
      text: allowed.includes(category) ? category : null,
      section,
      genericSafe,
      valid: validOption(option, answer),
    };
  });
}

function main() {
  const my = [];
  for (const year of YEARS) my.push(...myschoolCandidates(year));
  const aloc = alocCandidates();

  function keyOf(c) {
    return plain(c.raw)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // MySchool wins on metadata; ALOC fills gaps.
  const byKey = new Map();
  for (const c of [...my, ...aloc]) {
    const k = keyOf(c);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, c);
  }
  const candidates = [...byKey.values()];

  const report = {};
  for (const year of YEARS) {
    const rows = candidates.filter((c) => c.year === year);
    const counts = {};
    for (const c of rows) counts[c.category] = (counts[c.category] || 0) + 1;
    const allowed = allowedTexts(year);
    report[year] = {
      total: rows.length,
      valid: rows.filter((c) => c.valid).length,
      principles: counts["General Literary Principles"] || 0,
      appreciation: counts["Literary Appreciation"] || 0,
      texts: Object.fromEntries(allowed.map((t) => [t, counts[t] || 0])),
      excluded: Object.fromEntries(
        Object.entries(counts).filter(([k]) => !allowed.includes(k) && k !== "General Literary Principles" && k !== "Literary Appreciation"),
      ),
    };
  }
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync("tmp/build/candidates.json", JSON.stringify(candidates, null, 2) + "\n");
  console.log("saved", candidates.length, "candidates");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
