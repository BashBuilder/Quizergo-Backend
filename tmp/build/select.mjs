import fs from "node:fs";
import { plain, decodeEntities, detectText } from "./candidates.mjs";

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
const GENRE = {
  "Sons and Daughters": "drama",
  "Romeo and Juliet": "drama",
  "Women of Owu": "drama",
  "The Tempest": "drama",
  "Harvest of Corruption": "drama",
  Othello: "drama",
  "The Old Man and the Medal": "prose",
  "The Joys of Motherhood": "prose",
  "Nineteen Eighty-Four": "prose",
  "Purple Hibiscus": "prose",
  "The Old Man and the Sea": "prose",
  "A Woman in Her Prime": "prose",
  Faceless: "prose",
  "Lonely Days": "prose",
  "Native Son": "prose",
  "Selected Poems": "poetry",
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
    /selected\s*poems?|poems?\s*of\s*black\s*africa|new\s*poetry\s*from\s*africa|selection\s*of\s*african\s*poetry|african\s*(?:and|&)\s*non-?african\s*poetry|non-?african\s*poetry/i,
    "Selected Poems",
  ],
];

function isInstruction(text) {
  const t = plain(text).toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return false;
  return (
    /^(?:this|these|the|that)\b[^.]{0,80}\bbase[ds]?\s+on\b/.test(t) ||
    /^base[ds]?\s+on\b/.test(t) ||
    /^(?:questions?|qu\w*stions?)\s+\d+/.test(t) ||
    /^(?:questions?|qu\w*stions?)\s+(?:are|is)\b/.test(t) ||
    /^(?:use|read)\s+(?:the|this)\b/.test(t) ||
    /general\s*lit\w*\s*principles?/.test(t)
  );
}

function cleanChunk(html) {
  const s = String(html || "")
    .replace(/<pre>[\s\S]*?<\/pre>/gi, "")
    .replace(/<p[^>]*>\s*(?:&nbsp;|\s)*<\/p>/gi, "")
    .trim();
  return s;
}

function nonempty(s) {
  return plain(s) !== "" && plain(s) !== "\u00a0";
}

function splitDouble(html) {
  return String(html || "")
    .replace(/<br\s*\/?>\s*(?:\r?\n)?\s*<br\s*\/?>/gi, "@@BR@@")
    .split("@@BR@@")
    .map((s) => s.trim())
    .filter(nonempty);
}

function findInstructionEnd(flat, category) {
  // Returns the index just after the instruction sentence.
  const markers = [];
  if (category === "General Literary Principles") {
    markers.push(/general\s*lit\w*\s*principles?\s*[.:]?/i);
  } else if (category === "Literary Appreciation") {
    markers.push(/lit(?:er|era)cy\s*appreciations?\s*[.:]?/i);
    markers.push(/literary\s*appreciations?\s*[.:]?/i);
  } else {
    const alias = ALIASES.find(([, t]) => t === category);
    if (alias) markers.push(alias[0]);
  }
  for (const re of markers) {
    const m = flat.match(re);
    if (!m || m.index == null) continue;
    let cut = m.index + m[0].length;
    while (cut < flat.length && /[\s,.:;]/.test(flat[cut])) cut++;
    if (cut > 12 && flat.length - cut > 8) return cut;
  }
  return null;
}

