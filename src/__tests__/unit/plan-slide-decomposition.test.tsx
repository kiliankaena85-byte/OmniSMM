// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecapAndLinkSection } from '@/components/landing/order-engine/variants/slide/sub/RecapAndLinkSection';
import { DripAndCustomDataSection } from '@/components/landing/order-engine/variants/slide/sub/DripAndCustomDataSection';
import { PromoAndGatewaySection } from '@/components/landing/order-engine/variants/slide/sub/PromoAndGatewaySection';
import { SubmitPriceBar } from '@/components/landing/order-engine/variants/slide/sub/SubmitPriceBar';
import { SlideNavHeader } from '@/components/landing/order-engine/variants/slide/SlideNavHeader';
import { StepCheckoutParams } from '@/components/landing/order-engine/variants/slide/StepCheckoutParams';

const mockService: any = {
  id: 'srv-1',
  name: 'Telegram Подписчики Живые',
  pricePerUnitRub: 0.15,
  minQty: 100,
  maxQty: 50000,
  description: 'Качественные живые подписчики для каналов',
  isDripFeedEnabled: true,
  customDataType: 'NONE',
};

describe('Wave 15: PlanSlideOrderClient & StepCheckoutParams Decomposition', () => {
  const rootDir = process.cwd();
  const coordinatorFile = path.resolve(rootDir, 'src/components/landing/order-engine/variants/PlanSlideOrderClient.tsx');
  const paramsFile = path.resolve(rootDir, 'src/components/landing/order-engine/variants/slide/StepCheckoutParams.tsx');
  const slideDir = path.resolve(rootDir, 'src/components/landing/order-engine/variants/slide');

  it('MUST keep StepCheckoutParams.tsx <= 120 lines', () => {
    expect(fs.existsSync(paramsFile)).toBe(true);
    const content = fs.readFileSync(paramsFile, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines, `Expected StepCheckoutParams.tsx <= 120 lines, got ${lines}`).toBeLessThanOrEqual(120);
  });

  it('MUST keep all slide subcomponents <= 200 lines', () => {
    const subDir = path.join(slideDir, 'sub');
    const files = fs.readdirSync(subDir);
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const f of files) {
      const full = path.join(subDir, f);
      const lines = fs.readFileSync(full, 'utf-8').split('\n').length;
      expect(lines, `Expected ${f} <= 200 lines, got ${lines}`).toBeLessThanOrEqual(200);
    }
  });

  it('renders RecapAndLinkSection correctly with service details and link input', () => {
    render(
      <RecapAndLinkSection
        selectedService={mockService}
        link="https://t.me/test"
        setLink={() => {}}
        quantity={250}
        setQuantity={() => {}}
        linkRef={{ current: null }}
        quantityRef={{ current: null }}
      />
    );

    expect(screen.getByText('Telegram Подписчики Живые')).toBeTruthy();
    expect(screen.getByText('0.15 ₽')).toBeTruthy();
    expect(screen.getByText(/Мин: 100 · Макс: 50 000/)).toBeTruthy();
  });

  it('renders DripAndCustomDataSection correctly', () => {
    render(
      <DripAndCustomDataSection
        selectedService={mockService}
        numericQuantity={500}
        isDripFeedEnabled={true}
        setIsDripFeedEnabled={() => {}}
        dripRuns={5}
        setDripRuns={() => {}}
        dripInterval={60}
        setDripInterval={() => {}}
        customData=""
        setCustomData={() => {}}
        isRequirementsConfirmed={false}
        setIsRequirementsConfirmed={() => {}}
      />
    );

    expect(screen.getByText(/Постепенная накрутка \(Drip-Feed\)/)).toBeTruthy();
    expect(screen.getByText(/Заказ выполнится за 5 запусков по 100 шт/)).toBeTruthy();
  });

  it('renders PromoAndGatewaySection with promo toggle and payment methods', () => {
    render(
      <PromoAndGatewaySection
        email="client@example.com"
        setEmail={() => {}}
        emailRef={{ current: null }}
        showPromo={false}
        setShowPromo={() => {}}
        promoCode=""
        setPromoCode={() => {}}
        appliedPromo=""
        isApplyingPromo={false}
        promoMessage={null}
        onApplyPromo={() => {}}
        onRemovePromo={() => {}}
        selectedGateway="yookassa"
        setSelectedGateway={() => {}}
        availableGateways={{ yookassa: true, robokassa: true, cryptobot: true }}
        userBalanceCents={15000}
      />
    );

    expect(screen.getByText('+ У меня есть промокод')).toBeTruthy();
    expect(screen.getByText('Банковская карта')).toBeTruthy();
    expect(screen.getByText('Мой баланс')).toBeTruthy();
  });

  it('renders SubmitPriceBar with total and handles submit state', () => {
    render(
      <SubmitPriceBar
        totalPrice="75.00"
        originalPrice="100.00"
        serverPricing={{
          totalCents: 7500,
          originalTotalCents: 10000,
          discountCents: 2500,
          discountPercent: 25,
          providerCostCents: 3000,
          safetyFloorCents: 2000,
          tier: 'REGULAR',
        }}
        selectedGateway="yookassa"
        isPending={false}
        formState={{ error: undefined }}
        shakeKey={0}
      />
    );

    expect(screen.getByText('75.00 ₽')).toBeTruthy();
    expect(screen.getByText('100.00 ₽')).toBeTruthy();
    expect(screen.getByText('-25%')).toBeTruthy();
  });

  it('renders SlideNavHeader and handles steps', () => {
    render(
      <SlideNavHeader
        step="category"
        activeNetwork={{ id: 'net-1', name: 'Telegram', slug: 'telegram', icon: '' } as any}
        link="https://t.me/channel"
        enteredViaCatalog={false}
        onNavigateBack={() => {}}
        onReset={() => {}}
      />
    );

    expect(screen.getByText('https://t.me/channel')).toBeTruthy();
    expect(screen.getByTitle('Назад')).toBeTruthy();
  });

  it('integrates cleanly inside StepCheckoutParams', () => {
    render(
      <StepCheckoutParams
        selectedService={mockService}
        link="https://t.me/channel"
        setLink={() => {}}
        quantity={500}
        setQuantity={() => {}}
        email="test@smmplan.pro"
        setEmail={() => {}}
        isDripFeedEnabled={false}
        setIsDripFeedEnabled={() => {}}
        dripRuns={5}
        setDripRuns={() => {}}
        dripInterval={60}
        setDripInterval={() => {}}
        customData=""
        setCustomData={() => {}}
        isRequirementsConfirmed={false}
        setIsRequirementsConfirmed={() => {}}
        selectedGateway="yookassa"
        setSelectedGateway={() => {}}
        availableGateways={{ yookassa: true, robokassa: false, cryptobot: false }}
        userBalanceCents={0}
        showPromo={false}
        setShowPromo={() => {}}
        promoCode=""
        setPromoCode={() => {}}
        appliedPromo=""
        isApplyingPromo={false}
        promoMessage={null}
        onApplyPromo={() => {}}
        onRemovePromo={() => {}}
        serverPricing={null}
        totalPrice="75.00"
        originalPrice={null}
        formAction={() => {}}
        isPending={false}
        formState={{ error: undefined }}
        shakeKey={0}
        quantityRef={{ current: null }}
        emailRef={{ current: null }}
        linkRef={{ current: null }}
      />
    );

    expect(screen.getByText('Telegram Подписчики Живые')).toBeTruthy();
    expect(screen.getByText('75.00 ₽')).toBeTruthy();
  });
});
