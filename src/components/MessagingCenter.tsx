import React, { useState, useEffect, useRef } from 'react';
import { useMessaging, Conversation, ConversationType } from '@/hooks/useMessaging';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Send, MessageSquare, Users, Megaphone, Plus, Paperclip, FileText,
  Image as ImageIcon, Download, ChevronLeft, UserPlus, X
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const formatMessageDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
};

const getConversationIcon = (type: ConversationType) => {
  if (type === 'announcement') return <Megaphone className="h-4 w-4 text-orange-500" />;
  if (type === 'group') return <Users className="h-4 w-4 text-blue-500" />;
  return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
};

const getConversationLabel = (conv: Conversation, currentUserId: string) => {
  if (conv.name) return conv.name;
  if (conv.conversation_type === 'direct') {
    const other = conv.participants?.find(p => p.user_id !== currentUserId);
    if (other?.profiles) return `${other.profiles.first_name} ${other.profiles.last_name}`;
  }
  return 'Conversation';
};

const FileSizeLabel = ({ bytes }: { bytes: number }) => {
  if (bytes < 1024) return <span>{bytes} B</span>;
  if (bytes < 1024 * 1024) return <span>{(bytes / 1024).toFixed(1)} KB</span>;
  return <span>{(bytes / (1024 * 1024)).toFixed(1)} MB</span>;
};

