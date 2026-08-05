import React, { createContext, useContext, useMemo, useState } from 'react';
import { Habit } from '../types';

type HabitContextValue = {
  habits: Habit[];
  setHabits: (habits: Habit[]) => void;
};

const HabitContext = createContext<HabitContextValue | undefined>(undefined);

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);

  const value = useMemo(() => ({ habits, setHabits }), [habits]);

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>;
}

export function useHabits() {
  const context = useContext(HabitContext);

  if (!context) {
    throw new Error('useHabits must be used inside HabitProvider');
  }

  return context;
}
