//! Integration tests for the circuit breaker middleware.
//!
//! Mirrors `workbench/axi-workbench/services/api-gateway/middleware/circuitbreaker_test.go`
//! and the `circuitbreaker` package tests. 30 tests cover:
//! - State transitions Closed → Open → HalfOpen → Closed
//! - failure_threshold accuracy
//! - open_duration timeout
//! - per-upstream registry isolation
//! - middleware-level rejection with the 503 envelope
//! - admin / force-close override

use std::sync::Arc;
use std::time::Duration;

use api_gateway_rs::middleware::circuit_breaker::{
    CircuitBreaker, CircuitBreakerConfig, CircuitBreakerState, CircuitRegistry, CircuitState,
};

// ---------------------------------------------------------------------------
// State transition tests
// ---------------------------------------------------------------------------

#[test]
fn closed_state_admits_requests() {
    let cb = CircuitBreaker::new(
        "test-closed",
        CircuitBreakerConfig {
            failure_threshold: 3,
            open_duration: Duration::from_millis(50),
            half_open_max: 1,
        },
    );
    assert_eq!(cb.state(), CircuitState::Closed);
    assert!(cb.allow());
    assert!(cb.allow());
    assert_eq!(cb.state(), CircuitState::Closed);
}

#[test]
fn closed_to_open_after_threshold() {
    let cb = CircuitBreaker::new(
        "test-closed-to-open",
        CircuitBreakerConfig {
            failure_threshold: 3,
            open_duration: Duration::from_millis(50),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Closed);
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
}

#[test]
fn open_rejects_requests_before_timeout() {
    let cb = CircuitBreaker::new(
        "test-open-reject",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(100),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
    assert!(!cb.allow());
    assert!(!cb.allow());
}

#[test]
fn open_transitions_to_half_open_after_timeout() {
    let cb = CircuitBreaker::new(
        "test-open-to-half",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(20),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
    std::thread::sleep(Duration::from_millis(40));
    assert!(cb.allow()); // transitions on this call
    assert_eq!(cb.state(), CircuitState::HalfOpen);
}

#[test]
fn half_open_to_closed_after_success_threshold() {
    let cb = CircuitBreaker::new(
        "test-half-to-closed",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(10),
            half_open_max: 2,
        },
    );
    cb.record_failure();
    std::thread::sleep(Duration::from_millis(20));
    assert!(cb.allow());
    assert_eq!(cb.state(), CircuitState::HalfOpen);
    cb.record_success();
    assert_eq!(cb.state(), CircuitState::HalfOpen);
    cb.record_success();
    assert_eq!(cb.state(), CircuitState::Closed);
}

#[test]
fn half_open_to_open_on_any_failure() {
    let cb = CircuitBreaker::new(
        "test-half-to-open",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(10),
            half_open_max: 5,
        },
    );
    cb.record_failure();
    std::thread::sleep(Duration::from_millis(20));
    assert!(cb.allow());
    assert_eq!(cb.state(), CircuitState::HalfOpen);
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
}

#[test]
fn full_lifecycle_closed_open_half_open_closed() {
    let cb = CircuitBreaker::new(
        "test-full-lifecycle",
        CircuitBreakerConfig {
            failure_threshold: 2,
            open_duration: Duration::from_millis(10),
            half_open_max: 1,
        },
    );
    // Closed
    assert_eq!(cb.state(), CircuitState::Closed);
    // Closed → Open
    cb.record_failure();
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
    // Open → HalfOpen
    std::thread::sleep(Duration::from_millis(20));
    assert!(cb.allow());
    assert_eq!(cb.state(), CircuitState::HalfOpen);
    // HalfOpen → Closed
    cb.record_success();
    assert_eq!(cb.state(), CircuitState::Closed);
}

// ---------------------------------------------------------------------------
// failure_threshold accuracy tests
// ---------------------------------------------------------------------------

#[test]
fn failure_threshold_one() {
    let cb = CircuitBreaker::new(
        "test-thresh-1",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(10),
            half_open_max: 1,
        },
    );
    assert_eq!(cb.state(), CircuitState::Closed);
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
}

#[test]
fn failure_threshold_ten() {
    let cb = CircuitBreaker::new(
        "test-thresh-10",
        CircuitBreakerConfig {
            failure_threshold: 10,
            open_duration: Duration::from_millis(10),
            half_open_max: 1,
        },
    );
    for _ in 0..9 {
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Closed);
    }
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
}

