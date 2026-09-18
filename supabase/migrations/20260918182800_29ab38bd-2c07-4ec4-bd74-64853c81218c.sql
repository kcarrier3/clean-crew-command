CREATE OR REPLACE FUNCTION public.can_manage_training(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager')
$$;

CREATE TABLE public.training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  pass_score integer NOT NULL DEFAULT 80,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_courses TO authenticated;
GRANT ALL ON public.training_courses TO service_role;
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage courses" ON public.training_courses FOR ALL TO authenticated
  USING (public.can_manage_training(auth.uid())) WITH CHECK (public.can_manage_training(auth.uid()));
CREATE POLICY "Staff view published courses" ON public.training_courses FOR SELECT TO authenticated
  USING (is_published);

CREATE TABLE public.training_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  media_url text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_lessons TO authenticated;
GRANT ALL ON public.training_lessons TO service_role;
ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage lessons" ON public.training_lessons FOR ALL TO authenticated
  USING (public.can_manage_training(auth.uid())) WITH CHECK (public.can_manage_training(auth.uid()));
CREATE POLICY "Staff view lessons of published courses" ON public.training_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_courses c WHERE c.id = course_id AND c.is_published));

CREATE TABLE public.training_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_quiz_questions TO authenticated;
GRANT ALL ON public.training_quiz_questions TO service_role;
ALTER TABLE public.training_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage questions" ON public.training_quiz_questions FOR ALL TO authenticated
  USING (public.can_manage_training(auth.uid())) WITH CHECK (public.can_manage_training(auth.uid()));
CREATE POLICY "Staff view questions of published courses" ON public.training_quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_courses c WHERE c.id = course_id AND c.is_published));

CREATE TABLE public.training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_assignments TO authenticated;
GRANT ALL ON public.training_assignments TO service_role;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage assignments" ON public.training_assignments FOR ALL TO authenticated
  USING (public.can_manage_training(auth.uid())) WITH CHECK (public.can_manage_training(auth.uid()));
CREATE POLICY "Staff view own assignments" ON public.training_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.training_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.training_lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_lesson_progress TO authenticated;
GRANT ALL ON public.training_lesson_progress TO service_role;
ALTER TABLE public.training_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage own lesson progress" ON public.training_lesson_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Managers view lesson progress" ON public.training_lesson_progress FOR SELECT TO authenticated
  USING (public.can_manage_training(auth.uid()));

CREATE TABLE public.training_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_quiz_attempts TO authenticated;
GRANT ALL ON public.training_quiz_attempts TO service_role;
ALTER TABLE public.training_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage own attempts" ON public.training_quiz_attempts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Managers view attempts" ON public.training_quiz_attempts FOR SELECT TO authenticated
  USING (public.can_manage_training(auth.uid()));

CREATE TRIGGER update_training_courses_updated_at BEFORE UPDATE ON public.training_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_lessons_updated_at BEFORE UPDATE ON public.training_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_questions_updated_at BEFORE UPDATE ON public.training_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_assignments_updated_at BEFORE UPDATE ON public.training_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_training_lessons_course ON public.training_lessons(course_id);
CREATE INDEX idx_training_questions_course ON public.training_quiz_questions(course_id);
CREATE INDEX idx_training_assignments_user ON public.training_assignments(user_id);
CREATE INDEX idx_training_progress_user ON public.training_lesson_progress(user_id);
CREATE INDEX idx_training_attempts_user ON public.training_quiz_attempts(user_id);