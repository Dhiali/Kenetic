import React, { createContext, useContext, useMemo, useState } from 'react';

type LocationContextValue = {
  location: string | null;
  setLocation: (location: string | null) => void;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<string | null>(null);

  const value = useMemo(() => ({ location, setLocation }), [location]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error('useLocation must be used inside LocationProvider');
  }

  return context;
}
