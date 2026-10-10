import {
  AdministrativeAliasKind,
  AdministrativeCatalogMode,
  AdministrativeLevel,
  AdministrativeTransitionType,
  AdministrativeUnitStatus,
  AdministrativeUnitType,
  ImportRunStatus,
  PrismaClient,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeVietnamese } from './address-data.types';
import { loadDataset, validateAll } from './validate-vn-administrative-data';

const prisma = new PrismaClient();
const dataDir = join(__dirname, '..', 'data', 'vietnam-address');

function asText(value: ExcelJS.CellValue | undefined) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text).trim();
    if ('result' in value) return String(value.result ?? '').trim();
  }
  return String(value).trim();
}

function code(value: ExcelJS.CellValue | undefined, width: number) {
  const digits = asText(value).replace(/\.0$/, '').replace(/\D/g, '');
  return digits ? digits.padStart(width, '0') : '';
}

function parenthesizedCode(value: ExcelJS.CellValue | undefined) {
  return (
    asText(value)
      .match(/\((\d+)\)\s*$/)?.[1]
      ?.padStart(2, '0') ?? ''
  );
}

function aliasName(name: string) {
  return name
    .replace(
      /^(Tỉnh|Thành phố|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn|Đặc khu)\s+/iu,
      '',
    )
    .trim();
}

async function importDataset(datasetName: 'current' | 'legacy') {
  const dataset = await loadDataset(datasetName);
  const source = await prisma.dataSource.upsert({
    where: { key: dataset.source.key },
    update: {
      name: dataset.source.name,
      publisher: dataset.source.publisher,
      url: dataset.source.url,
      version: dataset.source.version,
      retrievedAt: new Date(dataset.source.retrievedAt),
      effectiveFrom: new Date(dataset.source.effectiveFrom),
      license: dataset.source.license,
      coverage: dataset.source.coverage,
      checksum: dataset.source.checksum,
      notes: dataset.source.notes,
    },
    create: {
      key: dataset.source.key,
      name: dataset.source.name,
      publisher: dataset.source.publisher,
      url: dataset.source.url,
      version: dataset.source.version,
      retrievedAt: new Date(dataset.source.retrievedAt),
      effectiveFrom: new Date(dataset.source.effectiveFrom),
      license: dataset.source.license,
      coverage: dataset.source.coverage,
      checksum: dataset.source.checksum,
      notes: dataset.source.notes,
    },
  });
  const run = await prisma.importRun.create({
    data: { sourceId: source.id, datasetVersion: dataset.source.version },
  });
  let insertedCount = 0;
  let updatedCount = 0;
  try {
    if (datasetName === 'current') {
      await prisma.administrativeUnit.updateMany({
        where: {
          catalogMode: AdministrativeCatalogMode.CURRENT,
          sourceId: { not: source.id },
          status: AdministrativeUnitStatus.ACTIVE,
        },
        data: {
          status: AdministrativeUnitStatus.INACTIVE,
          validTo: new Date(dataset.source.effectiveFrom),
        },
      });
    }
    const byCode = new Map<string, string>();
    const levels = ['PROVINCE', 'DISTRICT', 'COMMUNE'] as const;
    for (const level of levels) {
      const records = dataset.units.filter((item) => item.level === level);
      for (let offset = 0; offset < records.length; offset += 250) {
        const batch = records.slice(offset, offset + 250);
        const existing = await prisma.administrativeUnit.findMany({
          where: {
            catalogMode:
              datasetName === 'current'
                ? AdministrativeCatalogMode.CURRENT
                : AdministrativeCatalogMode.LEGACY,
            officialCode: { in: batch.map((item) => item.code) },
            validFrom: new Date(batch[0]?.validFrom ?? 0),
          },
          select: { officialCode: true },
        });
        const existingCodes = new Set(
          existing.map((item) => item.officialCode),
        );
        const results = await prisma.$transaction(
          batch.map((item) => {
            const parentId = item.parentCode
              ? byCode.get(item.parentCode)
              : null;
            if (item.parentCode && !parentId)
              throw new Error(
                `Missing imported parent ${item.parentCode} for ${item.code}`,
              );
            const identity = {
              officialCode: item.code,
              catalogMode: item.catalogMode as AdministrativeCatalogMode,
              validFrom: new Date(item.validFrom),
            };
            const data = {
              name: item.name,
              normalizedName: item.normalizedName,
              level: item.level as AdministrativeLevel,
              unitType: item.unitType as AdministrativeUnitType,
              status: AdministrativeUnitStatus.ACTIVE,
              parentId,
              sourceId: source.id,
              validTo: item.validTo ? new Date(item.validTo) : null,
              legalDocument: item.legalDocument,
            };
            return prisma.administrativeUnit.upsert({
              where: { officialCode_catalogMode_validFrom: identity },
              update: data,
              create: { ...identity, ...data },
            });
          }),
        );
        results.forEach((result) => byCode.set(result.officialCode, result.id));
        insertedCount += batch.filter(
          (item) => !existingCodes.has(item.code),
        ).length;
        updatedCount += batch.filter((item) =>
          existingCodes.has(item.code),
        ).length;
      }
    }

    const units = await prisma.administrativeUnit.findMany({
      where: { sourceId: source.id },
      select: { id: true, name: true },
    });
    for (let offset = 0; offset < units.length; offset += 500) {
      const batch = units.slice(offset, offset + 500);
      await prisma.$transaction(
        batch.flatMap((item) => {
          const alias = aliasName(item.name);
          if (!alias || alias === item.name) return [];
          const normalizedName = normalizeVietnamese(alias);
          return [
            prisma.administrativeUnitAlias.upsert({
              where: {
                unitId_normalizedName_kind: {
                  unitId: item.id,
                  normalizedName,
                  kind: AdministrativeAliasKind.SEARCH_NAME,
                },
              },
              update: { name: alias, sourceId: source.id },
              create: {
                unitId: item.id,
                sourceId: source.id,
                name: alias,
                normalizedName,
                kind: AdministrativeAliasKind.SEARCH_NAME,
              },
            }),
          ];
        }),
      );
    }
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: ImportRunStatus.SUCCEEDED,
        finishedAt: new Date(),
        insertedCount,
        updatedCount,
      },
    });
    return { source, insertedCount, updatedCount };
  } catch (error) {
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: ImportRunStatus.FAILED,
        finishedAt: new Date(),
        errorCount: 1,
        errorReport: {
          message: error instanceof Error ? error.message : String(error),
        },
      },
    });
    throw error;
  }
}

