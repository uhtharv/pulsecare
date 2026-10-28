import { supabaseAdmin, isSupabaseConfigured } from "../lib/supabase";

async function resetDatabase() {
  console.log("=== HealOps Database Reset Tool ===\n");
  if (!isSupabaseConfigured()) {
    console.error("Supabase is not configured in .env.local!");
    process.exit(1);
  }

  console.log("Wiping demo tables...");
  await supabaseAdmin.from("mock_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabaseAdmin.from("postmortems").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabaseAdmin.from("logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabaseAdmin.from("incidents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabaseAdmin.from("workflow_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabaseAdmin.from("clusters").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Clean slate established! Ready for live demo.");
}

resetDatabase().catch((err) => {
  console.error("Reset failed:", err.message);
  process.exit(1);
});

