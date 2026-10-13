import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import ExcelJS from 'exceljs';
import {
  AdministrativeDataset,
  AdministrativeUnitRecord,
  inferUnitType,
  normalizeVietnamese,
} from './address-data.types';

const SERVICE_URL = 'https://danhmuchanhchinh.nso.gov.vn/DMDVHC.asmx';
const CONVERSION_URL =
  'https://danhmuchanhchinh.nso.gov.vn/TAPTIN/BangChuyendoiĐVHCmoi_cu_final.xlsx';
const OUTPUT_DIR = join(__dirname, '..', 'data', 'vietnam-address');
const RETRIEVED_AT = new Date().toISOString();

const decision19ProvinceBaseline: Array<[string, string]> = [
  ['01', 'Thành phố Hà Nội'],
  ['04', 'Tỉnh Cao Bằng'],
  ['08', 'Tỉnh Tuyên Quang'],
  ['11', 'Tỉnh Điện Biên'],
  ['12', 'Tỉnh Lai Châu'],
  ['14', 'Tỉnh Sơn La'],
  ['15', 'Tỉnh Lào Cai'],
  ['19', 'Tỉnh Thái Nguyên'],
  ['20', 'Tỉnh Lạng Sơn'],
  ['22', 'Tỉnh Quảng Ninh'],
  ['24', 'Tỉnh Bắc Ninh'],
  ['25', 'Tỉnh Phú Thọ'],
  ['31', 'Thành phố Hải Phòng'],
  ['33', 'Tỉnh Hưng Yên'],
  ['37', 'Tỉnh Ninh Bình'],
  ['38', 'Tỉnh Thanh Hóa'],
  ['40', 'Tỉnh Nghệ An'],
  ['42', 'Tỉnh Hà Tĩnh'],
  ['44', 'Tỉnh Quảng Trị'],
  ['46', 'Thành phố Huế'],
  ['48', 'Thành phố Đà Nẵng'],
  ['51', 'Tỉnh Quảng Ngãi'],
  ['52', 'Tỉnh Gia Lai'],
  ['56', 'Tỉnh Khánh Hòa'],
  ['66', 'Tỉnh Đắk Lắk'],
  ['68', 'Tỉnh Lâm Đồng'],
  ['75', 'Tỉnh Đồng Nai'],
  ['79', 'Thành phố Hồ Chí Minh'],
  ['80', 'Tỉnh Tây Ninh'],
  ['82', 'Tỉnh Đồng Tháp'],
  ['86', 'Tỉnh Vĩnh Long'],
  ['91', 'Tỉnh An Giang'],
  ['92', 'Thành phố Cần Thơ'],
  ['96', 'Tỉnh Cà Mau'],
];

const parser = new XMLParser({ removeNSPrefix: true, trimValues: true });

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function soap(method: string, parameters: Record<string, string>) {
  const bodyParameters = Object.entries(parameters)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join('');
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method} xmlns="http://tempuri.org/">${bodyParameters}</${method}></soap:Body></soap:Envelope>`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(SERVICE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'text/xml; charset=utf-8',
          SOAPAction: `http://tempuri.org/${method}`,
        },
        body,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(
          `${method} ${JSON.stringify(parameters)}: HTTP ${response.status}`,
        );
      }
      const parsed = parser.parse(await response.text());
      const rows: Record<string, unknown>[] = [];
      collectRows(parsed, rows);
      return rows;
    } catch (error) {
      lastError = error;
      if (attempt < 5)
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

function collectRows(value: unknown, rows: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRows(item, rows));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if ('MaTinh' in record || 'MaQuanHuyen' in record || 'MaPhuongXa' in record) {
    rows.push(record);
    return;
  }
  Object.values(record).forEach((item) => collectRows(item, rows));
}

function text(row: Record<string, unknown>, ...keys: string[]) {
  const key = keys.find((candidate) => row[candidate] != null);
  return key ? String(row[key]).trim() : '';
}

function nameWithoutType(name: string) {
  return name.replace(/^(Tỉnh|Thành phố)\s+/iu, '').trim();
}

function unit(
  row: Record<string, unknown>,
  level: AdministrativeUnitRecord['level'],
  mode: AdministrativeUnitRecord['catalogMode'],
  parentCode: string | null,
  validFrom: string,
  validTo: string | null,
): AdministrativeUnitRecord {
  const codeKeys =
    level === 'PROVINCE'
      ? ['MaTinh']
      : level === 'DISTRICT'
        ? ['MaQuanHuyen', 'MaHuyen']
        : ['MaPhuongXa', 'MaXa'];
  const nameKeys =
    level === 'PROVINCE'
      ? ['TenTinh']
      : level === 'DISTRICT'
        ? ['TenQuanHuyen', 'TenHuyen']
        : ['TenPhuongXa', 'TenXa'];
  const codeWidth = level === 'PROVINCE' ? 2 : level === 'DISTRICT' ? 3 : 5;
  const code = text(row, ...codeKeys).padStart(codeWidth, '0');
  const name = text(row, ...nameKeys);
  if (!code || !name)
    throw new Error(`Invalid ${level} row: ${JSON.stringify(row)}`);
  return {
    code,
    name,
    normalizedName: normalizeVietnamese(name),
    level,
    unitType: inferUnitType(name, level),
    catalogMode: mode,
    parentCode,
    validFrom,
    validTo,
    legalDocument:
      text(row, 'NghiDinh', 'NghiQuyet', 'VanBan', 'SoQuyetDinh') || null,
  };
}

