import { create } from "axios";
import type {
  AddressMode,
  AdministrativeTransition,
  AdministrativeUnit,
  Street,
} from "./types";

const api = create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api",
  timeout: 15_000,
});

export const addressCatalogApi = {
  async provinces(mode: AddressMode) {
    const response = await api.get<AdministrativeUnit[]>(
      "/addresses/catalog/provinces",
      {
        params: { mode },
      },
    );
    return response.data;
  },

  async communes(provinceId: string) {
    const response = await api.get<AdministrativeUnit[]>(
      `/addresses/catalog/provinces/${provinceId}/communes`,
    );
    return response.data;
  },

  async legacyDistricts(provinceId: string) {
    const response = await api.get<AdministrativeUnit[]>(
      `/addresses/catalog/legacy/provinces/${provinceId}/districts`,
    );
    return response.data;
  },

  async legacyCommunes(districtId: string) {
    const response = await api.get<AdministrativeUnit[]>(
      `/addresses/catalog/legacy/districts/${districtId}/communes`,
    );
    return response.data;
  },

  async streets(communeId: string, query: string) {
    const response = await api.get<Street[]>("/addresses/catalog/streets", {
      params: { communeId, q: query },
    });
    return response.data;
  },

  async transitions(unitId: string) {
    const response = await api.get<AdministrativeTransition[]>(
      `/addresses/catalog/transitions/${unitId}`,
    );
    return response.data;
  },
};
