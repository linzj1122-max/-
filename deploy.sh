#!/bin/bash
set -e

echo "============================================"
echo "  OpenClaw AI 选品调研系统 - 一键部署脚本"
echo "============================================"

OPENCLAW_DIR="$HOME/.openclaw"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

check_openclaw() {
    if command -v openclaw &> /dev/null; then
        echo "[OK] OpenClaw 已安装: $(openclaw --version)"
        return 0
    else
        echo "[WARN] OpenClaw 未安装"
        echo "       正在安装 OpenClaw..."
        curl -fsSL https://openclaw.ai/install.sh | bash
        if command -v openclaw &> /dev/null; then
            echo "[OK] OpenClaw 安装成功"
        else
            echo "[ERROR] OpenClaw 安装失败，请手动安装后重试"
            exit 1
        fi
    fi
}

check_env() {
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        echo "[WARN] .env 文件不存在"
        echo "       正在从模板创建..."
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        echo "[ACTION] 请编辑 .env 文件，填入你的 API Key 后重新运行此脚本"
        echo "         必填项: BAILIAN_API_KEY 或 OPENAI_API_KEY"
        echo "         推荐填写: TAVILY_API_KEY (通用搜索兜底)"
        exit 1
    fi
    echo "[OK] .env 文件已存在"
}

load_env() {
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
    echo "[OK] 环境变量已加载"
}

backup_existing() {
    if [ -d "$OPENCLAW_DIR/workspace" ]; then
        BACKUP_DIR="$OPENCLAW_DIR/workspace_backup_$(date +%Y%m%d_%H%M%S)"
        echo "[INFO] 备份现有工作区到 $BACKUP_DIR"
        cp -r "$OPENCLAW_DIR/workspace" "$BACKUP_DIR"
    fi
    if [ -d "$OPENCLAW_DIR/skills" ]; then
        BACKUP_SKILLS="$OPENCLAW_DIR/skills_backup_$(date +%Y%m%d_%H%M%S)"
        echo "[INFO] 备份现有技能到 $BACKUP_SKILLS"
        cp -r "$OPENCLAW_DIR/skills" "$BACKUP_SKILLS"
    fi
}

deploy_workspace() {
    echo "[INFO] 部署选品工作区..."
    mkdir -p "$OPENCLAW_DIR/workspace"
    cp -r "$SCRIPT_DIR/workspace/"* "$OPENCLAW_DIR/workspace/"
    echo "[OK] 工作区部署完成"
}

deploy_skills() {
    echo "[INFO] 部署选品技能..."
    mkdir -p "$OPENCLAW_DIR/skills"
    cp -r "$SCRIPT_DIR/workspace/skills/"* "$OPENCLAW_DIR/skills/"
    echo "[OK] 技能部署完成"
}

deploy_plugin() {
    echo "[INFO] 部署 TypeScript 插件..."
    mkdir -p "$OPENCLAW_DIR/extensions/product-research"
    cp -r "$SCRIPT_DIR/extensions/product-research/"* "$OPENCLAW_DIR/extensions/product-research/"
    echo "[OK] 插件部署完成"
}

deploy_config() {
    echo "[INFO] 部署主配置文件..."
    if [ -f "$OPENCLAW_DIR/openclaw.json" ]; then
        BACKUP_CONFIG="$OPENCLAW_DIR/openclaw.json_backup_$(date +%Y%m%d_%H%M%S)"
        cp "$OPENCLAW_DIR/openclaw.json" "$BACKUP_CONFIG"
        echo "[INFO] 已备份现有配置到 $BACKUP_CONFIG"
    fi
    cp "$SCRIPT_DIR/openclaw.json" "$OPENCLAW_DIR/openclaw.json"
    echo "[OK] 配置文件部署完成"
}

validate_config() {
    echo "[INFO] 验证配置..."
    openclaw config validate 2>/dev/null && echo "[OK] 配置验证通过" || echo "[WARN] 配置验证有警告，请检查"
    openclaw doctor 2>/dev/null && echo "[OK] 健康检查通过" || echo "[WARN] 健康检查有警告"
}

restart_gateway() {
    echo "[INFO] 重启 Gateway..."
    openclaw gateway restart
    sleep 3
    if openclaw gateway status &> /dev/null; then
        echo "[OK] Gateway 重启成功"
    else
        echo "[WARN] Gateway 状态未知，请手动检查: openclaw gateway status"
    fi
}

install_recommended_skills() {
    echo "[INFO] 安装推荐技能..."

    if command -v clawhub &> /dev/null; then
        echo "[INFO] 检测到 clawhub，安装推荐技能..."
        clawhub install agent-reach 2>/dev/null && echo "[OK] agent-reach 安装成功" || echo "[SKIP] agent-reach 安装跳过"
        clawhub install summarize 2>/dev/null && echo "[OK] summarize 安装成功" || echo "[SKIP] summarize 安装跳过"
        clawhub install tavily-search 2>/dev/null && echo "[OK] tavily-search 安装成功" || echo "[SKIP] tavily-search 安装跳过"
    else
        echo "[INFO] 未检测到 clawhub，跳过社区技能安装"
        echo "       可稍后手动安装: npm install -g clawhub"
    fi
}

print_summary() {
    echo ""
    echo "============================================"
    echo "  部署完成！"
    echo "============================================"
    echo ""
    echo "  工作区: $OPENCLAW_DIR/workspace/"
    echo "  技能目录: $OPENCLAW_DIR/skills/"
    echo "  插件目录: $OPENCLAW_DIR/extensions/"
    echo "  配置文件: $OPENCLAW_DIR/openclaw.json"
    echo ""
    echo "  下一步:"
    echo "  1. 确认 .env 中的 API Key 已正确填写"
    echo "  2. 打开 WebUI: http://127.0.0.1:18789/chat"
    echo "  3. 测试选品: 发送「帮我调研户外水壶美国站」"
    echo ""
    echo "  常用命令:"
    echo "  - openclaw gateway status    查看网关状态"
    echo "  - openclaw logs --follow     实时查看日志"
    echo "  - openclaw skills list       查看已安装技能"
    echo "  - openclaw config validate   验证配置"
    echo ""
}

echo ""
echo "Step 1/9: 检查 OpenClaw 安装"
check_openclaw

echo ""
echo "Step 2/9: 检查环境变量"
check_env

echo ""
echo "Step 3/9: 加载环境变量"
load_env

echo ""
echo "Step 4/9: 备份现有配置"
backup_existing

echo ""
echo "Step 5/9: 部署工作区"
deploy_workspace

echo ""
echo "Step 6/9: 部署技能"
deploy_skills

echo ""
echo "Step 7/9: 部署插件和配置"
deploy_plugin
deploy_config

echo ""
echo "Step 8/9: 验证并重启"
validate_config
restart_gateway

echo ""
echo "Step 9/9: 安装推荐社区技能"
install_recommended_skills

print_summary
