import { apiClient } from '@/services/api-client';

export type OwnerReviewStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type OwnerDocumentPurpose = 'IDENTITY' | 'BUSINESS_LICENSE';
export type OwnerReviewQuery = {
  search?: string;
  status?: OwnerReviewStatus;
  page: number;
  limit: number;
  sortBy: 'submittedAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
};
export type OwnerReviewItem = {
  id: string;
  status: OwnerReviewStatus;
  version: number;
  businessName: string | null;
  submittedAt: string | null;
  updatedAt: string;
  user: { id: string; fullName: string; email: string | null; phone: string | null };
};
export type OwnerReviewPage = {
  items: OwnerReviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { pending: number; verified: number; rejected: number; suspended: number };
};
export type OwnerReviewDocument = {
  id: string;
  purpose: OwnerDocumentPurpose;
  status: 'RESERVED' | 'READY';
  mimeType: string;
  expectedSize: number;
  verifiedAt: string | null;
  createdAt: string;
};
export type OwnerReviewDetail = OwnerReviewItem & {
  userId: string;
  revision: number;
  businessAddress: string | null;
  representativeName: string | null;
  businessRegistrationNumber: string | null;
  businessPhone: string | null;
  createdAt: string;
  reviewedAt: string | null;
  approvalNote: string | null;
  rejectionReason: string | null;
  reviewedBy: { id: string; fullName: string } | null;
  user: OwnerReviewItem['user'] & {
    role: 'USER' | 'HOTEL_OWNER';
    status: string;
    emailVerifiedAt: string | null;
    phoneVerifiedAt: string | null;
  };
  identityDocument: OwnerReviewDocument | null;
  businessLicenseDocument: OwnerReviewDocument | null;
  auditTrail: {
    id: string; action: string; oldStatus: OwnerReviewStatus; newStatus: OwnerReviewStatus;
    reason: string | null; version: number; createdAt: string;
    actor: { id: string; fullName: string };
  }[];
};

export const ownerVerificationApi = {
  async list(query: OwnerReviewQuery) {
    return (await apiClient.get<OwnerReviewPage>('/admin/owner-applications', { params: query })).data;
  },
  async detail(id: string) {
    return (await apiClient.get<OwnerReviewDetail>(`/admin/owner-applications/${encodeURIComponent(id)}`)).data;
  },
  async documentAccess(id: string, purpose: OwnerDocumentPurpose) {
    return (await apiClient.get<{ accessUrl: string; expiresIn: number; mimeType: string }>(`/admin/owner-applications/${encodeURIComponent(id)}/documents/${purpose}/access`)).data;
  },
  async decide(id: string, decision: 'APPROVE' | 'REJECT', expectedVersion: number, reason?: string) {
    return (await apiClient.post<{ id: string; status: OwnerReviewStatus; version: number; reviewedAt: string; auditId: string }>(
      `/admin/owner-applications/${encodeURIComponent(id)}/decision`,
      { decision, expectedVersion, ...(reason ? { reason } : {}) },
    )).data;
  },
};
