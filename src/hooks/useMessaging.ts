import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type ConversationType = 'direct' | 'group' | 'announcement';

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  name: string | null;
  description: string | null;
  last_message_at: string;
  created_by: string | null;
  account_id: string | null;
  participant_count: number;
  unread_count: number;
  participants?: Participant[];
}

export interface Participant {
  user_id: string;
  role: 'admin' | 'member';
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    job_title?: string | null;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  read_at: string | null;
  created_at: string;
  sender_name?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
}

export interface AvailableUser {
  id: string;
  first_name: string;
  last_name: string;
  job_title?: string | null;
  employee_id?: string | null;
}

export const useMessaging = () => {
  const { user, profile, isManager } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [coworkers, setCoworkers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          id, conversation_type, name, description, last_message_at, created_by, account_id,
          conversation_participants!inner(user_id, role, last_read_at)
        `)
        .eq('conversation_participants.user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;

      const enriched = await Promise.all((convData || []).map(async (conv: any) => {
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('user_id, role, profiles(id, first_name, last_name, job_title)')
          .eq('conversation_id', conv.id);

        const myParticipant = conv.conversation_participants?.find((p: any) => p.user_id === user.id);
        const lastReadAt = myParticipant?.last_read_at;
        let unreadQuery = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id);
        if (lastReadAt) {
          unreadQuery = unreadQuery.gt('created_at', lastReadAt);
        }
        const { count: unreadCount } = await unreadQuery;

        return {
          ...conv,
          participant_count: (parts || []).length,
          unread_count: unreadCount || 0,
          participants: (parts || []).map((p: any) => ({
            user_id: p.user_id,
            role: p.role,
            profiles: p.profiles || { id: p.user_id, first_name: 'Unknown', last_name: 'User' }
          }))
        } as Conversation;
      }));

      setConversations(enriched);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [user]);

  const fetchAvailableUsers = useCallback(async () => {
    if (!user) return;
    try {
      if (isManager()) {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, job_title, employee_id')
          .neq('id', user.id)
          .order('last_name');
        setAvailableUsers(data || []);
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, job_title, employee_id')
          .in('job_title', ['Owner', 'General Manager', 'Operations Manager', 'Area Manager', 'Team Lead', 'Supervisor'])
          .neq('id', user.id)
          .order('last_name');
        setAvailableUsers(data || []);
      }
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  }, [user, isManager]);

  const fetchCoworkers = useCallback(async () => {
    if (!user || isManager()) return;
    try {
      const { data: mySchedules } = await supabase
        .from('schedules')
        .select('job_site_id')
        .eq('employee_id', user.id)
        .gte('start_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const jobSiteIds = [...new Set((mySchedules || []).map((s: any) => s.job_site_id).filter(Boolean))];
      if (jobSiteIds.length === 0) { setCoworkers([]); return; }

      const { data: sharedSchedules } = await supabase
        .from('schedules')
        .select('employee_id')
        .in('job_site_id', jobSiteIds)
        .neq('employee_id', user.id)
        .gte('start_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const coworkerIds = [...new Set((sharedSchedules || []).map((s: any) => s.employee_id).filter(Boolean))];
      if (coworkerIds.length === 0) { setCoworkers([]); return; }

      const { data: coworkerProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, job_title, employee_id')
        .in('id', coworkerIds)
        .order('last_name');

      setCoworkers(coworkerProfiles || []);
    } catch (error) {
      console.error('Error fetching coworkers:', error);
    }
  }, [user, isManager]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(prev => ({ ...prev, [conversationId]: data || [] }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({ title: 'Error', description: 'Failed to load messages', variant: 'destructive' });
    }
  }, [toast]);

  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    attachment?: { url: string; name: string; type: string; size: number }
  ) => {
    if (!user) return;
    const senderName = profile ? `${profile.first_name} ${profile.last_name}` : user.email || 'Unknown';
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          sender_name: senderName,
          content: content.trim() || (attachment ? attachment.name : ''),
          message_type: attachment ? 'file' : 'text',
          attachment_url: attachment?.url || null,
          attachment_name: attachment?.name || null,
          attachment_type: attachment?.type || null,
          attachment_size: attachment?.size || null,
        });
      if (error) throw error;
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    }
  }, [user, profile, toast]);

  const uploadFile = useCallback(async (file: File): Promise<{ url: string; name: string; type: string; size: number } | null> => {
    if (!user) return null;
    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `messages/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      return { url: urlData.publicUrl, name: file.name, type: file.type, size: file.size };
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ title: 'Upload failed', description: 'Could not upload the file.', variant: 'destructive' });
      return null;
    } finally {
      setUploadingFile(false);
    }
  }, [user, toast]);

  const startDirectConversation = useCallback(async (recipientId: string) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        _user1_id: user.id,
        _user2_id: recipientId
      });
      if (error) throw error;
      await fetchConversations();
      return data as string;
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({ title: 'Error', description: 'Failed to start conversation.', variant: 'destructive' });
      return null;
    }
  }, [user, fetchConversations, toast]);

  const createGroupConversation = useCallback(async (
    name: string,
    description: string,
    memberIds: string[]
  ) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.rpc('create_group_conversation', {
        _name: name,
        _description: description,
        _member_ids: memberIds,
        _account_id: null
      });
      if (error) throw error;
      await fetchConversations();
      return data as string;
    } catch (error) {
      console.error('Error creating group:', error);
      toast({ title: 'Error', description: 'Failed to create group conversation.', variant: 'destructive' });
      return null;
    }
  }, [user, fetchConversations, toast]);

  const createAnnouncement = useCallback(async (name: string, description: string) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.rpc('create_announcement', {
        _name: name,
        _description: description,
        _audience: 'all'
      });
      if (error) throw error;
      await fetchConversations();
      return data as string;
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast({ title: 'Error', description: 'Failed to create announcement channel.', variant: 'destructive' });
      return null;
    }
  }, [user, fetchConversations, toast]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    try {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error marking read:', error);
    }
  }, [user]);

  const markMessagesAsRead = markConversationRead;
  const startConversation = startDirectConversation;

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messaging-enhanced')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new as Message;
        setMessages(prev => ({
          ...prev,
          [newMessage.conversation_id]: [...(prev[newMessage.conversation_id] || []), newMessage]
        }));
        fetchConversations();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  useEffect(() => {
    if (user) {
      Promise.all([fetchConversations(), fetchAvailableUsers(), fetchCoworkers()])
        .finally(() => setLoading(false));
    }
  }, [user, fetchConversations, fetchAvailableUsers, fetchCoworkers]);

  return {
    conversations, messages, availableUsers, coworkers,
    loading, uploadingFile,
    fetchMessages, sendMessage, uploadFile,
    startConversation, startDirectConversation,
    createGroupConversation, createAnnouncement,
    markMessagesAsRead, markConversationRead,
  };
};
