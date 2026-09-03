import { parseKpiGroupImportCsv } from './kpi-groups-import.util';

describe('parseKpiGroupImportCsv', () => {
  it('parses valid header and row', () => {
    const csv = [
      'code,name,description,scope_type,default_direction,color,icon,display_order,status,department_ids,position_ids,suggested_unit_types,data_domains',
      'TEST_IMPORT,Test Import,Mô tả,ORGANIZATION,INCREASE,#17B6A4,target,10,DRAFT,,,COUNT,CRM',
    ].join('\n');
    const { rows, errors } = parseKpiGroupImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].body.code).toBe('TEST_IMPORT');
    expect(rows[0].body.scope_type).toBe('ORGANIZATION');
  });

  it('rejects invalid header', () => {
    const { rows, errors } = parseKpiGroupImportCsv('code,name\nA,B');
    expect(rows).toEqual([]);
    expect(errors[0]?.error).toBe('KPI_GROUP_IMPORT_HEADER_INVALID');
  });

  it('reports row validation errors', () => {
    const csv = [
      'code,name,description,scope_type,default_direction,color,icon,display_order,status,department_ids,position_ids,suggested_unit_types,data_domains',
      'bad,AB,desc,ORGANIZATION,INCREASE,#17B6A4,,,DRAFT,,,,',
    ].join('\n');
    const { rows, errors } = parseKpiGroupImportCsv(csv);
    expect(rows).toEqual([]);
    expect(errors[0]?.error).toBe('KPI_GROUP_NAME_REQUIRED');
  });
});
