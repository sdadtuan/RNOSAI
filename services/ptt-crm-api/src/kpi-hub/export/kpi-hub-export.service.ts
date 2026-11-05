import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { kpiHubMemory } from '../kpi-hub.memory-store';

@Injectable()
export class KpiHubExportService {
  async exportDictionaryXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('KPI Dictionary');
    ws.columns = [
      { header: 'Code', key: 'code', width: 14 },
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Group', key: 'kpi_group', width: 18 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Direction', key: 'direction', width: 18 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Primary Source', key: 'primary_source', width: 16 },
    ];
    for (const row of kpiHubMemory.snapshotDictionary()) {
      ws.addRow(row);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportTargetsXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Targets');
    ws.columns = [
      { header: 'KPI Code', key: 'dictionary_code', width: 14 },
      { header: 'Period', key: 'period', width: 12 },
      { header: 'Scope', key: 'scope_label', width: 24 },
      { header: 'Target', key: 'target_value', width: 14 },
      { header: 'Warning', key: 'warning_value', width: 14 },
      { header: 'Critical', key: 'critical_value', width: 14 },
    ];
    for (const row of kpiHubMemory.snapshotTargets()) {
      ws.addRow(row);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async previewTargetImport(rows: Array<Record<string, unknown>>) {
    const errors: string[] = [];
    const preview = rows.map((row, idx) => {
      const code = String(row['KPI Code'] ?? row.dictionary_code ?? '');
      const period = String(row.Period ?? row.period ?? '');
      const target = Number(row.Target ?? row.target_value);
      if (!code) errors.push(`Row ${idx + 2}: missing KPI Code`);
      if (!period) errors.push(`Row ${idx + 2}: missing Period`);
      if (!Number.isFinite(target)) errors.push(`Row ${idx + 2}: invalid Target`);
      const dict = kpiHubMemory.snapshotDictionary().find((d) => d.code === code);
      if (code && !dict) errors.push(`Row ${idx + 2}: unknown KPI ${code}`);
      return { row: idx + 2, dictionary_code: code, period, target_value: target, valid: Boolean(dict && period && Number.isFinite(target)) };
    });
    return { valid: errors.length === 0, errors, preview, row_count: rows.length };
  }
}
