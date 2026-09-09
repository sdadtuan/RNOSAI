export type Ledger = 'quoted' | 'delivered' | 'reported';
export type ActualQuality = 'valid' | 'estimated' | 'pending_validation' | 'invalid' | 'na';

export function canPublishClientReport(quality: ActualQuality, clientVisible: boolean): boolean {
  return quality === 'valid' && clientVisible;
}
