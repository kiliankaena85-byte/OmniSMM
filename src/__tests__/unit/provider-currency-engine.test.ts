/**
 * Test Suite: ProviderCurrencyEngine (SIL-2026 / SDD-TDD Standard)
 * Testing dynamic provider currency shifts, floating exchange rates,
 * and margin-preserving intelligent price recalculation without false quarantine.
 */

import { describe, it, expect } from 'vitest';
import {
  ProviderCurrencyEngine,
  ExistingServicePricingData,
  StagingServicePricingData
} from '@/services/providers/currency-detector.service';

describe('ProviderCurrencyEngine (DPC-Engine)', () => {
  const USD_RATE = 90.0;

  describe('1. Direct Probe Currency Detection', () => {
    it('фиксирует смену валюты при расхождении ответа провайдера и БД (USD -> RUB)', () => {
      const result = ProviderCurrencyEngine.detectShiftFromProbe('USD', 'RUB');
      expect(result.isShiftDetected).toBe(true);
      expect(result.detectedCurrency).toBe('RUB');
      expect(result.previousCurrency).toBe('USD');
      expect(result.confidence).toBe(1.0);
    });

    it('фиксирует смену валюты при расхождении ответа провайдера и БД (RUB -> USD)', () => {
      const result = ProviderCurrencyEngine.detectShiftFromProbe('RUB', 'USD');
      expect(result.isShiftDetected).toBe(true);
      expect(result.detectedCurrency).toBe('USD');
      expect(result.previousCurrency).toBe('RUB');
      expect(result.confidence).toBe(1.0);
    });

    it('возвращает false при совпадении валют', () => {
      const result = ProviderCurrencyEngine.detectShiftFromProbe('RUB', 'RUB');
      expect(result.isShiftDetected).toBe(false);
      expect(result.detectedCurrency).toBeNull();
    });

    it('игнорирует пустой/неопределенный probeCurrency', () => {
      const result = ProviderCurrencyEngine.detectShiftFromProbe('USD', null);
      expect(result.isShiftDetected).toBe(false);
      expect(result.detectedCurrency).toBeNull();
    });
  });

  describe('2. Statistical Shift Detection across Catalog (Batch Heuristic)', () => {
    it('определяет переключение провайдера с USD на RUB (рост номинала ставок в ~90 раз)', () => {
      // 10 услуг, у 9 из них ставка выросла примерно в 90 раз (провайдер переключил аккаунт в рубли)
      const currentServices: ExistingServicePricingData[] = [
        { id: 's1', externalId: '101', rate: 1.0, providerCurrency: 'USD', costPer1kRub: 90.0, markup: 2.0, pricePer1000Cents: 18000 },
        { id: 's2', externalId: '102', rate: 0.5, providerCurrency: 'USD', costPer1kRub: 45.0, markup: 2.0, pricePer1000Cents: 9000 },
        { id: 's3', externalId: '103', rate: 2.0, providerCurrency: 'USD', costPer1kRub: 180.0, markup: 2.0, pricePer1000Cents: 36000 },
        { id: 's4', externalId: '104', rate: 0.1, providerCurrency: 'USD', costPer1kRub: 9.0, markup: 2.0, pricePer1000Cents: 1800 },
        { id: 's5', externalId: '105', rate: 3.5, providerCurrency: 'USD', costPer1kRub: 315.0, markup: 2.0, pricePer1000Cents: 63000 },
        { id: 's6', externalId: '106', rate: 5.0, providerCurrency: 'USD', costPer1kRub: 450.0, markup: 2.0, pricePer1000Cents: 90000 },
        { id: 's7', externalId: '107', rate: 0.25, providerCurrency: 'USD', costPer1kRub: 22.5, markup: 2.0, pricePer1000Cents: 4500 },
        { id: 's8', externalId: '108', rate: 1.2, providerCurrency: 'USD', costPer1kRub: 108.0, markup: 2.0, pricePer1000Cents: 21600 },
        { id: 's9', externalId: '109', rate: 0.8, providerCurrency: 'USD', costPer1kRub: 72.0, markup: 2.0, pricePer1000Cents: 14400 },
        { id: 's10', externalId: '110', rate: 4.0, providerCurrency: 'USD', costPer1kRub: 360.0, markup: 2.0, pricePer1000Cents: 72000 }
      ];

      const incomingStaging: StagingServicePricingData[] = [
        { externalId: '101', rate: 91.0 }, // ratio 91.0
        { externalId: '102', rate: 44.5 }, // ratio 89.0
        { externalId: '103', rate: 179.0 }, // ratio 89.5
        { externalId: '104', rate: 9.2 }, // ratio 92.0
        { externalId: '105', rate: 310.0 }, // ratio 88.57
        { externalId: '106', rate: 455.0 }, // ratio 91.0
        { externalId: '107', rate: 22.0 }, // ratio 88.0
        { externalId: '108', rate: 109.0 }, // ratio 90.83
        { externalId: '109', rate: 71.0 }, // ratio 88.75
        { externalId: '110', rate: 5.0 } // 1 выброс (другой поставщик или баг)
      ];

      const result = ProviderCurrencyEngine.detectShiftFromCatalog(
        'USD',
        currentServices,
        incomingStaging,
        USD_RATE
      );

      expect(result.isShiftDetected).toBe(true);
      expect(result.detectedCurrency).toBe('RUB');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.affectedServiceCount).toBe(9);
    });

    it('определяет переключение провайдера с RUB на USD (падение номинала ставок в ~90 раз)', () => {
      const currentServices: ExistingServicePricingData[] = [
        { id: 's1', externalId: '201', rate: 90.0, providerCurrency: 'RUB', costPer1kRub: 90.0, markup: 2.0, pricePer1000Cents: 18000 },
        { id: 's2', externalId: '202', rate: 180.0, providerCurrency: 'RUB', costPer1kRub: 180.0, markup: 2.0, pricePer1000Cents: 36000 },
        { id: 's3', externalId: '203', rate: 270.0, providerCurrency: 'RUB', costPer1kRub: 270.0, markup: 2.0, pricePer1000Cents: 54000 },
        { id: 's4', externalId: '204', rate: 45.0, providerCurrency: 'RUB', costPer1kRub: 45.0, markup: 2.0, pricePer1000Cents: 9000 },
        { id: 's5', externalId: '205', rate: 900.0, providerCurrency: 'RUB', costPer1kRub: 900.0, markup: 2.0, pricePer1000Cents: 180000 }
      ];

      const incomingStaging: StagingServicePricingData[] = [
        { externalId: '201', rate: 1.0 }, // 1 / 90
        { externalId: '202', rate: 2.01 }, // 2.01 / 180
        { externalId: '203', rate: 3.0 }, // 3 / 270
        { externalId: '204', rate: 0.5 }, // 0.5 / 45
        { externalId: '205', rate: 10.0 } // 10 / 900
      ];

      const result = ProviderCurrencyEngine.detectShiftFromCatalog(
        'RUB',
        currentServices,
        incomingStaging,
        USD_RATE
      );

      expect(result.isShiftDetected).toBe(true);
      expect(result.detectedCurrency).toBe('USD');
      expect(result.confidence).toBe(1.0);
      expect(result.affectedServiceCount).toBe(5);
    });

    it('НЕ детектирует смену валюты при обычном изменении цен нескольких услуг', () => {
      const currentServices: ExistingServicePricingData[] = [
        { id: 's1', externalId: '301', rate: 10.0, providerCurrency: 'RUB', costPer1kRub: 10.0, markup: 2.0, pricePer1000Cents: 2000 },
        { id: 's2', externalId: '302', rate: 20.0, providerCurrency: 'RUB', costPer1kRub: 20.0, markup: 2.0, pricePer1000Cents: 4000 },
        { id: 's3', externalId: '303', rate: 30.0, providerCurrency: 'RUB', costPer1kRub: 30.0, markup: 2.0, pricePer1000Cents: 6000 }
      ];

      const incomingStaging: StagingServicePricingData[] = [
        { externalId: '301', rate: 11.0 }, // +10%
        { externalId: '302', rate: 22.0 }, // +10%
        { externalId: '303', rate: 28.0 }  // -6.7%
      ];

      const result = ProviderCurrencyEngine.detectShiftFromCatalog(
        'RUB',
        currentServices,
        incomingStaging,
        USD_RATE
      );

      expect(result.isShiftDetected).toBe(false);
      expect(result.detectedCurrency).toBeNull();
    });
  });

  describe('3. Dynamic Price Evaluation & Quarantine Protection', () => {
    it('плавающий курс доллара (+15%) обновляет розничную цену БЕЗ карантина', () => {
      // Исходная цена поставщика: 1.00 USD при курсе 80 = 80 ₽ себестоимость. Наценка 2.0x -> розница 160 ₽ (16000 копеек)
      const service: ExistingServicePricingData = {
        id: 's-float',
        externalId: 'ext-float',
        rate: 1.0,
        providerCurrency: 'USD',
        costPer1kRub: 80.0,
        markup: 2.0,
        pricePer1000Cents: 16000
      };

      // Провайдер по-прежнему отдает 1.00 USD, но курс доллара стал 92 (+15%)
      const newUsdRate = 92.0;
      const evaluation = ProviderCurrencyEngine.evaluateServicePriceChange(
        service,
        1.0, // ставка у провайдера не изменилась
        'USD',
        newUsdRate
      );

      // Изменение в валюте поставщика = 0%, поэтому карантина быть НЕ ДОЛЖНО!
      expect(evaluation.action).toBe('UPDATE_SILENT');
      expect(evaluation.rawRateChangePct).toBe(0);
      expect(evaluation.newCostRub).toBe(92.0);
      // Новая розничная цена с наценкой 2.0x = 92 * 2 = 184 ₽ -> красиво округляется до 190 ₽ (19000 коп)
      expect(evaluation.newRetailPriceCents).toBe(19000);
    });

    it('реальный скачок ставки провайдера на +60% отправляет услугу в карантин', () => {
      const service: ExistingServicePricingData = {
        id: 's-spike',
        externalId: 'ext-spike',
        rate: 1.0,
        providerCurrency: 'USD',
        costPer1kRub: 90.0,
        markup: 2.0,
        pricePer1000Cents: 18000
      };

      // Провайдер поднял цену с 1.00 до 1.60 USD (+60%)
      const evaluation = ProviderCurrencyEngine.evaluateServicePriceChange(
        service,
        1.60,
        'USD',
        USD_RATE
      );

      expect(evaluation.action).toBe('QUARANTINE_PRICE_SPIKE');
      expect(evaluation.rawRateChangePct).toBeCloseTo(0.60, 2);
      expect(evaluation.quarantineReason).toContain('+60%');
    });

    it('превышение верхнего лимита себестоимости (> UPPER_SANITY_LIMIT_RUB = 500,000 ₽) отправляет в карантин', () => {
      const service: ExistingServicePricingData = {
        id: 's-sanity',
        externalId: 'ext-sanity',
        rate: 5000.0,
        providerCurrency: 'USD',
        costPer1kRub: 450000.0,
        markup: 1.5,
        pricePer1000Cents: 67500000
      };

      // Провайдер выставил 6000 USD (6000 * 90 = 540,000 ₽ > 500,000 ₽)
      const evaluation = ProviderCurrencyEngine.evaluateServicePriceChange(
        service,
        6000.0,
        'USD',
        USD_RATE
      );

      expect(evaluation.action).toBe('QUARANTINE_SANITY_LIMIT');
      expect(evaluation.quarantineReason).toContain('Upper Sanity Limit Exceeded');
    });

    it('защита отрицательной маржи (Negative Margin Breach): если себестоимость выросла, но < 50%, розница динамически поднимается', () => {
      const service: ExistingServicePricingData = {
        id: 's-margin',
        externalId: 'ext-margin',
        rate: 10.0,
        providerCurrency: 'RUB',
        costPer1kRub: 10.0,
        markup: 1.5,
        pricePer1000Cents: 1500 // 15 ₽
      };

      // Ставка выросла до 14 ₽ (+40% < 50%).
      // Себестоимость (14 ₽) почти догнала старую розницу (15 ₽).
      const evaluation = ProviderCurrencyEngine.evaluateServicePriceChange(
        service,
        14.0,
        'RUB',
        USD_RATE
      );

      expect(evaluation.action).toBe('UPDATE_SILENT');
      expect(evaluation.newCostRub).toBe(14.0);
      // Новая розница пересчитана: 14 * 1.5 = 21 ₽ -> округление вверх до 30 ₽ (3000 коп)
      expect(evaluation.newRetailPriceCents).toBe(3000);
      expect(evaluation.newRetailPriceCents).toBeGreaterThan(evaluation.newCostRub * 100);
    });

    it('смена валюты поставщика при синк-оценке с правильной валютой НЕ вызывает карантин', () => {
      // Исходное состояние: услуга была в USD (0.03 USD = 2.7 ₽)
      const service: ExistingServicePricingData = {
        id: 's-healed',
        externalId: 'ext-healed',
        rate: 0.03,
        providerCurrency: 'USD',
        costPer1kRub: 2.7,
        markup: 2.0,
        pricePer1000Cents: 540
      };

      // После обнаружения смены валюты в RUB, провайдер передал ставку 2.70 (в RUB)
      // При передаче актуальной валюты 'RUB' себестоимость остается 2.7 ₽
      const evaluation = ProviderCurrencyEngine.evaluateServicePriceChange(
        service,
        2.70,
        'RUB',
        USD_RATE
      );

      expect(evaluation.action).toBe('UPDATE_SILENT');
      expect(evaluation.newCostRub).toBe(2.70);
      expect(evaluation.rawRateChangePct).toBe(0); // В реальном выражении изменений нет
    });
  });
});
