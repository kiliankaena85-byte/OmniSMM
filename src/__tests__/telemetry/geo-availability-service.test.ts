import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeoAvailabilityService } from '@/services/telemetry/geo-availability.service';

describe('GeoAvailabilityService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly parses 100% successful probes in Russia and Global regions', () => {
    const rawNodes: Record<string, [string, string, string, string]> = {
      'ru1.node.check-host.net': ['ru', 'Russia', 'Moscow', '185.12.34.56'],
      'ru2.node.check-host.net': ['ru', 'Russia', 'Saint Petersburg', '185.12.34.57'],
      'de1.node.check-host.net': ['de', 'Germany', 'Frankfurt', '45.67.89.10'],
      'fi1.node.check-host.net': ['fi', 'Finland', 'Helsinki', '95.12.44.22'],
    };

    const rawResults: Record<string, any> = {
      'ru1.node.check-host.net': [[1, 0.045, 'OK', 200, '1.2.3.4']],
      'ru2.node.check-host.net': [[1, 0.052, 'OK', 200, '1.2.3.4']],
      'de1.node.check-host.net': [[1, 0.088, 'OK', 200, '1.2.3.4']],
      'fi1.node.check-host.net': [[1, 0.075, 'OK', 200, '1.2.3.4']],
    };

    const report = GeoAvailabilityService.parseResults(
      'https://test.smmplan.pro',
      rawNodes,
      rawResults,
      'https://check-host.net/check-report/12345'
    );

    expect(report.targetUrl).toBe('https://test.smmplan.pro');
    expect(report.ruTotal).toBe(2);
    expect(report.ruPassed).toBe(2);
    expect(report.ruRate).toBe(1.0);
    expect(report.globalTotal).toBe(2);
    expect(report.globalPassed).toBe(2);
    expect(report.globalRate).toBe(1.0);
    expect(report.verdict).toBe('ALL_GREEN');
    expect(report.verdictText).toContain('100% Green');
    expect(report.avgResponseTimeMs).toBeGreaterThan(0);
    expect(report.nodes).toHaveLength(4);
    expect(report.nodes.find((n) => n.city === 'Moscow')?.isRussia).toBe(true);
    expect(report.nodes.find((n) => n.city === 'Moscow')?.status).toBe('OK');
  });

  it('detects RU_BLOCKED when all Russian nodes fail while international nodes pass', () => {
    const rawNodes: Record<string, [string, string, string, string]> = {
      'ru1.node.check-host.net': ['ru', 'Russia', 'Moscow', '185.12.34.56'],
      'ru2.node.check-host.net': ['ru', 'Russia', 'Saint Petersburg', '185.12.34.57'],
      'de1.node.check-host.net': ['de', 'Germany', 'Frankfurt', '45.67.89.10'],
      'us1.node.check-host.net': ['us', 'USA', 'New York', '104.22.1.2'],
    };

    const rawResults: Record<string, any> = {
      'ru1.node.check-host.net': [[0, 0.01, 'NXDOMAIN / Filtered', null, null]],
      'ru2.node.check-host.net': [[0, 5.0, 'Connection timed out', null, null]],
      'de1.node.check-host.net': [[1, 0.088, 'OK', 200, '1.2.3.4']],
      'us1.node.check-host.net': [[1, 0.12, 'OK', 200, '1.2.3.4']],
    };

    const report = GeoAvailabilityService.parseResults(
      'https://smmplan.pro',
      rawNodes,
      rawResults,
      'https://check-host.net/check-report/blocked123'
    );

    expect(report.ruTotal).toBe(2);
    expect(report.ruPassed).toBe(0);
    expect(report.ruRate).toBe(0);
    expect(report.globalPassed).toBe(2);
    expect(report.verdict).toBe('RU_BLOCKED');
    expect(report.verdictText).toContain('Блокировка в РФ');
  });

  it('detects PARTIAL_OUTAGE when some Russian nodes experience degradation', () => {
    const rawNodes: Record<string, [string, string, string, string]> = {
      'ru1.node.check-host.net': ['ru', 'Russia', 'Moscow', '185.12.34.56'],
      'ru2.node.check-host.net': ['ru', 'Russia', 'Saint Petersburg', '185.12.34.57'],
      'ru3.node.check-host.net': ['ru', 'Russia', 'Kazan', '185.12.34.58'],
      'de1.node.check-host.net': ['de', 'Germany', 'Frankfurt', '45.67.89.10'],
    };

    const rawResults: Record<string, any> = {
      'ru1.node.check-host.net': [[1, 0.045, 'OK', 200, '1.2.3.4']],
      'ru2.node.check-host.net': [[0, 3.0, 'Connection timed out', null, null]],
      'ru3.node.check-host.net': [[0, 3.0, 'Connection timed out', null, null]],
      'de1.node.check-host.net': [[1, 0.088, 'OK', 200, '1.2.3.4']],
    };

    const report = GeoAvailabilityService.parseResults(
      'https://test.smmplan.pro',
      rawNodes,
      rawResults,
      'https://check-host.net/check-report/partial123'
    );

    expect(report.ruTotal).toBe(3);
    expect(report.ruPassed).toBe(1);
    expect(report.ruRate).toBeCloseTo(0.33, 2);
    expect(report.verdict).toBe('PARTIAL_OUTAGE');
  });

  it('gracefully handles pending nodes that have not returned data yet', () => {
    const rawNodes: Record<string, [string, string, string, string]> = {
      'ru1.node.check-host.net': ['ru', 'Russia', 'Moscow', '185.12.34.56'],
      'de1.node.check-host.net': ['de', 'Germany', 'Frankfurt', '45.67.89.10'],
    };

    const rawResults: Record<string, any> = {
      'ru1.node.check-host.net': null, // Pending probe
      'de1.node.check-host.net': [[1, 0.05, 'OK', 200, '1.2.3.4']],
    };

    const report = GeoAvailabilityService.parseResults(
      'https://test.smmplan.pro',
      rawNodes,
      rawResults,
      'https://check-host.net/check-report/pending123'
    );

    const pendingNode = report.nodes.find((n) => n.nodeId === 'ru1.node.check-host.net');
    expect(pendingNode?.status).toBe('PENDING');
  });

  it('provides a resilient fallback report when network request throws', async () => {
    // Mock global fetch to throw error
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network ETIMEDOUT'));

    const report = await GeoAvailabilityService.checkAvailability('https://test.smmplan.pro', 5, 0);

    expect(report.targetUrl).toBe('https://test.smmplan.pro');
    expect(report.verdictText).toContain('Внешний зонд недоступен');
    expect(report.verdict).toBe('ALL_GREEN');
    expect(fetchMock).toHaveBeenCalled();
  });
});
