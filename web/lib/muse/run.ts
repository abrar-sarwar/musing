import { z } from "zod";
import { serverDb } from "@/lib/db/server";
import type { MuseJob } from "@/lib/types";
import { MUSE_IMAGE_MODEL, MUSE_TEXT_MODEL, muse } from "./client";
import { PartialStringField } from "./partial";

export type JobName = MuseJob | "smoke";

type Source = "live" | "cache";

// muse-spark-1.3 spends a few hundred reasoning tokens even on tiny jobs, and they
// count against max_completion_tokens. minimal effort was 2x faster than low with
// the same quality on small structured jobs.
export const DEFAULT_MAX_TOKENS = 1500;
export const DEFAULT_REASONING: Reasoning = "minimal";
export type Reasoning = "minimal" | "low" | "medium" | "high";

export type StructuredOpts<S extends z.ZodType> = {
  job: JobName;
  schema: S;
  schemaName: string;
  system: string;
  user: string;
  maxTokens?: number;
  reasoning?: Reasoning;
  planId?: string | null;
  /** short line for the trace panel */
  summarize?: (out: z.infer<S>) => string;
  /** extra semantic check. return an error string to reject + retry. */
  check?: (out: z.infer<S>) => string | null;
  /** cache slot. defaults to job. */
  cacheKey?: string;
  /** serve the cache without calling muse when present (smoke tests, muse off). */
  preferCache?: boolean;
  /** stream this string field's text to onText as it is generated */
  stream?: { field: string; onText: (delta: string) => void; onRestart?: () => void };
};

export type StructuredResult<T> = {
  data: T;
  source: Source;
  latencyMs: number;
  attempts: number;
};

