import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl } from "@/lib/seo/site";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-xs text-fl-text-muted"
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
              <span aria-current="page" className="text-fl-text">
                {item.label}
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
