import OpenAI from "openai";

export const MUSE_TEXT_MODEL = "muse-spark-1.3";
export const MUSE_IMAGE_MODEL = "muse-image-1.0";
export const MUSE_BASE_URL = "https://api.meta.ai/v1";

let cached: OpenAI | null = null;

// server only. the key never reaches the client.
export function muse(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("missing MODEL_API_KEY");
  cached = new OpenAI({
    apiKey,
    baseURL: MUSE_BASE_URL,
    timeout: 60_000,
    maxRetries: 0, // we retry once ourselves, with validation in the loop
  });
  return cached;
}