async function pooled<T, R>(
  items: T[],
  worker: (item: T) => Promise<R[]>,
  concurrency = 10,
) {
  const output: R[] = [];
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output.push(...(await worker(items[index])));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run),
  );
  return output;
}

async function fetchCurrent(): Promise<AdministrativeDataset> {
  const snapshotDate = '10/10/2026';
  const validFrom = '2026-10-10T00:00:00.000+07:00';
  const provinceRows = await soap('DanhMucTinh', { DenNgay: snapshotDate });
  const provinces = provinceRows.map((row) =>
    unit(row, 'PROVINCE', 'CURRENT', null, validFrom, null),
  );
  const baselineCodes = new Set(
    decision19ProvinceBaseline.map(([code]) => code),
  );
  if (
    provinces.length !== baselineCodes.size ||
    provinces.some((province) => !baselineCodes.has(province.code))
  ) {
    throw new Error(
      'Current province codes differ from the Decision 19 baseline; review the legal changes before importing.',
    );
  }
  const communes = await pooled(provinces, async (province) => {
    const rows = await soap('DanhMucPhuongXa', {
      DenNgay: snapshotDate,
      Tinh: province.code,
      TenTinh: province.name,
      QuanHuyen: '',
      TenQuanHuyen: '',
    });
    return rows.map((row) =>
      unit(row, 'COMMUNE', 'CURRENT', province.code, validFrom, null),
    );
  });
  return {
    schemaVersion: 1,
    source: {
      key: 'nso-current-2026-10-10',
      name: 'Danh mục đơn vị hành chính Việt Nam hiện hành',
      publisher: 'Cục Thống kê (NSO)',
      url: SERVICE_URL,
      version: '2026-10-10',
      retrievedAt: RETRIEVED_AT,
      effectiveFrom: validFrom,
      license: null,
      coverage: '34 tỉnh/thành và đơn vị hành chính cấp xã, mô hình hai cấp',
      notes:
        'Snapshot NSO tại 10/10/2026; bao gồm thay đổi loại hình cấp tỉnh có hiệu lực sau Quyết định 19/2025/QĐ-TTg.',
    },
    units: [...provinces, ...communes],
  };
}

async function fetchLegacy(): Promise<AdministrativeDataset> {
  const date = '30/06/2025';
  const validFrom = '1991-08-12T00:00:00.000+07:00';
  const validTo = '2025-06-30T23:59:59.999+07:00';
  const provinceRows = await soap('DanhMucTinh', { DenNgay: date });
  const provinces = provinceRows.map((row) =>
    unit(row, 'PROVINCE', 'LEGACY', null, validFrom, validTo),
  );
  const districts = await pooled(provinces, async (province) => {
    let rows = await soap('DanhMucQuanHuyen', {
      DenNgay: date,
      Tinh: '',
      TenTinh: nameWithoutType(province.name),
    });
    // NSO currently returns no 30/06/2025 district rows for former Bắc Giang.
    // Fall back to the last pre-reform year-end snapshot only when a province is empty.
    if (rows.length === 0) {
      rows = await soap('DanhMucQuanHuyen', {
        DenNgay: '31/12/2024',
        Tinh: '',
        TenTinh: nameWithoutType(province.name),
      });
    }
    return rows.map((row) =>
      unit(row, 'DISTRICT', 'LEGACY', province.code, validFrom, validTo),
    );
  });
  const communes = await pooled(districts, async (district) => {
    const rows = await soap('DanhMucPhuongXa', {
      DenNgay: date,
      Tinh: '',
      TenTinh: '',
      QuanHuyen: district.code,
      TenQuanHuyen: '',
    });
    return rows.map((row) =>
      unit(row, 'COMMUNE', 'LEGACY', district.code, validFrom, validTo),
    );
  });
  return {
    schemaVersion: 1,
    source: {
      key: 'nso-legacy-2025-06-30',
      name: 'Danh mục đơn vị hành chính Việt Nam trước mô hình hai cấp',
      publisher: 'Cục Thống kê (NSO)',
      url: SERVICE_URL,
      version: '2025-06-30',
      retrievedAt: RETRIEVED_AT,
      effectiveFrom: validFrom,
      license: null,
      coverage:
        'Tỉnh/thành, quận/huyện/thị xã/thành phố và phường/xã/thị trấn tại 30/06/2025',
      notes:
        'NSO không trả cấp huyện của Bắc Giang tại truy vấn 30/06/2025; pipeline dùng snapshot 31/12/2024 cho riêng cấp huyện này và vẫn truy vấn cấp xã tại 30/06/2025.',
    },
    units: [...provinces, ...districts, ...communes],
  };
}

