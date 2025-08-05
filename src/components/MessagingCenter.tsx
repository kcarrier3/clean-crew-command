import React, { useState, useEffect, useRef } from 'react';
import { useMessaging } from '@/hooks/useMessaging';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquare, Users } from 'lucide-react';
import { format } from 'date-fns';

const MessagingCenter = () => {
  const { user } = useAuth();
  const {
    conversations,
    messages,
    availableUsers,
    loading,
    fetchMessages,
    sendMessage,
    startConversation,
    markMessagesAsRead,
  } = useMessaging();

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedConversation]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      markMessagesAsRead(selectedConversation);
    }
  }, [selectedConversation, markMessagesAsRead]);

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversation(conversationId);
    fetchMessages(conversationId);
    setShowNewConversation(false);
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageInput.trim()) return;

    await sendMessage(selectedConversation, messageInput);
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartNewConversation = async () => {
    if (!selectedUser) return;

    const conversationId = await startConversation(selectedUser);
    if (conversationId) {
      setSelectedConversation(conversationId);
      setShowNewConversation(false);
      setSelectedUser('');
    }
  };

  const getOtherParticipant = (conversation: any) => {
    return conversation.participants?.find((p: any) => p.user_id !== user?.id);
  };

  const getUnreadCount = (conversationId: string) => {
    const conversationMessages = messages[conversationId] || [];
    return conversationMessages.filter(msg => 
      msg.sender_id !== user?.id && !msg.read_at
    ).length;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-4">
      {/* Conversations List */}
      <Card className="w-1/3">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Button
              size="sm"
              onClick={() => setShowNewConversation(true)}
              className="h-8"
            >
              <Users className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-16rem)]">
            {showNewConversation && (
              <div className="p-4 border-b bg-muted/50">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Start New Conversation</h4>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name} ({user.employee_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleStartNewConversation}
                      disabled={!selectedUser}
                      className="h-8"
                    >
                      Start Chat
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowNewConversation(false)}
                      className="h-8"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const otherUser = getOtherParticipant(conversation);
                const unreadCount = getUnreadCount(conversation.id);
                
                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation.id)}
                    className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedConversation === conversation.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {otherUser?.profiles?.first_name?.charAt(0)}
                          {otherUser?.profiles?.last_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-medium text-sm truncate">
                            {otherUser?.profiles?.first_name} {otherUser?.profiles?.last_name}
                          </p>
                          {unreadCount > 0 && (
                            <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(conversation.last_message_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="flex-1">
        {selectedConversation ? (
          <>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {(() => {
                  const conversation = conversations.find(c => c.id === selectedConversation);
                  const otherUser = getOtherParticipant(conversation);
                  return `${otherUser?.profiles?.first_name} ${otherUser?.profiles?.last_name}`;
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-[calc(100vh-18rem)]">
              {/* Messages */}
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-4 p-1">
                  {(messages[selectedConversation] || []).map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          message.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p>{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender_id === user?.id 
                            ? 'text-primary-foreground/70' 
                            : 'text-muted-foreground'
                        }`}>
                          {format(new Date(message.created_at), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MessagingCenter;