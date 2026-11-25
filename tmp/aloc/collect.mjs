import "dotenv/config";
import fs from "node:fs";

const base = process.env.ALOC_BASE_URL.replace(/\/+$/, "");
const headers = { AccessToken: process.env.ALOC_API_KEY };

async function fetchBatch(year) {
  const url = `${base}/q/40?subject=englishlit&year=${year}&type=utme`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  const data = Array.isArray(json.data) ? json.data : json.data?.data ?? [];
  return data;
}

const out = {};
for (let year = 2010; year <= 2019; year++) {
  const byId = new Map();
  let idle = 0;
  let rounds = 0;
  while (idle < 8 && rounds < 80) {
    rounds++;
    const batches = await Promise.all(
      Array.from({ length: 4 }, () => fetchBatch(year).catch(() => [])),
    );
    let added = 0;
    for (const batch of batches) {
      for (const q of batch) {
        if (!q || q.id == null) continue;
        if (String(q.examyear) !== String(year)) continue;
        if (!byId.has(q.id)) {
          byId.set(q.id, q);
          added++;
        }
      }
    }
    if (added === 0) idle++;
    else idle = 0;
  }
  out[year] = [...byId.values()];
  console.log(
    year,
    "authentic unique:",
    byId.size,
    "rounds:",
    rounds,
    "idle stops:",
    idle,
  );
}

fs.writeFileSync("tmp/aloc/unique.json", JSON.stringify(out, null, 2) + "\n");
console.log("written tmp/aloc/unique.json");
