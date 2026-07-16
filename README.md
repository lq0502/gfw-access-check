# 中国大陆访问检测 · GFW Access Check

从中国大陆五个节点实时解析域名，判断网站能否被墙内访问。基于 [ViewDNS.info](https://viewdns.info/) 的 Chinese Firewall Test API。

## 目录结构

```
gfw-access-check/
├─ index.html          # 前端页面
├─ functions/
│  └─ proxy.js         # 代理函数（Cloudflare Pages 用，藏 API key）
├─ proxy.php           # 代理的 PHP 版本（用 PHP 主机时才需要，可删）
└─ README.md
```

## 为什么不能只用 GitHub Pages

GitHub Pages 只托管静态文件，跑不了任何后端代码。而这个工具需要一个后端来「藏住 API key」——否则 key 写在前端会被人盗刷。

- **只想给朋友看界面 / 演示**：推到 GitHub Pages 就行，查询会自动落到内置的演示数据。
- **想让朋友查到真实结果**：用下面的 Cloudflare Pages 部署，它能同时托管静态页 + 代理函数，免费。

## 部署到 Cloudflare Pages（推荐）

### 1. 拿一个 ViewDNS API key
注册 <https://viewdns.info/api/>，拿到 key。

### 2. 推到 GitHub
```bash
cd gfw-access-check
git init
git add .
git commit -m "init: gfw access check"
git branch -M main
git remote add origin https://github.com/你的用户名/gfw-access-check.git
git push -u origin main
```

### 3. 在 Cloudflare Pages 连接仓库
1. 登录 <https://dash.cloudflare.com/> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 选中 `gfw-access-check` 仓库。
3. 构建设置：框架预设选 **None**，构建命令留空，输出目录填 `/`（根目录）。
4. 点 **Save and Deploy**。

### 4. 设置 API key（关键）
部署完成后进入这个项目的 **Settings → Environment variables**，新增：

| 变量名 | 值 |
| --- | --- |
| `VIEWDNS_API_KEY` | 你的 key |

保存后重新部署一次（Deployments → 最新一次 → Retry deployment）让变量生效。

### 5. 分享
Cloudflare 会给一个 `https://gfw-access-check-xxx.pages.dev` 地址，把它发给朋友即可。也可以在 **Custom domains** 里绑自己的域名。

## 换成 Vercel（可选替代）

Vercel 也行，两点不同：
- 函数目录不是 `functions/`，把 `functions/proxy.js` 移到 `api/proxy.js`。
- `index.html` 里的 `CONFIG.endpoint` 从 `/proxy` 改成 `/api/proxy`。
- API key 在 Vercel 项目的 **Settings → Environment Variables** 里设 `VIEWDNS_API_KEY`。

## 自定义

`index.html` 顶部有个 `CONFIG`：
- `endpoint`：代理地址，按上面平台选择。
- `presets`：常用站点，填了真实域名就能一键检测。

## 注意

- **配额**：ViewDNS 免费额度不高。公开给很多人用、频繁刷新，容易把额度打满或触发限流。人多的话建议加结果缓存，或升级套餐。
- **检测范围**：此工具只反映 DNS 层情况。IP 封锁、SNI 阻断、链路慢这些不一定体现。需要更精确判断时，配合国内多节点 HTTP 实测（如 itdog.cn、17ce.com）。
