export function getAccountMenuPresentation(
  handle: string | null | undefined,
  handleUnavailable = false,
) {
  if (handle) {
    return {
      href: "/settings",
      label: `@${handle}`,
      title: `Account settings for @${handle}`,
      needsOnboarding: false,
    } as const;
  }
  if (handle === null && !handleUnavailable) {
    return {
      href: "/onboarding",
      label: "Finish setup",
      title: "Finish account setup",
      needsOnboarding: true,
    } as const;
  }
  return {
    href: "/settings",
    label: "Account",
    title: "Account settings",
    needsOnboarding: false,
  } as const;
}
