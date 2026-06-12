#!/usr/bin/env bash
# Broadcast Ward (dynamic engine) to Robinhood Chain testnet.
#
# Prerequisite: the deployer wallet (.env DEPLOYER_ADDR) must be funded with testnet ETH.
# The faucet (https://faucet.testnet.chain.robinhood.com/) is browser-gated (Vercel bot
# challenge) and cannot be scripted — claim manually for DEPLOYER_ADDR first.
#
# Usage: ./deploy-testnet.sh
set -euo pipefail

RPC="https://rpc.testnet.chain.robinhood.com"
cd "$(dirname "$0")"
set -a; source .env; set +a
export PATH="$HOME/.foundry/bin:$HOME/.cargo/bin:$PATH"

echo "Deployer: $DEPLOYER_ADDR"
BAL=$(cast balance "$DEPLOYER_ADDR" --rpc-url "$RPC")
echo "Balance:  $BAL wei"
if [ "$BAL" = "0" ]; then
  echo "ERROR: deployer has 0 ETH. Fund $DEPLOYER_ADDR via the faucet first:"
  echo "  https://faucet.testnet.chain.robinhood.com/"
  exit 1
fi

echo "== Step 1/2: deploy the Stylus RiskEngine =="
# cargo stylus colorizes output, so strip ANSI escapes before parsing the address.
STYLUS_LOG=$(cd stylus && cargo stylus deploy --endpoint="$RPC" --private-key="$DEPLOYER_KEY" --no-verify 2>&1 | tee /dev/stderr)
ENGINE=$(printf '%s' "$STYLUS_LOG" | sed -E 's/\x1b\[[0-9;]*m//g' | grep -oiE "deployed code at address:? *0x[0-9a-fA-F]{40}" | grep -oiE "0x[0-9a-fA-F]{40}" | tail -1)
if [ -z "${ENGINE:-}" ]; then echo "ERROR: could not parse RiskEngine address from cargo stylus output"; exit 1; fi
echo "RiskEngine deployed at: $ENGINE"

echo "== Step 2/2: deploy LendingCore + PriceHistory + DynamicRiskModel + WardVault =="
RISK_ENGINE="$ENGINE" forge script script/DeployDynamic.s.sol \
  --rpc-url "$RPC" --broadcast --skip-simulation

echo "== Done. Addresses are in the forge output above and in broadcast/. =="
