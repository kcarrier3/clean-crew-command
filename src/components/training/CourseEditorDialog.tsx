import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { fetchLessons, fetchQuestions, type TrainingCourse } from './trainingApi';

const db = supabase as any;

interface LessonDraft { id?: string; title: string; content: string; media_url: string }
interface QuestionDraft { id?: string; question: string; options: string[]; correct_index: number }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: TrainingCourse | null;
  userId: string;
  onSaved: () => void;
}

export const CourseEditorDialog = ({ open, onOpenChange, course, userId, onSaved }: Props) => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [passScore, setPassScore] = useState(80);
  const [published, setPublished] = useState(false);
  const [lessons, setLessons] = useState<LessonDraft[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(course?.title ?? '');
    setDescription(course?.description ?? '');
    setCategory(course?.category ?? '');
    setPassScore(course?.pass_score ?? 80);
    setPublished(course?.is_published ?? false);
    if (course) {
      (async () => {
        const [l, q] = await Promise.all([fetchLessons(course.id), fetchQuestions(course.id)]);
        setLessons(l.map((x) => ({ id: x.id, title: x.title, content: x.content ?? '', media_url: x.media_url ?? '' })));
        setQuestions(q.map((x) => ({ id: x.id, question: x.question, options: x.options.length ? x.options : ['', ''], correct_index: x.correct_index })));
      })();
    } else {
      setLessons([{ title: '', content: '', media_url: '' }]);
      setQuestions([]);
    }
  }, [open, course]);

  const save = async () => {
    if (!title.trim()) {
      toast({ title: 'Add a title', description: 'The course needs a name.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let courseId = course?.id;
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        pass_score: passScore,
        is_published: published,
      };
      if (courseId) {
        const { error } = await db.from('training_courses').update(payload).eq('id', courseId);
        if (error) throw error;
      } else {
        const { data, error } = await db
          .from('training_courses')
          .insert({ ...payload, created_by: userId })
          .select('id')
          .single();
        if (error) throw error;
        courseId = data.id;
      }

      await db.from('training_lessons').delete().eq('course_id', courseId);
      const validLessons = lessons.filter((l) => l.title.trim());
      if (validLessons.length) {
        const { error } = await db.from('training_lessons').insert(
          validLessons.map((l, i) => ({
            course_id: courseId,
            title: l.title.trim(),
            content: l.content.trim() || null,
            media_url: l.media_url.trim() || null,
            position: i,
          })),
        );
        if (error) throw error;
      }

      await db.from('training_quiz_questions').delete().eq('course_id', courseId);
      const validQuestions = questions.filter((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2);
      if (validQuestions.length) {
        const { error } = await db.from('training_quiz_questions').insert(
          validQuestions.map((q, i) => ({
            course_id: courseId,
            question: q.question.trim(),
            options: q.options.filter((o) => o.trim()),
            correct_index: q.correct_index,
            position: i,
          })),
        );
        if (error) throw error;
      }

      toast({ title: 'Saved', description: 'Course updated.' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit course' : 'New course'}</DialogTitle>
          <DialogDescription>Build the lessons staff work through, then add a knowledge check.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-title">Title</Label>
            <Input id="course-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Restroom cleaning standards" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-desc">Description</Label>
            <Textarea id="course-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="course-cat">Category</Label>
              <Input id="course-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Safety" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-score">Passing score (%)</Label>
              <Input id="course-score" type="number" min={0} max={100} value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium text-sm">Published</div>
              <p className="text-xs text-muted-foreground">Staff only see published courses.</p>
            </div>
            <Switch checked={published} onCheckedChange={setPublished} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Lessons</h4>
              <Button size="sm" variant="outline" onClick={() => setLessons((l) => [...l, { title: '', content: '', media_url: '' }])}>
                <Plus className="h-4 w-4 mr-1" /> Add lesson
              </Button>
            </div>
            {lessons.map((lesson, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={lesson.title}
                    placeholder={`Lesson ${i + 1} title`}
                    onChange={(e) => setLessons((ls) => ls.map((l, x) => (x === i ? { ...l, title: e.target.value } : l)))}
                  />
                  <Button size="icon" variant="ghost" onClick={() => setLessons((ls) => ls.filter((_, x) => x !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  rows={3}
                  placeholder="What the employee should read or watch"
                  value={lesson.content}
                  onChange={(e) => setLessons((ls) => ls.map((l, x) => (x === i ? { ...l, content: e.target.value } : l)))}
                />
                <Input
                  placeholder="Link to a video or document (optional)"
                  value={lesson.media_url}
                  onChange={(e) => setLessons((ls) => ls.map((l, x) => (x === i ? { ...l, media_url: e.target.value } : l)))}
                />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Quiz questions</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuestions((q) => [...q, { question: '', options: ['', ''], correct_index: 0 }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Add question
              </Button>
            </div>
            {questions.map((q, qi) => (
              <div key={qi} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={q.question}
                    placeholder={`Question ${qi + 1}`}
                    onChange={(e) => setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, question: e.target.value } : x)))}
                  />
                  <Button size="icon" variant="ghost" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct_index === oi}
                      onChange={() => setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, correct_index: oi } : x)))}
                      aria-label={`Correct answer ${oi + 1}`}
                    />
                    <Input
                      value={opt}
                      placeholder={`Answer ${oi + 1}`}
                      onChange={(e) =>
                        setQuestions((qs) =>
                          qs.map((x, i) => (i === qi ? { ...x, options: x.options.map((o, y) => (y === oi ? e.target.value : o)) } : x)),
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, options: [...x.options, ''] } : x)))}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add answer choice
                </Button>
                <p className="text-xs text-muted-foreground">Select the circle next to the correct answer.</p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save course'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CourseEditorDialog;
