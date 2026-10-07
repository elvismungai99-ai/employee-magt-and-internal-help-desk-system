import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, LoginPayload, RegisterPayload } from '../api/authApi';
import { 
  getStoredRefreshToken, 
  setAccessToken, 
  setStoredRefreshToken, 
  registerLogoutCallback 
} from '../api/client';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  roles: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload, rememberMe?: boolean) => Promise<void>;
  register: (payload: RegisterPayload, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole | string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clearAuthState = useCallback(() => {
    setAccessToken(null);
    setStoredRefreshToken(null);
    setUser(null);
    setRoles([]);
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await authApi.getCurrentUser();
      setUser(profile);
      setRoles(profile.roles || []);
    } catch (err) {
      console.error('Failed to load user profile', err);
      clearAuthState();
    }
  }, [clearAuthState]);

  // Initial load: Attempt session restoration if refresh token is present in sessionStorage
  useEffect(() => {
    registerLogoutCallback(() => {
      clearAuthState();
    });

    const initAuth = async () => {
      const storedRefreshToken = getStoredRefreshToken();
      if (storedRefreshToken) {
        try {
          const authData = await authApi.refresh(storedRefreshToken);
          setAccessToken(authData.accessToken);
          setStoredRefreshToken(authData.refreshToken);
          setRoles(authData.roles || []);
          await fetchProfile();
        } catch {
          clearAuthState();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [clearAuthState, fetchProfile]);

  const login = async (payload: LoginPayload, rememberMe: boolean = false) => {
    setIsLoading(true);
    try {
      const authData = await authApi.login(payload);
      setAccessToken(authData.accessToken);
      setStoredRefreshToken(authData.refreshToken, rememberMe);
      setRoles(authData.roles || []);
      
      // Fetch full profile details (department, manager, employeeCode)
      await fetchProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload, rememberMe: boolean = false) => {
    setIsLoading(true);
    try {
      // Backend registers account with PENDING_APPROVAL status for HR verification
      return await authApi.register(payload);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = getStoredRefreshToken();
    try {
      await authApi.logout(refreshToken);
    } finally {
      clearAuthState();
    }
  };

  const hasRole = (role: UserRole | string): boolean => {
    return roles.includes(role) || roles.includes(`ROLE_${role}`);
  };

  const hasAnyRole = (targetRoles: string[]): boolean => {
    return targetRoles.some((r) => hasRole(r));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasRole,
        hasAnyRole,
        refreshUserProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
