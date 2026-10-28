# PRD: PulseCare AI — Autonomous Healthcare Concierge & Clinic Operations Control Plane

**Hackathon:** Code E Fiesta 2026  
**Problem Statement:** Action-Oriented Customer AI Agent  
**Domain:** Healthcare & Clinic Services  
**Target Solution:** An action-oriented AI agent that interacts with patients through voice and text, understands medical and administrative requests via a semantic knowledge base, autonomously executes database actions (booking appointments, creating support tickets, capturing patient leads), and escalates emergency/unresolved cases to human medical staff with live real-time takeover.

---

## 1. Executive Summary & One-Line Pitch
**PulseCare AI** is an action-driven conversational healthcare concierge that solves front-desk overload and lost patient opportunities by **turning patient conversations into immediate clinical and administrative actions**: autonomously scheduling doctor appointments, opening prescription/billing support tickets, capturing prospective patient registrations, and escalating urgent triage situations to clinic staff with seamless real-time live chat takeover.

---

## 2. Problem Statement & Business Opportunity
- **Missed Patients & Lost Revenue:** Clinics lose hundreds of potential patients each month because phone lines are busy, after-hours calls go to voicemail, and follow-ups are delayed.
- **Administrative Burnout:** Front-desk staff and nurses spend over 60% of their day answering repetitive FAQs (hours, insurance accepted, location, prep guidelines) instead of attending to in-clinic patient care.
- **Support & Refill Delays:** Prescription refill requests and billing inquiries linger in disjointed channels, frustrating patients and risking treatment continuity.
- **Triage Safety Risk:** Patients facing urgent symptoms need immediate escalation to a human provider rather than an unresponsive voice tree or a generic chatbot that provides ungrounded medical advice.

---

## 3. Core System Requirements (from Problem Brief)
1. **Multimodal Customer Interaction:** Natural conversation through both an interactive chat interface and hands-free voice (Web Speech API mic input & speech synthesis output).
2. **Knowledge-Grounded Reasoning:** Accurate answers to clinic services, doctors, insurances, and care guidelines powered by dynamic RAG (Supabase `pgvector` + Gemini embeddings).
3. **Autonomous Action Execution:** The AI must take real database actions rather than just generating conversational text:
   - **Book Doctor Appointments:** Schedule consultation slots into the clinic calendar.
   - **Create Support Tickets:** Generate tracked tickets for prescription refills, billing disputes, and medical records.
   - **Capture Patient Leads:** Register prospective new patients or corporate wellness inquiries into the CRM.
4. **CRM & Database Synchronization:** All actions immediately persist into Supabase and update the Clinic Operations Dashboard via Realtime.
5. **Emergency Triage & Human Escalation:** Detect acute symptoms or explicit human requests, summarize the context, alert the clinic desk, and allow a human nurse/operator to take over the conversation live.
6. **Dual-Persona Experience:** A customer-facing healthcare widget paired with a full Clinic Operations CRM and a Split-Screen Live Demo mode for hackathon judging.

---

## 4. Technical Architecture & Stack

```mermaid
flowchart TD
    subgraph PatientInterface["Patient Experience (Voice & Text)"]
        UI[PulseCare Chat Widget]
        STT[Browser Web Speech STT] --> UI
        UI --> TTS[Browser SpeechSynthesis]
    end

    subgraph AgentEngine["PulseCare Agent Engine (Next.js 14)"]
        UI <-->|POST /api/chat| API[Next.js App Router API]
        API --> RAG[Knowledge Retrieval (pgvector)]
        API --> LLM[Gemini 3.5 Flash Lite + Tools]
        LLM --> Router{Tool Dispatcher}
    end

    subgraph Tools["Autonomous Database Actions"]
        Router -->|book_appointment| T1[(appointments Table)]
        Router -->|create_support_ticket| T2[(support_tickets Table)]
        Router -->|record_lead| T3[(leads Table)]
        Router -->|escalate_to_human| T4[(conversations / escalations)]
    end

    subgraph ClinicOps["Clinic Operations CRM Dashboard"]
        T1 & T2 & T3 & T4 -.->|Supabase Realtime| CRM[Live Operations Control Plane]
        CRM --> Takeover[Live Nurse/Operator Takeover]
        Takeover -.->|Realtime Messages| UI
        CRM --> KBManager[Knowledge Base Editor & Vector Sync]
        KBManager --> RAG
    end
```

