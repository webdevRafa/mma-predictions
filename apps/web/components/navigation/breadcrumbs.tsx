import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { cn } from "@/lib/cn";
import { absoluteUrl } from "@/lib/seo/site";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  suffix?: ReactNode;
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className={cn(
          "flex flex-wrap items-center gap-1.5 text-xs text-fl-text-muted",
          className,
        )}
      >
        {items.map((item, index) => (
          <span
            className="inline-flex items-center gap-1.5"
            key={`${item.label}-${index}`}
          >
            {index > 0 ? <ChevronRight aria-hidden="true" size={13} /> : null}
            {item.href ? (
              <Link
                className="focus-ring rounded-sm transition hover:text-fl-text"
                href={item.href}
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="inline-flex items-center gap-1.5 text-fl-text"
              >
                <span>{item.label}</span>
                {item.suffix}
              </span>
            )}
          </span>
        ))}
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.label,
            ...(item.href ? { item: absoluteUrl(item.href) } : {}),
          })),
        }}
      />
    </>
  );
}
