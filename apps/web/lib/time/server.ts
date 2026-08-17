import "server-only";

/** Captures one server render instant for hydration-safe live clocks. */
export function getServerRenderTime() {
  return Date.now();
}
