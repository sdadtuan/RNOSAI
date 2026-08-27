import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ReProjectsPgRepository } from './re-projects-pg.repository';

describe('RE projects PostgreSQL cutover', () => {
  it('ports every public sqlite repository method', () => {
    const sqliteMethods = [
      'listProjectTypes', 'saveProjectType', 'deleteProjectType', 'listProjects', 'fetchProject',
      'createProject', 'updateProject', 'deleteProject', 'listProducts', 'saveProduct', 'deleteProduct',
      'listKpis', 'saveKpi', 'deleteKpi', 'listCrmKpiMetrics', 'syncProjectKpisToStaff',
      'pullProjectKpisFromStaff', 'refreshProjectReLeadsNewKpi', 'listRisks', 'saveRisk', 'deleteRisk',
      'listBudgetLines', 'saveBudgetLine', 'deleteBudgetLine', 'fetchProjectSummary', 'listProjectZones',
      'inventoryByZoneSummary', 'listPriceBatches', 'inventoryByPriceBatchSummary', 'listPriceLists',
      'fetchPriceList', 'listPriceListItems', 'savePriceList', 'deletePriceList', 'listAllVersionCodes',
      'listProjectStaff', 'addProjectStaff', 'updateProjectStaff', 'removeProjectStaff',
      'getProjectLeadConfig', 'saveProjectLeadConfig', 'computeProjectWorkflow', 'fetchProjectExportData',
    ];
    const pgMethods = new Set<string>();
    let prototype = ReProjectsPgRepository.prototype;
    while (prototype && prototype !== Object.prototype) {
      Object.getOwnPropertyNames(prototype).forEach((name) => pgMethods.add(name));
      prototype = Object.getPrototypeOf(prototype);
    }

    expect(sqliteMethods.filter((name) => !pgMethods.has(name))).toEqual([]);
  });

  it('does not wire the sqlite repository into the module or services', () => {
    const dir = __dirname;
    for (const file of [
      're-projects.module.ts',
      're-projects.service.ts',
      're-projects-ops.service.ts',
      're-projects-kpi-budget.service.ts',
      're-projects-accounting.service.ts',
      're-projects-accounting.util.ts',
    ]) {
      expect(readFileSync(join(dir, file), 'utf8')).not.toContain('ReProjectsSqliteRepository');
    }
  });

  it('does not use sqlite in the accounting repository', () => {
    const source = readFileSync(join(__dirname, 're-projects-accounting.repository.ts'), 'utf8');
    expect(source).not.toContain('node:sqlite');
    expect(source).not.toContain('sqlitePath');
  });
});
