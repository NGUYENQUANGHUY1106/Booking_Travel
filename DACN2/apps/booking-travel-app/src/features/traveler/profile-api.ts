import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import type { UserRole, UserStatus } from "@/features/auth";
import { apiClient } from "@/services/api-client";

export type ProfileGender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

export interface UserProfile {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  gender: ProfileGender | null;
  nationality: string | null;
  address: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: ProfileGender | null;
  nationality?: string | null;
  address?: string | null;
}

interface AvatarUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
  contentType: string;
}

interface ApiErrorBody {
  message?: string | string[];
}

export const profileQueryKey = (userId: string) => ["user-profile", userId] as const;

export const profileApi = {
  async getMine() {
    const response = await apiClient.get<UserProfile>("/users/me");
    return response.data;
  },

  async updateMine(input: UpdateProfileInput) {
    const response = await apiClient.patch<UserProfile>("/users/me", input);
    return response.data;
  },

  async uploadAvatarAsset(asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number;
  }) {
    const contentType = asset.mimeType ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      throw new Error("Ảnh đại diện chỉ hỗ trợ JPEG, PNG hoặc WebP.");
    }
    const fileResponse = await fetch(asset.uri);
    const blob = await fileResponse.blob();
    const sizeBytes = asset.fileSize ?? blob.size;
    const response = await apiClient.post<AvatarUploadResponse>(
      "/users/me/avatar-upload",
      {
        fileName: asset.fileName ?? `avatar-${Date.now()}`,
        contentType,
        sizeBytes,
      },
    );
    const upload = await fetch(response.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!upload.ok)
      throw new Error("Không thể tải ảnh đại diện lên kho lưu trữ.");

    return response.data.publicUrl;
  },
};

export function useMyProfile(userId?: string) {
  return useQuery({
    queryKey: profileQueryKey(userId ?? ""),
    queryFn: profileApi.getMine,
    enabled: Boolean(userId),
    refetchOnMount: "always",
  });
}

export function useUpdateMyProfile(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileApi.updateMine,
    onSuccess: (profile) =>
      queryClient.setQueryData(profileQueryKey(userId ?? profile.id), profile),
  });
}

export function getProfileErrorMessage(error: unknown, fallback: string) {
  if (!isAxiosError<ApiErrorBody>(error)) return fallback;
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join("\n");
  if (typeof message === "string" && message.trim()) return message;
  if (!error.response)
    return "Không thể kết nối máy chủ. Hãy kiểm tra backend và mạng.";
  if (error.response.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  return fallback;
}
