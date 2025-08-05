import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const TestNotificationButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createTestNotifications = async () => {
    setLoading(true);
    
    try {
      // For demo purposes, we'll create a test notification
      // In production, this would be handled by the cron job
      
      setTimeout(() => {
        toast({
          title: "🔔 Time-Off Request Deadline",
          description: "Reminder: Submit your time-off requests by end of day today for next week! Don't forget to plan ahead.",
          duration: 5000,
        });
        
        // Simulate another notification
        setTimeout(() => {
          toast({
            title: "📋 New Work Order",
            description: "You have been assigned a new quality control work order.",
            duration: 5000,
          });
        }, 2000);
        
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create test notifications",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={createTestNotifications}
      disabled={loading}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <Bell className="h-4 w-4" />
      {loading ? 'Creating...' : 'Test Weekly Reminder'}
    </Button>
  );
};