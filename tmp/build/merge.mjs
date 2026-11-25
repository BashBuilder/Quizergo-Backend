import fs from "node:fs";
import { decodeEntities } from "./candidates.mjs";

const sel = JSON.parse(fs.readFileSync("tmp/build/selected.json", "utf8"));
const dataPath = "data/literature_in_english.json";
const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
let nextId = Math.max(...existing.map((q) => Number(q.id) || 0)) + 1;

const out = [];
const problems = [];
for (const year of Object.keys(sel)) {
  const solutions = JSON.parse(
    fs.readFileSync(`tmp/build/solutions/${year}.json`, "utf8"),
  );
  for (const q of sel[year]) {
    const solution = solutions[String(q.n)];
    if (!solution || typeof solution !== "string") {
      problems.push(`${year}#${q.n} missing solution`);
      continue;
    }
    const option = {};
    for (const k of ["a", "b", "c", "d"]) {
      option[k] = decodeEntities(q.option[k] || "").trim();
    }
    if (!["a", "b", "c", "d"].includes(q.answer)) {
      problems.push(`${year}#${q.n} bad answer`);
      continue;
    }
    if (new Set(Object.values(option)).size !== 4) {
      problems.push(`${year}#${q.n} duplicate options`);
      continue;
    }
    out.push({
      id: nextId++,
      question: decodeEntities(q.question || "").trim(),
      option,
      section: decodeEntities(q.section || "").trim(),
      image: "",
      answer: q.answer,
      solution,
      examtype: "utme",
      examyear: String(year),
      questionNub: q.n,
      hasPassage: Number(q.hasPassage) ? 1 : 0,
      category: q.category,
    });
  }
}

if (problems.length) {
  console.error("PROBLEMS:", problems.length);
  console.error(problems.slice(0, 40).join("\n"));
  process.exit(1);
}

// Safety: don't append a question that already exists in the file.
const key = (q) =>
  String(q.question || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const existingKeys = new Set(existing.map(key));
const duplicates = out.filter((q) => existingKeys.has(key(q)));
if (duplicates.length) {
  console.warn("Note: questions repeated in older years:", duplicates.length);
  console.warn(duplicates.slice(0, 10).map((q) => `${q.examyear}#${q.questionNub}: ${q.question.slice(0, 70)}`).join("\n"));
}

const merged = [...existing, ...out];
fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2) + "\n");
console.log("existing:", existing.length, "appended:", out.length, "total:", merged.length);
for (const year of Object.keys(sel)) {
  console.log(year, merged.filter((q) => String(q.examyear) === year).length);
}
