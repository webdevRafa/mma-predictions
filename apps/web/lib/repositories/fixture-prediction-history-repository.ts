import type { PredictionHistory } from "@/features/profiles/prediction-history-types";

import type { PredictionHistoryRepository } from "./prediction-history-repository";

const demoHistory: PredictionHistory = {
  events: [
    {
      id: "evt_fl_demo_001",
      name: "UFC FightLobby Demo: Navarro vs Okafor",
      shortName: "Navarro vs Okafor",
      slug: "ufc-fightlobby-demo-navarro-vs-okafor-fl001",
      startsAt: "2026-09-06T00:00:00.000Z",
      status: "scheduled",
    },
    {
      id: "evt_fl_demo_000",
      name: "UFC FightLobby Demo: Vale vs Cole",
      shortName: "Vale vs Cole",
      slug: "ufc-fightlobby-demo-vale-vs-cole-fl000",
      startsAt: "2026-08-02T00:00:00.000Z",
      status: "completed",
    },
  ],
  entries: [
    {
      fightId: "fgt_fl_demo_001",
      fightSlug: "asha-navarro-vs-naomi-okafor-fl001",
      eventId: "evt_fl_demo_001",
      eventName: "UFC FightLobby Demo: Navarro vs Okafor",
      eventShortName: "Navarro vs Okafor",
      eventSlug: "ufc-fightlobby-demo-navarro-vs-okafor-fl001",
      eventStartsAt: "2026-09-06T00:00:00.000Z",
      boutOrder: 1,
      fighterAName: "Asha Navarro",
      fighterBName: "Naomi Okafor",
      selectedWinnerName: "Asha Navarro",
      method: "decision",
      detail: "unanimous",
      status: "locked",
      resultSummary: "Awaiting official result",
    },
    {
      fightId: "fgt_fl_demo_000_a",
      fightSlug: "marcus-vale-vs-idris-cole-fl000",
      eventId: "evt_fl_demo_000",
      eventName: "UFC FightLobby Demo: Vale vs Cole",
      eventShortName: "Vale vs Cole",
      eventSlug: "ufc-fightlobby-demo-vale-vs-cole-fl000",
      eventStartsAt: "2026-08-02T00:00:00.000Z",
      boutOrder: 1,
      fighterAName: "Marcus Vale",
      fighterBName: "Idris Cole",
      selectedWinnerName: "Marcus Vale",
      method: "ko_tko",
      detail: 2,
      status: "graded",
      points: 10,
      winnerCorrect: true,
      resultSummary: "Marcus Vale · KO/TKO · Round 2",
    },
    {
      fightId: "fgt_fl_demo_000_b",
      fightSlug: "hiro-tanaka-vs-thiago-moura-fl000",
      eventId: "evt_fl_demo_000",
      eventName: "UFC FightLobby Demo: Vale vs Cole",
      eventShortName: "Vale vs Cole",
      eventSlug: "ufc-fightlobby-demo-vale-vs-cole-fl000",
      eventStartsAt: "2026-08-02T00:00:00.000Z",
      boutOrder: 2,
      fighterAName: "Hiro Tanaka",
      fighterBName: "Thiago Moura",
      selectedWinnerName: "Hiro Tanaka",
      method: "decision",
      detail: "split",
      status: "graded",
      points: 0,
      winnerCorrect: false,
      resultSummary: "Thiago Moura · Split decision",
    },
  ],
};

export class FixturePredictionHistoryRepository implements PredictionHistoryRepository {
  getPrivateHistory() {
    return Promise.resolve(structuredClone(demoHistory));
  }

  getPublicHistory() {
    return Promise.resolve(structuredClone(demoHistory));
  }
}
