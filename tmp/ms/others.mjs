import fs from "node:fs";

const norm = (t) =>
  String(t || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

for (let year = 2010; year <= 2019; year++) {
  const d = JSON.parse(fs.readFileSync(`tmp/ms/lit-${year}.json`, "utf8"));
  const others = d.questions.filter((q) => {
    if (q.novel) return false;
    const t = norm(q.question).toLowerCase();
    return !/general literary principles|literary appreciation/.test(t);
  });
  console.log(`\n==== ${year} other: ${others.length}`);
  for (const q of others) {
    console.log(
      `${q.id} | ${norm(q.question).slice(0, 150)}${q.ref ? " [REF]" : ""}`,
    );
  }
}
