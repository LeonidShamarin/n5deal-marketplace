import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Rendered with a real HTTP 403 by `forbidden()` from the auth-interrupts API.
 * Typing the URL of someone else's private page lands here rather than on a
 * page that quietly pretends the resource does not exist.
 */
export default function Forbidden() {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-24 text-center">
      <ShieldX className="text-danger mx-auto h-10 w-10" aria-hidden />
      <h1 className="text-ink mt-4 text-[26px] font-bold">403 — Not your resource</h1>
      <p className="text-muted mt-2 text-[15px]">
        You are signed in, but this page belongs to another participant or to a role you
        do not hold. The check runs on the server, so the link will not work by being
        reloaded.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/dashboard">
          <Button>Back to my dashboard</Button>
        </Link>
        <Link href="/assets">
          <Button variant="outline">Browse listings</Button>
        </Link>
      </div>
    </div>
  );
}
