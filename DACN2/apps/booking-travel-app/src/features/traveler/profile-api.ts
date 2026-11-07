import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

import type { UserRole, UserStatus } from "@/features/auth";
import { apiClient } from "@/services/api-client";
import { absoluteMediaUrl } from "@/services/media-url";

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

  async uploadAvatarAsset(asset: ImagePickerAsset) {
    const contentType = asset.mimeType ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      throw new Error("Ảnh đại diện chỉ hỗ trợ JPEG, PNG hoặc WebP.");
    }
    const sizeBytes =
      asset.fileSize ??
      (Platform.OS === "web" ? asset.file?.size : new File(asset.uri).size);
    if (!sizeBytes || sizeBytes > 5 * 1024 * 1024) {
      throw new Error("Ảnh đại diện không được vượt quá 5 MB.");
    }
    const response = await apiClient.post<AvatarUploadResponse>(
      "/users/me/avatar-upload",
      {
        fileName: asset.fileName ?? `avatar-${Date.now()}`,
        contentType,
        sizeBytes,
      },
    );
    const uploadUrl = absoluteMediaUrl(response.data.uploadUrl);
    if (Platform.OS === "web") {
      if (!asset.file) throw new Error("Không thể đọc ảnh đã chọn.");
      const upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: asset.file,
      });
      if (!upload.ok)
        throw new Error("Không thể tải ảnh đại diện lên kho lưu trữ.");
    } else {
      const upload = await FileSystem.uploadAsync(uploadUrl, asset.uri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": contentType },
      });
      if (upload.status < 200 || upload.status >= 300)
        throw new Error("Không thể tải ảnh đại diện lên kho lưu trữ.");
    }

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
