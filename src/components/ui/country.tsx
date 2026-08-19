import { cn } from "@/lib/cn";
import { countryName } from "@/lib/vocabulary";

/**
 * The jurisdiction tile that stands where the reference site puts a flag image.
 *
 * It shows the ISO code large and the country name small. That reads at a
 * glance the way a flag does, needs no asset and — unlike flag emoji — looks the
 * same on Windows, macOS and Linux.
 */
export function CountryTile({ code, className }: { code: string; className?: string }) {
  return (
    <div
      className={cn(
        "border-line bg-panel grid shrink-0 place-content-center rounded-xl border px-2 text-center",
        className,
      )}
      title={countryName(code)}
    >
      <span className="text-ink block text-[20px] leading-none font-bold tracking-wide">
        {code.toUpperCase()}
      </span>
      <span className="text-faint mt-1 block max-w-[86px] truncate text-[11px] leading-none">
        {countryName(code)}
      </span>
    </div>
  );
}

/** Inline form for attribute cells and tables: "LT · Lithuania". */
export function CountryLabel({ code }: { code: string }) {
  return (
    <span className="truncate">
      <span className="font-semibold">{code.toUpperCase()}</span>
      <span className="text-muted"> · {countryName(code)}</span>
    </span>
  );
}