const MessagingCenter = () => {
  const { user } = useAuth();
  const {
    conversations, messages, availableUsers, coworkers,
    loading, uploadingFile,
    fetchMessages, sendMessage, uploadFile,
    startDirectConversation, createGroupConversation, createAnnouncement,
    markConversationRead,
  } = useMessaging();
  const { isManager } = useAuth();

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newType, setNewType] = useState<'direct' | 'group' | 'announcement'>('direct');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedDirectUser, setSelectedDirectUser] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation]);

  useEffect(() => {
    if (selectedConversation) {
      markConversationRead(selectedConversation);
    }
  }, [selectedConversation, markConversationRead]);

  const handleConversationSelect = (convId: string) => {
    setSelectedConversation(convId);
    fetchMessages(convId);
  };

  const handleSend = async () => {
    if (!selectedConversation) return;
    if (!messageInput.trim() && !pendingFile) return;

    let attachment = undefined;
    if (pendingFile) {
      const uploaded = await uploadFile(pendingFile);
      if (uploaded) attachment = uploaded;
      setPendingFile(null);
    }

    await sendMessage(selectedConversation, messageInput, attachment);
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    e.target.value = '';
  };

  const handleCreateConversation = async () => {
    setCreating(true);
    try {
      let convId: string | null = null;
      if (newType === 'direct') {
        if (!selectedDirectUser) return;
        convId = await startDirectConversation(selectedDirectUser);
      } else if (newType === 'group') {
        if (!newGroupName.trim() || selectedMembers.length === 0) return;
        convId = await createGroupConversation(newGroupName, newGroupDesc, selectedMembers);
      } else if (newType === 'announcement') {
        if (!newGroupName.trim()) return;
        convId = await createAnnouncement(newGroupName, newGroupDesc);
      }
      if (convId) {
        setSelectedConversation(convId);
        fetchMessages(convId);
        setShowNewDialog(false);
        resetNewForm();
      }
    } finally {
      setCreating(false);
    }
  };

  const resetNewForm = () => {
    setNewGroupName('');
    setNewGroupDesc('');
    setSelectedMembers([]);
    setSelectedDirectUser('');
  };

  const toggleMember = (id: string) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);
  const convMessages = selectedConversation ? (messages[selectedConversation] || []) : [];

  // Determine if current user is admin of selected conversation
  const isConvAdmin = selectedConv?.participants?.find(
    p => p.user_id === user?.id && p.role === 'admin'
  );
  const isAnnouncementChannel = selectedConv?.conversation_type === 'announcement';
  const canSendMessage = !isAnnouncementChannel || !!isConvAdmin;

  // Users available for new direct messages (managers see all, employees see managers + coworkers)
  const directMessageUsers = isManager()
    ? availableUsers
    : [...availableUsers, ...coworkers.filter(c => !availableUsers.find(u => u.id === c.id))];

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
      <Card className={`${selectedConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3`}>
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Button size="sm" onClick={() => setShowNewDialog(true)} className="h-8">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Click "New" to start one</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const label = getConversationLabel(conv, user?.id || '');
                const isSelected = selectedConversation === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleConversationSelect(conv.id)}
                    className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-muted' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs">
                            {conv.conversation_type === 'announcement'
                              ? <Megaphone className="h-4 w-4" />
                              : conv.conversation_type === 'group'
                              ? <Users className="h-4 w-4" />
                              : label.substring(0, 2).toUpperCase()
                            }
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {getConversationIcon(conv.conversation_type)}
                            <p className="font-medium text-sm truncate">{label}</p>
                          </div>
                          {conv.unread_count > 0 && (
                            <Badge className="ml-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs flex-shrink-0">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatMessageDate(conv.last_message_at)}
                          {conv.conversation_type !== 'direct' && (
                            <span className="ml-1">· {conv.participant_count} members</span>
                          )}
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
      <Card className={`${!selectedConversation ? 'hidden md:flex' : 'flex'} flex-col flex-1`}>
        {selectedConversation && selectedConv ? (
          <>
            <CardHeader className="pb-3 flex-shrink-0 border-b">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getConversationIcon(selectedConv.conversation_type)}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">
                    {getConversationLabel(selectedConv, user?.id || '')}
                  </CardTitle>
                  {selectedConv.description && (
                    <p className="text-xs text-muted-foreground truncate">{selectedConv.description}</p>
                  )}
                  {selectedConv.conversation_type !== 'direct' && (
                    <p className="text-xs text-muted-foreground">{selectedConv.participant_count} members</p>
                  )}
                </div>
                {isAnnouncementChannel && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs flex-shrink-0">
                    Announcements
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex flex-col flex-1 overflow-hidden p-0">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {convMessages.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No messages yet. Say hello!</p>
                    </div>
                  )}
                  {convMessages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    const isFile = msg.message_type === 'file';
                    const isImage = isFile && msg.attachment_type?.startsWith('image/');
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] space-y-1`}>
                          {!isMe && selectedConv.conversation_type !== 'direct' && (
                            <p className="text-xs text-muted-foreground px-1">
                              {msg.sender_name || 'Unknown'}
                            </p>
                          )}
                          <div className={`rounded-2xl px-3 py-2 text-sm ${
                            isMe
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted rounded-bl-sm'
                          }`}>
                            {isFile && msg.attachment_url ? (
                              <div className="space-y-1">
                                {isImage ? (
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={msg.attachment_url}
                                      alt={msg.attachment_name || 'Image'}
                                      className="max-w-xs rounded-lg max-h-48 object-cover"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={msg.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 hover:underline ${isMe ? 'text-primary-foreground' : 'text-foreground'}`}
                                  >
                                    <FileText className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate max-w-[200px]">{msg.attachment_name}</span>
                                    <Download className="h-3 w-3 flex-shrink-0" />
                                  </a>
                                )}
                                {msg.attachment_size && (
                                  <p className={`text-xs ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    <FileSizeLabel bytes={msg.attachment_size} />
                                  </p>
                                )}
                                {msg.content && msg.content !== msg.attachment_name && (
                                  <p>{msg.content}</p>
                                )}
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                            <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              {canSendMessage ? (
                <div className="p-3 border-t space-y-2">
                  {pendingFile && (
                    <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
                      {pendingFile.type.startsWith('image/') ? (
                        <ImageIcon className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="flex-1 truncate">{pendingFile.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => setPendingFile(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={isAnnouncementChannel ? 'Write an announcement...' : 'Type a message...'}
                      className="flex-1"
                      disabled={uploadingFile}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={(!messageInput.trim() && !pendingFile) || uploadingFile}
                      size="icon"
                      className="h-9 w-9 flex-shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-t text-center text-sm text-muted-foreground bg-muted/30">
                  <Megaphone className="h-4 w-4 inline mr-1.5 text-orange-500" />
                  This is an announcements channel — only managers can post here.
                </div>
              )}
            </CardContent>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Or click "New" to start one</p>
            </div>
          </div>
        )}
      </Card>

      {/* New Conversation Dialog */}
      <Dialog open={showNewDialog} onOpenChange={(open) => { setShowNewDialog(open); if (!open) resetNewForm(); }}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>

          {/* Type selector */}
          <div className="flex gap-2">
            <Button
              variant={newType === 'direct' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setNewType('direct')}
              className="flex-1"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Direct
            </Button>
            {isManager() && (
              <>
                <Button
                  variant={newType === 'group' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewType('group')}
                  className="flex-1"
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Group
                </Button>
                <Button
                  variant={newType === 'announcement' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewType('announcement')}
                  className="flex-1"
                >
                  <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                  Announce
                </Button>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {newType === 'direct' && (
              <div className="space-y-2">
                <Label className="text-sm">Select a person to message</Label>
                <ScrollArea className="h-52 border rounded-md">
                  {directMessageUsers.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No users available to message.</p>
                  ) : (
                    directMessageUsers.map(u => (
                      <div
                        key={u.id}
                        onClick={() => setSelectedDirectUser(u.id)}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b last:border-0 ${selectedDirectUser === u.id ? 'bg-muted' : ''}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{u.first_name} {u.last_name}</p>
                          {u.job_title && <p className="text-xs text-muted-foreground">{u.job_title}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
                {!isManager() && coworkers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    You can message managers and coworkers assigned to your accounts.
                  </p>
                )}
              </div>
            )}

            {(newType === 'group' || newType === 'announcement') && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    {newType === 'announcement' ? 'Announcement Channel Name' : 'Group Name'} *
                  </Label>
                  <Input
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder={newType === 'announcement' ? 'e.g., Company Announcements' : 'e.g., Night Crew'}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Description (optional)</Label>
                  <Input
                    value={newGroupDesc}
                    onChange={e => setNewGroupDesc(e.target.value)}
                    placeholder="What is this group for?"
                  />
                </div>
                {newType === 'group' && (
                  <div className="space-y-2">
                    <Label className="text-sm">Add Members *</Label>
                    <ScrollArea className="h-44 border rounded-md">
                      {availableUsers.map(u => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted/50 border-b last:border-0 cursor-pointer"
                          onClick={() => toggleMember(u.id)}
                        >
                          <Checkbox
                            checked={selectedMembers.includes(u.id)}
                            onCheckedChange={() => toggleMember(u.id)}
                          />
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm">{u.first_name} {u.last_name}</p>
                            {u.job_title && <p className="text-xs text-muted-foreground">{u.job_title}</p>}
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                    {selectedMembers.length > 0 && (
                      <p className="text-xs text-muted-foreground">{selectedMembers.length} member(s) selected</p>
                    )}
                  </div>
                )}
                {newType === 'announcement' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                    <p className="text-xs text-orange-800">
                      <strong>Announcement channels</strong> are read-only for employees. Only managers can post. All current employees will be added automatically.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="pt-2 border-t gap-2">
            <Button variant="outline" onClick={() => { setShowNewDialog(false); resetNewForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateConversation}
              disabled={creating || (
                newType === 'direct' ? !selectedDirectUser :
                newType === 'group' ? (!newGroupName.trim() || selectedMembers.length === 0) :
                !newGroupName.trim()
              )}
            >
              {creating ? 'Creating...' : newType === 'announcement' ? 'Create Channel' : newType === 'group' ? 'Create Group' : 'Start Chat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagingCenter;
