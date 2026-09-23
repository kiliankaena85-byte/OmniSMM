'use client';

import * as React from 'react';
import { 
  OrderDetailsModal, 
  type OrderModalColumn, 
  type OrderDetailsModalProps 
} from '@/components/admin/OrderDetailsModal';

export type OrderDrawerColumn = OrderModalColumn;
export type OrderDrawerProps = OrderDetailsModalProps;

/**
 * OrderDrawer (Deprecated - Replaced with Wide Bento Modal OrderDetailsModal)
 * Preserved for full backward compatibility across all admin views and tickets workspace.
 */
export function OrderDrawer(props: OrderDetailsModalProps) {
  return <OrderDetailsModal {...props} />;
}
