import { describe, it, expect } from 'vitest';
import {
  isBenignConsoleError,
  isHydrationError,
  calculateScreenStatus,
  generateElementSelector,
} from '../../../scripts/qa-sentinel/dom-inspector';
import { DomInspectionResult } from '../../../scripts/qa-sentinel/types';

describe('Omni-Sentinel QA: DOM & Console Inspectors', () => {
  describe('isBenignConsoleError', () => {
    it('should ignore benign favicon and third-party tracking errors', () => {
      expect(isBenignConsoleError('Failed to load resource: net::ERR_CONNECTION_REFUSED /favicon.ico')).toBe(true);
      expect(isBenignConsoleError('GET https://mc.yandex.ru/metrika/tag.js net::ERR_BLOCKED_BY_CLIENT')).toBe(true);
      expect(isBenignConsoleError('[HMR] connected')).toBe(true);
    });

    it('should identify real errors as non-benign', () => {
      expect(isBenignConsoleError('TypeError: Cannot read properties of undefined (reading "id")')).toBe(false);
      expect(isBenignConsoleError('Error: An unexpected response was received from the server.')).toBe(false);
      expect(isBenignConsoleError('Hydration failed because the initial UI does not match')).toBe(false);
    });
  });

  describe('isHydrationError', () => {
    it('should detect React 19 hydration mismatch errors', () => {
      expect(isHydrationError('Text content does not match server-rendered HTML.')).toBe(true);
      expect(isHydrationError('Hydration failed because the server rendered HTML didn\'t match the client.')).toBe(true);
      expect(isHydrationError('There was an error while hydrating. Because the error happened outside of a Suspense boundary')).toBe(true);
    });

    it('should return false for regular messages', () => {
      expect(isHydrationError('Fetch successful')).toBe(false);
      expect(isHydrationError('Warning: Each child in a list should have a unique "key" prop.')).toBe(false);
    });
  });

  describe('generateElementSelector', () => {
    it('should construct CSS selector from id if present', () => {
      const sel = generateElementSelector({ tagName: 'button', id: 'submit-btn', className: 'px-4 py-2' });
      expect(sel).toBe('button#submit-btn');
    });

    it('should construct CSS selector from classes when no id is present', () => {
      const sel = generateElementSelector({ tagName: 'div', className: 'overflow-hidden flex items-center' });
      expect(sel).toBe('div.overflow-hidden.flex.items-center');
    });

    it('should fallback to tag name when neither id nor classes are present', () => {
      const sel = generateElementSelector({ tagName: 'section' });
      expect(sel).toBe('section');
    });
  });

  describe('calculateScreenStatus', () => {
    const cleanDomMetrics: DomInspectionResult = {
      hasHorizontalScroll: false,
      scrollWidth: 1440,
      innerWidth: 1440,
      overflowPixels: 0,
      overflowElements: [],
      hydrationErrorDetected: false,
      smallTouchTargetsCount: 0,
    };

    it('should return PASS when there are no errors, no overflow, and clean DOM', () => {
      const status = calculateScreenStatus([], [], cleanDomMetrics);
      expect(status).toBe('PASS');
    });

    it('should return FAIL when there are console errors', () => {
      const status = calculateScreenStatus(['TypeError: x is not a function'], [], cleanDomMetrics);
      expect(status).toBe('FAIL');
    });

    it('should return FAIL when there is horizontal scroll overflow', () => {
      const brokenDomMetrics: DomInspectionResult = {
        ...cleanDomMetrics,
        hasHorizontalScroll: true,
        scrollWidth: 1520,
        innerWidth: 1440,
        overflowPixels: 80,
        overflowElements: [
          {
            selector: 'div.wide-table',
            tagName: 'div',
            className: 'wide-table',
            boundingWidth: 1520,
            overflowAmount: 80,
          },
        ],
      };
      const status = calculateScreenStatus([], [], brokenDomMetrics);
      expect(status).toBe('FAIL');
    });

    it('should return FAIL when hydration error is detected', () => {
      const hydrationFailedMetrics: DomInspectionResult = {
        ...cleanDomMetrics,
        hydrationErrorDetected: true,
        hydrationErrorMessage: 'Hydration failed',
      };
      const status = calculateScreenStatus([], [], hydrationFailedMetrics);
      expect(status).toBe('FAIL');
    });

    it('should return WARN when there are 4xx non-critical static assets but no console errors or scroll', () => {
      const failedRequests = [{ url: 'http://localhost:3000/avatar-missing.png', status: 404, method: 'GET' }];
      const status = calculateScreenStatus([], failedRequests, cleanDomMetrics);
      expect(status).toBe('WARN');
    });
  });
});
