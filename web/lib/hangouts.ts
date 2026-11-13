import { serverDb } from "@/lib/db/server";
import { getDemoClock } from "@/lib/demoTime";
import { aggregateAffinity, daypartFor, parseFeedback, type Affinity, type FeedbackFacets } from "@/lib/feedback";
import { planOpportunities, topicsFor } from "@/lib/discover";
import { PlanError } from "@/lib/plans";

const BUCKET = "hangout-memories";
const DOWNLOAD_SECONDS = 5 * 60;
const MAX_PHOTOS = 5;
const MAX_BYTES = 6 * 1024 * 1024;
const EVENT_SELECT = "*,host:users!events_host_id_fkey(id,name,avatar_seed)";

type EventRecord = {
  id: string; plan_id: string | null; host_id: string; visibility: "public" | "private";
  title: string; description: string | null; starts_at: string | null; location: string | null;
  poster_url: string | null; created_at: string; host: { id: string; name: string; avatar_seed: string };
};
type RsvpRecord = { event_id: string; user_id: string; status: "interested" | "going"; locked: boolean };
type MemoryRecord = {
  id: string; event_id: string; user_id: string; rating: number; tags: string[]; private_note: string | null;
  recommendation_topics: string[]; recommendation_facets: FeedbackFacets; event_snapshot: Record<string, unknown>;
  created_at: string; updated_at: string;
};

const completeAt = (event: EventRecord): number | null => event.starts_at ? Date.parse(event.starts_at) + 2 * 60 * 60 * 1000 : null;
const complete = (event: EventRecord, now: string): boolean => completeAt(event) !== null && completeAt(event)! <= Date.parse(now);

async function visibleEvents(userId: string): Promise<EventRecord[]> {
  const db = serverDb();
  const [{ data: rows, error }, { data: memberships }] = await Promise.all([
    db.from("events").select(EVENT_SELECT).order("starts_at", { ascending: true, nullsFirst: false }),
    db.from("plan_members").select("plan_id").eq("user_id", userId),
  ]);
  if (error) throw new Error(`events: ${error.message}`);
  const plans = new Set((memberships ?? []).map((m) => m.plan_id as string));
  return ((rows ?? []) as unknown as EventRecord[]).filter((event) => event.visibility === "public" || event.host_id === userId || Boolean(event.plan_id && plans.has(event.plan_id)));
}

async function stateFor(userId: string, events: EventRecord[]) {
  const ids = events.map((e) => e.id);
  if (ids.length === 0) return { rsvps: [] as RsvpRecord[], memories: [] as MemoryRecord[] };
  const db = serverDb();
  const [{ data: rsvps, error: rsvpError }, { data: memories, error: memoryError }] = await Promise.all([
    db.from("event_rsvps").select("event_id,user_id,status,locked").in("event_id", ids),
    db.from("hangout_memories").select("*").eq("user_id", userId).in("event_id", ids),
  ]);
  if (rsvpError) throw new Error(`event rsvps: ${rsvpError.message}`);
  if (memoryError) throw new Error(`event memories: ${memoryError.message}`);
  return { rsvps: (rsvps ?? []) as RsvpRecord[], memories: (memories ?? []) as MemoryRecord[] };
}

function shapeEvent(event: EventRecord, userId: string, now: string, rsvps: RsvpRecord[], memories: MemoryRecord[]) {
  const mine = rsvps.find((r) => r.event_id === event.id && r.user_id === userId) ?? null;
  const memory = memories.find((m) => m.event_id === event.id) ?? null;
  const isComplete = complete(event, now);
  const eligible = isComplete && mine?.status === "going";
  return {
    id: event.id,
    planId: event.plan_id,
    visibility: event.visibility,
    title: event.title,
    description: event.description,
    startsAt: event.starts_at,
    completesAt: event.starts_at ? new Date(completeAt(event)!).toISOString() : null,
    location: event.location,
    posterUrl: event.poster_url,
    host: event.host,
    attendeeCount: rsvps.filter((r) => r.event_id === event.id && r.status === "going").length,
    interestedCount: rsvps.filter((r) => r.event_id === event.id && r.status === "interested").length,
    rsvp: mine?.status ?? null,
    rsvpLocked: mine?.locked ?? false,
    canRsvp: !isComplete && event.plan_id === null && !(mine?.locked ?? false),
    completed: isComplete,
    feedback: {
      eligible,
      memoryId: memory?.id ?? null,
      rating: memory?.rating ?? null,
      prompt: eligible && !memory,
      notification: eligible && !memory,
    },
  };
}

