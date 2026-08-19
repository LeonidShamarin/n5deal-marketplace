import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Rendered with a real HTTP 401 by `unauthorized()`. */
export default function Unauthorized() {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-24 text-center">
      <LogIn className="text-brand mx-auto h-10 w-10" aria-hidden />
      <h1 className="text-ink mt-4 text-[26px] font-bold">401 — Sign in first</h1>
      <p className="text-muted mt-2 text-[15px]">
        This page needs an account. If you were signed in a moment ago, the account may
        have been suspended — a suspended participant is treated as signed out on their
        next request.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/sign-in">
          <Button>Sign in</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Use a demo account</Button>
        </Link>
      </div>
    </div>
  );
}
