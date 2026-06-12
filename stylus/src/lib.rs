//! Ward RiskEngine — Stylus (Rust) volatility-aware risk model.
//!
//! Computes, fully on-chain and in fixed-point (NO floating point — forbidden by the
//! Stylus VM):
//!   - `realized_vol(prices)`        : stddev of simple returns over a price window (WAD)
//!   - `dynamic_threshold_bps(vol)`  : volatility-adjusted liquidation threshold —
//!                                     calmer markets keep the base threshold, volatile
//!                                     markets tighten it (earlier Ward alerts)
//!
//! This is the engine behind the Solidity `StylusRiskModelAdapter` (IRiskModel):
//! Aave-style protocols use STATIC thresholds because this compute is too expensive in
//! EVM Solidity; Stylus makes it cheap enough to run permanently. That is Ward's
//! "difference #1".

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{alloy_primitives::U256, prelude::*};

/// 1e18 fixed-point scale (WAD).
const WAD: u128 = 1_000_000_000_000_000_000;

sol_storage! {
    #[entrypoint]
    pub struct RiskEngine {
        /// Base liquidation threshold in bps (e.g. 8000 = 80%), set once at init.
        uint256 base_threshold_bps;
    }
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
    /// One-shot initializer: sets the base threshold (bps). Reverts if already set.
    pub fn init(&mut self, base_threshold_bps: U256) -> Result<(), Vec<u8>> {
        if self.base_threshold_bps.get() != U256::ZERO {
            return Err(b"already initialized".to_vec());
        }
        if base_threshold_bps > U256::from(10_000) {
            return Err(b"bps>100%".to_vec());
        }
        self.base_threshold_bps.set(base_threshold_bps);
        Ok(())
    }

    pub fn base_threshold(&self) -> U256 {
        self.base_threshold_bps.get()
    }

    /// Realized volatility (WAD) over a window of prices (WAD): population stddev of
    /// simple returns r_i = (p_i - p_{i-1}) / p_{i-1}.
    pub fn realized_vol(&self, prices: Vec<U256>) -> U256 {
        let n = prices.len();
        if n < 2 {
            return U256::ZERO;
        }
        // simple returns in signed WAD
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
        // mean (signed WAD)
        let mut sum: i128 = 0;
        for r in &rets {
            sum += *r;
        }
        let mean = sum / rets.len() as i128;
        // population variance, kept in WAD scale: var = avg(d*d / WAD)
        let mut var_acc: u128 = 0;
        for r in &rets {
            let d = (*r - mean).unsigned_abs();
            var_acc += d.saturating_mul(d) / WAD;
        }
        let variance = var_acc / rets.len() as u128;
        // stddev in WAD: sqrt(variance * WAD)
        U256::from(isqrt(variance.saturating_mul(WAD)))
    }

    /// Volatility-adjusted liquidation threshold (bps).
    /// effective = base * (WAD - min(vol, WAD)/2) / WAD
    /// vol = 0      -> base unchanged
    /// vol = 10%    -> base * 0.95
    /// vol >= 100%  -> base * 0.5 (floor)
    pub fn dynamic_threshold_bps(&self, vol_wad: U256) -> U256 {
        let base = self.base_threshold_bps.get().to::<u128>();
        let vol = vol_wad.to::<u128>();
        let cap = if vol > WAD { WAD } else { vol };
        let eff = base.saturating_mul(WAD - cap / 2) / WAD;
        U256::from(eff)
    }

    /// Convenience for the adapter/bot: one call returning (vol, effectiveThresholdBps).
    pub fn risk_params(&self, prices: Vec<U256>) -> (U256, U256) {
        let vol = self.realized_vol(prices);
        let thr = self.dynamic_threshold_bps(vol);
        (vol, thr)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use stylus_sdk::testing::*;

    fn engine() -> RiskEngine {
        let vm = TestVM::default();
        let mut e = RiskEngine::from(&vm);
        e.init(U256::from(8000)).unwrap();
        e
    }

    #[test]
    fn init_is_one_shot_and_bounded() {
        let vm = TestVM::default();
        let mut e = RiskEngine::from(&vm);
        assert!(e.init(U256::from(10_001)).is_err()); // >100%
        e.init(U256::from(8000)).unwrap();
        assert_eq!(e.base_threshold(), U256::from(8000));
        assert!(e.init(U256::from(7000)).is_err()); // already initialized
    }

    #[test]
    fn isqrt_exact_values() {
        assert_eq!(isqrt(0), 0);
        assert_eq!(isqrt(1), 1);
        assert_eq!(isqrt(4), 2);
        assert_eq!(isqrt(10_000_000_000_000_000_000_000_000_000_000_000), 100_000_000_000_000_000); // 1e34 -> 1e17
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
        // 100 -> 110 (+10%), 110 -> 99 (-10%): mean 0, stddev = 10% = 0.1 WAD
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
        // calm: vol 0 -> 8000 bps unchanged
        assert_eq!(e.dynamic_threshold_bps(U256::ZERO), U256::from(8000));
        // 10% vol -> 8000 * 0.95 = 7600
        assert_eq!(e.dynamic_threshold_bps(U256::from(WAD / 10)), U256::from(7600));
        // extreme vol (>=100%) -> floor at half: 4000
        assert_eq!(e.dynamic_threshold_bps(U256::from(2 * WAD)), U256::from(4000));
    }

    #[test]
    fn risk_params_combines_both() {
        let e = engine();
        let p = alloc::vec![
            U256::from(100u128 * WAD),
            U256::from(110u128 * WAD),
            U256::from(99u128 * WAD),
        ];
        let (vol, thr) = e.risk_params(p);
        assert_eq!(vol, U256::from(WAD / 10));
        assert_eq!(thr, U256::from(7600));
    }
}
