import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

const apiKey = process.env.GEMINI_API_KEY || "";
const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const isCacheEnabled = process.env.LLM_CACHE === "true";

let aiInstance: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

/**
 * Computes a deterministic cache key for prompt and model.
 */
function computeCacheKey(prompt: string, model: string): string {
  return crypto.createHash("sha256").update(`${model}:${prompt}`).digest("hex");
}

/**
 * Calls Gemini with structured JSON output, caching, and retry capability.
 */
export async function callGeminiJSON<T = any>(params: {
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
  temperature?: number;
}): Promise<T> {
  const { prompt, systemInstruction, responseSchema, temperature = 0.1 } = params;
  const cacheKey = computeCacheKey(prompt + (systemInstruction || ""), modelName);

  // 1. Check llm_cache if enabled
  if (isCacheEnabled && isSupabaseConfigured()) {
    try {
      const { data: cached } = await supabaseAdmin
        .from("llm_cache")
        .select("response")
        .eq("key", cacheKey)
        .maybeSingle();

      if (cached && cached.response) {
        return cached.response as T;
      }
    } catch (e: any) {
      console.warn("Error checking LLM cache:", e.message);
    }
  }

  const ai = getAIClient();

  let attempts = 0;
  let lastError: any = null;
  let currentPrompt = prompt;

  while (attempts < 2) {
    attempts++;
    try {
      const config: any = {
        temperature,
        responseMimeType: "application/json",
      };

      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (responseSchema) {
        config.responseSchema = responseSchema;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: currentPrompt,
        config,
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text);

      // Store in llm_cache on success
      if (isCacheEnabled && isSupabaseConfigured()) {
        try {
          await supabaseAdmin.from("llm_cache").upsert({
            key: cacheKey,
            response: parsed,
          });
        } catch (cacheErr: any) {
          console.warn("Error writing to LLM cache:", cacheErr.message);
        }
      }

      return parsed as T;
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini call attempt ${attempts} failed:`, err.message);
      currentPrompt = `${prompt}\n\nCRITICAL FIX: Your previous response caused JSON parse/schema error: ${err.message}. Return ONLY valid, raw JSON conforming strictly to the requested schema.`;
    }
  }

  throw new Error(`Gemini JSON call failed after ${attempts} attempts: ${lastError?.message}`);
}

