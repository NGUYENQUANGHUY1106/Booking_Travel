import { apiClient } from "@/services/api-client";
import type {
  AddressMode,
  AdministrativeTransition,
  AdministrativeUnit,
  Street,
} from "./types";

export const addressCatalogApi = {
  async provinces(mode: AddressMode) {
    const response = await apiClient.get<AdministrativeUnit[]>(
      "/addresses/catalog/provinces",
      {
        params: { mode },
      },
    );
    return response.data;
  },

  async communes(provinceId: string) {
    const response = await apiClient.get<AdministrativeUnit[]>(
      `/addresses/catalog/provinces/${provinceId}/communes`,
    );
    return response.data;
  },

  async legacyDistricts(provinceId: string) {
    const response = await apiClient.get<AdministrativeUnit[]>(
      `/addresses/catalog/legacy/provinces/${provinceId}/districts`,
    );
    return response.data;
  },

  async legacyCommunes(districtId: string) {
    const response = await apiClient.get<AdministrativeUnit[]>(
      `/addresses/catalog/legacy/districts/${districtId}/communes`,
    );
    return response.data;
  },

  async streets(communeId: string, query: string) {
    const response = await apiClient.get<Street[]>(
      "/addresses/catalog/streets",
      {
        params: { communeId, q: query },
      },
    );
    return response.data;
  },

  async transitions(unitId: string) {
    const response = await apiClient.get<AdministrativeTransition[]>(
      `/addresses/catalog/transitions/${unitId}`,
    );
    return response.data;
  },
};