export async function eventsFor(userId: string) {
  const [events, clock] = await Promise.all([visibleEvents(userId), getDemoClock()]);
  const state = await stateFor(userId, events);
  return { events: events.map((event) => shapeEvent(event, userId, clock.now, state.rsvps, state.memories)), demoClock: clock };
}

export async function eventFor(userId: string, eventId: string) {
  const result = await eventsFor(userId);
  const event = result.events.find((row) => row.id === eventId);
  if (!event) throw new PlanError("event not found", 404);
  return { event, demoClock: result.demoClock };
}

async function rawEventFor(userId: string, eventId: string): Promise<EventRecord> {
  const event = (await visibleEvents(userId)).find((row) => row.id === eventId);
  if (!event) throw new PlanError("event not found", 404);
  return event;
}

export async function setRsvp(userId: string, eventId: string, status: unknown) {
  if (status !== null && status !== "interested" && status !== "going") throw new PlanError("status must be interested, going or null");
  const [event, clock] = await Promise.all([rawEventFor(userId, eventId), getDemoClock()]);
  if (complete(event, clock.now)) throw new PlanError("this event is complete", 409);
  if (event.plan_id) throw new PlanError("respond to the plan to change attendance", 409);
  const db = serverDb();
  const { data: existing } = await db.from("event_rsvps").select("locked").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  if (existing?.locked) throw new PlanError("this attendee is locked as going", 409);
  const result = status === null
    ? await db.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", userId)
    : await db.from("event_rsvps").upsert({ event_id: eventId, user_id: userId, status, locked: false, updated_at: new Date().toISOString() });
  if (result.error) throw new Error(`event rsvp: ${result.error.message}`);
  return eventFor(userId, eventId);
}

async function groundedEvent(event: EventRecord) {
  let planActivity: string | null = null;
  let opportunities: Awaited<ReturnType<typeof planOpportunities>> = [];
  let area = event.location?.trim().toLowerCase() || undefined;
  let price: string | undefined;
  if (event.plan_id) {
    const { data: plan } = await serverDb().from("plans").select("activity,public_event_id").eq("id", event.plan_id).maybeSingle();
    planActivity = (plan?.activity as string | null) ?? null;
    opportunities = await planOpportunities(event.plan_id);
    if (plan?.public_event_id) {
      const { data: publicEvent } = await serverDb().from("public_events").select("area,price").eq("id", plan.public_event_id).maybeSingle();
      area = (publicEvent?.area as string | undefined)?.trim().toLowerCase() ?? area;
      const amount = publicEvent?.price as number | null | undefined;
      if (amount !== undefined && amount !== null) price = amount === 0 ? "free" : amount <= 20 ? "low" : amount <= 50 ? "medium" : "high";
    }
  }
  return {
    topics: topicsFor(planActivity, ...opportunities.map((o) => `${o.title} ${o.topic ?? ""}`), event.title, event.description),
    facets: { area, daypart: daypartFor(event.starts_at), price } satisfies FeedbackFacets,
  };
}

async function snapshotFor(event: EventRecord) {
  const { data: attendeeRows } = await serverDb().from("event_rsvps").select("user_id,user:users!event_rsvps_user_id_fkey(id,name,avatar_seed)").eq("event_id", event.id).eq("status", "going");
  const attendees = attendeeRows ?? [];
  const snapshot: Record<string, unknown> = {
    id: event.id, title: event.title, description: event.description, startsAt: event.starts_at,
    location: event.location, planId: event.plan_id, host: event.host, attendeeCount: attendees.length,
  };
  if (event.plan_id) snapshot.crew = attendees.map((row) => row.user);
  return snapshot;
}

