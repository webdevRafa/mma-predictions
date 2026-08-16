import { BRAND } from "@fightlobby/domain";

export default function HomePage() {
  return (
    <main>
      <p>Foundation ready</p>
      <h1>{BRAND.name}</h1>
      <p>{BRAND.tagline}</p>
    </main>
  );
}