### Stack Details
- **Frontend & App Framework:** Next.js 14 (App Router, TypeScript, React 18)
- **Styling & Components:** Tailwind CSS, Lucide React Icons
- **Database, Realtime & Vector Search:** Hosted Supabase (Postgres, Realtime subscriptions, `pgvector` extension)
- **AI Core & Function Calling:** `@google/genai` with `gemini-3.5-flash-lite` (Temperature 0.2, native function/tool declarations)
- **Vector Embeddings:** Google GenAI `gemini-embedding-001` (Output dimensionality: 768)
- **Voice Capabilities:** Native Browser Web Speech API (`webkitSpeechRecognition` for microphone STT, `window.speechSynthesis` for audio playback — 0 external API cost)

---

## 5. Feature Breakdown & Acceptance Criteria

### F1. Multimodal Patient Interface (Voice + Text)
- **Chat Stream:** Clean, modern healthcare interface with avatar, message timestamps, and markdown support.
- **Voice Input:** One-click microphone button enabling voice transcription via Web Speech API.
- **Voice Output:** Speaker audio toggle to read AI answers aloud for accessibility.
- **Quick Suggestion Chips:** "Book Doctor Consultation", "Request Prescription Refill", "Check Insurance Coverage", "Speak to a Nurse".
- **Interactive Action Cards:** When the AI takes an action, it renders a custom UI card inline in the chat (e.g. Appointment Confirmation Card with date/time, Ticket Badge with tracking code, Lead Status).

### F2. Dynamic Clinic Knowledge Base with pgvector RAG
- Stores clinic data:
  - Doctor specialties (Cardiology, Dermatology, Pediatrics, Orthopedics, Family Medicine)
  - Operating hours and urgent care availability
  - Accepted insurances (Blue Cross, Aetna, UnitedHealthcare, Medicare, Cigna)
  - Lab test & procedure preparation instructions (e.g. fasting blood work, MRI prep)
- Search: Vector similarity via `match_knowledge` RPC function (cosine similarity >= 0.75).
- Admin KB Manager: Clinic coordinators can add, edit, or delete FAQ articles with automatic background vector re-indexing.

### F3. Autonomous Appointment Booking Tool (`book_appointment`)
- Parameters: `patient_name`, `patient_email`, `patient_phone`, `doctor_name`, `specialty`, `appointment_date` (YYYY-MM-DD), `appointment_time` (HH:MM), `reason_for_visit`.
- Execution: Inserts into `appointments` table with status `confirmed`, checks availability conflicts, returns formatted booking confirmation card.
- Capability: Patient can ask to view or reschedule their booking.

### F4. Patient Support & Refill Ticketing Tool (`create_support_ticket`)
- Parameters: `patient_name`, `patient_email`, `issue_category` (`prescription_refill`, `billing`, `medical_records`, `general_inquiry`), `priority` (`low`, `medium`, `high`, `urgent`), `subject`, `description`.
- Execution: Inserts into `support_tickets` table, generates a ticket code (e.g. `TCK-1042`), displays ticket tracking card to patient.

### F5. Prospective Patient Lead Qualification Tool (`record_lead`)
- Parameters: `contact_name`, `email`, `phone`, `insurance_provider`, `interested_services`, `interest_level` (`hot`, `warm`, `cold`), `notes`.
- Execution: Inserts into `leads` table in the CRM, calculates lead score, updates the Clinic Lead Pipeline in real time.

### F6. Emergency Triage & Live Nurse Escalation (`escalate_to_human`)
- Trigger conditions:
  - Acute medical symptoms (chest pain, breathing difficulty, sudden numbness, severe trauma).
  - Explicit customer request ("I need to speak with a human", "Connect me to a nurse").
  - Frustration or unresolved multi-turn inquiry.
- Action: Flags conversation as `escalated` with urgency level and clinical context summary.
- Live Takeover Console: The clinic operator dashboard flashes an escalation alert with a "Take Over Chat" button. When clicked, the operator can send messages directly into the patient's chat stream via Supabase Realtime!

### F7. Dual-View Command Center & Split-Screen Demo Mode
- **Customer View:** Full-screen patient concierge widget.
- **Clinic Operations View:** Full-featured CRM with tabs for Appointments Calendar, Support Tickets, Leads Pipeline, Escalation Desk, and Knowledge Base.
- **Split-Screen Live Demo Mode:** Side-by-side presentation showing the Patient Chat on the left and Live Clinic Operations on the right, enabling hackathon judges to observe instant database updates and live nurse takeover in real time!

---

## 6. Database Schema (`scripts/schema.sql`)

```sql
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

-- 6. Knowledge Base Table with pgvector
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

-- Disable RLS for Hackathon Development
alter table conversations disable row level security;
alter table messages disable row level security;
alter table appointments disable row level security;
alter table support_tickets disable row level security;
alter table leads disable row level security;
alter table knowledge_base disable row level security;
```

---

## 7. Gemini Tool Declarations (`lib/tools.ts`)

