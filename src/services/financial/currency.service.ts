export class CurrencyService {
    static dynamicCurrencyBuffer = 1.05; // +5% Margin Safety Net

    /**
     * Calculates the retail price in Kopecks (Integer) for 1000 items.
     * Prevents Value Risk from sudden currency fluctuations.
     * 
     * @param providerCostUsdPer1k Base cost in USD per 1000 actions
     * @param exchangeRate RUB per 1 USD
     * @param markupMultiplier Product's markup (e.g., 1.20 for 20%)
     * @param volatility_mode True if CBR rate is dropping fast
     * @returns Retail price in Integer Kopecks (Cents)
     */
    static calculatePricing(
        providerCostUsdPer1k: number,
        exchangeRate: number,
        markupMultiplier: number,
        volatility_mode: boolean = false
    ): number {
        // 1. Convert initial USD cost to RUB Kopecks (integer math)
        // Example: 1 USD * 100 RUB * 100 = 10000 kopecks
        const baseCostCents = Math.floor(providerCostUsdPer1k * exchangeRate * 100);
        
        // 2. Apply Hedge Buffer if volatile
        // Example: 10000 * 1.05 = 10500 kopecks
        const hedgedCents = volatility_mode 
            ? Math.floor(baseCostCents * this.dynamicCurrencyBuffer) 
            : baseCostCents;

        // 3. Apply standard markup
        // Example: 10500 * 1.20 = 12600 kopecks
        const finalPriceCents = Math.floor(hedgedCents * markupMultiplier);

        return finalPriceCents;
    }
}
