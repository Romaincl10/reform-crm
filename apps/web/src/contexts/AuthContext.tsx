import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User } from '../api/client';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('reform_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('reform_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get<User>('/auth/me')
      .then(u => {
        setUser(u);
        localStorage.setItem('reform_user', JSON.stringify(u));
      })
      .catch(() => {
        localStorage.removeItem('reform_token');
        localStorage.removeItem('reform_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem('reform_token', token);
    localStorage.setItem('reform_user', JSON.stringify(user));
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('reform_token');
    localStorage.removeItem('reform_user');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
