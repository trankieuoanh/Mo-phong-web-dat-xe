import type { Flow } from '@/lib/shared';
import type { FlowEntryScreen } from '@/lib/track';

export const FLOW_ENTRY: Record<string, FlowEntryScreen> = {
  '/': 'home',
  '/ride/address': 'address_selection',
  '/food': 'food_menu',
};

export interface FlowTab {
  flow: Flow;
  label: string;
  href: string;
}

export const FLOW_TABS: FlowTab[] = [
  { flow: 'ride', label: 'Đặt xe', href: '/ride/address' },
  { flow: 'food', label: 'Đặt đồ ăn', href: '/food' },
];

export function activeFlowOf(pathname: string): Flow | null {
  if (pathname === '/') return null;
  if (pathname.startsWith('/ride')) return 'ride';
  if (pathname.startsWith('/food')) return 'food';
  return null;
}

export function selectFlowScreenFor(
  pathname: string,
  flow: Flow,
  href: string,
): FlowEntryScreen | null {
  const active = activeFlowOf(pathname);

  if (active === flow) return null;
  if (active === null) return FLOW_ENTRY[href] ?? null;

  return FLOW_ENTRY[pathname] ?? null;
}