function splitMySchool(c) {
  const raw = String(c.raw || "").trim();
  if (c.refHtml && plain(c.refHtml)) {
    return { section: cleanChunk(c.refHtml), question: cleanChunk(raw), hasPassage: 1 };
  }

  // 1. Separate <p> blocks (instruction in its own paragraph).
  const paras = [...raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1].trim())
    .filter(nonempty);
  if (paras.length >= 2 && isInstruction(paras[0])) {
    return {
      section: cleanChunk(`<p>${paras[0]}</p>`),
      question: cleanChunk(paras.slice(1).map((p) => `<p>${p}</p>`).join("")),
      hasPassage: 0,
    };
  }

  // 2. Blank-line separated blocks.
  const dsegs = splitDouble(raw);
  if (dsegs.length >= 2) {
    const last = plain(dsegs[dsegs.length - 1]);
    if (isInstruction(dsegs[0]) || /^(based on|the question is based on)/i.test(last)) {
      return {
        section: cleanChunk(dsegs.slice(0, -1).join("<br />")),
        question: cleanChunk(dsegs[dsegs.length - 1]),
        hasPassage: dsegs.length > 2 ? 1 : 0,
      };
    }
  }

  // 3. Single line-break separated instruction + passage/question.
  const lines = raw
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter(nonempty);
  if (lines.length >= 2 && isInstruction(lines[0])) {
    return {
      section: cleanChunk(lines.slice(0, -1).join("<br />")),
      question: cleanChunk(lines[lines.length - 1]),
      hasPassage: lines.length > 2 ? 1 : 0,
    };
  }

  // 4. Run-on instruction (no reliable line break).
  const flat = plain(raw);
  if (isInstruction(flat)) {
    const cut = findInstructionEnd(flat, c.category);
    if (cut != null) {
      return {
        section: cleanChunk(decodeEntities(flat.slice(0, cut)).trim()),
        question: cleanChunk(decodeEntities(flat.slice(cut)).trim()),
        hasPassage: 0,
      };
    }
  }

  return { section: "", question: cleanChunk(raw), hasPassage: c.refHtml ? 1 : 0 };
}

function stripLeadBasedOn(split) {
  const flat = plain(split.question);
  const m = flat.match(
    /^(?:the question is based on|this question is based on|these questions? (?:are|is) based on|based on)\s+[^,.]{3,180}[,.]\s*/i,
  );
  if (!m || !detectText(m[0])) return split;
  const lead = m[0].trim();
  const rest = flat.slice(m[0].length).trim();
  if (rest.length < 8) return split;
  const section = split.section
    ? `${split.section}<p>${lead}</p>`
    : `<p>${lead}</p>`;
  return { ...split, section, question: `<p>${rest}</p>` };
}

function pickQuota(avail) {
  // Target the familiar JAMB shape: 10 principles, 8 appreciation, 22 text.
  // Any shortage is covered later from safe fallbacks or by adding text items.
  let P = 10;
  let A = 8;
  let T = Math.min(22, avail.textTotal);
  let total = P + A + T;
  while (total < 40 && T < avail.textTotal) {
    T++;
    total++;
  }
  return { P, A, T };
}

function allocateTexts(tCount, texts, availByText) {
  const counts = Object.fromEntries(texts.map((t) => [t, 0]));
  const usable = texts.filter((t) => (availByText[t] || 0) > 0);
  if (!usable.length || tCount <= 0) return counts;
  let remaining = tCount;
  for (const t of usable) {
    if (remaining <= 0) break;
    counts[t]++;
    remaining--;
  }
  let i = 0;
  let guard = 0;
  while (remaining > 0 && guard++ < 3000) {
    const t = usable[i % usable.length];
    i++;
    if (counts[t] < availByText[t]) {
      counts[t]++;
      remaining--;
    }
  }
  return counts;
}

const candidates = JSON.parse(fs.readFileSync("tmp/build/candidates.json", "utf8"));
const qKey = (c) =>
  plain(c.source === "aloc" ? c.raw : splitMySchool(c).question)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const byKey = new Map();
for (const c of candidates) {
  if (!c.valid) continue;
  const k = qKey(c);
  if (!k || byKey.has(k)) continue;
  byKey.set(k, c);
}

const selected = {};
const usedKeys = new Set();
const keyOf = qKey;

