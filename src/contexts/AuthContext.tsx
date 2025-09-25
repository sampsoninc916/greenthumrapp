import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef
} from 'react';
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
import { telemetryService } from '../services/telemetry';

// Configure Amplify once
configureAmplify();

export type UserRole = 'buyer' | 'seller' | 'admin';
type SignupRole = Exclude<UserRole, 'admin'>;

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (username: string, password: string, email: string, name: string, role: SignupRole) => Promise<void>;
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

  type AuthSessionResult = Awaited<ReturnType<typeof fetchAuthSession>>;

  const refreshTimeoutRef = useRef<number | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const refreshTokenRef = useRef<(() => Promise<void>) | null>(null);

  const extractRoleFromPayload = useCallback((payload: Record<string, any> | undefined): UserRole | null => {
    if (!payload) {
      return null;
    }
    const rawRole = (payload['custom:role'] ?? payload['role']) as string | undefined;
    if (rawRole === 'buyer' || rawRole === 'seller' || rawRole === 'admin') {
      return rawRole;
    }
    return null;
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const clearClientState = useCallback(() => {
    setUser(null);
    setToken(null);
    setRole(null);
    clearRefreshTimer();
    clearIdleTimer();
  }, [clearRefreshTimer, clearIdleTimer]);

  const ensureSecureSession = useCallback(async (session: AuthSessionResult) => {
    if (SECURITY_CONFIG.SESSION_STRATEGY !== 'token-exchange') {
      return true;
    }

    if (!SECURITY_CONFIG.TOKEN_EXCHANGE_ENDPOINT) {
      telemetryService.captureMessage(
        'Token exchange strategy selected but TOKEN_EXCHANGE_ENDPOINT is not configured.',
        {
          level: 'error',
          tags: {
            feature: 'auth',
            operation: 'token-exchange',
          },
        }
      );
      return false;
    }

    if (!session.tokens?.idToken) {
      return false;
    }

    try {
      const response = await fetch(SECURITY_CONFIG.TOKEN_EXCHANGE_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: session.tokens.idToken.toString(),
          accessToken: session.tokens.accessToken?.toString()
        })
      });

      if (!response.ok) {
        telemetryService.captureMessage('Token exchange endpoint responded with non-success status.', {
          level: 'error',
          tags: {
            feature: 'auth',
            operation: 'token-exchange',
          },
          extra: {
            status: response.status,
          },
        });
        return false;
      }

      return true;
    } catch (error) {
      telemetryService.captureException(error, {
        message: 'Failed to exchange Cognito tokens for secure session cookies',
        tags: {
          feature: 'auth',
          operation: 'token-exchange',
        },
      });
      return false;
    }
  }, []);

  const scheduleTokenRefresh = useCallback(
    (expiry?: number) => {
      if (!expiry) {
        return;
      }
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = (expiry - currentTime - SECURITY_CONFIG.TOKEN_REFRESH_BUFFER) * 1000;

      if (timeUntilExpiry <= 0) {
        if (refreshTokenRef.current) {
          void refreshTokenRef.current();
        }
        return;
      }

      clearRefreshTimer();
      refreshTimeoutRef.current = window.setTimeout(() => {
        if (refreshTokenRef.current) {
          void refreshTokenRef.current();
        }
      }, timeUntilExpiry);
    },
    [clearRefreshTimer]
  );

  const handleSessionUpdate = useCallback(
    async (session: AuthSessionResult, currentUser?: AuthUser | null) => {
      if (!session.tokens?.idToken) {
        throw new Error('Missing ID token in session');
      }

      const secureSessionOk = await ensureSecureSession(session);
      if (!secureSessionOk) {
        throw new Error('Unable to establish secure session');
      }

      if (currentUser) {
        setUser(currentUser);
      }

      const idToken = session.tokens.idToken.toString();
      setToken(idToken);
      setRole(extractRoleFromPayload(session.tokens.idToken.payload));
      scheduleTokenRefresh(session.tokens.idToken.payload?.exp);
    },
    [ensureSecureSession, extractRoleFromPayload, scheduleTokenRefresh]
  );

  const clearSecureSession = useCallback(async () => {
    if (SECURITY_CONFIG.SESSION_STRATEGY !== 'token-exchange') {
      return;
    }

    if (!SECURITY_CONFIG.SESSION_LOGOUT_ENDPOINT) {
      console.warn('SESSION_LOGOUT_ENDPOINT is not configured for token-exchange strategy.');
      return;
    }

    try {
      await fetch(SECURITY_CONFIG.SESSION_LOGOUT_ENDPOINT, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      telemetryService.captureException(error, {
        message: 'Failed to clear secure session cookie',
        tags: {
          feature: 'auth',
          operation: 'session-clear',
        },
      });
    }
  }, []);

  const performSignOut = useCallback(async () => {
    try {
      await signOut({ global: true });
    } catch (error) {
      telemetryService.captureException(error, {
        message: 'Global sign-out error',
        tags: {
          feature: 'auth',
          operation: 'signout',
        },
      });
    } finally {
      await clearSecureSession();
      clearClientState();
    }
  }, [clearClientState, clearSecureSession]);

  const handleIdleLogout = useCallback(async () => {
    console.warn('Idle timeout reached. Performing secure sign-out.');
    await performSignOut();
  }, [performSignOut]);

  const startIdleTimer = useCallback(() => {
    if (!SECURITY_CONFIG.IDLE_TIMEOUT_MS) {
      return;
    }

    clearIdleTimer();
    idleTimeoutRef.current = window.setTimeout(() => {
      void handleIdleLogout();
    }, SECURITY_CONFIG.IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, handleIdleLogout]);

  const loadUserSession = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      await handleSessionUpdate(session, currentUser);
    } catch (error) {
      console.warn('Failed to load authenticated session:', error);
      clearClientState();
      await clearSecureSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearClientState, clearSecureSession, handleSessionUpdate]);

  const refreshToken = useCallback(async () => {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      await handleSessionUpdate(session);
    } catch (error) {
      telemetryService.captureException(error, {
        message: 'Token refresh error',
        tags: {
          feature: 'auth',
          operation: 'token-refresh',
        },
      });
      await performSignOut();
    }
  }, [handleSessionUpdate, performSignOut]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  useEffect(() => {
    loadUserSession();
  }, [loadUserSession]);

  useEffect(() => {
    if (!SECURITY_CONFIG.IDLE_TIMEOUT_MS) {
      return;
    }

    if (!user) {
      clearIdleTimer();
      return;
    }

    startIdleTimer();
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'touchstart'];
    const activityHandler = () => startIdleTimer();

    events.forEach(event => window.addEventListener(event, activityHandler));

    return () => {
      events.forEach(event => window.removeEventListener(event, activityHandler));
      clearIdleTimer();
    };
  }, [user, startIdleTimer, clearIdleTimer]);

  useEffect(() => {
    return () => {
      clearRefreshTimer();
      clearIdleTimer();
    };
  }, [clearRefreshTimer, clearIdleTimer]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const { isSignedIn } = await signIn({ username, password });
      if (isSignedIn) {
        setIsLoading(true);
        await loadUserSession();
      }
    } catch (error) {
      telemetryService.captureException(error, {
        message: 'Login error',
        tags: {
          feature: 'auth',
          operation: 'login',
        },
      });
      throw error;
    }
  }, [loadUserSession]);

  const logout = useCallback(async () => {
    await performSignOut();
  }, [performSignOut]);

  const signup = useCallback(async (username: string, password: string, email: string, name: string, role: SignupRole) => {
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
      telemetryService.captureException(error, {
        message: 'Signup error',
        tags: {
          feature: 'auth',
          operation: 'signup',
        },
        extra: {
          username,
          role,
        },
      });
      throw error;
    }
  }, []);

  const confirmSignup = useCallback(async (username: string, code: string) => {
    try {
      await confirmSignUp({ username, confirmationCode: code });
    } catch (error) {
      telemetryService.captureException(error, {
        message: 'Confirmation error',
        tags: {
          feature: 'auth',
          operation: 'confirm-signup',
        },
        extra: {
          username,
        },
      });
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        await deleteUser();
        await clearSecureSession();
        clearClientState();
      }
    } catch (error) {
      telemetryService.captureException(error, {
        message: 'Error deleting user',
        tags: {
          feature: 'auth',
          operation: 'delete-account',
        },
      });
      throw error;
    }
  }, [clearClientState, clearSecureSession]);

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