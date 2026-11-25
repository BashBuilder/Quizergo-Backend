import fs from "node:fs";
import { decodePayloadFromHtml } from "./extract.mjs";

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(year, page, tries = 4) {
  const url = `https://myschool.ng/classroom/literature-in-english?exam_type=jamb&exam_year=${year}&page=${page}`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      const text = await res.text();
      if (res.status !== 200) throw new Error("status " + res.status);
      const payload = decodePayloadFromHtml(text);
      return payload.data["classroom-question-data-literature-in-english"]
        .practice_questions;
    } catch (e) {
      console.log(`  retry ${year} p${page}: ${e.message}`);
      await sleep(2500 + i * 2500);
    }
  }
  throw new Error(`failed ${year} page ${page}`);
}

const years = process.argv.slice(2).map(Number);
for (const year of years) {
  const outPath = `tmp/ms/lit-${year}.json`;
  if (fs.existsSync(outPath)) {
    const prev = JSON.parse(fs.readFileSync(outPath, "utf8"));
    console.log(year, "already scraped:", prev.length);
    continue;
  }
  const first = await fetchPage(year, 1);
  const rows = [...first.data];
  console.log(year, "total", first.total, "pages", first.last_page);
  for (let page = 2; page <= first.last_page; page++) {
    await sleep(900);
    const pq = await fetchPage(year, page);
    rows.push(...pq.data);
    process.stdout.write(`\r${year} page ${page}/${first.last_page} (${rows.length})`);
  }
  console.log();
  const byId = new Map(rows.map((q) => [q.id, q]));
  const unique = [...byId.values()];
  fs.writeFileSync(outPath, JSON.stringify({ total: first.total, questions: unique }, null, 2) + "\n");
  console.log(year, "saved", unique.length, "unique of", rows.length);
  await sleep(900);
}
