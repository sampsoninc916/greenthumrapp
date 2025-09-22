import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  signUp,
  confirmSignUp,
  AuthUser,
  deleteUser
} from 'aws-amplify/auth';
import { configureAmplify, SECURITY_CONFIG } from '../config/amplify';

// Configure Amplify once
configureAmplify();

type UserRole = 'buyer' | 'seller';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (username: string, password: string, email: string, name: string, role: UserRole) => Promise<void>;
  confirmSignup: (username: string, code: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  role: UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  const storage = SECURITY_CONFIG.TOKEN_STORAGE === 'local' ? localStorage : sessionStorage;

  const extractRoleFromPayload = (payload: Record<string, any> | undefined): UserRole | null => {
    if (!payload) {
      return null;
    }
    const rawRole = (payload['custom:role'] ?? payload['role']) as string | undefined;
    if (rawRole === 'buyer' || rawRole === 'seller') {
      return rawRole;
    }
    return null;
  };

  const loadUserSession = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      if (session.tokens?.idToken) {
        setUser(currentUser);
        setToken(session.tokens.idToken.toString());
        setRole(extractRoleFromPayload(session.tokens.idToken.payload));

        // Store token in sessionStorage for better security
        storage.setItem('authToken', session.tokens.idToken.toString());

        // Set up token refresh before expiry
        const expiryTime = session.tokens.idToken.payload.exp;
        if (expiryTime && typeof expiryTime === 'number') {
          const currentTime = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = (expiryTime - currentTime - SECURITY_CONFIG.TOKEN_REFRESH_BUFFER) * 1000;
          
          if (timeUntilExpiry > 0) {
            setTimeout(() => refreshToken(), timeUntilExpiry);
          }
        }
      }
    } catch (error) {
      // User is not authenticated
      setUser(null);
      setToken(null);
      setRole(null);
      storage.removeItem('authToken');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserSession();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const { isSignedIn } = await signIn({ username, password });
      if (isSignedIn) {
        await loadUserSession();
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      setToken(null);
      setRole(null);
      storage.removeItem('authToken');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const signup = async (username: string, password: string, email: string, name: string, role: UserRole) => {
    try {
      await signUp({
        username,
        password,
        options: {
          userAttributes: {
            preferred_username: username,
            email,
            name,
            'custom:role': role
          }
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const confirmSignup = async (username: string, code: string) => {
    try {
      await confirmSignUp({ username, confirmationCode: code });
    } catch (error) {
      console.error('Confirmation error:', error);
      throw error;
    }
  };

  const refreshToken = async () => {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      if (session.tokens?.idToken) {
        setToken(session.tokens.idToken.toString());
        setRole(extractRoleFromPayload(session.tokens.idToken.payload));
        storage.setItem('authToken', session.tokens.idToken.toString());

        // Set up next refresh
        const expiryTime = session.tokens.idToken.payload.exp;
        if (expiryTime && typeof expiryTime === 'number') {
          const currentTime = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = (expiryTime - currentTime - SECURITY_CONFIG.TOKEN_REFRESH_BUFFER) * 1000;
          
          if (timeUntilExpiry > 0) {
            setTimeout(() => refreshToken(), timeUntilExpiry);
          }
        }
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, log the user out
      await logout();
    }
  };

  const deleteAccount = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        await deleteUser();
        setUser(null);
        setToken(null);
        setRole(null);
        storage.removeItem('authToken');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    signup,
    confirmSignup,
    refreshToken,
    deleteAccount,
    role
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};