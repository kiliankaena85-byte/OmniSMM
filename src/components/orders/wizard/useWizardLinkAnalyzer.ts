'use client';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { analyzeUrl } from '@/actions/order/analyze-url';
import { PublicNetwork, PublicService } from '@/actions/order/catalog';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import {
  validateBaseOrderLink,
  saveOrderDraftToStorage,
  loadOrderDraftFromStorage,
  sanitizeAndNormalizeOrderLink,
} from '@/hooks/useBaseOrderValidation';

interface UseWizardLinkAnalyzerProps {
  link: string;
  setLink: (l: string) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  networks: PublicNetwork[];
  selectedNetwork: PublicNetwork | null;
  setSelectedNetwork: (n: PublicNetwork | null) => void;
  selectedCategory: { id: string } | null;
  selectedService: PublicService | null;
}

export function useWizardLinkAnalyzer({
  link,
  setLink,
  quantity,
  setQuantity,
  networks,
  selectedNetwork,
  setSelectedNetwork,
  selectedCategory,
  selectedService,
}: UseWizardLinkAnalyzerProps) {
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const analyzeRequestIdRef = useRef(0);

  // [T2-1] Restore sessionStorage draft on mount
  useEffect(() => {
    const draft = loadOrderDraftFromStorage<{ link?: string; quantity?: number }>('smmplan_draft');
    if (draft) {
      if (draft.link && typeof draft.link === 'string' && draft.link.length >= 5) setLink(draft.link);
      if (draft.quantity && typeof draft.quantity === 'number' && draft.quantity > 0) setQuantity(draft.quantity);
    }
  }, [setLink, setQuantity]);

  // [T2-1] Persist draft to sessionStorage on changes
  useEffect(() => {
    saveOrderDraftToStorage('smmplan_draft', {
      link,
      networkId: selectedNetwork?.id,
      categoryId: selectedCategory?.id,
      quantity,
    });
  }, [link, selectedNetwork?.id, selectedCategory?.id, quantity]);

  // Debounced URL analysis
  useEffect(() => {
    const trimmed = link.trim();
    if (trimmed.length < 5) {
      setDetectedType(null);
      setSuggestedCategories([]);
      setShowAllCategories(false);
      return;
    }
    const currentRequestId = ++analyzeRequestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await analyzeUrl(trimmed);
        if (currentRequestId !== analyzeRequestIdRef.current) return;
        if (res.success && res.data) {
          setDetectedType(res.data.type || null);
          setSuggestedCategories(res.data.suggestedCategories || []);
          const platformStr = res.data.platform !== 'OTHER' ? res.data.platform.toLowerCase() : null;
          if (platformStr && networks.length > 0) {
            const m = networks.find(n => n.slug.toLowerCase() === platformStr);
            if (m && (!selectedNetwork || selectedNetwork.id !== m.id)) setSelectedNetwork(m);
          }
        } else {
          setDetectedType(null);
          setSuggestedCategories([]);
        }
      } catch {
        if (currentRequestId === analyzeRequestIdRef.current) {
          setDetectedType(null);
          setSuggestedCategories([]);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [link, networks, selectedNetwork, setSelectedNetwork]);

  const handleBlurLink = () => {
    if (!link) return;
    const targetType = selectedService ? resolveServiceTargetType(selectedService) : undefined;
    const platformSlug = selectedNetwork?.slug ? selectedNetwork.slug.toUpperCase() : undefined;
    const res = sanitizeAndNormalizeOrderLink(link, platformSlug, targetType);
    if (res.cleanUrl && res.cleanUrl !== link) {
      setLink(res.cleanUrl);
      toast.info('Ссылка скорректирована автоматически');
    }
  };

  const validateLinkFormat = (): string | null => {
    if (!selectedService || !selectedNetwork || !link) return null;
    const targetType = resolveServiceTargetType(selectedService);
    const platformSlug = selectedNetwork.slug.toUpperCase();
    return validateBaseOrderLink(link, platformSlug, targetType);
  };

  return {
    detectedType,
    suggestedCategories,
    showAllCategories,
    setShowAllCategories,
    handleBlurLink,
    validateLinkFormat,
  };
}