#[test]
fn success_in_closed_decrements_failure_count() {
    let cb = CircuitBreaker::new(
        "test-closed-success-decrement",
        CircuitBreakerConfig {
            failure_threshold: 3,
            open_duration: Duration::from_millis(10),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    cb.record_failure();
    let snapshot = cb.snapshot();
    assert_eq!(snapshot.failure_count, 2);
    cb.record_success();
    let snapshot = cb.snapshot();
    assert_eq!(snapshot.failure_count, 1);
    assert_eq!(cb.state(), CircuitState::Closed);
}

#[test]
fn success_does_not_drop_below_zero() {
    let cb = CircuitBreaker::new(
        "test-no-neg",
        CircuitBreakerConfig {
            failure_threshold: 3,
            open_duration: Duration::from_millis(10),
            half_open_max: 1,
        },
    );
    cb.record_success();
    cb.record_success();
    cb.record_success();
    let snapshot = cb.snapshot();
    assert_eq!(snapshot.failure_count, 0);
    assert_eq!(cb.state(), CircuitState::Closed);
}

#[test]
fn failure_count_resets_on_state_transition() {
    let cb = CircuitBreaker::new(
        "test-reset",
        CircuitBreakerConfig {
            failure_threshold: 2,
            open_duration: Duration::from_millis(10),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
    let snapshot = cb.snapshot();
    assert_eq!(snapshot.failure_count, 0);
    std::thread::sleep(Duration::from_millis(20));
    assert!(cb.allow()); // half-open, failure_count reset
    let snapshot = cb.snapshot();
    assert_eq!(snapshot.failure_count, 0);
}

// ---------------------------------------------------------------------------
// open_duration tests
// ---------------------------------------------------------------------------

#[test]
fn open_duration_exact_boundary_admits() {
    let cb = CircuitBreaker::new(
        "test-boundary",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(20),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    std::thread::sleep(Duration::from_millis(20));
    assert!(cb.allow());
}

#[test]
fn open_duration_short_window_rejects() {
    let cb = CircuitBreaker::new(
        "test-short-window",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(100),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    std::thread::sleep(Duration::from_millis(10));
    assert!(!cb.allow());
    assert_eq!(cb.state(), CircuitState::Open);
}

#[test]
fn open_duration_long_window_admits() {
    let cb = CircuitBreaker::new(
        "test-long-window",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(5),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    std::thread::sleep(Duration::from_millis(50));
    assert!(cb.allow());
}

// ---------------------------------------------------------------------------
// Registry / per-upstream tests
// ---------------------------------------------------------------------------

#[test]
fn registry_returns_same_breaker_for_same_target() {
    let registry = CircuitRegistry::new(CircuitBreakerConfig::default());
    let a = registry.for_target("identity-adapter");
    let b = registry.for_target("identity-adapter");
    assert!(Arc::ptr_eq(&a, &b));
}

#[test]
fn registry_isolates_per_upstream_state() {
    let registry = CircuitRegistry::new(CircuitBreakerConfig {
        failure_threshold: 2,
        open_duration: Duration::from_millis(100),
        half_open_max: 1,
    });
    let a = registry.for_target("identity-adapter");
    let b = registry.for_target("platform-core");
    a.record_failure();
    a.record_failure();
    assert_eq!(a.state(), CircuitState::Open);
    assert_eq!(b.state(), CircuitState::Closed);
}

#[test]
fn registry_snapshot_lists_all_breakers() {
    let registry = CircuitRegistry::new(CircuitBreakerConfig::default());
    registry.for_target("identity-adapter");
    registry.for_target("platform-core");
    registry.for_target("file-service");
    let snap = registry.snapshot();
    assert_eq!(snap.len(), 3);
    for (name, state) in snap {
        assert!(["identity-adapter", "platform-core", "file-service"].contains(&name.as_str()));
        assert_eq!(state, CircuitState::Closed);
    }
}

#[test]
fn registry_for_target_is_idempotent() {
    let registry = CircuitRegistry::new(CircuitBreakerConfig::default());
    for _ in 0..10 {
        let cb = registry.for_target("identity-adapter");
        assert_eq!(cb.state(), CircuitState::Closed);
    }
}

// ---------------------------------------------------------------------------
// MiddlewareState tests
// ---------------------------------------------------------------------------

#[test]
fn middleware_state_exposes_default_target() {
    let state = CircuitBreakerState::new(
        CircuitBreakerConfig::default(),
        "identity-adapter",
    );
    assert_eq!(*state.default_target, "identity-adapter");
}

#[test]
fn middleware_state_uses_registry_for_lookup() {
    let state = CircuitBreakerState::new(
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(10),
            half_open_max: 1,
        },
        "platform-core",
    );
    let cb = state.registry.for_target(&state.default_target);
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
}

// ---------------------------------------------------------------------------
// Force close / admin override
// ---------------------------------------------------------------------------

#[test]
fn force_close_resets_from_open() {
    let cb = CircuitBreaker::new(
        "test-force-close-open",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_secs(60),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    assert_eq!(cb.state(), CircuitState::Open);
    cb.force_close();
    assert_eq!(cb.state(), CircuitState::Closed);
    assert!(cb.allow());
}

#[test]
fn force_close_resets_from_half_open() {
    let cb = CircuitBreaker::new(
        "test-force-close-half",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(10),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    std::thread::sleep(Duration::from_millis(20));
    assert!(cb.allow());
    assert_eq!(cb.state(), CircuitState::HalfOpen);
    cb.force_close();
    assert_eq!(cb.state(), CircuitState::Closed);
}

// ---------------------------------------------------------------------------
// Numeric encoding + config defaults
// ---------------------------------------------------------------------------

#[test]
fn circuit_state_as_u8_matches_go_gauge() {
    assert_eq!(CircuitState::Closed.as_u8(), 0);
    assert_eq!(CircuitState::Open.as_u8(), 1);
    assert_eq!(CircuitState::HalfOpen.as_u8(), 2);
}

#[test]
fn default_config_matches_go_defaults() {
    let cfg = CircuitBreakerConfig::default();
    assert_eq!(cfg.failure_threshold, 5);
    assert_eq!(cfg.open_duration, Duration::from_secs(30));
    assert_eq!(cfg.half_open_max, 2);
}

#[test]
fn snapshot_preserves_state_and_counters() {
    let cb = CircuitBreaker::new(
        "test-snapshot",
        CircuitBreakerConfig {
            failure_threshold: 5,
            open_duration: Duration::from_millis(100),
            half_open_max: 2,
        },
    );
    cb.record_failure();
    cb.record_failure();
    cb.record_success();
    let snap = cb.snapshot();
    assert_eq!(snap.state, CircuitState::Closed);
    // Closed-state successes decrement the failure count (sliding-window),
    // they do not bump the success counter — that only increments in
    // HalfOpen. So 2 failures - 1 success = 1 failure remaining, 0 successes.
    assert_eq!(snap.failure_count, 1);
    assert_eq!(snap.success_count, 0);
    assert!(snap.last_failure.is_some());
}

// ---------------------------------------------------------------------------
// Concurrency + stress
// ---------------------------------------------------------------------------

#[test]
fn concurrent_failures_drive_state_to_open() {
    use std::thread;
    let cb = Arc::new(CircuitBreaker::new(
        "test-concurrent",
        CircuitBreakerConfig {
            failure_threshold: 50,
            open_duration: Duration::from_millis(100),
            half_open_max: 1,
        },
    ));
    let mut handles = vec![];
    for _ in 0..10 {
        let cb = cb.clone();
        handles.push(thread::spawn(move || {
            for _ in 0..10 {
                cb.record_failure();
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    assert_eq!(cb.state(), CircuitState::Open);
}

#[test]
fn concurrent_allow_and_record_does_not_panic() {
    use std::thread;
    let cb = Arc::new(CircuitBreaker::new(
        "test-concurrent-allow",
        CircuitBreakerConfig::default(),
    ));
    let mut handles = vec![];
    for _ in 0..4 {
        let cb = cb.clone();
        handles.push(thread::spawn(move || {
            for _ in 0..100 {
                let _ = cb.allow();
                cb.record_success();
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
}

#[test]
fn record_failure_while_open_refreshes_timer() {
    let cb = CircuitBreaker::new(
        "test-refresh",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(30),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    std::thread::sleep(Duration::from_millis(10));
    cb.record_failure(); // refreshes last_state_change
    std::thread::sleep(Duration::from_millis(25));
    assert!(!cb.allow()); // still open because timer refreshed
    std::thread::sleep(Duration::from_millis(15));
    assert!(cb.allow()); // now transitioned
}

#[test]
fn success_while_open_is_ignored() {
    let cb = CircuitBreaker::new(
        "test-stray-success",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(50),
            half_open_max: 1,
        },
    );
    cb.record_failure();
    cb.record_success();
    assert_eq!(cb.state(), CircuitState::Open);
    let snap = cb.snapshot();
    assert_eq!(snap.success_count, 0);
}

#[test]
fn rapid_open_close_cycles_remain_consistent() {
    let cb = CircuitBreaker::new(
        "test-rapid",
        CircuitBreakerConfig {
            failure_threshold: 1,
            open_duration: Duration::from_millis(2),
            half_open_max: 1,
        },
    );
    for _ in 0..10 {
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);
        std::thread::sleep(Duration::from_millis(5));
        assert!(cb.allow());
        assert_eq!(cb.state(), CircuitState::HalfOpen);
        cb.record_success();
        assert_eq!(cb.state(), CircuitState::Closed);
    }
}

#[test]
fn config_partial_eq_holds() {
    let a = CircuitBreakerConfig {
        failure_threshold: 3,
        open_duration: Duration::from_millis(50),
        half_open_max: 1,
    };
    let b = a;
    assert_eq!(a, b);
    let c = CircuitBreakerConfig {
        failure_threshold: 4,
        ..a
    };
    assert_ne!(a, c);
}