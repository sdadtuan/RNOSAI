export type TowerFactory = 'A' | 'B';
export type TowerColumnId =
  | 'lead_b2' | 'intake' | 'consult' | 'contract' | 'tmmt_deliver' | 'care';
export type TowerSeverity = 'red' | 'amber' | 'ok';
export type TowerSensorId =
  | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10' | 'S11' | 'S12';

export type TowerEntityInput = {
  factory: TowerFactory;
  leadId: number;
  lifecycleId: number | null;
  b2Done: boolean;
  intakeGo: boolean;
  contractPendingOrActive: boolean;
  won: boolean;
  hasLifecycle: boolean;
  clientActive: boolean;
  retain: boolean;
  spaOnBoard: boolean;
  firstCallDone: boolean;
};

export type TowerColumnOpts = { factoryFilter?: 'A' | 'B' | 'both' };
