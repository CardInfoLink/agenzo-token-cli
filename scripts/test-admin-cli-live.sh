#!/bin/bash
# =============================================================
# agenzo-admin-cli 全链路实跑脚本（live，对接真实后端）
#
# 与 test-admin-cli-local.sh 的区别：本脚本自动完成 magic-link 登录
# （register -> 后端 consume -> CLI auth login 轮询自动拿到凭证），
# 因此能无人值守跑完 orgs / developers / keys 全部命令。
#
# 用法：
#   npm run build
#   HOST=http://localhost:8000 bash scripts/test-admin-cli-live.sh
#
# 前置：后端可达、jq 已安装。
# =============================================================

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${CLI:-node $ROOT/dist/index.js}"
HOST="${HOST:-http://localhost:8000}"
API="$HOST/api/v3/agent-pay"
EMAIL="${EMAIL:-admincli_$(date +%s)@example.com}"
ORG_NAME="${ORG_NAME:-AdminCliLive_$(date +%s)}"

PASS=0; FAIL=0
g() { printf "\033[32m  ✓ %s\033[0m\n" "$1"; PASS=$((PASS+1)); }
r() { printf "\033[31m  ✗ %s\033[0m\n" "$1"; FAIL=$((FAIL+1)); }
b() { printf "\033[34m▶ %s\033[0m\n" "$1"; }

OUT=/tmp/adminlive_out; ERR=/tmp/adminlive_err

# run <case_id> <expected_exit> -- <cmd...>  → 写 stdout 到 $OUT
run() {
  local id="$1" exp="$2"; shift 3
  "$@" >"$OUT" 2>"$ERR"; local rc=$?
  if [ "$rc" = "$exp" ]; then g "$id (exit=$rc)"; else r "$id (exp=$exp got=$rc): $(head -1 "$ERR")"; fi
}

echo "=========================================="
echo "  agenzo-admin-cli LIVE 全链路"
echo "  CLI=$CLI  HOST=$HOST  EMAIL=$EMAIL"
echo "=========================================="

# 0. 隔离本地状态
[ -d "$HOME/.agenzo-admin-cli" ] && mv "$HOME/.agenzo-admin-cli" "$HOME/.agenzo-admin-cli.live.bak.$(date +%s)"
$CLI config set-host "$HOST" --format json >/dev/null 2>&1

