import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  message_type: string;
}

interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  participants: {
    user_id: string;
    profiles: {
      first_name: string;
      last_name: string;
    };
  }[];
  messages?: Message[];
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  employee_id: string;
}

export const useMessaging = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{ [conversationId: string]: Message[] }>({});
  const [loading, setLoading] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const { user, isManager } = useAuth();
  const { toast } = useToast();

  // Fetch available users for messaging based on role permissions
  const fetchAvailableUsers = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, employee_id')
        .neq('id', user.id)
        .eq('active', true);

      // If user is an employee, only show managers/admins
      if (!isManager()) {
        const { data: managerUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['manager', 'admin']);

        if (managerUsers) {
          const managerIds = managerUsers.map(m => m.user_id);
          query = query.in('id', managerIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching available users:', error);
      toast({
        title: "Error",
        description: "Failed to load available users",
        variant: "destructive",
      });
    }
  }, [user, isManager, toast]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          created_at,
          updated_at,
          last_message_at,
          conversation_participants (
            user_id
          )
        `)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data for participants
      const conversationsWithProfiles = await Promise.all(
        (data || []).map(async (conv) => {
          const participantIds = conv.conversation_participants.map(p => p.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', participantIds);

          return {
            ...conv,
            participants: conv.conversation_participants.map(p => ({
              user_id: p.user_id,
              profiles: profiles?.find(profile => profile.id === p.user_id) || {
                first_name: 'Unknown',
                last_name: 'User'
              }
            }))
          };
        })
      );

      setConversations(conversationsWithProfiles);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(prev => ({
        ...prev,
        [conversationId]: data || []
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Send a message
  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    if (!user || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Start a new conversation
  const startConversation = useCallback(async (recipientId: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        _user1_id: user.id,
        _user2_id: recipientId
      });

      if (error) throw error;

      // Refresh conversations
      await fetchConversations();
      return data;
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation. You may not have permission to message this user.",
        variant: "destructive",
      });
      return null;
    }
  }, [user, fetchConversations, toast]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messaging')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => ({
            ...prev,
            [newMessage.conversation_id]: [
              ...(prev[newMessage.conversation_id] || []),
              newMessage
            ]
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      Promise.all([
        fetchConversations(),
        fetchAvailableUsers()
      ]).finally(() => setLoading(false));
    }
  }, [user, fetchConversations, fetchAvailableUsers]);

  return {
    conversations,
    messages,
    availableUsers,
    loading,
    fetchMessages,
    sendMessage,
    startConversation,
    markMessagesAsRead,
  };
};