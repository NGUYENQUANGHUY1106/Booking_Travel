export type CatalogMode = 'CURRENT' | 'LEGACY';
export type UnitLevel = 'PROVINCE' | 'DISTRICT' | 'COMMUNE';

export interface SourceMetadata {
  key: string;
  name: string;
  publisher: string;
  url: string;
  version: string;
  retrievedAt: string;
  effectiveFrom: string;
  license: string | null;
  coverage: string;
  checksum?: string;
  notes?: string;
}

export interface AdministrativeUnitRecord {
  code: string;
  name: string;
  normalizedName: string;
  level: UnitLevel;
  unitType:
    | 'PROVINCE'
    | 'MUNICIPALITY'
    | 'CITY'
    | 'URBAN_DISTRICT'
    | 'RURAL_DISTRICT'
    | 'TOWN'
    | 'WARD'
    | 'COMMUNE'
    | 'TOWNSHIP'
    | 'SPECIAL_ZONE'
    | 'UNKNOWN';
  catalogMode: CatalogMode;
  parentCode: string | null;
  validFrom: string;
  validTo: string | null;
  legalDocument: string | null;
}

export interface AdministrativeDataset {
  schemaVersion: 1;
  source: SourceMetadata;
  units: AdministrativeUnitRecord[];
}

export function normalizeVietnamese(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function inferUnitType(name: string, level: UnitLevel) {
  const normalized = normalizeVietnamese(name);
  if (level === 'PROVINCE') {
    return normalized.startsWith('thanh pho') ? 'MUNICIPALITY' : 'PROVINCE';
  }
  if (normalized.startsWith('quan')) return 'URBAN_DISTRICT';
  if (normalized.startsWith('huyen')) return 'RURAL_DISTRICT';
  if (normalized.startsWith('thi xa')) return 'TOWN';
  if (normalized.startsWith('thanh pho')) return 'CITY';
  if (normalized.startsWith('phuong')) return 'WARD';
  if (normalized.startsWith('thi tran')) return 'TOWNSHIP';
  if (normalized.startsWith('xa')) return 'COMMUNE';
  if (normalized.includes('dac khu')) return 'SPECIAL_ZONE';
  return 'UNKNOWN';
}
