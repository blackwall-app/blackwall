import type { Session, User } from "better-auth";
import { type Accessor, createContext, useContext } from "solid-js";

export type MaybeSessionContextType = Accessor<{
  session: Session;
  user: User;
} | null> | null;

export const MaybeSessionContext = createContext<MaybeSessionContextType>();

export const useMaybeSessionData = () => {
  const ctx = useContext(MaybeSessionContext);

  if (!ctx) {
    throw new Error("useMaybeSessionData called outside MaybeSessionContext.");
  }

  return ctx;
};
