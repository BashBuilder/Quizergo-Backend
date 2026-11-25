import fs from "node:fs";

const path = "data/literature_in_english.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const GENERIC = new Set(["General Literary Principles", "Literary Appreciation"]);

let added = 0;
for (const q of data) {
  const year = Number(q.examyear);
  if (year < 2010 || year > 2019) continue;
  if (GENERIC.has(q.category)) continue;
  const section = String(q.section || "");
  if (/based\s+on/i.test(section)) continue;
  const instruction = `<p>This question is based on <em>${q.category}</em>.</p>`;
  q.section = instruction + section;
  added++;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log("sections updated:", added);
