# Fix "Error sending recovery email" before employee rollout

## What we know (checked)
- Invite emails are sent by our own invite function through Resend from `noreply@invites.crewcompass360.com`, and they are being delivered.
- "Forgot password" on the sign-in page does not use that path. It asks Supabase to send the email using the email settings in the Supabase dashboard.
- Julian's account has no record of a reset email ever going out. Across all 9 accounts, only one reset email has ever succeeded (July 1).
- "Error sending recovery email" is the message Supabase gives when its own email settings fail to hand the message off.

## What we don't know
- The exact reason Supabase's email settings fail (wrong key, sender domain, or port). I can't read those settings or Supabase's sign-in logs from here.

## Plan
0. **Prerequisite (you, in Resend):** invites are currently failing with "This API key is not authorized to send emails from invites.crewcompass360.com". Create a Resend key with sending access to invites.crewcompass360.com (or "All domains"), then update the app's stored Resend key. Do this without breaking invoice emails: either one key with access to both domains, or a separate invite key that I wire up as `INVITE_RESEND_API_KEY`. Steps 1–5 depend on this.
1. **Send password resets the same way invites go out.** Add a "request password reset" step on our side that:
   - creates the secure reset link
   - emails it from the same invite sender that already works
   - always shows "If that email is on file, a link is on its way," so nobody can probe which emails exist
   - limits repeat requests (about 1 per minute and 5 per hour per email) so it can't be used to spam people
   - logs each request so we can see sent or failed status, like invites
2. **Point the sign-in page and the in-app "reset password" button at this new step**, instead of Supabase's mailer.
3. **Branded email** matching the invite email (Summit/Crew Compass look, one button, link expiry note).
4. **Test without emailing staff:** confirm an unknown address returns the generic message, the rate limit kicks in, and the reset page accepts a link. Then send one real test only to an address you choose.
5. **Optional check for you in Supabase:** Authentication → SMTP settings. Fixing those also helps other Supabase-sent emails (like email-address changes), but the rollout won't depend on them anymore.

## Technical details
- New edge function `request-password-reset` (no login required): zod-validate the email, look up the user server-side, `auth.admin.generateLink({ type: 'recovery', redirectTo: APP_URL + '/reset-password' })`, send via Resend with `INVITE_FROM_EMAIL`/`INVITE_FROM_NAME`. Return 200 with the same body for every outcome.
- New table `password_reset_requests` (email hash, user id, status, provider id, error, created_at) with GRANTs to service_role only, RLS on, no client policies. Rate limit is checked in the function.
- `src/pages/Auth.tsx` and `useAuth.sendPasswordResetEmail` call `supabase.functions.invoke('request-password-reset')` instead of `resetPasswordForEmail`.
- Reuse invite email HTML and helpers from `invite-employee`; keep the billing sender untouched.
- Record the rule in AGENTS.md: all auth emails go through our Resend auth sender, not Supabase SMTP.
- Add the item to roadmap.md.
