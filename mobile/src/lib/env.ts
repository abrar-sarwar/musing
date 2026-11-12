import Constants from "expo-constants";
import { Platform } from "react-native";

// "192.168.1.5:8081" when metro serves a device over lan
function metroHost(): string | null {
  const uri = Constants.expoConfig?.hostUri ?? null;
  if (!uri) return null;
  return uri.split(":")[0] ?? null;
}

// on a phone, localhost is the phone. swap in the laptop's ip that metro runs on.
export function resolveHost(url: string): string {
  if (Platform.OS === "web") return url;
  const host = metroHost();
  if (!host || host === "localhost" || host === "127.0.0.1") return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${host}`);
}

export const API_URL = resolveHost(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000");
export const SUPABASE_URL = resolveHost(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://localhost:56321");
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
