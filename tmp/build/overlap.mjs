import fs from "node:fs";
const c = JSON.parse(fs.readFileSync("tmp/build/candidates.json", "utf8"));
const plain = (h) =>
  String(h || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const core = (s) => {
  let t = plain(s).toLowerCase();
  t = t
    .replace(/^(these questions?|this question|the question|question[s]?[^.]*)\b[^.]*based on[^.]*\./, "")
    .replace(/^(use|read)\b[^.]*\./, "");
  return t.replace(/[^a-z0-9]+/g, " ").replace(/\b(the|a|an)\b/g, "").trim();
};
const byYear = {};
for (const x of c) {
  if (!x.valid) continue;
  (byYear[x.year] ||= { my: new Map(), al: new Map() });
  const k = core(x.raw);
  if (!k) continue;
  if (x.source === "myschool") byYear[x.year].my.set(k, x);
  else byYear[x.year].al.set(k, x);
}
let agree = 0;
let dis = 0;
const ex = [];
for (const y of Object.keys(byYear)) {
  for (const [k, a] of byYear[y].my) {
    const b = byYear[y].al.get(k);
    if (!b) continue;
    if (a.answer === b.answer) agree++;
    else {
      dis++;
      if (ex.length < 12)
        ex.push(`${y} | ${plain(a.raw).slice(0, 80)} | my=${a.answer} aloc=${b.answer}`);
    }
  }
}
console.log("overlap agree", agree, "disagree", dis);
console.log(ex.join("\n"));
