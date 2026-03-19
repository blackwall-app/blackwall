import type { Session, User } from "better-auth";
import { type Accessor, createContext, useContext } from "solid-js";

export type SessionContextType = Accessor<{
  session: Session;
  user: User;
}>;

export const SessionContext = createContext<SessionContextType>();

export const useSessionData = () => {
  const ctx = useContext(SessionContext);

  if (!ctx) {
    throw new Error("useSessionData called outside SessionContext.");
  }

  return ctx;
};
