import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

async function testConnections() {
  console.log("Testing Supabase connection...");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: runs, error: sbError } = await supabase.from("workflow_runs").select("count");
  if (sbError) {
    console.error("Supabase Error:", sbError.message);
  } else {
    console.log("Supabase connection SUCCESS! Tables are ready.");
  }

  console.log("\nTesting Gemini connection with model:", process.env.GEMINI_MODEL);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      contents: "Respond with the word 'PONG'",
    });
    console.log("Gemini generateContent SUCCESS! Response:", response.text?.trim());
  } catch (err: any) {
    console.error("Gemini Error:", err.message);
  }

  console.log("\nTesting Embedding model:", process.env.EMBEDDING_MODEL || "gemini-embedding-001");
  try {
    const embedRes = await ai.models.embedContent({
      model: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
      contents: "Sample error signature for testing",
      config: {
        outputDimensionality: 768,
      },
    });
    const embedding = embedRes.embeddings?.[0]?.values;
    console.log(`Embedding SUCCESS! Vector length: ${embedding?.length}`);
  } catch (err: any) {
    console.error("Embedding Error:", err.message);
  }
}

testConnections();