for (const year of YEARS) {
  const allowed = allowedTexts(year);
  const rows = [...byKey.values()].filter((c) => c.year === year && !usedKeys.has(keyOf(c)));
  // Generic questions come only from MySchool, whose ref/novel metadata makes
  // the principles vs appreciation distinction reliable.
  const principles = rows.filter(
    (c) => c.source === "myschool" && c.category === "General Literary Principles",
  );
  const appreciation = rows.filter(
    (c) => c.source === "myschool" && c.category === "Literary Appreciation",
  );
  const byText = Object.fromEntries(
    allowed.map((t) => [t, rows.filter((c) => c.text === t)]),
  );
  const avail = {
    principles: principles.length,
    appreciation: appreciation.length,
    textTotal: allowed.reduce((n, t) => n + byText[t].length, 0),
  };
  const quota = pickQuota(avail);
  const textCounts = allocateTexts(
    quota.T,
    allowed,
    Object.fromEntries(allowed.map((t) => [t, byText[t].length])),
  );

  const chosen = [];
  const sortById = (a, b) => Number(a.sourceId) - Number(b.sourceId);
  const take = (list, n) => {
    for (const c of list.sort(sortById)) {
      if (chosen.length >= 0 && n <= 0) break;
      if (usedKeys.has(keyOf(c))) continue;
      chosen.push(c);
      usedKeys.add(keyOf(c));
      n--;
      if (n <= 0) break;
    }
  };
  take(principles, quota.P);
  take(appreciation, quota.A);

  // If earlier years consumed duplicate generic questions, top up from safe
  // ALOC generic items (no out-of-cycle text, no quoted passage).
  const chosenP = () =>
    chosen.filter((c) => c.category === "General Literary Principles").length;
  const chosenA = () =>
    chosen.filter((c) => c.category === "Literary Appreciation").length;
  const fallback = (category, want) =>
    rows.filter(
      (c) =>
        c.source === "aloc" &&
        c.genericSafe &&
        c.category === category &&
        !usedKeys.has(keyOf(c)),
    );
  take(fallback("General Literary Principles", 0), quota.P - chosenP());
  take(fallback("Literary Appreciation", 0), quota.A - chosenA());

  for (const t of allowed) take(byText[t], textCounts[t]);

  // Any remaining shortfall (e.g. not enough text questions): fill from the
  // cleanest categories available.
  if (chosen.length < 40) {
    const rest = rows.filter(
      (c) =>
        !usedKeys.has(keyOf(c)) &&
        (c.category === "General Literary Principles" ||
          c.category === "Literary Appreciation" ||
          Boolean(c.text)) &&
        (c.source === "myschool" || c.genericSafe || Boolean(c.text)),
    );
    take(rest, 40 - chosen.length);
  }

  const ordered = [
    ...chosen.filter((c) => c.category === "General Literary Principles"),
    ...chosen.filter((c) => c.category === "Literary Appreciation"),
    ...chosen.filter((c) => GENRE[c.category] === "drama"),
    ...chosen.filter((c) => GENRE[c.category] === "prose"),
    ...chosen.filter((c) => GENRE[c.category] === "poetry"),
  ];

  const CATEGORY_FIXES = {
    "2012#26": "Nineteen Eighty-Four",
    "2015#19": "Selected Poems",
    "2015#20": "Selected Poems",
    "2015#21": "Selected Poems",
    "2015#22": "Selected Poems",
    "2015#23": "Selected Poems",
  };
  const ANSWER_FIXES = {
    "2013#36": "d",
    "2014#23": "d",
    "2014#24": "d",
    "2017#10": "a",
    "2019#21": "c",
  };
  selected[year] = ordered.map((c, i) => {
    const split =
      c.source === "aloc"
        ? {
            section: c.section ? cleanChunk(c.section) : "",
            question: cleanChunk(c.raw),
            hasPassage: c.section && plain(c.section).length > 120 ? 1 : 0,
          }
        : splitMySchool(c);
    const finalSplit = stripLeadBasedOn(split);
    return {
      year,
      n: i + 1,
      source: c.source,
      sourceId: c.sourceId,
      category: CATEGORY_FIXES[`${year}#${i + 1}`] || c.category,
      option: c.option,
      answer: ANSWER_FIXES[`${year}#${i + 1}`] || c.answer,
      section: finalSplit.section,
      question: finalSplit.question,
      hasPassage: finalSplit.hasPassage,
    };
  });
  console.log(year, "quota", quota, "texts", textCounts, "selected", ordered.length);
}

fs.writeFileSync("tmp/build/selected.json", JSON.stringify(selected, null, 2) + "\n");
console.log("saved selected.json");
