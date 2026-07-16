// Cloudflare Worker 入口：处理 /proxy 转发，其余请求交给静态资源。
// API key 存在环境变量 VIEWDNS_API_KEY（Settings → Variables and secrets）。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/proxy") {
      return handleProxy(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleProxy(request, env) {
  const url = new URL(request.url);
  let domain = (url.searchParams.get("domain") || "").trim();
  domain = domain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-zA-Z0-9.\-]/g, "");
  if (!domain) return json({ error: "请提供有效域名" }, 400);

  const key = env.VIEWDNS_API_KEY || "demo";
  const api =
    "https://api.viewdns.info/chinesefirewall/" +
    `?domain=${encodeURIComponent(domain)}` +
    `&apikey=${encodeURIComponent(key)}` +
    "&output=json";

  let data;
  try {
    const r = await fetch(api, { headers: { "User-Agent": "gfw-access-check/1.0" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    data = await r.json();
  } catch (e) {
    return json({ error: "ViewDNS 请求失败：" + e.message }, 502);
  }

  const norm = (s) => (s || "").trim().split(/[\s,]+/).filter(Boolean).sort().join(",");
  const expected = (data.expectedresponse || "").trim();
  const summary = (data.response && data.response.summary) || { result: "", description: "" };
  const servers = (data.response && data.response.detail && data.response.detail.server) || [];
  const nodes = servers.map((s) => {
    const ips = (s.resultvalue || "").trim();
    const status = ((s.resultstatus || "").trim().toLowerCase()) || "unknown";
    return {
      location: s.location || "",
      ips,
      status,
      match: expected !== "" && ips !== "" && norm(ips) === norm(expected),
    };
  });

  return json({
    domain,
    expected,
    summary: { result: (summary.result || "").toLowerCase(), description: summary.description || "" },
    nodes,
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
