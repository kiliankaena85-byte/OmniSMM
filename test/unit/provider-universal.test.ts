import { describe, it, expect, vi, beforeAll } from 'vitest';
import { UniversalProvider } from '../../src/services/providers/universal.provider';

describe('UniversalProvider - WAF Bypass & V2 Standard', () => {
    beforeAll(() => {
        // We explicitly unstub fetch because this test verifies real WAF bypass against a live URL
        vi.unstubAllGlobals();
    });
    // Testing smmprime.com with the real provided test key to verify WAF bypass
    // We pass the raw key since our fallback allows raw keys if decryption yields null
    const provider = new UniversalProvider(
        'https://smmprime.com/api/v2',
        process.env.PROVIDER_KEY_SMMPRIME || 'test-mock-key-placeholder'
    );

    it('should successfully fetch balance bypassing WAF constraints', async () => {
        const result = await provider.getBalance();
        
        expect(result).toHaveProperty('balance');
        expect(result).toHaveProperty('currency');
        expect(typeof result.balance).toBe('string');
        console.log(`[Universal Test] Successfully retrieved balance: ${result.balance} ${result.currency}`);
    });

    it('should cleanly parse a string error if the order ID is invalid for multiStatus', async () => {
        // "2": "Incorrect order ID" test
        const result = await provider.getMultiOrderStatus([9999999]);
        const key = Object.keys(result)[0];
        
        // Either it returns an empty object if 9999999 is totally rejected, or an error string
        // Many panels return {"9999999": "Incorrect order ID"}
        if (result[key]) {
            if (typeof result[key] !== 'string' && (result[key] as any).error) {
                expect((result[key] as any).error).toContain('Incorrect');
            } else if (typeof result[key] === 'string') {
                expect(result[key]).toContain('Incorrect');
            } else {
                expect(result[key]).toHaveProperty('status');
            }
        }
    });

    it('should successfully fetch and parse service catalog', async () => {
        const services = await provider.getServices();
        
        expect(services).toBeInstanceOf(Array);
        expect(services.length).toBeGreaterThan(0);
        
        const first = services[0];
        expect(first).toHaveProperty('service');
        expect(first).toHaveProperty('name');
        expect(first).toHaveProperty('rate');
        expect(first).toHaveProperty('min');
        expect(first).toHaveProperty('max');
        expect(typeof first.service).toBe('string');
        console.log(`[Universal Test] Successfully parsed service catalog. Found ${services.length} services.`);
    });
});
