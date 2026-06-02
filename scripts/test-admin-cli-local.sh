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
assert_exit 0 "TC-CFG-SET-02" -- $CLI config set-host "$HOST" --format json
$CLI config show --format json >/tmp/admincli_out 2>/dev/null
assert_json "TC-CFG-SHOW-04" /tmp/admincli_out
echo "  config show: $(cat /tmp/admincli_out | jq -c . 2>/dev/null)"
assert_exit 0 "TC-CFG-RST-01" -- $CLI config reset-host --format json
# 改回测试 host 继续后续用例
$CLI config set-host "$HOST" --format json >/dev/null 2>&1

# ----------------------------------------------------------
# 5.1 auth login（magic-link，需人工点链接）
# ----------------------------------------------------------
c_blue "▶ auth login (§5.1) — 需人工完成 magic link"
echo "  即将以 $EMAIL 登录；请在收到邮件后点击链接（或在后端 consume）。"
if [ "${AUTO_LOGIN:-0}" = "1" ]; then
  $CLI auth login --email "$EMAIL" --format json 1>/tmp/admincli_out 2>/tmp/admincli_err
  login_rc=$?
  if [ "$login_rc" = "0" ]; then
    c_green "  ✓ TC-AUTH-LOGIN-02 (exit=0)"; PASS=$((PASS+1))
    assert_no_secret "TC-AUTH-LOGIN-06" /tmp/admincli_out
    assert_json "TC-AUTH-LOGIN-08" /tmp/admincli_out
  else
    c_red "  ✗ TC-AUTH-LOGIN-02 (exit=$login_rc)"; FAIL=$((FAIL+1))
    echo "  登录未完成，跳过需要登录态的用例（orgs/developers/keys）"
    echo "=========================================="
    echo "  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
    echo "=========================================="
    exit 1
  fi
else
  c_blue "  (SKIP) 设 AUTO_LOGIN=1 启用自动登录轮询；当前跳过登录及其后续用例"
  echo "  手动登录命令："
  echo "    $CLI auth login --email \"$EMAIL\""
  SKIP=$((SKIP+1))
  echo "=========================================="
  echo "  config 用例已验证。登录后重跑（AUTO_LOGIN=1）可覆盖 orgs/developers/keys。"
  echo "  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
  echo "=========================================="
  exit 0
fi

# ----------------------------------------------------------
# 5.6 orgs get
# ----------------------------------------------------------
c_blue "▶ orgs get (§5.6)"
$CLI orgs get --format json >/tmp/admincli_out 2>/tmp/admincli_err
assert_json "TC-ORG-GET-01" /tmp/admincli_out
ORG_ID=$(jq -r '.id // .org_id // empty' /tmp/admincli_out)
echo "  ORG_ID=$ORG_ID"
# 旧 verb 应不存在
$CLI orgs me >/dev/null 2>&1
[ $? -ne 0 ] && { c_green "  ✓ TC-ORG-GET-03 (orgs me 已移除)"; PASS=$((PASS+1)); } \
             || { c_red "  ✗ TC-ORG-GET-03 (orgs me 仍存在)"; FAIL=$((FAIL+1)); }

# ----------------------------------------------------------
# 5.7 orgs update（[idem]）
# ----------------------------------------------------------
c_blue "▶ orgs update (§5.7)"
assert_exit 0 "TC-ORG-UPD-01" -- $CLI orgs update --name "AdminCli Updated" --idempotency-key org-upd-1 --format json

# ----------------------------------------------------------
# 5.8/5.9 orgs list / switch（纯本地）
# ----------------------------------------------------------
c_blue "▶ orgs list / switch (§5.8-5.9)"
$CLI orgs list --format json >/tmp/admincli_out 2>/dev/null
assert_json "TC-ORG-LIST-05" /tmp/admincli_out
[ -n "$ORG_ID" ] && assert_exit 0 "TC-ORG-SW-01" -- $CLI orgs switch "$ORG_ID" --format json

# ----------------------------------------------------------
# 5.10 developers create（[idem]）
# ----------------------------------------------------------
c_blue "▶ developers create (§5.10)"
$CLI developers create \
  --developer-name "shopping-bot-$(date +%s)" --developer-email oncall@acme.com \
  --idempotency-key dev-crt-1 --yes --format json 1>/tmp/admincli_out 2>/tmp/admincli_err
dev_rc=$?
[ "$dev_rc" = "0" ] && { c_green "  ✓ TC-DEV-CRT-01 (exit=0)"; PASS=$((PASS+1)); } \
                    || { c_red "  ✗ TC-DEV-CRT-01 (exit=$dev_rc)"; FAIL=$((FAIL+1)); }
DEV_ID=$(jq -r '.id // .developer_id // empty' /tmp/admincli_out)
echo "  DEV_ID=$DEV_ID"

# ----------------------------------------------------------
# 5.11/5.12/5.13 developers list / get / update
# ----------------------------------------------------------
c_blue "▶ developers list / get / update (§5.11-5.13)"
$CLI developers list --format json >/tmp/admincli_out 2>/dev/null
assert_json "TC-DEV-LST-04" /tmp/admincli_out
if [ -n "$DEV_ID" ]; then
  assert_exit 0 "TC-DEV-GET-01" -- $CLI developers get "$DEV_ID" --format json
  assert_exit 0 "TC-DEV-UPD-01" -- $CLI developers update "$DEV_ID" --name "shopping-bot-prod" --idempotency-key dev-upd-1 --format json
fi
# 负用例：不存在的 developer -> 退出 1
assert_exit 1 "TC-DEV-GET-02" -- $CLI developers get dev_notexist --format json

# ----------------------------------------------------------
# 5.14 keys create（[idem]，一次性明文）
# ----------------------------------------------------------
c_blue "▶ keys create (§5.14)"
if [ -n "$DEV_ID" ]; then
  $CLI keys create --developer-id "$DEV_ID" --key-name "Test Key" \
    --scope token,merchant,payment --idempotency-key key-crt-1 --format json \
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
fi

# ----------------------------------------------------------
# 5.15/5.16 keys list / get（无明文）
# ----------------------------------------------------------
c_blue "▶ keys list / get (§5.15-5.16)"
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
if [ -n "${KEY_ID:-}" ]; then
  assert_exit 0 "TC-KEY-DIS-01" -- $CLI keys disable "$KEY_ID" --idempotency-key key-dis-1 --format json
  # 幂等：二次 disable 仍成功
  assert_exit 0 "TC-KEY-DIS-03" -- $CLI keys disable "$KEY_ID" --format json
fi

# ----------------------------------------------------------
# 5.2 auth logout
# ----------------------------------------------------------
c_blue "▶ auth logout (§5.2)"
assert_exit 0 "TC-AUTH-LOGOUT-01" -- $CLI auth logout --format json

# ----------------------------------------------------------
# 汇总
# ----------------------------------------------------------
echo "=========================================="
echo "  本地命令级测试汇总"
echo "  PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
echo "=========================================="
[ "$FAIL" = "0" ] && exit 0 || exit 1
