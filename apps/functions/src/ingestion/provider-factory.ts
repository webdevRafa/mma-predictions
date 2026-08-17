import {
  SportsDataIoMmaProvider,
  type MmaDataProvider,
} from "@fightlobby/providers";

export function getConfiguredProvider(
  environment: NodeJS.ProcessEnv = process.env,
): MmaDataProvider {
  const provider = environment.MMA_PROVIDER?.trim().toLowerCase();
  if (provider !== "sportsdataio")
    throw new Error(
      "Production ingestion is disabled. Set MMA_PROVIDER=sportsdataio after configuring licensed data access.",
    );
  if (environment.SPORTSDATAIO_COMMERCIAL_RIGHTS_CONFIRMED !== "true")
    throw new Error(
      "SportsDataIO ingestion requires SPORTSDATAIO_COMMERCIAL_RIGHTS_CONFIRMED=true.",
    );
  const apiKey = environment.SPORTSDATAIO_MMA_KEY?.trim();
  if (!apiKey) throw new Error("SPORTSDATAIO_MMA_KEY is required");
  return new SportsDataIoMmaProvider({ apiKey });
}

export function providerSyncEnabled(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return (
    environment.MMA_PROVIDER?.trim().toLowerCase() === "sportsdataio" &&
    environment.SPORTSDATAIO_COMMERCIAL_RIGHTS_CONFIRMED === "true" &&
    Boolean(environment.SPORTSDATAIO_MMA_KEY?.trim())
  );
}