async function importTransitions(sourceId: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(join(dataDir, 'official-transition-map.xlsx'));
  const sheet =
    workbook.getWorksheet('Tổng hợp_không merge ') ?? workbook.worksheets[1];
  if (!sheet) throw new Error('Transition worksheet not found.');
  const [legacyUnits, currentUnits] = await Promise.all([
    prisma.administrativeUnit.findMany({
      where: { catalogMode: AdministrativeCatalogMode.LEGACY },
      select: { id: true, officialCode: true, level: true },
    }),
    prisma.administrativeUnit.findMany({
      where: {
        catalogMode: AdministrativeCatalogMode.CURRENT,
        status: AdministrativeUnitStatus.ACTIVE,
      },
      select: { id: true, officialCode: true, level: true },
    }),
  ]);
  const legacyByCode = new Map(
    legacyUnits.map((item) => [`${item.level}:${item.officialCode}`, item.id]),
  );
  const currentByCode = new Map(
    currentUnits.map((item) => [`${item.level}:${item.officialCode}`, item.id]),
  );
  const rows: Array<{
    oldCode: string;
    newCode: string;
    note: string;
    oldProvince: string;
    newProvince: string;
  }> = [];
  for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = sheet.getRow(rowNumber).values as ExcelJS.CellValue[];
    const newCode = code(values[3], 5);
    const oldRaw = code(values[5], 5);
    if (!newCode || !oldRaw) continue;
    rows.push({
      newCode,
      oldCode: oldRaw,
      note: asText(values[6]),
      newProvince: parenthesizedCode(values[1]),
      oldProvince: parenthesizedCode(values[8]),
    });
  }
  const targetsPerOld = new Map<string, Set<string>>();
  rows.forEach((row) => {
    const targets = targetsPerOld.get(row.oldCode) ?? new Set<string>();
    targets.add(row.newCode);
    targetsPerOld.set(row.oldCode, targets);
  });
  const unique = new Map<string, (typeof rows)[number]>();
  rows.forEach((row) => unique.set(`${row.oldCode}:${row.newCode}`, row));
  const operations = [...unique.values()].flatMap((row) => {
    const fromUnitId =
      legacyByCode.get(`COMMUNE:${row.oldCode}`) ??
      legacyByCode.get(`DISTRICT:${row.oldCode.replace(/^00/, '')}`);
    const toUnitId = currentByCode.get(`COMMUNE:${row.newCode}`);
    if (!fromUnitId || !toUnitId) return [];
    const normalizedNote = normalizeVietnamese(row.note);
    const relationType = normalizedNote.includes('mot phan')
      ? AdministrativeTransitionType.PARTIALLY_TRANSFERRED_TO
      : (targetsPerOld.get(row.oldCode)?.size ?? 0) > 1
        ? AdministrativeTransitionType.SPLIT_INTO
        : normalizedNote.includes('doi ten') ||
            normalizedNote.includes('doi loai')
          ? AdministrativeTransitionType.RENAMED_TO
          : AdministrativeTransitionType.MERGED_INTO;
    return [{ fromUnitId, toUnitId, relationType, notes: row.note }];
  });
  const provincePairs = new Set(
    rows
      .filter((row) => row.oldProvince && row.newProvince)
      .map((row) => `${row.oldProvince}:${row.newProvince}`),
  );
  for (const pair of provincePairs) {
    const [oldCode, newCode] = pair.split(':');
    const fromUnitId = legacyByCode.get(`PROVINCE:${oldCode}`);
    const toUnitId = currentByCode.get(`PROVINCE:${newCode}`);
    if (fromUnitId && toUnitId)
      operations.push({
        fromUnitId,
        toUnitId,
        relationType:
          oldCode === newCode
            ? AdministrativeTransitionType.RENAMED_TO
            : AdministrativeTransitionType.MERGED_INTO,
        notes: 'Suy ra từ bảng chuyển đổi đơn vị hành chính chính thức.',
      });
  }
  let imported = 0;
  for (let offset = 0; offset < operations.length; offset += 300) {
    const batch = operations.slice(offset, offset + 300);
    await prisma.$transaction(
      batch.map((item) =>
        prisma.administrativeTransition.upsert({
          where: {
            fromUnitId_toUnitId_relationType: {
              fromUnitId: item.fromUnitId,
              toUnitId: item.toUnitId,
              relationType: item.relationType,
            },
          },
          update: { sourceId, notes: item.notes },
          create: { ...item, sourceId },
        }),
      ),
    );
    imported += batch.length;
  }
  return imported;
}

