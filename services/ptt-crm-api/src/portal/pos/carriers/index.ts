import type { CarrierId } from '../portal-pos.types';
import type { CarrierAdapter } from './carrier-adapter';
import { ghnAdapter } from './ghn.adapter';
import { ghtkAdapter } from './ghtk.adapter';
import { vtpAdapter } from './vtp.adapter';

export { ghnAdapter } from './ghn.adapter';
export { ghtkAdapter } from './ghtk.adapter';
export { vtpAdapter } from './vtp.adapter';
export * from './carrier-adapter';

const ADAPTERS: Record<CarrierId, CarrierAdapter> = {
  ghn: ghnAdapter,
  ghtk: ghtkAdapter,
  vtp: vtpAdapter,
};

export function getCarrierAdapter(id: CarrierId): CarrierAdapter {
  const adapter = ADAPTERS[id];
  if (!adapter) throw new Error('unknown_carrier');
  return adapter;
}
