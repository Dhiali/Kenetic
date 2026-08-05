export type AppTheme = 'light' | 'dark';

export type User = {
  id: string;
  name: string;
  email?: string;
};

export type Habit = {
  id: string;
  title: string;
  streak: number;
  completedToday?: boolean;
};
