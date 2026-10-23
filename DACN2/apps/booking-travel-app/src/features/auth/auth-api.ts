import { isAxiosError } from 'axios';

import { apiClient } from '@/services/api-client';

import type { LoginInput, LoginResponse, RegisterInput, RegisterResponse, ResendVerificationResponse, VerifyOtpInput, VerifyOtpResponse } from './types';

interface ApiErrorBody {
  message?: string | string[];
}

export const authApi = {
  async login(input: LoginInput) {
    const response = await apiClient.post<LoginResponse>('/auth/login', input);
    return response.data;
  },

  async refresh(refreshToken: string) {
    const response = await apiClient.post<LoginResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },

  async register(input: RegisterInput) {
    const response = await apiClient.post<RegisterResponse>('/auth/register', input);
    return response.data;
  },

  async verify(input: VerifyOtpInput) {
    const response = await apiClient.post<VerifyOtpResponse>('/auth/verify', input);
    return response.data;
  },

  async resendVerification(verificationSessionId: string) {
    const response = await apiClient.post<ResendVerificationResponse>('/auth/resend-verification', { verificationSessionId });
    return response.data;
  },
};

export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (!isAxiosError<ApiErrorBody>(error)) return fallback;

  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string' && message.trim()) return message;
  if (!error.response) {
    return 'Không thể kết nối máy chủ. Hãy kiểm tra backend và địa chỉ mạng.';
  }
  if (error.response.status === 404) {
    return 'Không tìm thấy API xác thực. Hãy kiểm tra đúng cổng backend và khởi động lại ứng dụng.';
  }
  if (error.response.status >= 500) {
    return 'Máy chủ đang gặp lỗi. Hãy kiểm tra terminal backend.';
  }

  return fallback;
}
