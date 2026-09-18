import { supabase } from '@/integrations/supabase/client';

export interface TrainingCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  pass_score: number;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TrainingLesson {
  id: string;
  course_id: string;
  title: string;
  content: string | null;
  media_url: string | null;
  position: number;
}

export interface TrainingQuestion {
  id: string;
  course_id: string;
  question: string;
  options: string[];
  correct_index: number;
  position: number;
}

export interface TrainingAssignment {
  id: string;
  course_id: string;
  user_id: string;
  assigned_by: string | null;
  due_date: string | null;
  completed_at: string | null;
}

export interface LessonProgress {
  id: string;
  lesson_id: string;
  course_id: string;
  user_id: string;
  completed_at: string;
}

export interface QuizAttempt {
  id: string;
  course_id: string;
  user_id: string;
  score: number;
  passed: boolean;
  created_at: string;
}

const db = supabase as any;

export const fetchCourses = async (): Promise<TrainingCourse[]> => {
  const { data, error } = await db
    .from('training_courses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const fetchLessons = async (courseId: string): Promise<TrainingLesson[]> => {
  const { data, error } = await db
    .from('training_lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('position');
  if (error) throw error;
  return data ?? [];
};

export const fetchQuestions = async (courseId: string): Promise<TrainingQuestion[]> => {
  const { data, error } = await db
    .from('training_quiz_questions')
    .select('*')
    .eq('course_id', courseId)
    .order('position');
  if (error) throw error;
  return (data ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }));
};

export const fetchAssignments = async (userId?: string): Promise<TrainingAssignment[]> => {
  let query = db.from('training_assignments').select('*').order('due_date', { nullsFirst: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const fetchLessonProgress = async (userId?: string): Promise<LessonProgress[]> => {
  let query = db.from('training_lesson_progress').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const fetchAttempts = async (userId?: string): Promise<QuizAttempt[]> => {
  let query = db.from('training_quiz_attempts').select('*').order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const completeLesson = async (userId: string, courseId: string, lessonId: string) => {
  const { error } = await db
    .from('training_lesson_progress')
    .upsert({ user_id: userId, course_id: courseId, lesson_id: lessonId }, { onConflict: 'lesson_id,user_id' });
  if (error) throw error;
};

export const recordAttempt = async (
  userId: string,
  courseId: string,
  score: number,
  passed: boolean,
  answers: number[],
) => {
  const { error } = await db
    .from('training_quiz_attempts')
    .insert({ user_id: userId, course_id: courseId, score, passed, answers });
  if (error) throw error;
  if (passed) {
    await db
      .from('training_assignments')
      .update({ completed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('course_id', courseId);
  }
};
