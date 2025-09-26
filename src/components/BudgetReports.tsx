import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface JobSiteBudget {
  id: string;
  name: string;
  budgeted_hours: number;
  used_hours: number;
  current_month_used_hours: number;
}

interface MonthlyHistory {
  job_site_id: string;
  job_site_name: string;
  budgeted_hours: number;
  used_hours: number;
  month_year: string;
}

const BudgetReports = () => {
  const [currentMonthData, setCurrentMonthData] = useState<JobSiteBudget[]>([]);
  const [previousMonthData, setPreviousMonthData] = useState<MonthlyHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const previousMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    try {
      // Fetch current month data for recurring monthly accounts
      const { data: currentData, error: currentError } = await supabase
        .from('job_sites')
        .select('id, name, budgeted_hours, used_hours, current_month_used_hours')
        .eq('is_recurring_monthly', true)
        .not('budgeted_hours', 'is', null)
        .eq('active', true);

      if (currentError) throw currentError;

      // Fetch previous month data from history and join with job sites
      const { data: historyData, error: historyError } = await supabase
        .from('monthly_budget_history')
        .select('job_site_id, budgeted_hours, used_hours, month_year')
        .eq('month_year', previousMonth);

      if (historyError) throw historyError;

      // Fetch job site names for history data
      const jobSiteIds = historyData?.map(item => item.job_site_id) || [];
      const { data: jobSitesData, error: jobSitesError } = await supabase
        .from('job_sites')
        .select('id, name, active')
        .in('id', jobSiteIds)
        .eq('active', true);

      if (jobSitesError) throw jobSitesError;

      // Create a map of job site names
      const jobSiteMap = new Map(jobSitesData?.map(site => [site.id, site.name]) || []);

      setCurrentMonthData(currentData || []);
      setPreviousMonthData(historyData?.filter(item => 
        jobSiteMap.has(item.job_site_id)
      ).map(item => ({
        job_site_id: item.job_site_id,
        job_site_name: jobSiteMap.get(item.job_site_id) || 'Unknown',
        budgeted_hours: item.budgeted_hours,
        used_hours: item.used_hours,
        month_year: item.month_year
      })) || []);
    } catch (error) {
      console.error('Error fetching budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (data: { budgeted_hours: number; used_hours: number }[]) => {
    return data.reduce(
      (acc, item) => ({
        budgeted: acc.budgeted + item.budgeted_hours,
        used: acc.used + item.used_hours,
      }),
      { budgeted: 0, used: 0 }
    );
  };

  const currentTotals = calculateTotals(
    currentMonthData.map(item => ({
      budgeted_hours: item.budgeted_hours,
      used_hours: item.current_month_used_hours || 0
    }))
  );

  const previousTotals = calculateTotals(previousMonthData);

  const getVarianceColor = (budgeted: number, used: number) => {
    const percentage = (used / budgeted) * 100;
    if (percentage > 110) return "destructive";
    if (percentage > 90) return "default";
    return "secondary";
  };

  const getVarianceBadge = (budgeted: number, used: number) => {
    const variance = used - budgeted;
    const percentage = (used / budgeted) * 100;
    
    return (
      <Badge variant={getVarianceColor(budgeted, used)} className="ml-2">
        {variance > 0 ? '+' : ''}{variance.toFixed(1)}h ({percentage.toFixed(1)}%)
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Budget Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading budget data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Budget Reports - Recurring Monthly Accounts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Previous Month Summary */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Previous Month ({format(subMonths(new Date(), 1), 'MMM yyyy')})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{previousTotals.budgeted.toFixed(1)}</div>
                <p className="text-sm text-muted-foreground">Total Budgeted Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{previousTotals.used.toFixed(1)}</div>
                <p className="text-sm text-muted-foreground">Total Used Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold flex items-center">
                  {((previousTotals.used / previousTotals.budgeted) * 100).toFixed(1)}%
                  {getVarianceBadge(previousTotals.budgeted, previousTotals.used)}
                </div>
                <p className="text-sm text-muted-foreground">Budget Utilization</p>
              </CardContent>
            </Card>
          </div>

          {previousMonthData.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Job Site Breakdown</h4>
              {previousMonthData.map((site) => (
                <div key={site.job_site_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{site.job_site_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {site.used_hours.toFixed(1)}h / {site.budgeted_hours.toFixed(1)}h
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min((site.used_hours / site.budgeted_hours) * 100, 100)} 
                      className="w-20"
                    />
                    {getVarianceBadge(site.budgeted_hours, site.used_hours)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current Month Summary */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Current Month ({format(new Date(), 'MMM yyyy')})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{currentTotals.budgeted.toFixed(1)}</div>
                <p className="text-sm text-muted-foreground">Total Budgeted Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{currentTotals.used.toFixed(1)}</div>
                <p className="text-sm text-muted-foreground">Total Used Hours (To Date)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold flex items-center">
                  {currentTotals.budgeted > 0 ? ((currentTotals.used / currentTotals.budgeted) * 100).toFixed(1) : 0}%
                  {currentTotals.budgeted > 0 && getVarianceBadge(currentTotals.budgeted, currentTotals.used)}
                </div>
                <p className="text-sm text-muted-foreground">Budget Utilization (To Date)</p>
              </CardContent>
            </Card>
          </div>

          {currentMonthData.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Job Site Breakdown</h4>
              {currentMonthData.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{site.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(site.current_month_used_hours || 0).toFixed(1)}h / {site.budgeted_hours.toFixed(1)}h
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min(((site.current_month_used_hours || 0) / site.budgeted_hours) * 100, 100)} 
                      className="w-20"
                    />
                    {getVarianceBadge(site.budgeted_hours, site.current_month_used_hours || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {currentMonthData.length === 0 && previousMonthData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No recurring monthly accounts with budgets found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetReports;