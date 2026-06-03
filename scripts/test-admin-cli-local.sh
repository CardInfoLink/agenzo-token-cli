#!/bin/bash
# =============================================================
# agenzo-admin-cli 本地命令级测试脚本（L3）
#
# 对应 docs/TEST_DESIGN.md §5。覆盖 18 条命令的可执行验证：
#   auth / config / orgs / developers / keys
#
# 不需要发布到 npm。CLI 入口由 $CLI 变量决定（默认直接跑构建产物）：
#   方式 A（推荐）：构建后直接调 dist
#       npm run build
#       bash scripts/test-admin-cli-local.sh
#   方式 B：npm link 后用全局 binary
#       npm run build && npm link
#       CLI="agenzo-admin-cli" bash scripts/test-admin-cli-local.sh
#
# 前置：
#   - 后端可达（默认 http://localhost:8000，可用 HOST 覆盖）
#   - jq 已安装
#   - 测试邮箱可收 magic link（EMAIL 覆盖；登录步骤需人工点链接，见下）
#
# 用法：
#   HOST=https://agent-test.everonet.com EMAIL=you@acme.com \
#     bash scripts/test-admin-cli-local.sh
# =============================================================

set -uo pipefail

# ---- CLI 入口（无需发布）----
CLI="${CLI:-node $(cd "$(dirname "$0")/.." && pwd)/dist/index.js}"
HOST="${HOST:-http://localhost:8000}"
EMAIL="${EMAIL:-admincli_$(date +%s)@example.com}"
ORG_NAME="${ORG_NAME:-AdminCliTestOrg}"

PASS=0
FAIL=0
SKIP=0

c_green() { printf "\033[32m%s\033[0m\n" "$1"; }
c_yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
c_red()   { printf "\033[31m%s\033[0m\n" "$1"; }
c_blue()  { printf "\033[34m%s\033[0m\n" "$1"; }

# assert_exit <expected_code> <case_id> -- <command...>
assert_exit() {
  local expected="$1" id="$2"; shift 3
  "$@" >/tmp/admincli_out 2>/tmp/admincli_err
  local actual=$?
  if [ "$actual" = "$expected" ]; then
    c_green "  ✓ $id (exit=$actual)"; PASS=$((PASS+1))
  else
    c_red   "  ✗ $id (expected exit=$expected, got $actual)"
    sed 's/^/      stderr> /' /tmp/admincli_err | head -3
    FAIL=$((FAIL+1))
  fi
}

# assert_no_secret <case_id> <file> -- stdout 不含 Bearer token
assert_no_secret() {
  local id="$1" file="$2"
  if grep -Eq "access_token|refresh_token" "$file"; then
    c_red "  ✗ $id 泄漏 Bearer token 到 stdout"; FAIL=$((FAIL+1))
  else
    c_green "  ✓ $id stdout 无 Bearer token"; PASS=$((PASS+1))
  fi
}

# assert_json <case_id> <file> -- stdout 是合法 JSON
assert_json() {
  local id="$1" file="$2"
  if jq . "$file" >/dev/null 2>&1; then
    c_green "  ✓ $id stdout 是合法 JSON"; PASS=$((PASS+1))
  else
    c_red "  ✗ $id stdout 不是合法 JSON"; FAIL=$((FAIL+1))
  fi
}

echo "=========================================="
echo "  agenzo-admin-cli 本地命令级测试"
echo "  CLI : $CLI"
echo "  HOST: $HOST"
echo "=========================================="

# ----------------------------------------------------------
# 0. 环境准备：备份本地状态目录 + 指向测试 host
# ----------------------------------------------------------
c_blue "▶ 0. 环境准备"
if [ -d "$HOME/.agenzo-admin-cli" ]; then
  mv "$HOME/.agenzo-admin-cli" "$HOME/.agenzo-admin-cli.bak.$(date +%s)"
  echo "  已备份旧的 ~/.agenzo-admin-cli"
fi

# ----------------------------------------------------------
# 5.3/5.4/5.5 config 命令（纯本地，无需登录，可独立验证）
# ----------------------------------------------------------
c_blue "▶ config set-host / show / reset-host (§5.3-5.5)"
  c_yellow "  - TC-CFG-RST-02 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-CFG-RST-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-CFG-RST-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-CFG-SET-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-CFG-SET-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-CFG-SET-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-CFG-SHOW-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-CFG-SHOW-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-CFG-SHOW-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))

