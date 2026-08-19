"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { DEMO_PASSWORD, DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { actionFail, actionOk, withAction, type ActionResult } from "@/lib/session";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

/**
 * Sign in with typed credentials.
 *
 * `redirect: false` keeps Auth.js from throwing a NEXT_REDIRECT that the form
 * cannot distinguish from a failure; the caller navigates once it has a result.
 */
export async function signInAction(
  _prev: ActionResult<{ redirectTo: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  return withAction(async () => {
    const parsed = signInSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        "Check the form.",
        z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      );
    }

    const { email, password } = parsed.data;
    const locale = String(formData.get("locale") ?? "en");

    // Distinguish "suspended" from "wrong password" for the message only. The
    // authorize() callback refuses both alike, so this leaks nothing an attacker
    // could not learn by trying the account before it was suspended.
    const existing = await db.user.findUnique({
      where: { email },
      select: { status: true },
    });

    try {
      await signIn("credentials", { email, password, redirect: false });
    } catch (error) {
      if (error instanceof AuthError) {
        if (existing && existing.status !== "ACTIVE") {
          return actionFail(
            "FORBIDDEN",
            existing.status === "SUSPENDED"
              ? "This account is suspended and cannot sign in."
              : "This account has been removed.",
          );
        }
        return actionFail("VALIDATION", "Wrong email or password.");
      }
      throw error;
    }

    return actionOk({ redirectTo: `/${locale}/dashboard` });
  });
}

/**
 * One-click sign-in for the seeded demo accounts.
 *
 * A reviewer should reach each role in a second rather than copy a password
 * between windows. The role is looked up in a fixed allow-list, so the action
 * cannot be coaxed into signing anyone in as an arbitrary email.
 */
export async function signInAsDemoAction(formData: FormData): Promise<void> {
  const roleKey = String(formData.get("role") ?? "");
  const locale = String(formData.get("locale") ?? "en");

  const account = DEMO_ACCOUNTS.find((a) => a.key === roleKey);
  if (!account) return;

  await signIn("credentials", {
    email: account.email,
    password: DEMO_PASSWORD,
    redirectTo: `/${locale}/dashboard`,
  });
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "en");
  await signOut({ redirectTo: `/${locale}` });
}
