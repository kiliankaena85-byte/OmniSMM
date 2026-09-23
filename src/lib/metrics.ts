import { logger } from './logger';

const log = logger.child({ component: 'Metrics' });

interface MetricCounters {
  workerJobSuccess: number;
  workerJobFailure: number;
  circuitBreakerTripped: number;
}

const counters: MetricCounters = {
  workerJobSuccess: 0,
  workerJobFailure: 0,
  circuitBreakerTripped: 0,
};

export const metrics = {
  recordWorkerSuccess(processorName: string) {
    counters.workerJobSuccess++;
    log.debug(`[Metrics] ${processorName} job success (Total: ${counters.workerJobSuccess})`);
  },

  recordWorkerFailure(processorName: string, error: Error) {
    counters.workerJobFailure++;
    log.error(`[Metrics] ${processorName} job failure: ${error.message} (Total: ${counters.workerJobFailure})`);
  },

  recordCircuitBreakerTrip(host: string) {
    counters.circuitBreakerTripped++;
    log.warn(`[Metrics] CircuitBreaker tripped for ${host} (Total: ${counters.circuitBreakerTripped})`);
  },

  getMetrics() {
    return { ...counters, timestamp: new Date().toISOString() };
  }
};
