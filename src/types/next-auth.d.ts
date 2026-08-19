import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Widen the session and the JWT so that `session.user.role` is typed everywhere
// instead of being cast at each call site.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

// The JWT interface has to be augmented on "@auth/core/jwt", not on
// "next-auth/jwt": the latter is a bare `export * from "@auth/core/jwt"`, so a
// declaration merged into it never reaches the interface the callbacks use, and
// `token.id` silently stays `unknown`.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

export {};
