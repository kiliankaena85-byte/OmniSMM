/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * External Database Performance Harness: pgbench Runner inside Docker (RAC-2026 / ISO 25010)
 *
 * Runs custom synthetic & realistic workloads using PostgreSQL's native pgbench
 * directly inside the smmplan_lite_db container on 127.0.0.1:5433.
 */

export * from './run-pgbench';
import './run-pgbench';
