export const SITE_NAME = "FightLobby";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fightlobby.com"
).replace(/\/$/, "");

export function absoluteUrl(pathname: string) {
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
