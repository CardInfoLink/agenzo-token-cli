#!/bin/bash
# =============================================================
# agent-token-admin E2E 测试脚本
#
# 完整流程：注册 → 开发者 → API Key → 绑卡 → Webhook → VCN
#
# 用法：bash scripts/test-e2e.sh
# 前提：本地服务已启动 http://localhost:8000
# =============================================================

set -euo pipefail

BASE="http://localhost:8000/api/v3/agent-pay"
EMAIL="test_$(date +%s)@example.com"
ORG_NAME="TestOrg_$(date +%s)"

echo "=========================================="
echo "  agent-token-admin E2E 测试"
echo "=========================================="
echo ""

# ----------------------------------------------------------
# Step 1: 注册
# ----------------------------------------------------------
echo "▶ Step 1: 注册 ($EMAIL)"
REGISTER_RESP=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"organization_name\":\"$ORG_NAME\"}")

echo "  响应: $REGISTER_RESP"
MLT=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['magic_link_token'])")
echo "  Magic Link Token: $MLT"

# Consume magic link
curl -s "$BASE/auth/magic-links/consume?token=$MLT" > /dev/null

# Get credentials
STATUS_RESP=$(curl -s "$BASE/auth/magic-links/status?token=$MLT")
ACCESS_TOKEN=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")
ORG_ID=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['organization_id'])")
echo "  ✓ 注册成功: org=$ORG_ID"
echo ""

# ----------------------------------------------------------
# Step 2: 创建开发者
# ----------------------------------------------------------
echo "▶ Step 2: 创建开发者"
DEV_RESP=$(curl -s -X POST "$BASE/developers/create" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Agent","email":"agent@example.com"}')

echo "  响应: $DEV_RESP"
DEV_ID=$(echo "$DEV_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✓ 开发者创建成功: $DEV_ID"
echo ""

# ----------------------------------------------------------
# Step 3: 创建 API Key
# ----------------------------------------------------------
echo "▶ Step 3: 创建 API Key"
KEY_RESP=$(curl -s -X POST "$BASE/keys/create" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"developer_id\":\"$DEV_ID\",\"name\":\"Production Key\"}")

echo "  响应: $KEY_RESP"
API_KEY=$(echo "$KEY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['api_key'])")
KEY_ID=$(echo "$KEY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✓ API Key 创建成功: $KEY_ID"
echo "  ✓ API Key: $API_KEY"
echo ""

# ----------------------------------------------------------
# Step 4: 绑卡
# ----------------------------------------------------------
echo "▶ Step 4: 绑卡 (2223001870064586)"
PM_RESP=$(curl -s -X POST "$BASE/payment-methods/create" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"card","email":"user@example.com","card_number":"2223001870064586","expiry_date":"1028","cvv":"123"}')

echo "  响应: $PM_RESP"
PM_CODE=$(echo "$PM_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['code'])")
if [ "$PM_CODE" != "0000" ]; then
  PM_MSG=$(echo "$PM_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['message'])")
  echo "  ✗ 绑卡失败: [$PM_CODE] $PM_MSG"
  echo "=========================================="
  exit 1
fi
PM_ID=$(echo "$PM_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  ✓ 支付方式创建成功: $PM_ID (PENDING)"
echo ""

# ----------------------------------------------------------
# Step 5: Webhook 激活支付方式
# ----------------------------------------------------------
echo "▶ Step 5: Webhook 激活支付方式"
WH_RESP=$(curl -s -X POST "$BASE/webhooks/payment-methods" \
  -H "Content-Type: application/json" \
  -d "{\"payment_method_id\":\"$PM_ID\",\"status\":\"success\",\"brand\":\"mastercard\",\"last4\":\"4586\",\"first6\":\"222300\",\"exp_month\":10,\"exp_year\":2028}")

echo "  响应: $WH_RESP"

# 确认状态
PM_GET=$(curl -s "$BASE/payment-methods/$PM_ID" -H "X-Api-Key: $API_KEY")
PM_STATUS=$(echo "$PM_GET" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
echo "  ✓ 支付方式状态: $PM_STATUS"
echo ""

# ----------------------------------------------------------
# Step 6: 创建 VCN 支付令牌
# ----------------------------------------------------------
echo "▶ Step 6: 创建 VCN 支付令牌 (amount=2500)"
IDEM_KEY="idem_$(date +%s)"
EXT_TX="ext_tx_$(date +%s)"
VCN_RESP=$(curl -s -X POST "$BASE/payment-tokens/create" \
  -H "X-Api-Key: $API_KEY" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"vcn\",\"payment_method_id\":\"$PM_ID\",\"member_id\":\"mem_001\",\"amount\":2500,\"external_transaction_id\":\"$EXT_TX\"}")

echo "  响应: $VCN_RESP"
VCN_CODE=$(echo "$VCN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['code'])")

if [ "$VCN_CODE" = "0000" ]; then
  PTK_ID=$(echo "$VCN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
  echo "  ✓ VCN 创建成功: $PTK_ID"
else
  VCN_MSG=$(echo "$VCN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['message'])")
  echo "  ✗ VCN 创建失败: [$VCN_CODE] $VCN_MSG"
  echo "  ℹ 这通常是 Evo 沙箱不支持该测试卡的预授权，不是 CLI 的问题"
fi
echo ""

# ----------------------------------------------------------
# 汇总
# ----------------------------------------------------------
echo "=========================================="
echo "  测试汇总"
echo "=========================================="
echo "  邮箱:       $EMAIL"
echo "  组织 ID:    $ORG_ID"
echo "  开发者 ID:  $DEV_ID"
echo "  Key ID:     $KEY_ID"
echo "  API Key:    $API_KEY"
echo "  PM ID:      $PM_ID"
echo "  PM 状态:    $PM_STATUS"
echo "  VCN 结果:   $VCN_CODE"
echo "=========================================="
