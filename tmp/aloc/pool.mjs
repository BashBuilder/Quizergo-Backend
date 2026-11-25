import "dotenv/config";
import fs from "node:fs";

const base = process.env.ALOC_BASE_URL.replace(/\/+$/, "");
const headers = { AccessToken: process.env.ALOC_API_KEY };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(base + path, { headers });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      await sleep(3000 + i * 3000);
    }
  }
  return null;
}

const byId = new Map();

// Pool: request a year the API does not really have, so each call returns a
// random sample across the whole englishlit dataset.
for (let i = 0; i < 70; i++) {
  const json = await getJson("/q/40?subject=englishlit&year=2011&type=utme");
  const data = Array.isArray(json?.data) ? json.data : json?.data?.data ?? [];
  let added = 0;
  for (const q of data) {
    if (q && q.id != null && !byId.has(q.id)) {
      byId.set(q.id, q);
      added++;
    }
  }
  if ((i + 1) % 10 === 0) console.log("call", i + 1, "unique", byId.size, "+", added);
  await sleep(1200);
}

const buckets = {};
for (const q of byId.values()) {
  const y = String(q.examyear);
  (buckets[y] ||= []).push(q);
}
for (const y of Object.keys(buckets).sort()) {
  console.log("year", y, "unique", buckets[y].length);
}
fs.writeFileSync("tmp/aloc/pool.json", JSON.stringify([...byId.values()], null, 2) + "\n");
console.log("total pool", byId.size);
