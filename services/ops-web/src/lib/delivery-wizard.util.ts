import type { DeliveryCapability } from './delivery-projects.util';

export function wizardFooter(caps: DeliveryCapability[]): {
  primary: 'save' | 'continue_scope';
  showSteps2to5: boolean;
} {
  const delivery = caps.includes('delivery');
  return { primary: delivery ? 'continue_scope' : 'save', showSteps2to5: delivery };
}
