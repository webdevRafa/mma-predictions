import { describe, expect, it, vi } from "vitest";

import {
  SportsDataIoMmaProvider,
  parseSportsDataEasternDateTime,
} from "../src/index";

const now = () => new Date("2026-08-16T12:00:00.000Z");

describe("SportsDataIoMmaProvider", () => {
  it("interprets documented offset-free datetimes as US Eastern", () => {
    expect(parseSportsDataEasternDateTime("2026-08-22T22:00:00")).toBe(
      "2026-08-23T02:00:00.000Z",
    );
    expect(parseSportsDataEasternDateTime("2026-01-10T22:00:00")).toBe(
      "2026-01-11T03:00:00.000Z",
    );
  });

  it("validates and normalizes an event card without leaking vendor fields", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          EventId: 900,
          LeagueId: 1,
          Name: "UFC 999: Alpha vs Beta",
          ShortName: "UFC 999",
          DateTime: "2026-08-22T22:00:00",
          Status: "Scheduled",
          VendorOnly: "not canonical",
          Fights: [
            {
              FightId: 901,
              Order: 1,
              Status: "Scheduled",
              WeightClass: "Lightweight",
              CardSegment: "Main Card",
              Rounds: 5,
              IsClosed: false,
              Fighters: [
                {
                  FighterId: 10,
                  FirstName: "Ada",
                  LastName: "Alpha",
                  PreFightWins: 12,
                  PreFightLosses: 1,
                  PreFightDraws: 0,
                  PreFightNoContests: 0,
                },
                {
                  FighterId: 20,
                  FirstName: "Bea",
                  LastName: "Beta",
                  PreFightWins: 11,
                  PreFightLosses: 2,
                  PreFightDraws: 0,
                  PreFightNoContests: 1,
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new SportsDataIoMmaProvider({
      apiKey: "test-key",
      fetch: fetcher,
      now,
    });
    const card = await provider.getEventCard("900");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.sportsdata.io/v3/mma/scores/JSON/Event/900",
      expect.objectContaining({
        headers: { "Ocp-Apim-Subscription-Key": "test-key" },
      }),
    );
    expect(card.event.name).toBe("UFC 999: Alpha vs Beta");
    expect(card.event.startsAt).toBe("2026-08-23T02:00:00.000Z");
    expect(card.fights[0]?.fighterA.name.full).toBe("Ada Alpha");
    expect(card.providerRefs).toEqual({
      event: "900",
      fights: { fgt_sportsdataio_901: "901" },
      fighters: { ftr_sportsdataio_10: "10", ftr_sportsdataio_20: "20" },
    });
    expect(JSON.stringify(card)).not.toContain("VendorOnly");
    expect(provider.drainRawSnapshots()).toHaveLength(1);
    expect(provider.drainRawSnapshots()).toHaveLength(0);
  });

  it("rejects malformed upstream payloads before normalization", async () => {
    const provider = new SportsDataIoMmaProvider({
      apiKey: "test-key",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ EventId: "wrong", Fights: [] })),
        ),
      now,
    });
    await expect(provider.getEventCard("wrong")).rejects.toThrow();
  });
});
