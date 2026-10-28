import { buildNormalizedSignature, generateErrorEmbedding, hashSignature } from "./embeddings";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface ClusterMatchResult {
  clusterId: string;
  clusterCode: string;
  isNew: boolean;
  canonicalFix?: any;
  similarity?: number;
}

/**
 * Matches an incident to an existing error cluster or creates a new one.
 */
export async function matchOrCreateCluster(params: {
  incidentId: string;
  step: string;
  errorCode: string;
  errorMessage: string;
  currentPayload: Record<string, any>;
}): Promise<ClusterMatchResult | null> {
  if (!isSupabaseConfigured()) return null;

  const { incidentId, step, errorCode, errorMessage, currentPayload } = params;
  const payloadShape = Object.keys(currentPayload);
  const signature = buildNormalizedSignature(step, errorCode, errorMessage, payloadShape);
  const sigHash = hashSignature(signature);

  // Generate 768-dim vector embedding
  const embedding = await generateErrorEmbedding(signature);

  let matchedCluster: any = null;

  // 1. Try vector cosine similarity match if embedding succeeded
  if (embedding) {
    try {
      const { data: matches, error } = await supabaseAdmin.rpc("match_clusters", {
        query_embedding: embedding,
        match_threshold: 0.88,
        match_count: 1,
      });

      if (!error && matches && matches.length > 0) {
        matchedCluster = matches[0];
      }
    } catch (e: any) {
      console.warn("Vector match error, falling back to signature hash:", e.message);
    }
  }

  // 2. Fallback: match by signature hash or exact signature
  if (!matchedCluster) {
    const { data: hashMatch } = await supabaseAdmin
      .from("clusters")
      .select("*")
      .eq("signature", signature)
      .maybeSingle();

    if (hashMatch) {
      matchedCluster = hashMatch;
    }
  }

  if (matchedCluster) {
    // Join existing cluster
    const clusterId = matchedCluster.id;
    const clusterCode = matchedCluster.cluster_code;

    // Fetch full cluster to get canonical_fix
    const { data: fullCluster } = await supabaseAdmin
      .from("clusters")
      .select("*")
      .eq("id", clusterId)
      .single();

    // Increment incident_count
    await supabaseAdmin
      .from("clusters")
      .update({
        incident_count: (fullCluster?.incident_count || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clusterId);

    // Link cluster_id and signature/embedding to incident
    await supabaseAdmin
      .from("incidents")
      .update({
        cluster_id: clusterId,
        error_signature: signature,
        error_embedding: embedding || null,
      })
      .eq("id", incidentId);

    return {
      clusterId,
      clusterCode,
      isNew: false,
      canonicalFix: fullCluster?.canonical_fix,
      similarity: matchedCluster.similarity || 1.0,
    };
  }

  // 3. Create a new cluster (e.g. CL-1)
  const { count } = await supabaseAdmin.from("clusters").select("*", { count: "exact", head: true });
  const nextNum = (count || 0) + 1;
  const clusterCode = `CL-${nextNum}`;

  const { data: newCluster, error: createErr } = await supabaseAdmin
    .from("clusters")
    .insert({
      cluster_code: clusterCode,
      label: `${step}:${errorCode}`,
      signature,
      centroid: embedding || null,
      incident_count: 1,
      heal_success_count: 0,
      canonical_fix: null,
    })
    .select("*")
    .single();

  if (createErr || !newCluster) {
    console.error("Failed to create cluster:", createErr?.message);
    return null;
  }

  await supabaseAdmin
    .from("incidents")
    .update({
      cluster_id: newCluster.id,
      error_signature: signature,
      error_embedding: embedding || null,
    })
    .eq("id", incidentId);

  return {
    clusterId: newCluster.id,
    clusterCode,
    isNew: true,
  };
}

/**
 * Records a successful patch as the cluster's canonical fix.
 */
export async function recordClusterSuccess(clusterId: string, patch: any) {
  if (!isSupabaseConfigured() || !clusterId) return;

  try {
    const { data: cluster } = await supabaseAdmin
      .from("clusters")
      .select("heal_success_count")
      .eq("id", clusterId)
      .single();

    await supabaseAdmin
      .from("clusters")
      .update({
        heal_success_count: (cluster?.heal_success_count || 0) + 1,
        canonical_fix: patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clusterId);
  } catch (err: any) {
    console.warn("Failed to record cluster canonical fix:", err.message);
  }
}

