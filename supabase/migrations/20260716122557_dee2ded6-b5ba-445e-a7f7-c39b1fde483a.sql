
-- 1) conversation_participants: prevent self-join to arbitrary conversations
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;
CREATE POLICY "Users can add participants to conversations"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
);

-- 2) messages: consolidate insert policies so announcement rule can't be OR-bypassed
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Only admins can post in announcements" ON public.messages;

CREATE POLICY "Users can send messages to their conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_participant(conversation_id, auth.uid())
  AND (
    NOT EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.conversation_type = 'announcement'
    )
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role = 'admin'
    )
  )
);

-- 3) supply_items: restrict read of cost/pricing to supply managers
DROP POLICY IF EXISTS "authenticated read items" ON public.supply_items;
CREATE POLICY "Supply managers read items"
ON public.supply_items
FOR SELECT
TO authenticated
USING (public.is_supply_manager(auth.uid()));

-- 4) Revoke public execute on trigger-only SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.prevent_job_title_self_escalation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_job_title_self_escalation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_job_title_self_escalation() FROM authenticated;
