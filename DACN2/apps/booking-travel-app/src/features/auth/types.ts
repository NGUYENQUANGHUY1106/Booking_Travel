export type UserRole = 'USER' | 'HOTEL_OWNER' | 'ADMIN';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'LOCKED' | 'SUSPENDED' | 'DISABLED';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface VerificationSession {
  verificationSessionId: string;
  channel: string;
  target: string;
  expiresAt: string;
  resendAvailableAt: string;
  deliveryStatus: string;
  sendCount?: number;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  tokenType: 'Bearer';
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
  sessionId: string;
  user: AuthUser;
}

export interface RegisterResponse {
  message: string;
  user: AuthUser;
  verification: VerificationSession;
  developmentOtp?: string;
}

export interface VerifyOtpInput {
  verificationSessionId: string;
  otp: string;
}

export interface VerifyOtpResponse {
  message: string;
  verified: boolean;
  user: AuthUser;
  verification: {
    verificationSessionId: string;
    channel: string;
    verifiedAt: string;
  };
}

export interface ResendVerificationResponse {
  message: string;
  verification: VerificationSession;
  developmentOtp?: string;
}
