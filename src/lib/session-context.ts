import { createContext, useContext } from "react";
import type { Account } from "@/lib/api";

export type Session = {
  account: Account;
  /** AI buttons should show: the server has a model and this person wants AI. */
  ai: boolean;
  /** the server has a model set up, whatever this person's setting is. */
  aiAvailable: boolean;
  /** re-reads both after an admin or personal setting changes. */
  refreshFeatures: () => void;
  offline: boolean;
};

export const SessionContext = createContext<Session | null>(null);

export const useSession = () => {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession needs a signed-in page");
  return value;
};
