import { apiClient } from "@/services/api-client";
import type { UserRole, UserStatus } from "@/features/auth/types";

export type ManagedRole = Extract<UserRole, "USER" | "HOTEL_OWNER">;
export type AccountAction = "LOCK" | "UNLOCK" | "SUSPEND" | "RESTORE";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: ManagedRole;
  status: UserStatus;
  createdAt: string;
  lastSessionAt: string | null;
}

export interface AdminUserDetail extends AdminUser {
  updatedAt: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  activitySummary: {
    bookingCount: number;
    accommodationCount: number;
    lastSessionAt: string | null;
  };
  audit: {
    id: string;
    action: AccountAction;
    oldStatus: UserStatus;
    newStatus: UserStatus;
    reason: string;
    createdAt: string;
    actor: { id: string; fullName: string };
  }[];
}

export interface AdminUserQuery {
  search: string;
  role?: ManagedRole;
  status?: UserStatus;
  page: number;
  limit: number;
  sortBy: "createdAt" | "fullName" | "email" | "status";
  sortOrder: "asc" | "desc";
}

export interface AdminUserPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const adminUsersApi = {
  async list(query: AdminUserQuery) {
    const response = await apiClient.get<AdminUserPage>("/admin/users", {
      params: query,
    });
    return response.data;
  },
  async get(id: string) {
    const response = await apiClient.get<AdminUserDetail>(
      `/admin/users/${encodeURIComponent(id)}`,
    );
    return response.data;
  },
  async changeStatus(id: string, action: AccountAction, reason: string) {
    const response = await apiClient.patch<{
      id: string;
      status: UserStatus;
      auditId: string;
    }>(`/admin/users/${encodeURIComponent(id)}/${action.toLowerCase()}`, {
      reason,
    });
    return response.data;
  },
};
