# OpenClaw AI 选品调研系统

全网情报聚合 × 交叉分析 × 结构化报告，10 分钟出报告替代 1 周人工。

## 项目结构

```
openclaw-product-research/
├── workspace/                    # 选品工作区
│   ├── IDENTITY.md              # 选品分析员人设
│   ├── SOUL.md                  # Agent 灵魂/行为定义
│   ├── USER.md                  # 用户偏好 + 选品知识库
│   ├── AGENTS.md                # 工作规范 + 安全边界
│   ├── TOOLS.md                 # 工具说明（给 Agent 看）
│   ├── MEMORY.md                # 长期记忆
│   ├── HEARTBEAT.md             # 心跳检查清单
│   └── skills/                  # 选品专用技能
│       ├── amazon-research/     # 亚马逊数据抓取
│       │   └── SKILL.md
│       ├── google-trends/       # 谷歌趋势数据
│       │   └── SKILL.md
│       ├── tiktok-research/     # TikTok 数据抓取
│       │   └── SKILL.md
│       └── cross-analysis/      # 交叉分析引擎
│           └── SKILL.md
├── extensions/                   # TypeScript 插件（生产级）
│   └── product-research/
│       ├── openclaw.plugin.json
│       └── index.ts
├── openclaw.json                 # 主配置文件
├── deploy.sh                     # 一键部署脚本
└── .env.example                  # 环境变量模板
```

## 快速开始

### 1. 前置条件

- 已安装 OpenClaw（`curl -fsSL https://openclaw.ai/install.sh | bash`）
- Node.js ≥ 22
- 以下 API Key 至少准备一个：
  - `AMAZON_API_KEY`（或第三方选品工具 API）
  - `GOOGLE_TRENDS_KEY`（或使用 Agent-Reach 替代）
  - `TIKTOK_API_KEY`（或使用 Agent-Reach 替代）
  - `TAVILY_API_KEY`（通用搜索，推荐）

### 2. 一键部署

```bash
# 克隆项目
git clone <your-repo-url>
cd openclaw-product-research

# 复制环境变量模板并填写
cp .env.example .env

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 3. 手动部署

```bash
# 复制工作区到 OpenClaw 目录
cp -r workspace/ ~/.openclaw/workspace/

# 复制技能到全局技能目录
cp -r workspace/skills/* ~/.openclaw/skills/

# 复制插件到扩展目录
cp -r extensions/ ~/.openclaw/extensions/

# 复制主配置
cp openclaw.json ~/.openclaw/openclaw.json

# 重启 Gateway
openclaw gateway restart
```

### 4. 验证

在飞书/钉钉/WebUI 中发送：

> 帮我调研户外水壶美国站

Agent 会自动调用 3 个数据源 Skill → 交叉分析 → 输出结构化报告。

## 数据流

```
用户提问 → Agent 判断选品意图
  ├── 调用 amazon-research Skill → 抓取 Best Sellers / 评论数据
  ├── 调用 google-trends Skill → 获取搜索趋势
  ├── 调用 tiktok-research Skill → 获取热门标签/视频
  └── 调用 cross-analysis Skill → 交叉验证 + 生成报告
      → 至少 3 个数据源信号一致才输出「推荐进入」
      → 输出：市场规模 / 核心痛点 / 爆款公式 / 风险提示
```

## 定时任务

系统预配置了每日早晚两次自动选品扫描：

- 08:00 — 早间扫描（覆盖昨日数据）
- 20:00 — 晚间扫描（覆盖当日数据）

异常数据自动触发飞书群告警。

## 安全提醒

- API Key 必须通过环境变量或 `.env` 文件配置，严禁明文写入配置
- 爬虫遵守目标站点 robots.txt 和服务条款
- 选品结果仅作内部参考，不承诺具体销量或 ROI
