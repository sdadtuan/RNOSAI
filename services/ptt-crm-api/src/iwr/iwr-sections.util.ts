import {
  IWR_DAILY_SECTIONS,
  IWR_MONTHLY_SECTIONS,
  IWR_WEEKLY_SECTIONS,
  type IwrSectionValue,
  type IwrTemplateCode,
} from './iwr.types';

function emptySection(): IwrSectionValue {
  return { body: '', items: [] };
}

function keysForCode(code: IwrTemplateCode): readonly string[] {
  if (code === 'daily_work') return IWR_DAILY_SECTIONS;
  if (code === 'weekly_work') return IWR_WEEKLY_SECTIONS;
  return IWR_MONTHLY_SECTIONS;
}

export function emptySectionsForCode(
  code: IwrTemplateCode,
): Record<string, IwrSectionValue> {
  return Object.fromEntries(keysForCode(code).map((k) => [k, emptySection()]));
}

export function sectionKeysForCode(code: IwrTemplateCode): string[] {
  return [...keysForCode(code)];
}
