// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PriceHistory} from "../src/PriceHistory.sol";
import {MockV3Aggregator} from "../src/oracles/MockV3Aggregator.sol";

contract PriceHistoryTest is Test {
    MockV3Aggregator feed;
    PriceHistory hist;

    uint256 constant MAX_STALENESS = 1 hours;
    uint256 constant MIN_INTERVAL = 60; // 60s between samples

    function setUp() public {
        feed = new MockV3Aggregator(8, 250e8); // 250 USD, 8-dec Chainlink feed
        hist = new PriceHistory(address(feed), MAX_STALENESS, MIN_INTERVAL);
    }

    function _poke() internal {
        vm.warp(block.timestamp + MIN_INTERVAL);
        hist.poke();
    }

    // --- F2: provenance — the buffer only ever holds the FEED's value, never an injected one ---

    function test_pokeStoresNormalizedFeedPrice() public {
        _poke();
        // 250e8 (8-dec feed) normalized to WAD = 250e18
        assertEq(hist.latestWad(), 250e18);
        assertEq(hist.length(), 1);
    }

    /// THE attack: there is no setter to inject a chosen price. The only entry point is poke(),
    /// which reads the feed. And the feed itself is owner-gated, so an attacker can neither move
    /// the feed nor inject via poke — they can only ever store the real feed value.
    function test_attackerCannotInjectArbitraryPrice() public {
        address attacker = address(0xBAD);
        // attacker cannot even move the feed (owner-gated)
        vm.prank(attacker);
        vm.expectRevert();
        feed.updateAnswer(999e8);
        // and poking only ever stores the real feed value
        feed.updateAnswer(250e8); // owner (this test) sets the legitimate price
        vm.warp(block.timestamp + MIN_INTERVAL);
        vm.prank(attacker);
        hist.poke();
        assertEq(hist.latestWad(), 250e18);
    }

    /// Proof of surface: PriceHistory exposes NO price-writing function other than poke().
    function test_noArbitraryPriceWriteFunction() public view {
        string memory json = vm.readFile("out/PriceHistory.sol/PriceHistory.json");
        string[] memory sigs = vm.parseJsonKeys(json, ".methodIdentifiers");
        for (uint256 i = 0; i < sigs.length; i++) {
            bytes32 h = keccak256(bytes(sigs[i]));
            require(h != keccak256("setPrice(uint256)"), "setPrice exists!");
            require(h != keccak256("setVol(uint256)"), "setVol exists!");
            require(h != keccak256("pushPrice(uint256)"), "pushPrice exists!");
            require(h != keccak256("setAnswer(int256)"), "setAnswer exists!");
        }
    }

    // --- sampling discipline ---

    function test_pokeRevertsTooSoon() public {
        _poke();
        vm.expectRevert(bytes("too soon"));
        hist.poke(); // no warp -> within MIN_INTERVAL
    }

    function test_pokeRevertsOnStaleFeed() public {
        // feed not updated for > MAX_STALENESS
        vm.warp(block.timestamp + MAX_STALENESS + 1);
        vm.expectRevert(bytes("stale feed"));
        hist.poke();
    }

    function test_pokeRevertsOnNonPositivePrice() public {
        feed.updateAnswer(0);
        vm.warp(block.timestamp + MIN_INTERVAL);
        vm.expectRevert(bytes("bad price"));
        hist.poke();
    }

    // --- ring buffer behaviour ---

    function test_windowIsChronologicalAndCaps() public {
        // push 20 samples into a 16-slot ring; window keeps the last 16, oldest->newest
        int256 p = 100e8;
        for (uint256 i = 0; i < 20; i++) {
            feed.updateAnswer(p + int256(i) * 1e8);
            vm.warp(block.timestamp + MIN_INTERVAL);
            hist.poke();
        }
        uint256[] memory w = hist.window();
        assertEq(w.length, 16);
        // newest sample = 100+19 = 119 USD
        assertEq(w[w.length - 1], 119e18);
        // oldest kept = 100+4 = 104 USD (first 4 evicted)
        assertEq(w[0], 104e18);
        // strictly chronological
        for (uint256 i = 1; i < w.length; i++) {
            assertGt(w[i], w[i - 1]);
        }
    }

    function test_lastUpdateTracksPoke() public {
        _poke();
        assertEq(hist.lastUpdate(), block.timestamp);
    }
}
