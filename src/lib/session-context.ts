import { createContext, useContext } from "react";
import type { Account } from "@/lib/api";

export type Session = {
  account: Account;
  ai: boolean;
  offline: boolean;
};

export const SessionContext = createContext<Session | null>(null);

export const useSession = () => {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession needs a signed-in page");
  return value;
};
