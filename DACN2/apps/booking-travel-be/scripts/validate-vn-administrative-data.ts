import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { AdministrativeDataset } from './address-data.types';

export interface ValidationSummary {
  currentProvinces: number;
  currentCommunes: number;
  legacyProvinces: number;
  legacyDistricts: number;
  legacyCommunes: number;
  transitionRows: number;
  errors: string[];
}

const dataDir = join(__dirname, '..', 'data', 'vietnam-address');

export async function loadDataset(name: 'current' | 'legacy') {
  return JSON.parse(
    await readFile(join(dataDir, `${name}.json`), 'utf8'),
  ) as AdministrativeDataset;
}

function validateUnits(dataset: AdministrativeDataset, errors: string[]) {
  const keys = new Set<string>();
  for (const item of dataset.units) {
    const key = `${item.catalogMode}:${item.level}:${item.code}`;
    if (keys.has(key)) errors.push(`Duplicate: ${key}`);
    keys.add(key);
    if (!/^\d{2,5}$/.test(item.code)) errors.push(`Invalid code: ${key}`);
    if (!item.name || !item.normalizedName) errors.push(`Missing name: ${key}`);
  }
  for (const item of dataset.units) {
    if (!item.parentCode) continue;
    const parentLevel =
      item.level === 'COMMUNE' && item.catalogMode === 'CURRENT'
        ? 'PROVINCE'
        : item.level === 'COMMUNE'
          ? 'DISTRICT'
          : 'PROVINCE';
    if (!keys.has(`${item.catalogMode}:${parentLevel}:${item.parentCode}`)) {
      errors.push(`Orphan: ${item.catalogMode}:${item.level}:${item.code}`);
    }
  }
}

export async function validateAll(): Promise<ValidationSummary> {
  const [current, legacy] = await Promise.all([
    loadDataset('current'),
    loadDataset('legacy'),
  ]);
  const errors: string[] = [];
  validateUnits(current, errors);
  validateUnits(legacy, errors);
  if (current.units.filter((item) => item.level === 'PROVINCE').length !== 34) {
    errors.push('Current catalog must have exactly 34 province-level units.');
  }
  if (
    current.units.filter((item) => item.level === 'COMMUNE').length !== 3321
  ) {
    errors.push('Current catalog must have exactly 3,321 commune-level units.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(join(dataDir, 'official-transition-map.xlsx'));
  const sheet =
    workbook.getWorksheet('Tổng hợp_không merge ') ?? workbook.worksheets[1];
  if (!sheet) errors.push('Transition worksheet is missing.');
  let transitionRows = 0;
  const currentCommuneCodes = new Set(
    current.units
      .filter((item) => item.level === 'COMMUNE')
      .map((item) => item.code),
  );
  const legacyCommuneCodes = new Set(
    legacy.units
      .filter((item) => item.level === 'COMMUNE')
      .map((item) => item.code),
  );
  const legacyDistrictCodes = new Set(
    legacy.units
      .filter((item) => item.level === 'DISTRICT')
      .map((item) => item.code),
  );
  const unresolvedTransitions: string[] = [];
  if (sheet) {
    for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const values = sheet.getRow(rowNumber).values as ExcelJS.CellValue[];
      if (!values[3] || !values[5]) continue;
      transitionRows += 1;
      const newCode = String(values[3])
        .replace(/\.0$/, '')
        .replace(/\D/g, '')
        .padStart(5, '0');
      const oldCode = String(values[5])
        .replace(/\.0$/, '')
        .replace(/\D/g, '')
        .padStart(5, '0');
      const oldDistrictCode = oldCode.replace(/^00/, '');
      if (
        !currentCommuneCodes.has(newCode) ||
        (!legacyCommuneCodes.has(oldCode) &&
          !legacyDistrictCodes.has(oldDistrictCode))
      ) {
        unresolvedTransitions.push(`${rowNumber}:${oldCode}->${newCode}`);
      }
    }
  }
  if (transitionRows < 10_000)
    errors.push(`Only ${transitionRows} transition rows found.`);
  if (unresolvedTransitions.length > 0) {
    errors.push(
      `${unresolvedTransitions.length} transition rows reference missing units: ${unresolvedTransitions.slice(0, 20).join(', ')}`,
    );
  }

  return {
    currentProvinces: current.units.filter((item) => item.level === 'PROVINCE')
      .length,
    currentCommunes: current.units.filter((item) => item.level === 'COMMUNE')
      .length,
    legacyProvinces: legacy.units.filter((item) => item.level === 'PROVINCE')
      .length,
    legacyDistricts: legacy.units.filter((item) => item.level === 'DISTRICT')
      .length,
    legacyCommunes: legacy.units.filter((item) => item.level === 'COMMUNE')
      .length,
    transitionRows,
    errors,
  };
}

if (require.main === module) {
  void validateAll()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
      if (summary.errors.length > 0) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
