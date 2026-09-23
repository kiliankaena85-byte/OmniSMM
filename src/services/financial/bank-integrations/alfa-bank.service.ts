import { getRedisConnection } from '@/lib/queue-manager';
import { logger } from '@/lib/logger';
import Decimal from 'decimal.js';
import { db } from '@/lib/db';
import { VaultService } from '@/lib/vault';

const log = logger.child({ component: 'AlfaBankService' });

export interface AlfaBankAccountBalance {
  accountNumber: string;
  maskedAccountNumber: string;
  currency: string;
  authorizedBalanceRub: number;
  availableBalanceRub: number;
  lastSyncedAt: string;
  isSandbox: boolean;
  status: 'ACTIVE' | 'BLOCKED' | 'RESTRICTED';
}

export interface AlfaBankSyncResult {
  success: boolean;
  bank?: 'ALFA_BANK';
  account?: AlfaBankAccountBalance;
  error?: string;
  isCached?: boolean;
}

interface RawAlfaAccount {
  accountNumber?: string;
  currency?: string;
  status?: 'ACTIVE' | 'BLOCKED' | 'RESTRICTED';
  balance?: {
    authorizedBalance?: number;
    availableBalance?: number;
  };
}

interface RawAlfaResponse {
  accounts?: RawAlfaAccount[];
  accountNumber?: string;
  currency?: string;
  status?: 'ACTIVE' | 'BLOCKED' | 'RESTRICTED';
  balance?: {
    authorizedBalance?: number;
    availableBalance?: number;
  };
}

export class AlfaBankService {
  private static readonly REDIS_CACHE_PREFIX = 'bank:balance:alfa';
  private static readonly CACHE_TTL_SECONDS = 3600; // 1 hour cache to prevent rate-limiting

  /**
   * Masks a bank account number (e.g. 40802810900000001234 -> 40802810****1234)
   */
  public static maskAccountNumber(accountNumber: string): string {
    if (!accountNumber || accountNumber.length < 12) {
      return accountNumber || '40802810****0000';
    }
    return `${accountNumber.slice(0, 8)}****${accountNumber.slice(-4)}`;
  }

