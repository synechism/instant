"use client";

import { db } from "@/lib/db";
import { authClient } from "@/lib/auth-client";
import { InstantAuth } from "better-auth-instantdb/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InstantAuth db={db} authClient={authClient} persistent />
      {children}
    </>
  );
}
