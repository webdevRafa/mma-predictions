export function getFormString(form: FormData, key: string, fallback = "") {
  const value = form.get(key);
  return typeof value === "string" ? value : fallback;
}
