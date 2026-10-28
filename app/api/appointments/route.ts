import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ appointments: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ appointments: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ appointment: body, simulated: true });
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        patient_name: body.patient_name,
        patient_email: body.patient_email,
        patient_phone: body.patient_phone,
        doctor_name: body.doctor_name,
        specialty: body.specialty,
        appointment_date: body.appointment_date,
        appointment_time: body.appointment_time,
        reason_for_visit: body.reason_for_visit || "Consultation",
        status: "confirmed",
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ appointment: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (isSupabaseConfigured()) {
      await supabaseAdmin.from("appointments").delete().eq("id", id);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

