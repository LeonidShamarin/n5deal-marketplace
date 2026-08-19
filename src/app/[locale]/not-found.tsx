import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-24 text-center">
      <SearchX className="text-faint mx-auto h-10 w-10" aria-hidden />
      <h1 className="text-ink mt-4 text-[26px] font-bold">404 — Nothing here</h1>
      <p className="text-muted mt-2 text-[15px]">
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
