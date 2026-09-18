import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  completeLesson, fetchLessons, fetchQuestions, recordAttempt,
  type TrainingCourse, type TrainingLesson, type TrainingQuestion,
} from './trainingApi';

interface Props {
  course: TrainingCourse;
  userId: string;
  completedLessonIds: string[];
  onBack: () => void;
  onChanged: () => void;
}

export const CoursePlayer = ({ course, userId, completedLessonIds, onBack, onChanged }: Props) => {
  const { toast } = useToast();
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [questions, setQuestions] = useState<TrainingQuestion[]>([]);
  const [done, setDone] = useState<string[]>(completedLessonIds);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [l, q] = await Promise.all([fetchLessons(course.id), fetchQuestions(course.id)]);
        setLessons(l);
        setQuestions(q);
      } finally {
        setLoading(false);
      }
    })();
  }, [course.id]);

  const pct = useMemo(
    () => (lessons.length ? Math.round((done.filter((d) => lessons.some((l) => l.id === d)).length / lessons.length) * 100) : 0),
    [done, lessons],
  );

  const markDone = async (lessonId: string) => {
    try {
      await completeLesson(userId, course.id, lessonId);
      setDone((d) => [...new Set([...d, lessonId])]);
      onChanged();
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const submitQuiz = async () => {
    const correct = questions.filter((q) => answers[q.id] === q.correct_index).length;
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= course.pass_score;
    try {
      await recordAttempt(userId, course.id, score, passed, questions.map((q) => answers[q.id] ?? -1));
      setResult({ score, passed });
      onChanged();
      toast({
        title: passed ? 'Passed' : 'Not passed yet',
        description: `You scored ${score}%. Passing score is ${course.pass_score}%.`,
      });
    } catch {
      toast({ title: 'Could not submit', description: 'Please try again.', variant: 'destructive' });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading course…</p>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to training
      </Button>

      <div>
        <h2 className="text-xl font-semibold">{course.title}</h2>
        {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
        <div className="mt-3 flex items-center gap-3">
          <Progress value={pct} className="h-2 max-w-xs" />
          <span className="text-sm text-muted-foreground">{pct}% complete</span>
        </div>
      </div>

      <div className="space-y-3">
        {lessons.map((lesson, i) => {
          const finished = done.includes(lesson.id);
          return (
            <Card key={lesson.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between gap-3">
                  <span>{i + 1}. {lesson.title}</span>
                  {finished && <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lesson.content && <p className="text-sm whitespace-pre-wrap">{lesson.content}</p>}
                {lesson.media_url && (
                  <a
                    href={lesson.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary underline"
                  >
                    Open material <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {!finished && (
                  <div>
                    <Button size="sm" onClick={() => markDone(lesson.id)}>Mark as complete</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {lessons.length === 0 && <p className="text-sm text-muted-foreground">No lessons yet.</p>}
      </div>

      {questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Knowledge check</CardTitle>
            <CardDescription>You need {course.pass_score}% to pass.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {questions.map((q, qi) => (
              <div key={q.id} className="space-y-2">
                <p className="font-medium text-sm">{qi + 1}. {q.question}</p>
                <RadioGroup
                  value={answers[q.id]?.toString() ?? ''}
                  onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
                >
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <RadioGroupItem value={oi.toString()} id={`${q.id}-${oi}`} />
                      <Label htmlFor={`${q.id}-${oi}`} className="font-normal">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Button onClick={submitQuiz} disabled={Object.keys(answers).length < questions.length}>
                Submit answers
              </Button>
              {result && (
                <Badge variant={result.passed ? 'secondary' : 'destructive'}>
                  {result.score}% — {result.passed ? 'Passed' : 'Try again'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CoursePlayer;