  /**
   * Retrieves live balance for a tenant from Alfa-Bank Open API or Redis cache.
   */
  public static async getLiveBalance(
    tenantId: string = 'smmplan',
    forceRefresh: boolean = false
  ): Promise<AlfaBankSyncResult> {
    const effectiveTenantId = (!tenantId || tenantId === 'all') ? 'smmplan' : tenantId;
    const cacheKey = `${this.REDIS_CACHE_PREFIX}:${effectiveTenantId}`;
    const redis = getRedisConnection();

    // 1. Check Redis cache if forceRefresh is false
    if (!forceRefresh) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as AlfaBankAccountBalance;
          return {
            success: true,
            bank: 'ALFA_BANK',
            account: parsed,
            isCached: true,
          };
        }
      } catch (err) {
        log.warn('Failed to read Alfa-Bank balance from Redis cache, proceeding to API', { err });
      }
    }

    // 2. Read credentials from database settings with fallback to environment variables
    let apiKey = process.env.ALFA_BANK_API_KEY;
    let clientSecret = process.env.ALFA_BANK_CLIENT_SECRET;
    let accountNumber = process.env.ALFA_BANK_ACCOUNT_NUMBER || '40802810500001234567';
    let isSandbox = process.env.ALFA_BANK_IS_SANDBOX !== 'false';
    let baseUrl = process.env.ALFA_BANK_API_BASE_URL || 'https://business.alfabank.ru/ext-api/v1';

    try {
      const dbSettings = await db.systemSettings.findUnique({
        where: { id: effectiveTenantId },
      });
      if (dbSettings) {
        const hasDbConfig = Boolean(dbSettings.alfaBankApiKey || dbSettings.alfaBankAccountNumber);
        if (hasDbConfig && typeof dbSettings.alfaBankIsSandbox === 'boolean') {
          isSandbox = dbSettings.alfaBankIsSandbox;
        }
        if (dbSettings.alfaBankApiKey) {
          try {
            const decrypted = VaultService.decrypt(dbSettings.alfaBankApiKey);
            if (decrypted) apiKey = decrypted;
          } catch {
            apiKey = dbSettings.alfaBankApiKey;
          }
        }
        if (dbSettings.alfaBankClientSecret) {
          try {
            const decrypted = VaultService.decrypt(dbSettings.alfaBankClientSecret);
            if (decrypted) clientSecret = decrypted;
          } catch {
            clientSecret = dbSettings.alfaBankClientSecret;
          }
        }
        if (dbSettings.alfaBankAccountNumber) {
          accountNumber = dbSettings.alfaBankAccountNumber;
        }
        if (dbSettings.alfaBankApiBaseUrl) {
          baseUrl = dbSettings.alfaBankApiBaseUrl;
        }
      }
    } catch (dbErr) {
      log.warn('Failed to read Alfa-Bank settings from DB, using fallback env', { dbErr, tenantId: effectiveTenantId });
    }

    // 3. Fetch from Alfa-Bank Open API or Sandbox Mock
    try {
      let balanceData: AlfaBankAccountBalance;

      if (!apiKey || isSandbox) {
        // Sandbox Mock Mode for development & testing
        balanceData = {
          accountNumber,
          maskedAccountNumber: this.maskAccountNumber(accountNumber),
          currency: 'RUB',
          authorizedBalanceRub: 1450000.0,
          availableBalanceRub: 1450000.0,
          lastSyncedAt: new Date().toISOString(),
          isSandbox: true,
          status: 'ACTIVE',
        };
      } else {
        // Production Alfa-Bank Open API Request with 10s timeout
        const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
        const response = await fetch(`${cleanBaseUrl}/accounts`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-Client-Secret': clientSecret || '',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`Alfa-Bank API HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as RawAlfaResponse;
        const matchingAccount = Array.isArray(data.accounts)
          ? data.accounts.find((acc) => acc.accountNumber === accountNumber) || data.accounts[0]
          : data;

        if (!matchingAccount) {
          throw new Error(`Account ${accountNumber} not found in Alfa-Bank response`);
        }

        const rawBalance = matchingAccount.balance?.authorizedBalance ?? matchingAccount.balance?.availableBalance ?? 0;
        const cleanBalance = new Decimal(rawBalance).toDecimalPlaces(2).toNumber();

        balanceData = {
          accountNumber: matchingAccount.accountNumber || accountNumber,
          maskedAccountNumber: this.maskAccountNumber(matchingAccount.accountNumber || accountNumber),
          currency: matchingAccount.currency || 'RUB',
          authorizedBalanceRub: cleanBalance,
          availableBalanceRub: cleanBalance,
          lastSyncedAt: new Date().toISOString(),
          isSandbox: false,
          status: matchingAccount.status || 'ACTIVE',
        };
      }

      // 4. Cache in Redis
      try {
        await redis.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(balanceData));
      } catch (cacheErr) {
        log.warn('Failed to persist Alfa-Bank balance to Redis cache', { cacheErr });
      }

      log.info(
        `Alfa-Bank account balance synchronized successfully (${balanceData.authorizedBalanceRub} RUB)`,
        { tenantId: effectiveTenantId, balance: balanceData.authorizedBalanceRub, isSandbox: balanceData.isSandbox }
      );

      return {
        success: true,
        bank: 'ALFA_BANK',
        account: balanceData,
        isCached: false,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown Alfa-Bank API Error';
      log.error('Alfa-Bank balance synchronization failed', { err, tenantId: effectiveTenantId });

      return {
        success: false,
        bank: 'ALFA_BANK',
        error: errorMessage,
      };
    }
  }
}
