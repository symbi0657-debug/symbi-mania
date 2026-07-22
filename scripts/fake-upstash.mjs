// Minimal in-memory Upstash REST server — enough of the command surface for lib/db.js.
import http from "node:http";

const store = new Map();   // key -> string | object
const sets  = new Map();   // key -> Set
const lists = new Map();   // key -> array
const zsets = new Map();   // key -> Map(member -> score)
const Z = (k) => { if (!zsets.has(k)) zsets.set(k, new Map()); return zsets.get(k); };

const S = (k) => { if (!sets.has(k)) sets.set(k, new Set()); return sets.get(k); };
const num = (k) => Number(store.get(k) ?? 0);

// Artificial delay injected between a SET NX and its follow-up write, to widen
// the race window the sweeper/webhook fight over.
export const control = { delayMs: 0, onSetNx: null };

async function run(cmd) {
  const [rawOp, ...a] = cmd;
  const op = String(rawOp).toLowerCase();
  switch (op) {
    case "set": {
      const nx = a.some((x) => String(x).toLowerCase() === "nx");
      if (nx) {
        if (store.has(a[0])) return null;
        store.set(a[0], a[1]);
        if (control.onSetNx) await control.onSetNx(a[0], a[1]);
        return "OK";
      }
      store.set(a[0], a[1]);
      return "OK";
    }
    case "get": return store.has(a[0]) ? store.get(a[0]) : null;
    case "mget": return a.map((k) => (store.has(k) ? store.get(k) : null));
    case "del": { const had = store.delete(a[0]); return had ? 1 : 0; }
    case "incr": { const v = num(a[0]) + 1; store.set(a[0], v); return v; }
    case "incrby": { const v = num(a[0]) + Number(a[1]); store.set(a[0], v); return v; }
    case "decrby": { const v = num(a[0]) - Number(a[1]); store.set(a[0], v); return v; }
    case "sadd": { const s = S(a[0]); const before = s.size; a.slice(1).forEach((m) => s.add(String(m))); return s.size - before; }
    case "srem": { const s = S(a[0]); let n = 0; a.slice(1).forEach((m) => { if (s.delete(String(m))) n++; }); return n; }
    case "smembers": return [...S(a[0])];
    case "scard": return S(a[0]).size;
    case "sismember": return S(a[0]).has(String(a[1])) ? 1 : 0;
    case "lpush": { if (!lists.has(a[0])) lists.set(a[0], []); lists.get(a[0]).unshift(...a.slice(1)); return lists.get(a[0]).length; }
    case "lrange": { const l = lists.get(a[0]) || []; const [s, e] = [Number(a[1]), Number(a[2])]; return l.slice(s, e === -1 ? undefined : e + 1); }
    case "ltrim": { const l = lists.get(a[0]) || []; lists.set(a[0], l.slice(Number(a[1]), Number(a[2]) === -1 ? undefined : Number(a[2]) + 1)); return "OK"; }
    case "zadd": {
      const z = Z(a[0]);
      // Upstash sends {score, member} objects.
      for (const it of a.slice(1)) {
        if (it && typeof it === "object" && "member" in it) z.set(String(it.member), Number(it.score));
      }
      return 1;
    }
    case "zrange": case "zrevrange": {
      const z = [...Z(a[0]).entries()].sort((x, y) => x[1] - y[1]).map(([m]) => m);
      const arr = op === "zrevrange" ? z.reverse() : z;
      const [s0, e0] = [Number(a[1]), Number(a[2])];
      return arr.slice(s0, e0 === -1 ? undefined : e0 + 1);
    }
    case "zcard": return Z(a[0]).size;
    case "zrem": { const z = Z(a[0]); let n = 0; a.slice(1).forEach((m) => { if (z.delete(String(m))) n++; }); return n; }
    case "expire": case "pexpire": return 1;
    case "exists": return store.has(a[0]) ? 1 : 0;
    default: throw new Error("fake-upstash: unsupported command " + op);
  }
}

export function start(port = 0) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const parsed = body ? JSON.parse(body) : [];
        // Shape, not URL: a single command is ["set","k","v"], a batch is
        // [["set",...],["get",...]]. Auto-pipelining makes the URL unreliable.
        const isBatch = Array.isArray(parsed) && Array.isArray(parsed[0]);
        const out = isBatch
          ? await (async () => { const r = []; for (const c of parsed) r.push({ result: await run(c) }); return r; })()
          : { result: await run(parsed) };
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
      } catch (e) {
        console.error("FAKE-ERR", String(e.message || e));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(e.message || e) }));
      }
    });
  });
  return new Promise((r) => server.listen(port, () => r({ server, port: server.address().port })));
}
export { store, sets };

// `node scripts/fake-upstash.mjs 8079` → standalone local Redis for `next dev`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const p = Number(process.argv[2] || 8079);
  start(p).then(({ port }) => console.log(`fake-upstash listening on http://127.0.0.1:${port}`));
}
