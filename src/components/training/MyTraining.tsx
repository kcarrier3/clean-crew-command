import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import CoursePlayer from './CoursePlayer';
import {
  fetchAssignments, fetchAttempts, fetchCourses, fetchLessonProgress,
  type LessonProgress, type QuizAttempt, type TrainingAssignment, type TrainingCourse,
} from './trainingApi';

export const MyTraining = ({ userId }: { userId: string }) => {
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [active, setActive] = useState<TrainingCourse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, a, p, at] = await Promise.all([
        fetchCourses(),
        fetchAssignments(userId),
        fetchLessonProgress(userId),
        fetchAttempts(userId),
      ]);
      setCourses(c.filter((x) => x.is_published));
      setAssignments(a);
      setProgress(p);
      setAttempts(at);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (active) {
    return (
      <CoursePlayer
        course={active}
        userId={userId}
        completedLessonIds={progress.filter((p) => p.course_id === active.id).map((p) => p.lesson_id)}
        onBack={() => { setActive(null); load(); }}
        onChanged={load}
      />
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading your training…</p>;

  const assignedIds = new Set(assignments.map((a) => a.course_id));
  const assignedCourses = courses.filter((c) => assignedIds.has(c.id));
  const optional = courses.filter((c) => !assignedIds.has(c.id));

  const renderCard = (course: TrainingCourse) => {
    const assignment = assignments.find((a) => a.course_id === course.id);
    const passed = attempts.some((a) => a.course_id === course.id && a.passed);
    return (
      <Card key={course.id}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-start justify-between gap-3">
            <span>{course.title}</span>
            {passed && <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>}
          </CardTitle>
          {course.description && <CardDescription>{course.description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {course.category && <Badge variant="outline">{course.category}</Badge>}
            {assignment?.due_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> Due {new Date(assignment.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
          <Button size="sm" onClick={() => setActive(course)}>{passed ? 'Review' : 'Start'}</Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Assigned to me</h3>
        {assignedCourses.length ? assignedCourses.map(renderCard)
          : <p className="text-sm text-muted-foreground">No training assigned right now.</p>}
      </section>

      {optional.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold">Available courses</h3>
          {optional.map(renderCard)}
        </section>
      )}
    </div>
  );
};

export default MyTraining;
