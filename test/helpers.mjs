// Shared fakes for the tests: an in-memory localStorage and a tiny in-memory GitHub gist API.

export function makeStorage(seed = {}) {
  const mem = new Map(Object.entries(seed));
  return {
    mem,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
  };
}

const reply = (status, body, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

// Behaves like the parts of api.github.com the app uses. `log` records every call.
export function fakeGithub() {
  const gh = {
    gists: new Map(), // id -> { files: { name: { content } } }
    log: [],
    fail: null, // (method, path) => response | undefined, to inject errors
    offline: false,
    gateMethod: null, // limit the gate to one HTTP method
    gate: null, // a promise that PATCH/GET wait on, to hold a request in flight
    next: 1,
    seed(content, id = "g" + gh.next++) {
      gh.gists.set(id, { id, files: { "tarnished-ledger.json": { content: typeof content === "string" ? content : JSON.stringify(content) } } });
      return id;
    },
    content(id) { return JSON.parse(gh.gists.get(id).files["tarnished-ledger.json"].content); },
    async fetch(url, opts = {}) {
      const method = opts.method || "GET";
      const path = String(url).replace("https://api.github.com", "");
      gh.log.push(method + " " + path);
      if (gh.offline) throw new TypeError("Failed to fetch");
      const forced = gh.fail?.(method, path);
      if (forced) return forced;
      if (gh.gate && (!gh.gateMethod || gh.gateMethod === method)) await gh.gate;
      if (!String(opts.headers?.Authorization || "").startsWith("Bearer tok")) return reply(401, {});
      if (method === "GET" && path.startsWith("/gists?")) return reply(200, [...gh.gists.values()]);
      const m = path.match(/^\/gists\/(.+)$/);
      if (method === "GET" && m) return gh.gists.has(m[1]) ? reply(200, gh.gists.get(m[1])) : reply(404, {});
      if (method === "PATCH" && m) {
        if (!gh.gists.has(m[1])) return reply(404, {});
        Object.assign(gh.gists.get(m[1]).files, JSON.parse(opts.body).files);
        return reply(200, {});
      }
      if (method === "POST" && path === "/gists") {
        const id = gh.seed(JSON.parse(opts.body).files["tarnished-ledger.json"].content);
        return reply(201, { id });
      }
      return reply(404, {});
    },
  };
  return gh;
}
export { reply };

export const tick = () => new Promise((r) => setImmediate(r));
export async function settle(n = 20) { for (let i = 0; i < n; i++) await tick(); }
