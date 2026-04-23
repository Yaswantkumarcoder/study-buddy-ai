CREATE TABLE public.test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  test_type text NOT NULL DEFAULT 'quiz',
  title text,
  score numeric NOT NULL,
  max_score numeric NOT NULL,
  percentage numeric GENERATED ALWAYS AS (CASE WHEN max_score > 0 THEN ROUND((score / max_score) * 100, 2) ELSE 0 END) STORED,
  difficulty integer DEFAULT 3,
  notes text,
  taken_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own test results" ON public.test_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own test results" ON public.test_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own test results" ON public.test_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own test results" ON public.test_results FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_test_results_user_taken ON public.test_results(user_id, taken_at DESC);