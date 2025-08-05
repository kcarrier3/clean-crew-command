import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  action_url?: string;
  created_at: string;
  read_at?: string;
}

interface NotificationBellProps {
  employeeId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ employeeId }) => {
  // Demo notifications for now
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Time-Off Request Deadline',
      message: 'Reminder: Submit your time-off requests by end of day today for next week! Don\'t forget to plan ahead.',
      type: 'timeoff_reminder',
      read: false,
      action_url: '/time-off',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'New Work Order Assigned',
      message: 'You have been assigned a new work order for Building A - Floor 2 cleaning.',
      type: 'work_order',
      read: false,
      created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
    {
      id: '3',
      title: 'Schedule Update',
      message: 'Your schedule for next week has been updated. Please review your new assignments.',
      type: 'schedule',
      read: true,
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      read_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ]);

  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId 
          ? { ...n, read: true, read_at: new Date().toISOString() }
          : n
      )
    );
    
    toast({
      title: "Notification marked as read",
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ 
        ...n, 
        read: true, 
        read_at: n.read ? n.read_at : new Date().toISOString() 
      }))
    );

    toast({
      title: "All notifications marked as read",
    });
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    toast({
      title: "Notification deleted",
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'timeoff_reminder':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'work_order':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'schedule':
        return <Bell className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'timeoff_reminder':
        return 'border-l-blue-500';
      case 'work_order':
        return 'border-l-orange-500';
      case 'schedule':
        return 'border-l-green-500';
      default:
        return 'border-l-gray-500';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-l-4 ${getNotificationColor(notification.type)} ${
                        !notification.read ? 'bg-muted/50' : 'bg-background'
                      } hover:bg-muted/70 transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-1">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markAsRead(notification.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteNotification(notification.id)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};