import React, { createContext, useContext, useMemo, useState } from 'react';
import { User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInAnonymous: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading] = useState(false);

  const value = useMemo(
    () => ({
      user,
      loading,
      signInAnonymous: async () => {
        setUser({ id: 'demo-user', name: 'Guest User' });
      },
      signOut: async () => {
        setUser(null);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}