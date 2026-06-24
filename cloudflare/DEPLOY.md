# Cloudflare Worker 部署指南

## 免费额度

| 资源 | 免费额度 |
|------|---------|
| Workers 请求 | 100,000 次/天 |
| Cron Triggers | 5 个 |
| KV 读取 | 100,000 次/天 |
| KV 写入 | 1,000 次/天 |
| KV 存储 | 1 GB |
| CPU 时间 | 10ms/请求 |

## 前置条件

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
2. 安装 Node.js >= 18
3. 安装 wrangler CLI：`npm install -g wrangler`

## 部署步骤

### 1. 安装依赖

```bash
cd cloudflare
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

浏览器会打开授权页面，点击允许。

### 3. 创建 KV 命名空间

```bash
npx wrangler kv:namespace create "RESEARCH_KV"
```

命令会输出类似：
```
{ binding = "RESEARCH_KV", id = "xxxxxxxxxxxxxxxxxxxx" }
```

把输出的 `id` 填入 `wrangler.toml` 中的 `YOUR_KV_NAMESPACE_ID`。

### 4. 配置环境变量（Secrets）

**不要**把 API Key 写入 `wrangler.toml`，使用 wrangler secrets 设置：

```bash
# AI 模型（至少配一个）
npx wrangler secret put BAILIAN_API_KEY
npx wrangler secret put OPENAI_API_KEY

# 数据源 API（按需配置，至少配 TAVILY_API_KEY 作为兜底）
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret put AMAZON_API_KEY
npx wrangler secret put GOOGLE_TRENDS_KEY
npx wrangler secret put TIKTOK_API_KEY

# API 基础地址（可选，有默认值）
npx wrangler secret put AMAZON_API_BASE_URL
npx wrangler secret put GOOGLE_TRENDS_API_BASE_URL
npx wrangler secret put TIKTOK_API_BASE_URL

# Gateway 认证 Token（必须设置，自己生成一个随机字符串）
npx wrangler secret put GATEWAY_TOKEN

# 可选配置
npx wrangler secret put DEFAULT_TIMEOUT_SECONDS   # 默认 30
npx wrangler secret put MIN_POSITIVE_SIGNALS       # 默认 3
```

### 5. 本地测试

```bash
# 创建 .dev.vars 文件用于本地开发（不要提交到 git）
# 格式：
# BAILIAN_API_KEY=your_key
# TAVILY_API_KEY=your_key
# GATEWAY_TOKEN=your_token

npx wrangler dev
```

访问 http://localhost:8787/chat 打开 WebUI。

### 6. 部署到 Cloudflare

```bash
npx wrangler deploy
```

部署成功后会输出 Worker URL，如：`https://product-research-api.your-subdomain.workers.dev`

### 7. 验证

```bash
# 健康检查
curl https://product-research-api.your-subdomain.workers.dev/health

# 测试选品调研
curl -X POST https://product-research-api.your-subdomain.workers.dev/api/research/full \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GATEWAY_TOKEN" \
  -d '{"keyword": "户外水壶"}'
```

### 8. 打开 WebUI

访问 `https://product-research-api.your-subdomain.workers.dev/chat`

在设置中填入：
- API 基础地址：`https://product-research-api.your-subdomain.workers.dev`
- Gateway Token：你设置的 GATEWAY_TOKEN

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/chat` | GET | WebUI 聊天界面 |
| `/api/research/amazon` | POST | Amazon 数据调研 |
| `/api/research/google-trends` | POST | Google 趋势调研 |
| `/api/research/tiktok` | POST | TikTok 数据调研 |
| `/api/research/cross-analysis` | POST | 交叉分析 |
| `/api/research/full` | POST | 一键全量调研（推荐） |
| `/api/chat` | POST | AI 对话 |
| `/api/history` | GET | 历史报告查询 |

## 定时任务

部署后自动生效（Cloudflare Cron Triggers）：

| 时间 (UTC) | 北京时间 | 任务 |
|------------|---------|------|
| 0:00 | 8:00 | 早间选品扫描 |
| 12:00 | 20:00 | 晚间选品扫描 |
| 周五 10:00 | 周五 18:00 | 周度复盘 |

## 设置监控关键词

通过 KV 存储设置需要定时扫描的关键词：

```bash
npx wrangler kv:key put --namespace-id=YOUR_KV_NAMESPACE_ID "monitored_keywords" '["户外水壶","蓝牙耳机","宠物用品"]'
```

## 自定义域名（可选）

1. 在 Cloudflare Dashboard 中添加你的域名
2. 在 Worker 设置中添加自定义域名
3. 或通过 Cloudflare Router 规则路由到 Worker

## 故障排查

```bash
# 查看实时日志
npx wrangler tail

# 查看 KV 数据
npx wrangler kv:key list --namespace-id=YOUR_KV_NAMESPACE_ID

# 查看特定报告
npx wrangler kv:key get --namespace-id=YOUR_KV_NAMESPACE_ID "report:户外水壶:1234567890"
```