function validate(dataset: AdministrativeDataset) {
  const seen = new Set<string>();
  const all = new Set(
    dataset.units.map(
      (item) => `${item.catalogMode}:${item.level}:${item.code}`,
    ),
  );
  for (const item of dataset.units) {
    const key = `${item.catalogMode}:${item.level}:${item.code}`;
    if (seen.has(key)) throw new Error(`Duplicate unit ${key}`);
    seen.add(key);
    if (item.parentCode) {
      const parentLevel =
        item.level === 'COMMUNE' && item.catalogMode === 'CURRENT'
          ? 'PROVINCE'
          : item.level === 'COMMUNE'
            ? 'DISTRICT'
            : 'PROVINCE';
      if (!all.has(`${item.catalogMode}:${parentLevel}:${item.parentCode}`)) {
        throw new Error(
          `Orphan unit ${key}; parent ${item.parentCode} is missing`,
        );
      }
    }
  }
}

function spreadsheetText(value: ExcelJS.CellValue | undefined) {
  return value == null ? '' : String(value).trim();
}

function spreadsheetCode(value: ExcelJS.CellValue | undefined, width: number) {
  const digits = spreadsheetText(value).replace(/\.0$/, '').replace(/\D/g, '');
  return digits ? digits.padStart(width, '0') : '';
}

function namedCode(value: ExcelJS.CellValue | undefined, width: number) {
  const match = spreadsheetText(value).match(/^(.*?)\s*\((\d+)\)\s*$/);
  return match
    ? { name: match[1].trim(), code: match[2].padStart(width, '0') }
    : null;
}

async function augmentLegacyFromTransitionWorkbook(
  legacy: AdministrativeDataset,
  workbookBuffer: Buffer,
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer as unknown as ExcelJS.Buffer);
  const sheet =
    workbook.getWorksheet('Tổng hợp_không merge ') ?? workbook.worksheets[1];
  if (!sheet) throw new Error('Transition worksheet not found.');
  const provinceCodes = new Set(
    legacy.units
      .filter((item) => item.level === 'PROVINCE')
      .map((item) => item.code),
  );
  const districtCodes = new Set(
    legacy.units
      .filter((item) => item.level === 'DISTRICT')
      .map((item) => item.code),
  );
  const communeCodes = new Set(
    legacy.units
      .filter((item) => item.level === 'COMMUNE')
      .map((item) => item.code),
  );
  const validFrom = '1991-08-12T00:00:00.000+07:00';
  const validTo = '2025-06-30T23:59:59.999+07:00';

  for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = sheet.getRow(rowNumber).values as ExcelJS.CellValue[];
    const province = namedCode(values[8], 2);
    const district = namedCode(values[7], 3);
    const oldCodeRaw = spreadsheetText(values[5])
      .replace(/\.0$/, '')
      .replace(/\D/g, '');
    const oldName = spreadsheetText(values[4]);
    if (!province || !provinceCodes.has(province.code)) continue;
    if (district && !districtCodes.has(district.code)) {
      legacy.units.push(
        unit(
          { MaQuanHuyen: district.code, TenQuanHuyen: district.name },
          'DISTRICT',
          'LEGACY',
          province.code,
          validFrom,
          validTo,
        ),
      );
      districtCodes.add(district.code);
    }
    if (oldCodeRaw.length > 3 && oldName && district) {
      const oldCode = spreadsheetCode(values[5], 5);
      if (!communeCodes.has(oldCode)) {
        legacy.units.push(
          unit(
            { MaPhuongXa: oldCode, TenPhuongXa: oldName },
            'COMMUNE',
            'LEGACY',
            district.code,
            validFrom,
            validTo,
          ),
        );
        communeCodes.add(oldCode);
      }
    }
  }
}

async function saveJson(name: string, dataset: AdministrativeDataset) {
  const content = `${JSON.stringify(dataset, null, 2)}\n`;
  dataset.source.checksum = createHash('sha256').update(content).digest('hex');
  await writeFile(
    join(OUTPUT_DIR, name),
    `${JSON.stringify(dataset, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const [current, legacy, conversionResponse] = await Promise.all([
    fetchCurrent(),
    fetchLegacy(),
    fetch(CONVERSION_URL, { signal: AbortSignal.timeout(60_000) }),
  ]);
  if (!conversionResponse.ok)
    throw new Error(`Conversion workbook: HTTP ${conversionResponse.status}`);
  const conversionBuffer = Buffer.from(await conversionResponse.arrayBuffer());
  await augmentLegacyFromTransitionWorkbook(legacy, conversionBuffer);
  validate(current);
  validate(legacy);
  await Promise.all([
    saveJson('current.json', current),
    saveJson('legacy.json', legacy),
    writeFile(
      join(OUTPUT_DIR, 'official-transition-map.xlsx'),
      conversionBuffer,
    ),
  ]);
  console.log(
    `Current: ${current.units.length} units; legacy: ${legacy.units.length} units.`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
