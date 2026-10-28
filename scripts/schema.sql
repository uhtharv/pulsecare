-- PulseCare AI Database Schema
-- Run this script in your Supabase SQL Editor

create extension if not exists "pgcrypto";
create extension if not exists vector;

-- 1. Conversations Table
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  patient_name text,
  patient_email text,
  patient_phone text,
  status text not null default 'active',     -- active | escalated | operator_taken_over | closed
  sentiment text default 'neutral',          -- positive | neutral | frustrated | urgent
  urgency text default 'normal',             -- normal | high | emergency
  summary text,
  started_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Messages Table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender text not null,                      -- patient | ai | operator
  content text not null,
  action_type text,                          -- book_appointment | create_support_ticket | record_lead | escalate | null
  action_data jsonb,                         -- details of the executed action
  created_at timestamptz default now()
);

-- 3. Appointments Table
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  patient_name text not null,
  patient_email text not null,
  patient_phone text not null,
  doctor_name text not null,
  specialty text not null,
  appointment_date date not null,
  appointment_time text not null,
  reason_for_visit text,
  status text not null default 'confirmed',  -- confirmed | cancelled | completed
  created_at timestamptz default now()
);

-- 4. Support Tickets Table
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text unique not null,          -- TCK-1001
  conversation_id uuid references conversations(id) on delete set null,
  patient_name text not null,
  patient_email text not null,
  issue_category text not null,              -- prescription_refill | billing | medical_records | general
  priority text not null default 'medium',   -- low | medium | high | urgent
  status text not null default 'open',       -- open | in_progress | resolved
  subject text not null,
  description text not null,
  created_at timestamptz default now()
);

-- 5. Leads Table (CRM Registrations)
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  contact_name text not null,
  email text not null,
  phone text,
  insurance_provider text,
  interested_services text[],
  interest_level text not null default 'warm', -- hot | warm | cold
  status text not null default 'new',          -- new | contacted | qualified | closed
  notes text,
  created_at timestamptz default now()
);

-- 6. Knowledge Base Table with pgvector (768 dimensions)
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,                    -- doctors | insurance | services | policies | prep
  content text not null,
  embedding vector(768),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Vector Similarity Search Function
create or replace function match_knowledge(query_embedding vector(768), match_threshold float, match_count int)
returns table (id uuid, title text, category text, content text, similarity float)
language sql stable as $$
  select k.id, k.title, k.category, k.content, 1 - (k.embedding <=> query_embedding) as similarity
  from knowledge_base k
  where k.embedding is not null and k.is_active = true and 1 - (k.embedding <=> query_embedding) >= match_threshold
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

-- Enable Realtime for Live Updates & Operator Takeover
do $$
begin
  alter publication supabase_realtime add table conversations, messages, appointments, support_tickets, leads, knowledge_base;
exception when others then null;
end $$;

-- Disable RLS for Hackathon Development Speed
alter table conversations disable row level security;
alter table messages disable row level security;
alter table appointments disable row level security;
alter table support_tickets disable row level security;
alter table leads disable row level security;
alter table knowledge_base disable row level security;

-- Seed Initial Knowledge Base Articles (Factual Clinic Context)
insert into knowledge_base (title, category, content) values
(
  'Clinic Hours & Locations',
  'services',
  'PulseCare Health Clinic is open Monday to Friday from 8:00 AM to 7:00 PM, and Saturday from 9:00 AM to 2:00 PM. We are closed on Sundays. Our main clinic is located at 450 Health Sciences Blvd, Suite 200, Metro City. Walk-ins are accepted for urgent care, but scheduled appointments are recommended.'
),
(
  'Accepted Insurance Plans',
  'insurance',
  'PulseCare Health Clinic accepts all major insurance providers including Blue Cross Blue Shield, Aetna, UnitedHealthcare, Medicare Part B, Cigna, and Humana. Co-pays are collected at check-in. For uninsured patients, we offer sliding-scale self-pay discount packages ($95 standard consultation).'
),
(
  'Physicians & Specialties',
  'doctors',
  'Our primary care and specialist team includes: 1. Dr. Marcus Reynolds, MD (Cardiology & Preventive Heart Health - available Mon/Wed/Fri). 2. Dr. Elena Vance, MD (Dermatology & Skin Cancer Screening - available Tue/Thu). 3. Dr. James Chen, MD (General & Family Medicine - available Mon-Fri). 4. Dr. Sarah Jenkins, MD (Pediatrics & Adolescent Care - available Mon-Sat).'
),
(
  'Prescription Refill Policy',
  'policies',
  'Prescription refills can be requested through our AI concierge or patient portal. Refill requests are processed within 24 business hours and routed directly to your preferred pharmacy (e.g. CVS, Walgreens). Controlled substances require a recent in-person consultation within the past 6 months.'
),
(
  'Lab Test & Fasting Preparation Guidelines',
  'prep',
  'For comprehensive metabolic panels (CMP), lipid profiles, and fasting glucose tests, patients must fast for 8 to 12 hours prior to their blood draw (water and vital medications only). For echocardiograms and EKGs, avoid caffeine for 24 hours prior. For general dermatology consultations, avoid applying heavy moisturizers or makeup.'
)
on conflict do nothing;
