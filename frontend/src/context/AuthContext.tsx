import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

const API = 'http://localhost:8000';

export interface AuthUser {
  id:           number;
  email:        string;
  display_name: string | null;
}

interface AuthCtx {
  user:     AuthUser | null;
  token:    string | null;
  loading:  boolean;
  login:    (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout:   () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(() => localStorage.getItem('insightai_token'));
  const [loading, setLoading] = useState(true);   // true while validating stored token

  // ── Axios default header ──────────────────────────────────────────────────
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // ── Validate stored token on mount ────────────────────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem('insightai_token');
    if (!storedToken) { setLoading(false); return; }

    axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    axios.get<AuthUser>(`${API}/api/auth/me`)
      .then(res => {
        setUser(res.data);
        setToken(storedToken);
      })
      .catch(() => {
        // Token expired or invalid — clear it
        localStorage.removeItem('insightai_token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);

    const res = await axios.post(`${API}/api/auth/login`, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { access_token, user_id, email: userEmail, display_name } = res.data;

    localStorage.setItem('insightai_token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser({ id: user_id, email: userEmail, display_name });
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const register = async (email: string, password: string, displayName?: string) => {
    await axios.post(`${API}/api/auth/register`, {
      email, password, display_name: displayName,
    });
    // Do not set token or user to force manual login after registration.
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem('insightai_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