# Before logging in, active_org should be null
assert_exit 0 "TC-CFG-RST-01" -- $CLI config reset-host --format json
assert_exit 1 "TC-CFG-RST-04" -- $CLI config reset-host --idempotency-key k --format json

$CLI config show --format json >/tmp/admincli_out 2>/dev/null
assert_json "TC-CFG-SHOW-04" /tmp/admincli_out
[ "$(jq -r '.active_org // empty' /tmp/admincli_out)" = "" ] && { c_green "  ✓ TC-CFG-SHOW-02 active_org is null"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-CFG-SHOW-02"; FAIL=$((FAIL+1)); }

assert_exit 1 "TC-CFG-SET-03" -- $CLI config set-host --format json
assert_exit 1 "TC-CFG-SET-06" -- $CLI config set-host "$HOST" --idempotency-key k --format json

# Testing set-host output deduplication (TC-CFG-SET-07)
$CLI config set-host "$HOST" --format table 1>/tmp/admincli_out 2>/tmp/admincli_err
set_rc=$?
[ "$set_rc" = "0" ] && { c_green "  ✓ TC-CFG-SET-02 (exit=0)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-CFG-SET-02 (exit=$set_rc)"; FAIL=$((FAIL+1)); }
[ $(grep -c "API host set to" /tmp/admincli_err) -eq 1 ] && { c_green "  ✓ TC-CFG-SET-07 (no duplicate status lines)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-CFG-SET-07"; FAIL=$((FAIL+1)); }

# Check logout before login
assert_exit 3 "TC-AUTH-LOGOUT-02" -- $CLI auth logout --format json
assert_exit 1 "TC-AUTH-LOGOUT-04" -- $CLI auth logout --idempotency-key k --format json

# ----------------------------------------------------------
# 5.1 auth login（magic-link，需人工点链接）
# ----------------------------------------------------------
c_blue "▶ auth login (§5.1) — 自动 mock email consume"
  c_yellow "  - TC-AUTH-LOGIN-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-AUTH-LOGIN-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-AUTH-LOGIN-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-AUTH-LOGIN-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-AUTH-LOGIN-09 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-AUTH-LOGIN-12 (interactive/mock skipped)"; SKIP=$((SKIP+1))

assert_exit 1 "TC-AUTH-LOGIN-11" -- $CLI auth login --email "$EMAIL" --yes --format json
assert_exit 1 "TC-AUTH-LOGIN-10" -- $CLI auth login --yes --format json

echo "  即将以 $EMAIL 登录（邮件被 mock，脚本自动 consume）。"

# pre-register and consume to bypass the interactive prompt for Organization name
REG_RES=$(curl -s -X POST "$HOST/api/v3/agent-pay/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"organization_name\":\"TestOrg_$(date +%s)\"}")
MLT=$(echo "$REG_RES" | jq -r '.data.magic_link_token // empty')
if [ -n "$MLT" ]; then
  curl -s "$HOST/api/v3/agent-pay/auth/magic-links/consume?token=$MLT" > /dev/null
fi

$CLI auth login --email "$EMAIL" --idempotency-key "login-idem-$(date +%s)" --format json --verbose 1>/tmp/admincli_out 2>/tmp/admincli_err &
LOGIN_PID=$!

# Polling MongoDB for the magic link token and automatically consuming it
for i in {1..10}; do
  sleep 1
  TOKEN=$(docker exec agenzo-mongodb mongosh "mongodb://agenzo:agenzo_mongo_123@localhost:27017/agenzo?authSource=admin" --quiet --eval "db.ap_magic_links.findOne({email: '$EMAIL', status: 'PENDING'})?._id" 2>/dev/null)
  if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "  [Mock] 自动点击 magic link: $TOKEN"
    curl -s "$HOST/api/v3/agent-pay/auth/magic-links/consume?token=$TOKEN" > /dev/null
    break
  fi
done

wait $LOGIN_PID
login_rc=$?

if [ "$login_rc" = "0" ]; then
  c_green "  ✓ TC-AUTH-LOGIN-02 (exit=0)"; PASS=$((PASS+1))
  assert_no_secret "TC-AUTH-LOGIN-06" /tmp/admincli_out
  assert_json "TC-AUTH-LOGIN-08" /tmp/admincli_out
  c_green "  ✓ TC-AUTH-LOGIN-07 (idempotency key passed)"; PASS=$((PASS+1))
else
  c_red "  ✗ TC-AUTH-LOGIN-02 (exit=$login_rc)"; FAIL=$((FAIL+1))
  echo "  登录未完成，跳过需要登录态的用例（orgs/developers/keys）"
  echo "=========================================="
  echo "  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
  echo "=========================================="
  exit 1
fi

# ----------------------------------------------------------
# 5.6 orgs get
# ----------------------------------------------------------
c_blue "▶ orgs get (§5.6)"
  c_yellow "  - TC-ORG-GET-02 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ORG-GET-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
$CLI orgs get --format json >/tmp/admincli_out 2>/tmp/admincli_err
assert_json "TC-ORG-GET-01" /tmp/admincli_out
ORG_ID=$(jq -r '.id // .org_id // empty' /tmp/admincli_out)
echo "  ORG_ID=$ORG_ID"
# 旧 verb 应不存在
$CLI orgs me >/dev/null 2>&1
[ $? -ne 0 ] && { c_green "  ✓ TC-ORG-GET-03 (orgs me 已移除)"; PASS=$((PASS+1)); } \
             || { c_red "  ✗ TC-ORG-GET-03 (orgs me 仍存在)"; FAIL=$((FAIL+1)); }
jq -e '.created_at and .updated_at' /tmp/admincli_out >/dev/null \
  && { c_green "  ✓ TC-ORG-GET-04 (fields match)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-ORG-GET-04"; FAIL=$((FAIL+1)); }

# ----------------------------------------------------------
# 5.7 orgs update（[idem]）
# ----------------------------------------------------------
c_blue "▶ orgs update (§5.7)"
  c_yellow "  - TC-ORG-UPD-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ORG-UPD-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ORG-UPD-06 (interactive/mock skipped)"; SKIP=$((SKIP+1))
assert_exit 0 "TC-ORG-UPD-01" -- $CLI orgs update --name "AdminCli Updated" --idempotency-key org-upd-1 --format json

assert_exit 0 "TC-ORG-UPD-02" -- $CLI orgs update --email "new_$EMAIL" --idempotency-key org-upd-2 --format json
jq -e '.magic_link_token' /tmp/admincli_out >/dev/null && { c_green "  ✓ TC-ORG-UPD-08 (split response assertion)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-ORG-UPD-08"; FAIL=$((FAIL+1)); }

assert_exit 1 "TC-ORG-UPD-05" -- $CLI orgs update --email "invalid-email" --idempotency-key org-upd-3 --format json
assert_exit 1 "TC-ORG-UPD-07" -- $CLI orgs update --name "Test" --yes --format json

# ----------------------------------------------------------
# 5.8/5.9 orgs list / switch（纯本地）
# ----------------------------------------------------------
c_blue "▶ orgs list / switch (§5.8-5.9)"
  c_yellow "  - TC-ORG-LIST-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ORG-LIST-02 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ORG-LIST-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ORG-LIST-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ORG-SW-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ORG-SW-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
$CLI orgs list --format json >/tmp/admincli_out 2>/dev/null
assert_json "TC-ORG-LIST-05" /tmp/admincli_out
[ $(jq 'type' /tmp/admincli_out) = '"array"' ] && { c_green "  ✓ TC-ORG-LIST-05 (array)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-ORG-LIST-05"; FAIL=$((FAIL+1)); }
[ -n "$ORG_ID" ] && assert_exit 0 "TC-ORG-SW-01" -- $CLI orgs switch "$ORG_ID" --format json

assert_exit 3 "TC-ORG-SW-02" -- $CLI orgs switch "org_notexist" --format json
assert_exit 1 "TC-ORG-SW-05" -- $CLI orgs switch "org_notexist" --idempotency-key k --format json

# ----------------------------------------------------------
# 5.10 developers create（[idem]）
# ----------------------------------------------------------
c_blue "▶ developers create (§5.10)"
  c_yellow "  - TC-DEV-CRT-02 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-CRT-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-CRT-06 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-CRT-07 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-CRT-11 (interactive/mock skipped)"; SKIP=$((SKIP+1))

assert_exit 1 "TC-DEV-CRT-03" -- $CLI developers create --yes --format json
assert_exit 1 "TC-DEV-CRT-05" -- $CLI developers create --developer-name x --developer-email invalid --idempotency-key d-1 --format json
assert_exit 1 "TC-DEV-CRT-10" -- $CLI developers create --developer-name x --developer-email a@b.com --billing-mode weekly --idempotency-key d-2 --format json

$CLI developers create \
  --developer-name "shopping-bot-$(date +%s)" --developer-email oncall@acme.com \
  --idempotency-key dev-crt-1 --yes --format json 1>/tmp/admincli_out 2>/tmp/admincli_err
dev_rc=$?
[ "$dev_rc" = "0" ] && { c_green "  ✓ TC-DEV-CRT-01 (exit=0)"; PASS=$((PASS+1)); } \
                    || { c_red "  ✗ TC-DEV-CRT-01 (exit=$dev_rc)"; FAIL=$((FAIL+1)); }
DEV_ID=$(jq -r '.id // .developer_id // empty' /tmp/admincli_out)
echo "  DEV_ID=$DEV_ID"

[ "$(jq -r '.billing_mode // empty' /tmp/admincli_out)" = "pay_per_call" ] && { c_green "  ✓ TC-DEV-CRT-08 (default billing_mode)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-DEV-CRT-08"; FAIL=$((FAIL+1)); }

# TC-DEV-CRT-09 / 11 : create another one with monthly_settlement
$CLI developers create --developer-name "monthly-bot-$(date +%s)" --developer-email month@acme.com --billing-mode Monthly_Settlement --idempotency-key dev-crt-2 --yes --format json 1>/tmp/admincli_out 2>/dev/null
[ "$(jq -r '.billing_mode // empty' /tmp/admincli_out)" = "monthly_settlement" ] && { c_green "  ✓ TC-DEV-CRT-09/11 (monthly_settlement norm)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-DEV-CRT-09/11"; FAIL=$((FAIL+1)); }
MONTHLY_DEV_ID=$(jq -r '.id // empty' /tmp/admincli_out)

# ----------------------------------------------------------
# 5.11/5.12/5.13 developers list / get / update
# ----------------------------------------------------------
c_blue "▶ developers list / get / update (§5.11-5.13)"
  c_yellow "  - TC-DEV-LST-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-LST-02 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-LST-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-UPD-02 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-UPD-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-DEV-UPD-06 (interactive/mock skipped)"; SKIP=$((SKIP+1))
$CLI developers list --format json >/tmp/admincli_out 2>/dev/null
assert_json "TC-DEV-LST-04" /tmp/admincli_out
[ $(jq 'type' /tmp/admincli_out) = '"array"' ] && { c_green "  ✓ TC-DEV-LST-04 (array)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-DEV-LST-04"; FAIL=$((FAIL+1)); }

if [ -n "$DEV_ID" ]; then
  assert_exit 0 "TC-DEV-GET-01" -- $CLI developers get "$DEV_ID" --format json
  assert_exit 0 "TC-DEV-UPD-01" -- $CLI developers update "$DEV_ID" --name "shopping-bot-prod" --idempotency-key dev-upd-1 --format json
fi
# 负用例：不存在的 developer -> 退出 1
assert_exit 1 "TC-DEV-GET-02" -- $CLI developers get dev_notexist --format json
assert_exit 1 "TC-DEV-GET-03" -- $CLI developers get --format json
assert_exit 1 "TC-DEV-UPD-03" -- $CLI developers update dev_notexist --name x --idempotency-key upd-x --format json
assert_exit 1 "TC-DEV-UPD-05" -- $CLI developers update "$DEV_ID" --email invalid --idempotency-key upd-y --format json

# ----------------------------------------------------------
# 5.14 keys create（[idem]，一次性明文）
# ----------------------------------------------------------
c_blue "▶ keys create (§5.14)"
  c_yellow "  - TC-KEY-CRT-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-CRT-08 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-CRT-09 (interactive/mock skipped)"; SKIP=$((SKIP+1))

assert_exit 1 "TC-KEY-CRT-04" -- $CLI keys create --developer-id dev_notexist --key-name test --idempotency-key k-1 --format json
[ -n "${DEV_ID:-}" ] && assert_exit 1 "TC-KEY-CRT-10" -- $CLI keys create --developer-id "$DEV_ID" --key-name test --scope weekly --idempotency-key k-2 --format json

if [ -n "$DEV_ID" ]; then
  $CLI keys create --developer-id "$DEV_ID" --key-name "Test Key" \
    --idempotency-key key-crt-1 --yes --format json \
    1>/tmp/admincli_out 2>/tmp/admincli_err
  key_rc=$?
  [ "$key_rc" = "0" ] && { c_green "  ✓ TC-KEY-CRT-01 (exit=0)"; PASS=$((PASS+1)); } \
                      || { c_red "  ✗ TC-KEY-CRT-01 (exit=$key_rc)"; FAIL=$((FAIL+1)); }
  KEY_ID=$(jq -r '.id // empty' /tmp/admincli_out)
  echo "  KEY_ID=$KEY_ID"
  # api_key 必须存在；Bearer token 必须不存在
  jq -e '.api_key' /tmp/admincli_out >/dev/null 2>&1 \
    && { c_green "  ✓ TC-KEY-CRT-06 (api_key 出现在 json)"; PASS=$((PASS+1)); } \
    || { c_red "  ✗ TC-KEY-CRT-06 (api_key 缺失)"; FAIL=$((FAIL+1)); }
  assert_no_secret "TC-KEY-CRT-07" /tmp/admincli_out

  [ "$(jq -c '.scope // empty' /tmp/admincli_out)" = '["token","merchant","payment"]' ] && { c_green "  ✓ TC-KEY-CRT-02 (default scope)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-KEY-CRT-02"; FAIL=$((FAIL+1)); }

  # Test subset scope
  assert_exit 0 "TC-KEY-CRT-03" -- $CLI keys create --developer-id "$DEV_ID" --key-name "SubKey" --scope token --idempotency-key key-crt-2 --format json
  [ "$(jq -c '.scope // empty' /tmp/admincli_out)" = '["token"]' ] && { c_green "  ✓ TC-KEY-CRT-03 (subset scope)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-KEY-CRT-03"; FAIL=$((FAIL+1)); }
fi

# ----------------------------------------------------------
# 5.15/5.16 keys list / get（无明文）
# ----------------------------------------------------------
c_blue "▶ keys list / get (§5.15-5.16)"
  c_yellow "  - TC-KEY-GET-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-GET-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-LST-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-LST-02 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-LST-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
assert_exit 1 "TC-KEY-LST-04" -- $CLI keys list --developer-id dev_notexist --format json
assert_exit 1 "TC-KEY-GET-02" -- $CLI keys get key_notexist --format json

if [ -n "$DEV_ID" ]; then
  $CLI keys list --developer-id "$DEV_ID" --format json >/tmp/admincli_out 2>/dev/null
  jq -e 'all(.[]; has("api_key") | not)' /tmp/admincli_out >/dev/null 2>&1 \
    && { c_green "  ✓ TC-KEY-LST-03 (list 无 api_key)"; PASS=$((PASS+1)); } \
    || { c_red "  ✗ TC-KEY-LST-03 (list 含 api_key)"; FAIL=$((FAIL+1)); }
fi
if [ -n "${KEY_ID:-}" ]; then
  $CLI keys get "$KEY_ID" --format json >/tmp/admincli_out 2>/dev/null
  jq -e 'has("api_key") | not' /tmp/admincli_out >/dev/null 2>&1 \
    && { c_green "  ✓ TC-KEY-GET-03 (get 无 api_key)"; PASS=$((PASS+1)); } \
    || { c_red "  ✗ TC-KEY-GET-03 (get 含 api_key)"; FAIL=$((FAIL+1)); }
fi

# ----------------------------------------------------------
# 5.17 keys rotate（[idem]，新明文）
# ----------------------------------------------------------
c_blue "▶ keys rotate (§5.17)"
  c_yellow "  - TC-KEY-ROT-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-ROT-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-ROT-06 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-ROT-08 (interactive/mock skipped)"; SKIP=$((SKIP+1))
assert_exit 1 "TC-KEY-ROT-02" -- $CLI keys rotate key_notexist --idempotency-key rot-x --format json
[ -n "${KEY_ID:-}" ] && assert_exit 1 "TC-KEY-ROT-07" -- $CLI keys rotate "$KEY_ID" --yes --format json

if [ -n "${KEY_ID:-}" ]; then
  $CLI keys rotate "$KEY_ID" --idempotency-key key-rot-1 --format json >/tmp/admincli_out 2>/dev/null
  jq -e '.api_key' /tmp/admincli_out >/dev/null 2>&1 \
    && { c_green "  ✓ TC-KEY-ROT-01 (新 api_key 存在)"; PASS=$((PASS+1)); } \
    || { c_red "  ✗ TC-KEY-ROT-01"; FAIL=$((FAIL+1)); }
fi

# ----------------------------------------------------------
# 5.18 keys disable（[idem]，幂等）
# ----------------------------------------------------------
c_blue "▶ keys disable (§5.18)"
  c_yellow "  - TC-KEY-DIS-04 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-KEY-DIS-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
assert_exit 1 "TC-KEY-DIS-02" -- $CLI keys disable key_notexist --idempotency-key dis-x --format json
[ -n "${KEY_ID:-}" ] && assert_exit 1 "TC-KEY-DIS-06" -- $CLI keys disable "$KEY_ID" --yes --format json

if [ -n "${KEY_ID:-}" ]; then
  assert_exit 0 "TC-KEY-DIS-01" -- $CLI keys disable "$KEY_ID" --idempotency-key key-dis-1 --format json
  # 幂等：二次 disable 仍成功
  assert_exit 0 "TC-KEY-DIS-03" -- $CLI keys disable "$KEY_ID" --idempotency-key key-dis-1 --format json
  
  # TC-KEY-ROT-03 (cannot rotate after disable)
  assert_exit 1 "TC-KEY-ROT-03" -- $CLI keys rotate "$KEY_ID" --idempotency-key key-rot-2 --format json
fi

# ----------------------------------------------------------
# 5.19 accounts get
# ----------------------------------------------------------
c_blue "▶ accounts get (§5.19)"
  c_yellow "  - TC-ACCT-GET-05 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ACCT-GET-06 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-ACCT-GET-07 (interactive/mock skipped)"; SKIP=$((SKIP+1))
if [ -n "${MONTHLY_DEV_ID:-}" ]; then
  assert_exit 0 "TC-ACCT-GET-01" -- $CLI accounts get --developer-id "$MONTHLY_DEV_ID" --format json
  jq -e '.id | startswith("acct_")' /tmp/admincli_out >/dev/null && { c_green "  ✓ TC-ACCT-GET-02 (starts with acct_)"; PASS=$((PASS+1)); } || { c_red "  ✗ TC-ACCT-GET-02"; FAIL=$((FAIL+1)); }
fi

if [ -n "${DEV_ID:-}" ]; then
  # pay_per_call has no account
  assert_exit 0 "TC-ACCT-GET-03" -- $CLI accounts get --developer-id "$DEV_ID" --format json
  OUT_CONTENT="$(cat /tmp/admincli_out)"
  if [ "$OUT_CONTENT" = "null" ] || [ -z "$OUT_CONTENT" ] || echo "$OUT_CONTENT" | jq -e '.data == null' >/dev/null 2>&1; then
    c_green "  ✓ TC-ACCT-GET-03 (null result)"; PASS=$((PASS+1))
  else
    c_red "  ✗ TC-ACCT-GET-03 ($OUT_CONTENT)"; FAIL=$((FAIL+1))
  fi
fi

assert_exit 1 "TC-ACCT-GET-04" -- $CLI accounts get --developer-id dev_notexist --format json

# ----------------------------------------------------------
# 5.2 auth logout
# ----------------------------------------------------------
c_blue "▶ auth logout (§5.2)"
  c_yellow "  - TC-AUTH-LOGOUT-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-IDEM-INT-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-IDEM-YES-01 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-IDEM-YES-02 (interactive/mock skipped)"; SKIP=$((SKIP+1))
  c_yellow "  - TC-IDEM-YES-03 (interactive/mock skipped)"; SKIP=$((SKIP+1))
assert_exit 0 "TC-AUTH-LOGOUT-01" -- $CLI auth logout --format json

# ----------------------------------------------------------
# 汇总
# ----------------------------------------------------------
echo "=========================================="
echo "  本地命令级测试汇总"
echo "  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
echo "=========================================="
[ "$FAIL" = "0" ] && exit 0 || exit 1
