import fs from "node:fs";
import vm from "node:vm";

const WRAPPERS = new Set([
  "ShallowReactive",
  "Reactive",
  "ShallowRef",
  "Ref",
  "Date",
  "Set",
  "Map",
  "RegExp",
  "BigInt",
  "URL",
  "Object",
  "null",
  "undefined",
  "NaN",
  "Infinity",
  "-Infinity",
  "-0",
]);

export function decodePayloadFromHtml(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((s) => s.trimStart().startsWith('[["ShallowReactive"'));
  if (!scripts.length) throw new Error("payload script not found");
  const code = scripts.sort((a, b) => b.length - a.length)[0];
  const sandbox = {};
  vm.createContext(sandbox);
  const flat = vm.runInContext(code, sandbox, { timeout: 10000 });
  if (!Array.isArray(flat)) throw new Error("payload is not an array");

  const seen = new Map();
  function decode(index) {
    const value = flat[index];
    if (value === null || typeof value !== "object") return value;
    if (seen.has(index)) return seen.get(index);

    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === "string" && WRAPPERS.has(value[0])) {
        if (value[0] === "Set") return new Set(value[1].map?.(decode) ?? []);
        if (value[0] === "Map") {
          return new Map((value[1] ?? []).map((pair) => pair.map(decode)));
        }
        if (value[0] === "Date") return new Date(value[1]);
        if (value[0] === "RegExp") return new RegExp(value[1], value[2]);
        if (value[0] === "null") return null;
        if (value[0] === "undefined") return undefined;
        if (value[0] === "NaN") return NaN;
        if (value[0] === "Infinity") return Infinity;
        if (value[0] === "-Infinity") return -Infinity;
        return decode(value[1]);
      }
      const out = [];
      seen.set(index, out);
      for (const ref of value) out.push(decode(ref));
      return out;
    }

    const out = {};
    seen.set(index, out);
    for (const [key, ref] of Object.entries(value)) out[key] = decode(ref);
    return out;
  }

  return decode(1);
}

export function readPayload(path) {
  return decodePayloadFromHtml(fs.readFileSync(path, "utf8"));
}
