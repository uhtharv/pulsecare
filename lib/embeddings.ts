import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const apiKey = process.env.GEMINI_API_KEY || "";
const embeddingModel = process.env.EMBEDDING_MODEL || "gemini-embedding-001";

let aiInstance: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

/**
 * Normalizes an error signature by replacing dynamic IDs, emails, and numbers with tokens.
 */
export function buildNormalizedSignature(
  step: string,
  errorCode: string,
  errorMessage: string,
  payloadShape: string[]
): string {
  const normMsg = errorMessage
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "<EMAIL>")
    .replace(/\+?[1-9]\d{7,14}/g, "<PHONE>")
    .replace(/[0-9a-fA-F-]{8,}/g, "<ID>")
    .replace(/\d+/g, "<NUM>")
    .trim();

  return `${step} | ${errorCode} | ${normMsg} | [${payloadShape.sort().join(",")}]`;
}

/**
 * Generates a 768-dimensional vector embedding with automatic fallback to null if offline.
 */
export async function generateErrorEmbedding(signature: string): Promise<number[] | null> {
  if (!apiKey) return null;

  try {
    const ai = getAIClient();
    const res = await ai.models.embedContent({
      model: embeddingModel,
      contents: signature,
      config: {
        outputDimensionality: 768,
      },
    });

    const values = res.embeddings?.[0]?.values;
    if (values && values.length === 768) {
      return values;
    }
    return null;
  } catch (err: any) {
    console.warn("Embedding generation failed, utilizing signature hash fallback:", err.message);
    return null;
  }
}

/**
 * Computes deterministic SHA-256 hash of signature for hash-based clustering fallback.
 */
export function hashSignature(signature: string): string {
  return crypto.createHash("sha256").update(signature).digest("hex").slice(0, 16);
}

