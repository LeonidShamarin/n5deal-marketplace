import { cache } from "react";
import { forbidden, unauthorized } from "next/navigation";
import type { Role, UserStatus } from "@prisma/client";

import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * The authorisation layer.
 *
 * Hiding a button is presentation; this file is the enforcement. Every page and
 * every server action that touches non-public data starts here, so the answer to
 * "what happens if someone types the URL by hand" is the same as the answer to
 * "what happens if they click the button": the check runs either way.
 *
 * The JWT is trusted for identity only. Role and account status are re-read from
 * the database on each request, because a manager can suspend an account that is
 * already holding a valid token — and a token cannot be revoked.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
};

/**
 * `cache` deduplicates the lookup within one request: a layout, a page and three
 * components all calling this hit the database once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  // Suspended and removed accounts are treated as signed out from here on. Their
  // token is still cryptographically valid, which is exactly why the status has
  // to be checked here rather than at sign-in only.
  if (!user || user.status !== "ACTIVE") return null;

  return user;
});

/** Signed in, or a real 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) unauthorized();
  return user;
}

/** Signed in with one of the given roles, or a real 403. */
export async function requireRole<R extends Role>(
  ...roles: readonly R[]
): Promise<SessionUser & { role: R }> {
  const user = await requireUser();
  if (!roles.includes(user.role as R)) forbidden();
  return user as SessionUser & { role: R };
}

// ---------------------------------------------------------------------------
// The same checks for server actions, which must not throw navigation errors
// ---------------------------------------------------------------------------

/**
 * Server actions return a result object rather than interrupting navigation, so
 * that the form can show the message inline. `forbidden()` inside an action would
 * surface as an unhandled error in the client, not as a 403 page.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError; message: string; fieldErrors?: Record<string, string[]> };

export type ActionError =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "GONE"
  | "VALIDATION"
  | "CONFLICT";

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(
  error: ActionError,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, message, fieldErrors };
}

/**
 * Thrown by the action guards and converted to an `ActionResult` by
 * `withAction`, which keeps every action body free of try/catch boilerplate.
 */
export class ActionAbort extends Error {
  constructor(
    readonly code: ActionError,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ActionAbort";
  }
}

export function abort(
  code: ActionError,
  message: string,
  fieldErrors?: Record<string, string[]>,
): never {
  throw new ActionAbort(code, message, fieldErrors);
}

/** Signed in, for use inside a server action. */
export async function requireActionUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) abort("UNAUTHENTICATED", "You need to sign in to do that.");
  return user;
}

/** Signed in with one of the given roles, for use inside a server action. */
export async function requireActionRole<R extends Role>(
  ...roles: readonly R[]
): Promise<SessionUser & { role: R }> {
  const user = await requireActionUser();
  if (!roles.includes(user.role as R)) {
    abort("FORBIDDEN", "Your role does not allow this action.");
  }
  return user as SessionUser & { role: R };
}

/**
 * Wraps an action body so that an `ActionAbort` becomes a typed failure result
 * and anything unexpected becomes a generic one — without ever leaking a stack
 * trace or a database error message to the browser.
 *
 * Control-flow errors are re-thrown untouched: Next signals redirect() and
 * notFound() by throwing, and swallowing those would break navigation.
 */
export async function withAction<T>(
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ActionAbort) {
      return actionFail(error.code, error.message, error.fieldErrors);
    }
    if (isNextControlFlowError(error)) throw error;

    console.error("[action] unhandled error", error);
    return actionFail("CONFLICT", "Something went wrong. Please try again.");
  }
}

function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}
