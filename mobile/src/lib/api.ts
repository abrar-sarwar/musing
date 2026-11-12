import { fetch as expoFetch } from "expo/fetch";
import { API_URL } from "./env";

const USER_HEADER = "x-musing-user";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(json.error ?? `http ${res.status}`, res.status);
  return json;
}

export async function apiGet<T>(path: string, userId: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { [USER_HEADER]: userId } });
  return parse<T>(res);
}

export async function apiPost<T>(path: string, userId: string, body?: object): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { [USER_HEADER]: userId, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}

export async function apiDelete<T>(path: string, userId: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: "DELETE", headers: { [USER_HEADER]: userId } });
  return parse<T>(res);
}

// server paths like "/api/posters/<id>" need the api host in front on a phone
export function absoluteUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith("/") ? `${API_URL}${pathOrUrl}` : pathOrUrl;
}

export type SseEvent = { event: string; data: unknown };

// server-sent events over expo/fetch (it supports streaming bodies).
// calls onEvent for every "event:/data:" block until the stream closes.
export async function apiStream(
  path: string,
  userId: string,
  body: object,
  onEvent: (ev: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await expoFetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { [USER_HEADER]: userId, "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let message = text || `http ${res.status}`;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? message;
    } catch {
      /* not json */
    }
    throw new ApiError(message, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length === 0) continue;
      const raw = dataLines.join("\n");
      let data: unknown = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        /* plain text event */
      }
      onEvent({ event, data });
    }
  }
}
