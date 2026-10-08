# Finish the Training module

The Training area (courses, lessons, quizzes, assignments, progress) is built and in the sidebar for managers and staff. One small step is left.

## Remaining step
- Let a staff member mark their own assigned course as completed when they pass its quiz. Right now the pass is saved, but the "completed" mark on their assignment is blocked because only managers can change assignments.

## Technical details
- Add a database rule on `training_assignments` allowing an update only where `user_id = auth.uid()`.
- No other changes. The supply data request was read-only and changes nothing.
