import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import CourseEditorDialog from './CourseEditorDialog';
import {
  fetchAssignments, fetchAttempts, fetchCourses, fetchLessonProgress,
  type QuizAttempt, type TrainingAssignment, type TrainingCourse,
} from './trainingApi';

const db = supabase as any;

interface Person { id: string; first_name: string; last_name: string; job_title: string | null }

export const TrainingAdmin = ({ userId }: { userId: string }) => {
  const { toast } = useToast();
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingCourse | null>(null);
  const [assignCourse, setAssignCourse] = useState<TrainingCourse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, a, at, p] = await Promise.all([
        fetchCourses(),
        fetchAssignments(),
        fetchAttempts(),
        db.from('profiles').select('id, first_name, last_name, job_title').eq('active', true).order('first_name'),
      ]);
      setCourses(c);
      setAssignments(a);
      setAttempts(at);
      setPeople(p.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nameOf = useMemo(
    () => (id: string) => {
      const p = people.find((x) => x.id === id);
      return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
    },
    [people],
  );

  const removeCourse = async (id: string) => {
    const { error } = await db.from('training_courses').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Deleted', description: 'Course removed.' });
    load();
  };

  const saveAssignments = async () => {
    if (!assignCourse || selected.length === 0) return;
    const rows = selected.map((uid) => ({
      course_id: assignCourse.id,
      user_id: uid,
      assigned_by: userId,
      due_date: dueDate || null,
    }));
    const { error } = await db.from('training_assignments').upsert(rows, { onConflict: 'course_id,user_id' });
    if (error) {
      toast({ title: 'Could not assign', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Assigned', description: `${selected.length} staff assigned to ${assignCourse.title}.` });
    setAssignCourse(null);
    setSelected([]);
    setDueDate('');
    load();
  };

  const unassign = async (id: string) => {
    await db.from('training_assignments').delete().eq('id', id);
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading training…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Courses</h3>
          <p className="text-sm text-muted-foreground">Build lessons and knowledge checks for your staff.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New course
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {courses.map((course) => {
          const assigned = assignments.filter((a) => a.course_id === course.id);
          const passedCount = new Set(attempts.filter((a) => a.course_id === course.id && a.passed).map((a) => a.user_id)).size;
          return (
            <Card key={course.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-start justify-between gap-2">
                  <span>{course.title}</span>
                  <Badge variant={course.is_published ? 'secondary' : 'outline'}>
                    {course.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </CardTitle>
                {course.description && <CardDescription>{course.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {assigned.length} assigned · {passedCount} passed · pass mark {course.pass_score}%
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(course); setEditorOpen(true); }}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setAssignCourse(course); setSelected([]); }}>
                    <UserPlus className="h-4 w-4 mr-1" /> Assign
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeCourse(course.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {courses.length === 0 && <p className="text-sm text-muted-foreground">No courses yet.</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff progress</CardTitle>
          <CardDescription>Who has been assigned what, and how they scored.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => {
                const course = courses.find((c) => c.id === a.course_id);
                const best = attempts
                  .filter((x) => x.course_id === a.course_id && x.user_id === a.user_id)
                  .sort((x, y) => y.score - x.score)[0];
                return (
                  <TableRow key={a.id}>
                    <TableCell>{nameOf(a.user_id)}</TableCell>
                    <TableCell>{course?.title ?? '—'}</TableCell>
                    <TableCell>{a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>
                      {best?.passed ? (
                        <Badge variant="secondary">Passed {best.score}%</Badge>
                      ) : best ? (
                        <Badge variant="destructive">Scored {best.score}%</Badge>
                      ) : (
                        <Badge variant="outline">Not started</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => unassign(a.id)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">Nothing assigned yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CourseEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        course={editing}
        userId={userId}
        onSaved={load}
      />

      <Dialog open={!!assignCourse} onOpenChange={(v) => !v && setAssignCourse(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign “{assignCourse?.title}”</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="due">Due date (optional)</Label>
              <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Staff</Label>
              <div className="space-y-2 rounded-md border p-3 max-h-64 overflow-y-auto">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={(v) =>
                        setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))
                      }
                    />
                    <span>{p.first_name} {p.last_name}</span>
                    {p.job_title && <span className="text-muted-foreground text-xs">{p.job_title}</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignCourse(null)}>Cancel</Button>
            <Button onClick={saveAssignments} disabled={selected.length === 0}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingAdmin;
