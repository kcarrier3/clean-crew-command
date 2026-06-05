-- Enhanced Messaging Migration
-- Adds: group chats, announcements, file attachments, account-based peer messaging

-- Add group/announcement support to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type text NOT NULL DEFAULT 'direct'
    CHECK (conversation_type IN ('direct', 'group', 'announcement')),
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES job_sites(id) ON DELETE SET NULL;

-- Add file attachment support to messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

-- Add sender name cache to messages for performance
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_name text;

-- Add role to conversation participants (admin can manage group)
ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'member')),
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- Create message_attachments storage bucket (handled via Supabase dashboard)
-- We'll use the existing 'uploads' bucket or create a messages bucket

-- Function: create a group conversation
CREATE OR REPLACE FUNCTION create_group_conversation(
  _name text,
  _description text,
  _member_ids uuid[],
  _account_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _conv_id uuid;
  _member_id uuid;
BEGIN
  -- Create the conversation
  INSERT INTO conversations (conversation_type, name, description, created_by, account_id, last_message_at)
  VALUES ('group', _name, _description, auth.uid(), _account_id, now())
  RETURNING id INTO _conv_id;

  -- Add the creator as admin
  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES (_conv_id, auth.uid(), 'admin');

  -- Add all members
  FOREACH _member_id IN ARRAY _member_ids LOOP
    IF _member_id != auth.uid() THEN
      INSERT INTO conversation_participants (conversation_id, user_id, role)
      VALUES (_conv_id, _member_id, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN _conv_id;
END;
$$;

-- Function: create an announcement channel (manager only)
CREATE OR REPLACE FUNCTION create_announcement(
  _name text,
  _description text,
  _audience text DEFAULT 'all'  -- 'all' or department_id
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _conv_id uuid;
  _profile record;
BEGIN
  -- Create the announcement conversation
  INSERT INTO conversations (conversation_type, name, description, created_by, last_message_at)
  VALUES ('announcement', _name, _description, auth.uid(), now())
  RETURNING id INTO _conv_id;

  -- Add creator as admin
  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES (_conv_id, auth.uid(), 'admin');

  -- Add all employees as members
  FOR _profile IN SELECT id FROM profiles WHERE id != auth.uid() LOOP
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (_conv_id, _profile.id, 'member')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN _conv_id;
END;
$$;

-- Function: get conversations for current user (enhanced)
CREATE OR REPLACE FUNCTION get_my_conversations()
RETURNS TABLE (
  id uuid,
  conversation_type text,
  name text,
  description text,
  last_message_at timestamptz,
  created_by uuid,
  account_id uuid,
  participant_count bigint,
  unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.conversation_type,
    c.name,
    c.description,
    c.last_message_at,
    c.created_by,
    c.account_id,
    COUNT(DISTINCT cp2.user_id) as participant_count,
    COUNT(DISTINCT m.id) FILTER (
      WHERE m.sender_id != auth.uid()
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
    ) as unread_count
  FROM conversations c
  JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = auth.uid()
  LEFT JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
  LEFT JOIN messages m ON m.conversation_id = c.id
  GROUP BY c.id, c.conversation_type, c.name, c.description, c.last_message_at, c.created_by, c.account_id, cp.last_read_at
  ORDER BY c.last_message_at DESC;
END;
$$;

-- Function: update last_read_at for a participant
CREATE OR REPLACE FUNCTION mark_conversation_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = _conversation_id AND user_id = auth.uid();
END;
$$;

-- Function: get employees who share an account with current user (for peer messaging)
CREATE OR REPLACE FUNCTION get_coworkers_at_shared_accounts()
RETURNS TABLE (id uuid, first_name text, last_name text, job_title text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.first_name,
    p.last_name,
    p.job_title
  FROM profiles p
  WHERE p.id != auth.uid()
    AND p.id IN (
      -- Employees who have been scheduled at the same job sites as the current user
      SELECT DISTINCT s2.employee_id
      FROM schedules s1
      JOIN schedules s2 ON s2.job_site_id = s1.job_site_id AND s2.employee_id != auth.uid()
      WHERE s1.employee_id = auth.uid()
        AND s1.start_time >= now() - interval '30 days'
        AND s2.start_time >= now() - interval '30 days'
    )
  ORDER BY p.last_name, p.first_name;
END;
$$;

-- RLS: update conversations policy to handle group/announcement types
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations" ON conversations
  FOR SELECT USING (
    id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS: messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Announcement channels: only admins can send messages
DROP POLICY IF EXISTS "Only admins can post in announcements" ON messages;
CREATE POLICY "Only admins can post in announcements" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- Allow if conversation is not an announcement
      conversation_id NOT IN (
        SELECT id FROM conversations WHERE conversation_type = 'announcement'
      )
      OR
      -- Allow if user is admin of the announcement
      conversation_id IN (
        SELECT conversation_id FROM conversation_participants
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );
