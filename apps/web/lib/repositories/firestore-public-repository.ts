import "server-only";

import type { Event, EventCard, Fight, Fighter } from "@fightlobby/domain";
import type {
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { z } from "zod";

import type { PublicRepository } from "./public-repository";

const eventDocSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    slugHistory: z.array(z.string()),
    status: z.string(),
  })
  .passthrough();
const fightDocSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    slugHistory: z.array(z.string()),
    eventId: z.string(),
    fighterAId: z.string(),
    fighterBId: z.string(),
  })
  .passthrough();
const fighterDocSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    slugHistory: z.array(z.string()),
    name: z.object({ full: z.string(), normalized: z.string() }),
  })
  .passthrough();

function parseDoc<T>(snapshot: QueryDocumentSnapshot, schema: z.ZodType): T {
  const result = schema.safeParse(snapshot.data());
  if (!result.success)
    throw new Error(
      `Invalid ${snapshot.ref.path}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`,
    );
  return result.data as T;
}

export class FirestorePublicRepository implements PublicRepository {
  constructor(private readonly firestore: Firestore) {}

  async listEvents(): Promise<Event[]> {
    const snapshot = await this.firestore
      .collection("events")
      .where("status", "!=", "draft")
      .orderBy("status")
      .orderBy("startsAt", "desc")
      .limit(30)
      .get();
    return snapshot.docs.map((doc) => parseDoc<Event>(doc, eventDocSchema));
  }

  async getEventBySlug(slug: string): Promise<EventCard | null> {
    const event = await this.findBySlug<Event>("events", slug, eventDocSchema);
    if (!event) return null;
    const [fightSnapshot, fighterSnapshot] = await Promise.all([
      this.firestore
        .collection("fights")
        .where("eventId", "==", event.id)
        .orderBy("boutOrder")
        .get(),
      this.firestore
        .collection("fighters")
        .where("upcomingEventIds", "array-contains", event.id)
        .get(),
    ]);
    return {
      event,
      fights: fightSnapshot.docs.map((doc) =>
        parseDoc<Fight>(doc, fightDocSchema),
      ),
      fighters: fighterSnapshot.docs.map((doc) =>
        parseDoc<Fighter>(doc, fighterDocSchema),
      ),
    };
  }

  async getFightBySlug(
    slug: string,
  ): Promise<{ fight: Fight; event: Event; fighters: Fighter[] } | null> {
    const fight = await this.findBySlug<Fight>("fights", slug, fightDocSchema);
    if (!fight) return null;
    const [eventDoc, fighterADoc, fighterBDoc] = await Promise.all([
      this.firestore.collection("events").doc(fight.eventId).get(),
      this.firestore.collection("fighters").doc(fight.fighterAId).get(),
      this.firestore.collection("fighters").doc(fight.fighterBId).get(),
    ]);
    if (!eventDoc.exists || !fighterADoc.exists || !fighterBDoc.exists)
      throw new Error(`Fight ${fight.id} references missing public documents`);
    return {
      fight,
      event: eventDoc.data() as Event,
      fighters: [fighterADoc.data() as Fighter, fighterBDoc.data() as Fighter],
    };
  }

  async getFighterBySlug(
    slug: string,
  ): Promise<{ fighter: Fighter; fights: Fight[] } | null> {
    const fighter = await this.findBySlug<Fighter>(
      "fighters",
      slug,
      fighterDocSchema,
    );
    if (!fighter) return null;
    const [asA, asB] = await Promise.all([
      this.firestore
        .collection("fights")
        .where("fighterAId", "==", fighter.id)
        .limit(25)
        .get(),
      this.firestore
        .collection("fights")
        .where("fighterBId", "==", fighter.id)
        .limit(25)
        .get(),
    ]);
    const fights = [...asA.docs, ...asB.docs].map((doc) =>
      parseDoc<Fight>(doc, fightDocSchema),
    );
    return { fighter, fights };
  }

  private async findBySlug<T>(
    collectionName: string,
    slug: string,
    schema: z.ZodType,
  ): Promise<T | null> {
    const direct = await this.firestore
      .collection(collectionName)
      .where("slug", "==", slug)
      .limit(1)
      .get();
    const snapshot =
      direct.docs[0] ??
      (
        await this.firestore
          .collection(collectionName)
          .where("slugHistory", "array-contains", slug)
          .limit(1)
          .get()
      ).docs[0];
    return snapshot ? parseDoc<T>(snapshot, schema) : null;
  }
}
