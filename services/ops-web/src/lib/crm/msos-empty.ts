export const MSOS_EMPTY = {
  command: 'Chưa có ngoại lệ. Tạo inventory và booking trên các màn Inventory / Packages.',
  inventory: 'Chưa có placement. Tạo inventory PTT hoặc property publisher của partner thật.',
  packages: 'Chưa có package. Chọn placement đã có rate published và client CRM thật.',
  campaigns: 'Chưa có media line.',
  evidence: 'Chưa có evidence pack.',
  outcomes: 'Chưa có outcome link. Chỉ gắn lead/sale ID đã có trên CRM.',
  margin: 'Chưa có waterfall. Mở sau khi có media line.',
  settings: 'Chưa có partner để chấm scorecard.',
} as const;

export type MsosEmptyScreen = keyof typeof MSOS_EMPTY;

export const MSOS_UI_DENYLIST = [
  'CL-1042',
  'IO-VNE-0912',
  'PKG-2026-048',
  'PKG-2026-051',
  'PKG-2026-044',
  'publisher-pilot.example',
  'Sunlight',
  'Nova Home',
  'Tâm An',
  'Admicro',
  'ML-2026-0912-VNE',
  'WIN · A',
] as const;
