// Cloudflare Pages Function —— 部署后自动响应 /proxy
// 作用：把 API key 留在服务器端，前端只调用 /proxy，避免 key 泄露和跨域问题。
// API key 在 Cloudflare 后台设为环境变量 VIEWDNS_API_KEY（Settings → Environment variables）。
// 没设置时回退到 'demo'（仅供临时测试，额度极低）。

export async function onRequestGet(context) {
  const { request, env } = context;
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

  // 归一化成前端好用的结构（以后换成自建探针，只改这一段）
  const norm = (s) =>
    (s || "").trim().split(/[\s,]+/).filter(Boolean).sort().join(",");

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
    summary: {
      result: (summary.result || "").toLowerCase(),
      description: summary.description || "",
    },
    nodes,
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