# ---------- §5.1 auth login（自动 magic-link）----------
b "auth login (§5.1) — 自动 register + consume"
REG=$(curl -s "$API/auth/register" -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"organization_name\":\"$ORG_NAME\"}" --max-time 10)
MLT=$(echo "$REG" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'].get('magic_link_token',''))" 2>/dev/null)
if [ -z "$MLT" ]; then r "register 失败: $REG"; echo "PASS=$PASS FAIL=$FAIL"; exit 1; fi
# 后台启动 CLI 登录（会轮询 status），同时主动 consume
( $CLI auth login --email "$EMAIL" --idempotency-key login-1 --format json >"$OUT" 2>"$ERR" ) &
LOGIN_PID=$!
sleep 1
curl -s "$API/auth/magic-links/consume?token=$MLT" >/dev/null --max-time 10
wait $LOGIN_PID; login_rc=$?
if [ "$login_rc" = "0" ]; then g "TC-AUTH-LOGIN-01 (exit=0)"; else r "TC-AUTH-LOGIN-01 (exit=$login_rc): $(head -2 "$ERR")"; fi
jq . "$OUT" >/dev/null 2>&1 && g "TC-AUTH-LOGIN-08 (stdout 合法 JSON)" || r "TC-AUTH-LOGIN-08 (stdout 非 JSON)"
grep -Eq "access_token|refresh_token" "$OUT" && r "TC-AUTH-LOGIN-06 (泄漏 token)" || g "TC-AUTH-LOGIN-06 (无 Bearer token)"
ORG_ID=$(jq -r '.org_id // empty' "$OUT")
echo "    ORG_ID=$ORG_ID"
[ -z "$ORG_ID" ] && { r "登录未拿到 org_id，后续依赖登录态的用例无法继续"; echo "PASS=$PASS FAIL=$FAIL"; exit 1; }

# ---------- §5.6 orgs get ----------
b "orgs get (§5.6)"
run "TC-ORG-GET-01" 0 -- $CLI orgs get --format json
$CLI orgs me >/dev/null 2>&1 && r "TC-ORG-GET-03 (orgs me 仍存在)" || g "TC-ORG-GET-03 (orgs me 已移除)"

# ---------- §5.7 orgs update ----------
b "orgs update (§5.7)"
run "TC-ORG-UPD-01" 0 -- $CLI orgs update --name "AdminCli Updated" --idempotency-key org-upd-1 --format json

# ---------- §5.8/5.9 orgs list / switch ----------
b "orgs list / switch (§5.8-5.9)"
$CLI orgs list --format json >"$OUT" 2>/dev/null
jq -e 'type=="array"' "$OUT" >/dev/null 2>&1 && g "TC-ORG-LIST-05 (JSON 数组)" || r "TC-ORG-LIST-05"
run "TC-ORG-SW-01" 0 -- $CLI orgs switch "$ORG_ID" --format json

# ---------- §5.10 developers create ----------
b "developers create (§5.10)"
$CLI developers create --developer-name "bot-$(date +%s)" --developer-email oncall@acme.com \
  --idempotency-key dev-crt-1 --yes --format json >"$OUT" 2>"$ERR"; dc=$?
[ "$dc" = 0 ] && g "TC-DEV-CRT-01 (exit=0)" || r "TC-DEV-CRT-01 (exit=$dc): $(head -1 "$ERR")"
DEV_ID=$(jq -r '.id // .developer_id // empty' "$OUT"); echo "    DEV_ID=$DEV_ID"

# ---------- §5.11-5.13 developers list / get / update ----------
b "developers list / get / update (§5.11-5.13)"
$CLI developers list --format json >"$OUT" 2>/dev/null
jq -e 'type=="array"' "$OUT" >/dev/null 2>&1 && g "TC-DEV-LST-04 (JSON 数组)" || r "TC-DEV-LST-04"
if [ -n "$DEV_ID" ]; then
  run "TC-DEV-GET-01" 0 -- $CLI developers get "$DEV_ID" --format json
  run "TC-DEV-UPD-01" 0 -- $CLI developers update "$DEV_ID" --name "bot-prod" --idempotency-key dev-upd-1 --format json
fi
run "TC-DEV-GET-02" 1 -- $CLI developers get dev_notexist --format json

# ---------- §5.14 keys create ----------
b "keys create (§5.14)"
if [ -n "$DEV_ID" ]; then
  $CLI keys create --developer-id "$DEV_ID" --key-name "Test Key" \
    --scope token,merchant,payment --idempotency-key key-crt-1 --format json >"$OUT" 2>"$ERR"; kc=$?
  [ "$kc" = 0 ] && g "TC-KEY-CRT-01 (exit=0)" || r "TC-KEY-CRT-01 (exit=$kc): $(head -1 "$ERR")"
  KEY_ID=$(jq -r '.id // empty' "$OUT"); echo "    KEY_ID=$KEY_ID"
  jq -e '.api_key' "$OUT" >/dev/null 2>&1 && g "TC-KEY-CRT-06 (api_key 在 json)" || r "TC-KEY-CRT-06 (api_key 缺失)"
  grep -Eq "access_token|refresh_token" "$OUT" && r "TC-KEY-CRT-07 (泄漏 Bearer)" || g "TC-KEY-CRT-07 (无 Bearer)"
fi

# ---------- §5.15/5.16 keys list / get ----------
b "keys list / get (§5.15-5.16)"
if [ -n "$DEV_ID" ]; then
  $CLI keys list --developer-id "$DEV_ID" --format json >"$OUT" 2>/dev/null
  jq -e 'all(.[]; has("api_key")|not)' "$OUT" >/dev/null 2>&1 && g "TC-KEY-LST-03 (list 无 api_key)" || r "TC-KEY-LST-03 (list 含 api_key)"
fi
if [ -n "${KEY_ID:-}" ]; then
  $CLI keys get "$KEY_ID" --format json >"$OUT" 2>/dev/null
  jq -e 'has("api_key")|not' "$OUT" >/dev/null 2>&1 && g "TC-KEY-GET-03 (get 无 api_key)" || r "TC-KEY-GET-03 (get 含 api_key)"
fi

# ---------- §5.17 keys rotate ----------
b "keys rotate (§5.17)"
if [ -n "${KEY_ID:-}" ]; then
  $CLI keys rotate "$KEY_ID" --idempotency-key key-rot-1 --format json >"$OUT" 2>/dev/null
  jq -e '.api_key' "$OUT" >/dev/null 2>&1 && g "TC-KEY-ROT-01 (新 api_key)" || r "TC-KEY-ROT-01"
fi

# ---------- §5.18 keys disable（幂等）----------
b "keys disable (§5.18)"
if [ -n "${KEY_ID:-}" ]; then
  run "TC-KEY-DIS-01" 0 -- $CLI keys disable "$KEY_ID" --idempotency-key key-dis-1 --format json
  run "TC-KEY-DIS-03" 0 -- $CLI keys disable "$KEY_ID" --format json
fi

# ---------- §5.2 auth logout ----------
b "auth logout (§5.2)"
run "TC-AUTH-LOGOUT-01" 0 -- $CLI auth logout --format json

echo "=========================================="
echo "  LIVE 汇总  PASS=$PASS  FAIL=$FAIL"
echo "=========================================="
[ "$FAIL" = 0 ] && exit 0 || exit 1
