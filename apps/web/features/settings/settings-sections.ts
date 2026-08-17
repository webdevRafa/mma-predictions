export const settingsSections = [
  { href: "/settings", id: "account", label: "Account" },
  {
    href: "/settings/profile",
    id: "profile",
    label: "Public profile",
  },
  {
    href: "/settings/notifications",
    id: "notifications",
    label: "Notifications",
  },
  { href: "/settings/privacy", id: "privacy", label: "Privacy" },
  {
    href: "/settings/blocked-users",
    id: "blocked-users",
    label: "Blocked users",
  },
] as const;

export type SettingsSection = (typeof settingsSections)[number]["id"];

export function settingsSectionForPath(pathname: string): SettingsSection {
  return (
    settingsSections.find((section) => section.href === pathname)?.id ??
    "account"
  );
}