The AI agent uses native function calling with the following declarations:

1. **`book_appointment`**:
   - `patient_name` (string, required)
   - `patient_email` (string, required)
   - `patient_phone` (string, required)
   - `doctor_name` (string, required)
   - `specialty` (string, required)
   - `appointment_date` (string, required: YYYY-MM-DD)
   - `appointment_time` (string, required: e.g. "10:30 AM")
   - `reason_for_visit` (string)

2. **`create_support_ticket`**:
   - `patient_name` (string, required)
   - `patient_email` (string, required)
   - `issue_category` (string, enum: `prescription_refill`, `billing`, `medical_records`, `general`)
   - `priority` (string, enum: `low`, `medium`, `high`, `urgent`)
   - `subject` (string, required)
   - `description` (string, required)

3. **`record_lead`**:
   - `contact_name` (string, required)
   - `email` (string, required)
   - `phone` (string)
   - `insurance_provider` (string)
   - `interested_services` (array of strings)
   - `interest_level` (string, enum: `hot`, `warm`, `cold`)
   - `notes` (string)

4. **`escalate_to_human`**:
   - `reason` (string, required: e.g. "Acute chest pain symptoms" or "Customer requested nurse")
   - `summary` (string, required: 2-sentence clinical handoff summary)
   - `urgency` (string, enum: `normal`, `high`, `emergency`)

---

## 8. API Route Architecture
| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Conversational agent endpoint (voice/text, RAG retrieval, Gemini tool calling, message storage) |
| `/api/appointments` | GET, POST, DELETE | Appointment management and scheduling conflict validation |
| `/api/tickets` | GET, POST, PATCH | Support & refill ticket creation and status updates |
| `/api/leads` | GET, POST | CRM patient lead pipeline tracking |
| `/api/escalate` | POST | Operator escalation and live takeover messaging |
| `/api/knowledge` | GET, POST, DELETE | Knowledge Base CRUD with automatic 768-dim vector embedding |
| `/api/admin/reset` | POST | Wipe or pre-seed golden clinic data (doctors, appointments, KB articles) |

---

## 9. 4-Minute Demo Script for Hackathon Judges

1. **Side-by-Side Presentation (0:00 - 0:45):**
   - Open PulseCare AI in **Split-Screen Demo Mode**: Customer Chatbot on the left, Clinic Operations CRM on the right.
   - Explain the problem: "Clinics lose 30% of calls and patient appointments because front-desks are overwhelmed. PulseCare AI doesn't just chat; it executes real clinical and administrative actions."

2. **Knowledge-Grounded Query & Voice Interaction (0:45 - 1:30):**
   - Click the microphone and ask: *"Do you accept Aetna insurance, and what are Dr. Reynolds' clinic hours?"*
   - AI answers accurately from the pgvector knowledge base and speaks the response aloud.

3. **Autonomous Action 1: Doctor Appointment Booking (1:30 - 2:15):**
   - Say: *"I'd like to book an appointment with Dr. Reynolds for cardiology tomorrow at 2 PM. My name is Maya Patel, email maya@example.com, phone +15551234567."*
   - AI executes `book_appointment`, renders an interactive **Appointment Confirmation Card**, and the right-hand CRM calendar immediately updates with Maya's confirmed appointment!

4. **Autonomous Action 2: Prescription Refill Support Ticket (2:15 - 2:45):**
   - Type: *"I need an urgent refill on my Atorvastatin prescription sent to CVS on Main St."*
   - AI triggers `create_support_ticket`, issues tracking badge `TCK-1042` with `high` priority, and it immediately appears in the Clinic Tickets Desk.

5. **Action 3 & High-Acuity Emergency Escalation + Live Nurse Takeover (2:45 - 3:30):**
   - Type: *"I'm having sudden sharp chest pain and tightness radiating down my arm."*
   - AI instantly detects emergency triage criteria, posts an emergency advisory, triggers `escalate_to_human`, and rings the **Live Escalation Alert** on the clinic desk!
   - On the right-hand dashboard, the nurse clicks **"Take Over Chat"** and sends: *"Maya, this is Nurse Sarah. Please stay seated; I am dispatching emergency services to your location now."*
   - The message instantly appears in the customer's chat with a "Nurse Sarah (Live Operator)" badge!

6. **Wrap-up & Metrics (3:30 - 4:00):**
   - Highlight the Knowledge Base Manager where clinic policies can be updated in 5 seconds.
   - Conclude: *"In under 4 minutes, PulseCare AI answered insurance questions, booked an appointment, filed a refill ticket, and performed emergency triage with live nurse handoff—saving hours of staff time and ensuring zero patients are lost."*