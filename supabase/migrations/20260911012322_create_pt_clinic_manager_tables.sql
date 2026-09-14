/*
# Create PT clinic manager tables

1. New Tables
- `patients`
  - `id` (uuid, primary key)
  - `name` (text, patient display name)
  - `diagnosis` (text, primary diagnosis)
  - `age` (integer, optional age)
  - `gender` (text, optional gender)
  - `phone` (text, optional contact phone)
  - `email` (text, optional contact email)
  - `address` (text, optional address)
  - `status` (text, active or archived)
  - `created_at` and `updated_at` timestamps
- `evaluations`
  - `id` (uuid, primary key)
  - `patient_id` (uuid, related patient)
  - `subjective` (text, patient-reported concerns)
  - `objective` (text, clinical observations)
  - `assessment` (text, therapist assessment)
  - `plan` (text, treatment plan)
  - `saved_at` timestamp

2. Security
- Row level security is enabled on both tables.
- This is an intentionally shared single-tenant clinic workspace, so anonymous and authenticated users can create, read, update, and delete records.

3. Important Notes
- Patient deletion cascades to the related evaluation.
- Archived patients remain stored and can be restored from the archive view.
*/

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  diagnosis text NOT NULL DEFAULT '',
  age integer,
  gender text,
  phone text,
  email text,
  address text,
  nationality text,
  attending_physician text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  document_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  subjective text NOT NULL DEFAULT '',
  objective text NOT NULL DEFAULT '',
  assessment text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT '',
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id)
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_select_patients" ON public.patients;
CREATE POLICY "shared_select_patients" ON public.patients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "shared_insert_patients" ON public.patients;
CREATE POLICY "shared_insert_patients" ON public.patients FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_update_patients" ON public.patients;
CREATE POLICY "shared_update_patients" ON public.patients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_delete_patients" ON public.patients;
CREATE POLICY "shared_delete_patients" ON public.patients FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_select_evaluations" ON public.evaluations;
CREATE POLICY "shared_select_evaluations" ON public.evaluations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "shared_insert_evaluations" ON public.evaluations;
CREATE POLICY "shared_insert_evaluations" ON public.evaluations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_update_evaluations" ON public.evaluations;
CREATE POLICY "shared_update_evaluations" ON public.evaluations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_delete_evaluations" ON public.evaluations;
CREATE POLICY "shared_delete_evaluations" ON public.evaluations FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS patients_status_idx ON public.patients(status);
CREATE INDEX IF NOT EXISTS patients_updated_at_idx ON public.patients(updated_at DESC);
CREATE INDEX IF NOT EXISTS evaluations_patient_id_idx ON public.evaluations(patient_id);