async function upsertTransitionSource() {
  const url =
    'https://danhmuchanhchinh.nso.gov.vn/TAPTIN/BangChuyendoiĐVHCmoi_cu_final.xlsx';
  const content = await readFile(join(dataDir, 'official-transition-map.xlsx'));
  const data = {
    name: 'Bảng chuyển đổi đơn vị hành chính mới–cũ',
    publisher: 'Cục Thống kê (NSO)',
    url,
    version: '2025-07-01',
    retrievedAt: new Date('2026-10-10T00:00:00.000+07:00'),
    effectiveFrom: new Date('2025-07-01T00:00:00.000+07:00'),
    license: null,
    coverage: 'Ánh xạ đơn vị hành chính trước và sau 01/07/2025',
    checksum: createHash('sha256').update(content).digest('hex'),
  };
  return prisma.dataSource.upsert({
    where: { key: 'nso-transition-2025-07-01' },
    update: data,
    create: { key: 'nso-transition-2025-07-01', ...data },
  });
}

async function main() {
  const validation = await validateAll();
  if (validation.errors.length) throw new Error(validation.errors.join('\n'));
  const current = await importDataset('current');
  const legacy = await importDataset('legacy');
  const transitionSource = await upsertTransitionSource();
  const transitions = await importTransitions(transitionSource.id);
  console.log(JSON.stringify({ current, legacy, transitions }, null, 2));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
