import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/components/admin/catalog-table-v2.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const marker = 'function getNetworkBadgeClass(slug: string | null) {';
const badgeIdx = content.indexOf(marker);

const header = `'use client';
// audit-disable STR-002

import { useState, useTransition, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Table } from '@heroui/react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Trash2, ShoppingCart, Pencil, Plus, Loader2, AlertCircle, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SocialIcon } from '@/components/ui/SocialIcon';
import type { CatalogServiceDTO } from '@/types/catalog.dto';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  toggleServiceActiveAction,
  updateServiceMarkupAction,
} from '@/actions/admin/catalog/batch';
import { softDeleteServiceAction } from '@/actions/admin/catalog/soft-delete';
import {
  applyBeautifulRounding,
  SAFETY_FLOOR_MARKUP,
  TOTAL_MANDATORY_DEDUCTIONS,
} from '@/lib/financial-constants';
import { useRangeSelection } from '@/hooks/use-range-selection';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BatchActionBar } from './catalog/batch-action-bar';
import { AdminPricingIntelligenceModal } from './catalog/AdminPricingIntelligenceModal';
const SAFETY_MULTIPLIER = (1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS);

function calcDisplayPrice(rate: number, markup: number, usdToRub: number, curr: 'RUB' | 'USD', vol: 'UNIT' | '1K') {
  if (vol === '1K') {
    const rawPrice = curr === 'USD' ? rate * markup : rate * markup * usdToRub;
    return curr === 'RUB' ? applyBeautifulRounding(rawPrice) : parseFloat(rawPrice.toFixed(4));
  } else {
    const rawPrice = curr === 'USD' ? (rate * markup) / 1000 : (rate * markup * usdToRub) / 1000;
    return curr === 'RUB' 
      ? applyBeautifulRounding(rawPrice * 1000) / 1000 
      : parseFloat(rawPrice.toFixed(6));
  }
}

function calcDisplayCost(rate: number, usdToRub: number, curr: 'RUB' | 'USD', vol: 'UNIT' | '1K') {
  if (vol === '1K') {
    return curr === 'USD' ? rate : rate * usdToRub;
  } else {
    return curr === 'USD' ? rate / 1000 : (rate * usdToRub) / 1000;
  }
}

`;

content = header + content.slice(badgeIdx);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed header of catalog-table-v2.tsx');
