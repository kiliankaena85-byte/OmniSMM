import type { FluxNetwork, FluxCategory, FluxService } from '@/types/flux';

export type Step = 'network' | 'category' | 'service' | 'checkout';

export const slideVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 25 : -25,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    y: direction < 0 ? 25 : -25,
    opacity: 0,
  })
};

export const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } }
};

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 }
};

export interface FluxDashboardOrderWizardProps {
  userEmail?: string;
  userBalanceCents?: number;
  initialReorderData?: { serviceId: string; categoryId: string; link: string; quantity: number } | null;
  tenantId?: string;
}
