import type {
  UserResponse,
  LoginResponse,
  SessionResponse,
  SessionListResponse,
} from '@/types';
import { api, refreshSessionSingleFlight } from '@utils/api';

export type { UserResponse, LoginResponse, SessionResponse, SessionListResponse };

export const authService = {
  async checkStatus(): Promise<UserResponse | null> {
    try {
      return await api.get<UserResponse>('/auth/verify', undefined, {
        suppressAuthExpired: true,
      });
    } catch {
      return null;
    }
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    return api.post<LoginResponse>('/auth/login', { email, password }, undefined, {
      suppressAuthExpired: true,
    });
  },

  async refreshToken(): Promise<LoginResponse> {
    return refreshSessionSingleFlight();
  },

  async getSessions(): Promise<SessionListResponse> {
    return api.get<SessionListResponse>('/auth/sessions');
  },

  async revokeSession(familyId: string): Promise<void> {
    await api.delete(`/auth/sessions/${familyId}`);
  },

  async revokeOtherSessions(): Promise<void> {
    await api.post('/auth/sessions/revoke-others', {});
  },

  async register(email: string, password: string, confirmPassword: string): Promise<void> {
    await api.post('/auth/register', { email, password, confirm_password: confirmPassword });
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout', {}, undefined, {
        skipAuthRetry: true,
        suppressAuthExpired: true,
      });
    } catch {
      // Proceed with local cleanup even if the server request fails.
    }
  },

  async verifyEmail(token: string): Promise<void> {
    await api.get(`/auth/verify-email/${token}`, undefined, { suppressAuthExpired: true });
  },

  async resendVerification(email: string): Promise<void> {
    await api.post('/auth/resend-verification', { email });
  },

  async resetPassword(email: string): Promise<void> {
    await api.post('/auth/reset-password', { email });
  },
};
