export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
}

export function slugify(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "-");
}

export function canonicalSlug(label: string, immutableId: string): string {
  const suffix = immutableId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toLocaleLowerCase("en-US");
  return `${slugify(label)}-${suffix}`;
}
