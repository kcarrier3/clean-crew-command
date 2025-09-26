import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

interface JobBudgetingWidgetProps {
  jobSite: {
    id: string;
    name: string;
    is_recurring_monthly: boolean;
    budgeted_hours: number | null;
    used_hours: number | null;
    remaining_hours: number | null;
  };
  className?: string;
}

const JobBudgetingWidget = ({ jobSite, className }: JobBudgetingWidgetProps) => {
  if (jobSite.is_recurring_monthly || !jobSite.budgeted_hours) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {jobSite.is_recurring_monthly ? 'Recurring Monthly Account' : 'No Budget Set'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const budgetedHours = jobSite.budgeted_hours;
  const usedHours = jobSite.used_hours || 0;
  const remainingHours = jobSite.remaining_hours || 0;
  const progressPercentage = Math.min((usedHours / budgetedHours) * 100, 100);

  const getBudgetStatus = () => {
    if (remainingHours <= 0) {
      return { color: 'destructive', icon: AlertTriangle, label: 'Over Budget' };
    } else if (progressPercentage >= 90) {
      return { color: 'secondary', icon: TrendingDown, label: 'Nearly Complete' };
    } else if (progressPercentage >= 75) {
      return { color: 'outline', icon: Clock, label: 'In Progress' };
    } else {
      return { color: 'default', icon: CheckCircle, label: 'On Track' };
    }
  };

  const status = getBudgetStatus();
  const StatusIcon = status.icon;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Job Budget</span>
          <Badge variant={status.color as any} className="text-xs">
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Budgeted</div>
            <div className="font-semibold text-sm">{budgetedHours}h</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Used</div>
            <div className="font-semibold text-sm">{Math.round(usedHours * 100) / 100}h</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className={`font-semibold text-sm ${remainingHours <= 0 ? 'text-destructive' : ''}`}>
              {Math.round(remainingHours * 100) / 100}h
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default JobBudgetingWidget;