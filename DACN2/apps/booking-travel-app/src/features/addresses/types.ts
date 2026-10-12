export type AddressMode = "CURRENT" | "LEGACY";

export interface AdministrativeUnit {
  id: string;
  officialCode: string;
  name: string;
  level: "PROVINCE" | "DISTRICT" | "COMMUNE";
  unitType: string;
  catalogMode: AddressMode;
}

export interface Street {
  id: string;
  officialCode: string | null;
  name: string;
}

export interface AdministrativeTransition {
  id: string;
  relationType:
    "MERGED_INTO" | "SPLIT_INTO" | "RENAMED_TO" | "PARTIALLY_TRANSFERRED_TO";
  notes?: string | null;
  toUnit: AdministrativeUnit;
}

export interface AddressFormValue {
  mode: AddressMode;
  provinceUnitId: string;
  districtUnitId?: string;
  communeUnitId: string;
  streetId?: string;
  streetText?: string;
  addressLine: string;
  postalCode?: string;
}