export async function saveFeedback(userId: string, eventId: string, input: { rating?: unknown; tags?: unknown; note?: unknown }) {
  let parsed: ReturnType<typeof parseFeedback>;
  try { parsed = parseFeedback(input); } catch (error) { throw new PlanError(error instanceof Error ? error.message : String(error)); }
  const [event, clock] = await Promise.all([rawEventFor(userId, eventId), getDemoClock()]);
  if (!complete(event, clock.now)) throw new PlanError("feedback opens two hours after the event starts", 409);
  const db = serverDb();
  const { data: rsvp } = await db.from("event_rsvps").select("status").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  if (rsvp?.status !== "going") throw new PlanError("only people who were going can rate this event", 403);
  const { data: existing } = await db.from("hangout_memories").select("id").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  let memoryId: string;
  if (existing?.id) {
    const { error } = await db.from("hangout_memories").update({ rating: parsed.rating, tags: parsed.tags, private_note: parsed.note, updated_at: new Date().toISOString() }).eq("id", existing.id).eq("user_id", userId);
    if (error) throw new Error(`feedback update: ${error.message}`);
    memoryId = existing.id as string;
  } else {
    const [grounding, snapshot] = await Promise.all([groundedEvent(event), snapshotFor(event)]);
    const { data, error } = await db.from("hangout_memories").insert({
      event_id: eventId, user_id: userId, rating: parsed.rating, tags: parsed.tags, private_note: parsed.note,
      recommendation_topics: grounding.topics, recommendation_facets: grounding.facets, event_snapshot: snapshot,
    }).select("id").single();
    if (error || !data) throw new Error(`feedback insert: ${error?.message}`);
    memoryId = data.id as string;
  }
  return memoryFor(userId, memoryId);
}

async function signedPhotos(memoryIds: string[]) {
  if (memoryIds.length === 0) return new Map<string, Array<Record<string, unknown>>>();
  const { data, error } = await serverDb().from("memory_photos").select("*").in("memory_id", memoryIds).order("position");
  if (error) throw new Error(`memory photos: ${error.message}`);
  const out = new Map<string, Array<Record<string, unknown>>>();
  await Promise.all((data ?? []).map(async (photo) => {
    let url: string | null = null;
    if (photo.state === "ready") {
      const signed = await serverDb().storage.from(BUCKET).createSignedUrl(photo.storage_path as string, DOWNLOAD_SECONDS);
      if (!signed.error) url = signed.data.signedUrl;
    }
    const row = { id: photo.id, position: photo.position, state: photo.state, width: photo.width, height: photo.height, url };
    const list = out.get(photo.memory_id as string) ?? [];
    list.push(row);
    out.set(photo.memory_id as string, list);
  }));
  return out;
}

export async function memoriesFor(userId: string) {
  const { data, error } = await serverDb().from("hangout_memories").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw new Error(`memories: ${error.message}`);
  const memories = (data ?? []) as MemoryRecord[];
  const photos = await signedPhotos(memories.map((m) => m.id));
  return { memories: memories.map((memory) => ({
    id: memory.id, eventId: memory.event_id, rating: memory.rating, tags: memory.tags,
    privateNote: memory.private_note, event: memory.event_snapshot, photos: photos.get(memory.id) ?? [],
    createdAt: memory.created_at, updatedAt: memory.updated_at,
  })) };
}

export async function memoryFor(userId: string, memoryId: string) {
  const all = await memoriesFor(userId);
  const memory = all.memories.find((row) => row.id === memoryId);
  if (!memory) throw new PlanError("memory not found", 404);
  return { memory };
}

async function ownMemory(userId: string, memoryId: string) {
  const { data, error } = await serverDb().from("hangout_memories").select("id").eq("id", memoryId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`memory: ${error.message}`);
  if (!data) throw new PlanError("memory not found", 404);
}

export async function reservePhoto(userId: string, memoryId: string, input: { mimeType?: unknown; byteSize?: unknown; width?: unknown; height?: unknown }) {
  await ownMemory(userId, memoryId);
  if (input.mimeType !== "image/jpeg") throw new PlanError("memory photos must be JPEGs");
  if (!Number.isInteger(input.byteSize) || (input.byteSize as number) < 1 || (input.byteSize as number) > MAX_BYTES) throw new PlanError("photo must be 6 MiB or smaller");
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || (input.width as number) < 1 || (input.height as number) < 1 || Math.max(input.width as number, input.height as number) > 2048) throw new PlanError("photo long edge must be at most 2048 pixels");
  const db = serverDb();
  const { data: existing } = await db.from("memory_photos").select("position").eq("memory_id", memoryId);
  if ((existing ?? []).length >= MAX_PHOTOS) throw new PlanError("a memory can have at most five photos", 409);
  const used = new Set((existing ?? []).map((row) => row.position as number));
  const position = [0, 1, 2, 3, 4].find((n) => !used.has(n))!;
  const id = crypto.randomUUID();
  const storagePath = `${userId}/${memoryId}/${id}.jpg`;
  const { error } = await db.from("memory_photos").insert({ id, memory_id: memoryId, user_id: userId, storage_path: storagePath, position, state: "pending", mime_type: input.mimeType, byte_size: input.byteSize, width: input.width, height: input.height });
  if (error) throw new Error(`photo reserve: ${error.message}`);
  const signed = await db.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (signed.error) {
    await db.from("memory_photos").delete().eq("id", id);
    throw new Error(`photo upload URL: ${signed.error.message}`);
  }
  return { photoId: id, path: storagePath, token: signed.data.token, uploadUrl: signed.data.signedUrl };
}

