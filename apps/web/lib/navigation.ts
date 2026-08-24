export function isNavigationPathActive(
  pathname: string,
  paths: readonly string[],
) {
  return paths.some((path) =>
    path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(`${path}/`),
  );
}
