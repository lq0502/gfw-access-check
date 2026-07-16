<?php
/**
 * ViewDNS Chinese Firewall Test 代理
 * 作用：把 API key 留在服务器端，前端只调用本文件，避免 key 泄露和跨域问题。
 * 用法：和 index.html 放在同一目录即可。
 *
 * API key 获取：https://viewdns.info/api/  注册后拿到 key，
 * 推荐用环境变量 VIEWDNS_API_KEY 设置；没设置时下面回退到 'demo'（仅供临时测试，额度极低）。
 */

header('Content-Type: application/json; charset=utf-8');

$API_KEY = getenv('VIEWDNS_API_KEY') ?: 'demo';

/* 把 "1.2.3.4 5.6.7.8" 这类字符串排序后归一，便于比较 */
function normalize_ips($s){
    $parts = array_filter(preg_split('/[\s,]+/', trim((string)$s)));
    sort($parts);
    return implode(',', $parts);
}

/* 取 domain 并清洗，只保留域名合法字符 */
$raw = isset($_GET['domain']) ? trim($_GET['domain']) : '';
$domain = preg_replace('#^https?://#i', '', $raw);
$domain = preg_replace('#/.*$#', '', $domain);
$domain = preg_replace('#[^a-zA-Z0-9.\-]#', '', $domain);

if ($domain === '') {
    http_response_code(400);
    echo json_encode(['error' => '请提供有效域名'], JSON_UNESCAPED_UNICODE);
    exit;
}

$url = 'https://api.viewdns.info/chinesefirewall/'
     . '?domain='  . urlencode($domain)
     . '&apikey='  . urlencode($API_KEY)
     . '&output=json';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_USERAGENT      => 'gfw-access-check/1.0',
]);
$body = curl_exec($ch);
$err  = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($body === false || $code >= 400) {
    http_response_code(502);
    echo json_encode(['error' => 'ViewDNS 请求失败：' . ($err ?: ('HTTP ' . $code))], JSON_UNESCAPED_UNICODE);
    exit;
}

$data = json_decode($body, true);
if (!is_array($data)) {
    http_response_code(502);
    echo json_encode(['error' => '无法解析 ViewDNS 响应'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* 归一化成前端好用的结构（以后换成自建探针，只改这一段） */
$expected = isset($data['expectedresponse']) ? trim($data['expectedresponse']) : '';
$summary  = $data['response']['summary'] ?? ['result' => '', 'description' => ''];
$servers  = $data['response']['detail']['server'] ?? [];

$nodes = [];
foreach ($servers as $s) {
    $ips    = trim($s['resultvalue'] ?? '');
    $status = strtolower(trim($s['resultstatus'] ?? '')) ?: 'unknown';
    $match  = ($expected !== '' && $ips !== '' && normalize_ips($ips) === normalize_ips($expected));
    $nodes[] = [
        'location' => $s['location'] ?? '',
        'ips'      => $ips,
        'status'   => $status,
        'match'    => $match,
    ];
}

echo json_encode([
    'domain'   => $domain,
    'expected' => $expected,
    'summary'  => [
        'result'      => strtolower(trim($summary['result'] ?? '')),
        'description' => $summary['description'] ?? '',
    ],
    'nodes'    => $nodes,
], JSON_UNESCAPED_UNICODE);
