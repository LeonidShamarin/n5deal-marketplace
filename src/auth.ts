import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Auth.js v5, credentials + JWT.
 *
 * No database adapter on purpose. Sessions are JWTs, which means no session
 * table, no round trip per request, and — more to the point — no adapter code
 * running in the edge runtime. The trade-off is that the token can outlive a
 * change to the account, so `requireUser()` in `src/lib/session.ts` re-reads the
 * user from the database on every protected path. A suspended account is locked
 * out on its next request, not on its next sign-in.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/en/sign-in",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            passwordHash: true,
          },
        });

        // Compare against a dummy hash when the user is missing so that a wrong
        // email and a wrong password take the same time to answer.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const passwordOk = await compare(password, hash);

        if (!user || !passwordOk) return null;

        // A suspended or removed participant cannot sign in at all. This is the
        // first half of the rule; the second half is re-checked per request,
        // because a manager can suspend someone who is already signed in.
        if (user.status !== "ACTIVE") return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as Role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
});

/**
 * A real bcrypt hash of a value nobody can supply. Used only to keep the timing
 * of "no such user" indistinguishable from "wrong password".
 */
const DUMMY_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8eQ8i1V7q2vT2QK1zRZ0mZ6XxYnq7C";