// zod -> json schema in meta's strict subset. root object, additionalProperties:false,
// every key required. use nullable instead of optional in every schema.
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export async function runStructured<S extends z.ZodType>(opts: StructuredOpts<S>): Promise<StructuredResult<z.infer<S>>> {
  const cacheKey = opts.cacheKey ?? opts.job;

  if (opts.preferCache) {
    const hit = await cacheGet(cacheKey);
    const parsed = hit ? opts.schema.safeParse(hit) : null;
    // a cached answer still has to pass this request's checks (ids, leaks)
    if (parsed?.success && !opts.check?.(parsed.data)) {
      await trace({ job: opts.job, model: "cache", latencyMs: 0, ok: true, summary: `replayed: ${opts.summarize?.(parsed.data) ?? "ok"}`, planId: opts.planId ?? null });
      if (opts.stream) opts.stream.onText(String((parsed.data as Record<string, unknown>)[opts.stream.field] ?? ""));
      return { data: parsed.data, source: "cache", latencyMs: 0, attempts: 0 };
    }
  }

  const jsonSchema = toStrictJsonSchema(opts.schema);
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    let usage: Usage = { attempt };
    try {
      const { text, finishReason, reasoningTokens, completionTokens, promptTokens } = await complete(opts, jsonSchema, attempt);
      usage = { attempt, promptTokens, completionTokens, reasoningTokens };
      const latencyMs = Date.now() - t0;
      if (finishReason === "length") {
        throw new Error(`truncated: ${completionTokens ?? "?"} completion tokens (${reasoningTokens ?? "?"} reasoning)`);
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`not json: ${text.slice(0, 80)}`);
      }
      const parsed = opts.schema.safeParse(json);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`schema: ${issue?.path.join(".")} ${issue?.message}`);
      }
      const semantic = opts.check?.(parsed.data) ?? null;
      if (semantic) throw new Error(`check: ${semantic}`);

      await trace({
        job: opts.job,
        model: MUSE_TEXT_MODEL,
        latencyMs,
        ok: true,
        summary: opts.summarize?.(parsed.data) ?? "ok",
        planId: opts.planId ?? null,
        usage,
      });
      await cachePut(cacheKey, parsed.data);
      return { data: parsed.data, source: "live", latencyMs, attempts: attempt };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      await trace({
        job: opts.job,
        model: MUSE_TEXT_MODEL,
        latencyMs: Date.now() - t0,
        ok: false,
        summary: `attempt ${attempt} failed: ${msg.slice(0, 160)}`,
        planId: opts.planId ?? null,
        usage,
      });
      opts.stream?.onRestart?.();
    }
  }

  // both attempts failed. last good response for this slot keeps the demo alive.
  const hit = await cacheGet(cacheKey);
  const parsed = hit ? opts.schema.safeParse(hit) : null;
  if (parsed?.success && !opts.check?.(parsed.data)) {
    if (opts.stream) opts.stream.onText(String((parsed.data as Record<string, unknown>)[opts.stream.field] ?? ""));
    return { data: parsed.data, source: "cache", latencyMs: 0, attempts: 2 };
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

type Completion = { text: string; finishReason: string | null; reasoningTokens?: number; completionTokens?: number; promptTokens?: number };

// one chat completion, streamed when opts.stream is set. meta returns json keys in
// alphabetical order, so the streamed field shows up once earlier keys are done.
async function complete<S extends z.ZodType>(opts: StructuredOpts<S>, jsonSchema: Record<string, unknown>, attempt: number): Promise<Completion> {
  const base = {
    model: MUSE_TEXT_MODEL,
    messages: [
      { role: "system" as const, content: opts.system },
      { role: "user" as const, content: opts.user },
    ],
    response_format: {
      type: "json_schema" as const,
      json_schema: { name: opts.schemaName, strict: true, schema: jsonSchema },
    },
    // reasoning tokens count against this budget. attempt 2 doubles it.
    max_completion_tokens: (opts.maxTokens ?? DEFAULT_MAX_TOKENS) * attempt,
    reasoning_effort: opts.reasoning ?? DEFAULT_REASONING,
  };

  if (!opts.stream) {
    const res = await muse().chat.completions.create(base);
    const choice = res.choices[0];
    return {
      text: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? null,
      reasoningTokens: res.usage?.completion_tokens_details?.reasoning_tokens,
      completionTokens: res.usage?.completion_tokens,
      promptTokens: res.usage?.prompt_tokens,
    };
  }

  const stream = await muse().chat.completions.create({ ...base, stream: true, stream_options: { include_usage: true } });
  const partial = new PartialStringField(opts.stream.field);
  let text = "";
  let finishReason: string | null = null;
  let reasoningTokens: number | undefined;
  let completionTokens: number | undefined;
  let promptTokens: number | undefined;
  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    const delta = choice?.delta?.content;
    if (delta) {
      text += delta;
      const out = partial.update(text);
      if (out) opts.stream.onText(out);
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (chunk.usage) {
      reasoningTokens = chunk.usage.completion_tokens_details?.reasoning_tokens;
      completionTokens = chunk.usage.completion_tokens;
      promptTokens = chunk.usage.prompt_tokens;
    }
  }
  return { text, finishReason, reasoningTokens, completionTokens, promptTokens };
}

export type ImageOpts = {
  job: JobName;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  planId?: string | null;
  cacheKey?: string;
  preferCache?: boolean;
};

export type ImageResult = { b64: string; format: "png"; source: Source; latencyMs: number };

const ImageCache = z.object({ b64: z.string(), format: z.literal("png") });

// muse-image-1.0 took ~45s in testing. never block a request on this; run it in the background.
export async function generateImage(opts: ImageOpts): Promise<ImageResult> {
  const cacheKey = opts.cacheKey ?? `${opts.job}_image`;

  if (opts.preferCache) {
    const hit = await cacheGet(cacheKey);
    const parsed = hit ? ImageCache.safeParse(hit) : null;
    if (parsed?.success) return { ...parsed.data, source: "cache", latencyMs: 0 };
  }

  let t0 = Date.now();
  try {
    const call = () =>
      muse().images.generate({
        model: MUSE_IMAGE_MODEL,
        prompt: opts.prompt,
        n: 1,
        size: opts.size ?? "1024x1024",
        response_format: "b64_json",
        output_format: "png",
      });
    let res: Awaited<ReturnType<typeof call>>;
    try {
      res = await call();
    } catch (e) {
      // a connection that never opened cost nothing, so it gets one more try.
      // anything slower may have reached the api, and an image is the priciest call.
      if (!neverConnected(e, Date.now() - t0)) throw e;
      await trace({ job: opts.job, model: MUSE_IMAGE_MODEL, latencyMs: Date.now() - t0, ok: false, summary: "image: connection didn't open, trying once more", planId: opts.planId ?? null });
      t0 = Date.now();
      res = await call();
    }
    const latencyMs = Date.now() - t0;
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image in response");
    await trace({ job: opts.job, model: MUSE_IMAGE_MODEL, latencyMs, ok: true, summary: `image ${Math.round((b64.length * 0.75) / 1024)}kb`, planId: opts.planId ?? null });
    await cachePut(cacheKey, { b64, format: "png" });
    return { b64, format: "png", source: "live", latencyMs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await trace({ job: opts.job, model: MUSE_IMAGE_MODEL, latencyMs: Date.now() - t0, ok: false, summary: `image failed: ${msg.slice(0, 160)}`, planId: opts.planId ?? null });
    const hit = await cacheGet(cacheKey);
    const parsed = hit ? ImageCache.safeParse(hit) : null;
    if (parsed?.success) return { ...parsed.data, source: "cache", latencyMs: 0 };
    throw e;
  }
}

// true when the request died before a connection was established (dns, tcp or tls,
// undici gives up on those after 10s). the api never saw it.
function neverConnected(e: unknown, elapsedMs: number): boolean {
  const name = e instanceof Error ? e.constructor.name : "";
  return elapsedMs < 15_000 && (name === "APIConnectionError" || name === "APIConnectionTimeoutError");
}

// ---------- trace + cache ----------

type Usage = { attempt?: number; promptTokens?: number; completionTokens?: number; reasoningTokens?: number };

async function trace(t: { job: JobName; model: string; latencyMs: number; ok: boolean; summary: string; planId: string | null; usage?: Usage }) {
  const { error } = await serverDb().from("muse_trace").insert({
    prompt_tokens: t.usage?.promptTokens ?? null,
    completion_tokens: t.usage?.completionTokens ?? null,
    reasoning_tokens: t.usage?.reasoningTokens ?? null,
    attempt: t.usage?.attempt ?? (t.model === "cache" ? 0 : null),
    job: t.job,
    model: t.model,
    latency_ms: t.latencyMs,
    ok: t.ok,
    summary: t.summary,
    plan_id: t.planId,
  });
  if (error) console.error("muse_trace insert failed:", error.message);
}

export async function cacheGet(key: string): Promise<unknown | null> {
  const { data, error } = await serverDb().from("muse_cache").select("output").eq("job", key).maybeSingle();
  if (error) {
    console.error("muse_cache read failed:", error.message);
    return null;
  }
  return data?.output ?? null;
}

export async function cachePut(key: string, output: unknown) {
  const { error } = await serverDb().from("muse_cache").upsert({ job: key, output, updated_at: new Date().toISOString() });
  if (error) console.error("muse_cache write failed:", error.message);
}
