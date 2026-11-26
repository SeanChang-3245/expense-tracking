import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Sharing } from './api';
import type { Category } from './types';

export type AppCtx = {
  me: string;
  email: string;
  /** The signed-in user's own categories. */
  categories: Category[];
  byId: Map<string, Category>;
  reloadCategories: () => Promise<void>;
  sharing: Sharing;
  reloadSharing: () => Promise<void>;
  toast: (msg: string) => void;
};

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
