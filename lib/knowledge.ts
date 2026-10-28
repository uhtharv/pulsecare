import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

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
 * Generates a 768-dim vector embedding using Gemini.
 */
export async function getVectorEmbedding(text: string): Promise<number[] | null> {
  if (!apiKey) return null;
  try {
    const ai = getAIClient();
    const res = await ai.models.embedContent({
      model: embeddingModel,
      contents: text,
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
    console.warn("Embedding generation failed, falling back to text search:", err.message);
    return null;
  }
}

/**
 * Searches the Knowledge Base using pgvector cosine similarity or text search fallback.
 */
export async function searchKnowledge(query: string, matchCount: number = 3): Promise<string> {
  if (!isSupabaseConfigured()) {
    return "PulseCare Health Clinic is open Mon-Fri 8am-7pm, Sat 9am-2pm. We accept Aetna, Blue Cross, Medicare, and UnitedHealthcare. Doctors include Dr. Marcus Reynolds (Cardiology) and Dr. Elena Vance (Dermatology).";
  }

  try {
    const queryEmbedding = await getVectorEmbedding(query);

    // 1. Vector similarity search via match_knowledge RPC
    if (queryEmbedding) {
      const { data: matches, error } = await supabaseAdmin.rpc("match_knowledge", {
        query_embedding: queryEmbedding,
        match_threshold: 0.60,
        match_count: matchCount,
      });

      if (!error && matches && matches.length > 0) {
        return matches
          .map((m: any) => `[Source: ${m.title} (${m.category})]\n${m.content}`)
          .join("\n\n");
      }
    }

    // 2. Fallback: Text search
    const { data: textMatches } = await supabaseAdmin
      .from("knowledge_base")
      .select("title, category, content")
      .eq("is_active", true)
      .limit(matchCount);

    if (textMatches && textMatches.length > 0) {
      return textMatches
        .map((m: any) => `[Source: ${m.title} (${m.category})]\n${m.content}`)
        .join("\n\n");
    }

    return "No specific clinic knowledge article matched.";
  } catch (err: any) {
    console.warn("Knowledge search exception:", err.message);
    return "";
  }
}

/**
 * Inserts or updates a Knowledge Base article with its vector embedding.
 */
export async function saveKnowledgeArticle(title: string, category: string, content: string, id?: string) {
  if (!isSupabaseConfigured()) return null;

  const embedding = await getVectorEmbedding(`${title} ${content}`);

  if (id) {
    const { data, error } = await supabaseAdmin
      .from("knowledge_base")
      .update({
        title,
        category,
        content,
        embedding: embedding || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("knowledge_base")
      .insert({
        title,
        category,
        content,
        embedding: embedding || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }
}

