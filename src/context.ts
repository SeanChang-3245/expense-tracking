import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Category } from './types';

export type AppCtx = {
  categories: Category[];
  byId: Map<string, Category>;
  reloadCategories: () => Promise<void>;
  toast: (msg: string) => void;
};

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
