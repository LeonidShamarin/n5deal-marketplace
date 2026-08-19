import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-24 text-center">
      <SearchX className="mx-auto h-10 w-10 text-faint" aria-hidden />
      <h1 className="mt-4 text-[26px] font-bold text-ink">404 — Nothing here</h1>
      <p className="mt-2 text-[15px] text-muted">
        This page does not exist, or the listing it pointed to was never published.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/assets">
          <Button>Browse listings</Button>
        </Link>
      </div>
    </div>
  );
}