async function ownPhoto(userId: string, memoryId: string, photoId: string) {
  await ownMemory(userId, memoryId);
  const { data, error } = await serverDb().from("memory_photos").select("*").eq("id", photoId).eq("memory_id", memoryId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`memory photo: ${error.message}`);
  if (!data) throw new PlanError("photo not found", 404);
  return data;
}

export async function retryPhoto(userId: string, memoryId: string, photoId: string) {
  const photo = await ownPhoto(userId, memoryId, photoId);
  const db = serverDb();
  await db.from("memory_photos").update({ state: "pending", updated_at: new Date().toISOString() }).eq("id", photoId);
  const signed = await db.storage.from(BUCKET).createSignedUploadUrl(photo.storage_path as string, { upsert: true });
  if (signed.error) throw new Error(`photo upload URL: ${signed.error.message}`);
  return { photoId, path: photo.storage_path, token: signed.data.token, uploadUrl: signed.data.signedUrl };
}

export async function finalizePhoto(userId: string, memoryId: string, photoId: string) {
  const photo = await ownPhoto(userId, memoryId, photoId);
  const path = photo.storage_path as string;
  const parts = path.split("/");
  const name = parts.pop()!;
  const { data, error } = await serverDb().storage.from(BUCKET).list(parts.join("/"), { search: name, limit: 10 });
  const object = data?.find((row) => row.name === name);
  const metadata = object?.metadata as { size?: number; mimetype?: string } | null | undefined;
  if (error || !object) throw new PlanError("photo upload has not finished", 409);
  if ((metadata?.size ?? 0) < 1 || (metadata?.size ?? 0) > MAX_BYTES || metadata?.mimetype !== "image/jpeg") {
    await serverDb().storage.from(BUCKET).remove([path]);
    await serverDb().from("memory_photos").update({ state: "failed", updated_at: new Date().toISOString() }).eq("id", photoId);
    throw new PlanError("uploaded photo failed JPEG or 6 MiB validation");
  }
  const { error: updateError } = await serverDb().from("memory_photos").update({ state: "ready", byte_size: metadata.size, updated_at: new Date().toISOString() }).eq("id", photoId);
  if (updateError) throw new Error(`photo finalize: ${updateError.message}`);
  return memoryFor(userId, memoryId);
}

export async function deletePhoto(userId: string, memoryId: string, photoId: string) {
  const photo = await ownPhoto(userId, memoryId, photoId);
  const db = serverDb();
  const removed = await db.storage.from(BUCKET).remove([photo.storage_path as string]);
  if (removed.error && !removed.error.message.toLowerCase().includes("not found")) throw new Error(`photo delete: ${removed.error.message}`);
  const { error } = await db.from("memory_photos").delete().eq("id", photoId).eq("user_id", userId);
  if (error) throw new Error(`photo delete: ${error.message}`);
  return { ok: true };
}

export async function affinityFor(userId: string): Promise<Affinity> {
  const { data, error } = await serverDb().from("hangout_memories").select("rating,tags,recommendation_topics,recommendation_facets").eq("user_id", userId);
  if (error) throw new Error(`feedback affinity: ${error.message}`);
  return aggregateAffinity((data ?? []) as unknown as Parameters<typeof aggregateAffinity>[0]);
}

export async function clearMemoryStorage(): Promise<void> {
  const { error } = await serverDb().storage.emptyBucket(BUCKET);
  if (error && !/not found|does not exist/i.test(error.message)) throw new Error(`memory storage reset: ${error.message}`);
}
