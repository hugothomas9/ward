//! Ward RiskEngine — Stylus (Rust) volatility-aware risk math.
//!
//! A PURE, STATELESS on-chain math library. It holds NO storage, so there is nothing to
//! initialize and nothing to front-run (this is why the old `init()` is gone — F7 dissolved by
//! removing state entirely). All inputs are passed in by the trusted caller:
//!   - `realized_vol(prices)`             : stddev of simple returns over a price window (WAD)
//!   - `dynamic_threshold_bps(base, vol)` : volatility-adjusted liquidation threshold (bps)
//!
//! Provenance of `prices` is enforced upstream: the only caller is the Solidity DynamicRiskModel,
//! which feeds the on-chain `PriceHistory` buffer (filled by `poke()` reading the Chainlink feed).
//! So even though these functions are pure and callable by anyone, the SYSTEM only ever evaluates
//! them on real feed history.
//!
//! All math is fixed-point (no floating point — forbidden by the Stylus VM).

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{alloy_primitives::U256, prelude::*};

/// 1e18 fixed-point scale (WAD).
const WAD: u128 = 1_000_000_000_000_000_000;

sol_storage! {
    #[entrypoint]
    pub struct RiskEngine {}
}

/// Integer square root (Babylonian method). Deterministic, no floats.
fn isqrt(x: u128) -> u128 {
    if x == 0 {
        return 0;
    }
    let mut z = x / 2 + 1;
    let mut y = x;
    while z < y {
        y = z;
        z = (x / z + z) / 2;
    }
    y
}

#[public]
impl RiskEngine {
    /// Realized volatility (WAD) over a window of prices (WAD): population stddev of simple
    /// returns r_i = (p_i - p_{i-1}) / p_{i-1}.
    pub fn realized_vol(&self, prices: Vec<U256>) -> U256 {
        let n = prices.len();
        if n < 2 {
            return U256::ZERO;
        }
        let mut rets: Vec<i128> = Vec::with_capacity(n - 1);
        for i in 1..n {
            let prev = prices[i - 1].to::<u128>();
            let cur = prices[i].to::<u128>();
            if prev == 0 {
                rets.push(0);
                continue;
            }
            let diff = cur as i128 - prev as i128;
            rets.push(diff.saturating_mul(WAD as i128) / prev as i128);
        }
        let mut sum: i128 = 0;
        for r in &rets {
            sum += *r;
        }
        let mean = sum / rets.len() as i128;
        let mut var_acc: u128 = 0;
        for r in &rets {
            let d = (*r - mean).unsigned_abs();
            var_acc += d.saturating_mul(d) / WAD;
        }
        let variance = var_acc / rets.len() as u128;
        U256::from(isqrt(variance.saturating_mul(WAD)))
    }

    /// Volatility-adjusted liquidation threshold (bps), given a base threshold (bps).
    /// effective = base * (WAD - min(vol, WAD)/2) / WAD
    ///   vol = 0      -> base unchanged
    ///   vol = 10%    -> base * 0.95
    ///   vol >= 100%  -> base * 0.5 (floor)
    pub fn dynamic_threshold_bps(&self, base_bps: U256, vol_wad: U256) -> U256 {
        let base = base_bps.to::<u128>();
        let vol = vol_wad.to::<u128>();
        let cap = if vol > WAD { WAD } else { vol };
        let eff = base.saturating_mul(WAD - cap / 2) / WAD;
        U256::from(eff)
    }

}

#[cfg(test)]
mod test {
    use super::*;
    use stylus_sdk::testing::*;

    fn engine() -> RiskEngine {
        let vm = TestVM::default();
        RiskEngine::from(&vm)
    }

    #[test]
    fn isqrt_exact_values() {
        assert_eq!(isqrt(0), 0);
        assert_eq!(isqrt(1), 1);
        assert_eq!(isqrt(4), 2);
        assert_eq!(isqrt(10_000_000_000_000_000_000_000_000_000_000_000), 100_000_000_000_000_000);
    }

    #[test]
    fn constant_prices_have_zero_vol() {
        let e = engine();
        let p = alloc::vec![U256::from(100u128 * WAD); 5];
        assert_eq!(e.realized_vol(p), U256::ZERO);
    }

    #[test]
    fn symmetric_ten_percent_swings_give_ten_percent_vol() {
        let e = engine();
        let p = alloc::vec![
            U256::from(100u128 * WAD),
            U256::from(110u128 * WAD),
            U256::from(99u128 * WAD),
        ];
        assert_eq!(e.realized_vol(p), U256::from(WAD / 10));
    }

    #[test]
    fn dynamic_threshold_tightens_with_vol() {
        let e = engine();
        assert_eq!(e.dynamic_threshold_bps(U256::from(8000), U256::ZERO), U256::from(8000));
        assert_eq!(e.dynamic_threshold_bps(U256::from(8000), U256::from(WAD / 10)), U256::from(7600));
        assert_eq!(e.dynamic_threshold_bps(U256::from(8000), U256::from(2 * WAD)), U256::from(4000));
    }

}
