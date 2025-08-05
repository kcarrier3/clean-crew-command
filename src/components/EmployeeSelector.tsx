import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PersonalWorkerDashboard from './PersonalWorkerDashboard';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
}

const EmployeeSelector = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('active', true)
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    }
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    setSelectedEmployee(employee || null);
  };

  const handleLogout = () => {
    setSelectedEmployee(null);
  };

  if (selectedEmployee) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">
                Welcome, {selectedEmployee.first_name} {selectedEmployee.last_name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedEmployee.employee_id} • {selectedEmployee.job_title}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Switch User
          </Button>
        </div>
        <PersonalWorkerDashboard selectedEmployee={selectedEmployee} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <LogIn className="h-6 w-6" />
            Employee Login
          </CardTitle>
          <p className="text-muted-foreground">
            Select your name to access your dashboard
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Your Name:</label>
            <Select onValueChange={handleEmployeeSelect}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Choose your name from the list" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {employees.map((employee) => (
                  <SelectItem 
                    key={employee.id} 
                    value={employee.id}
                    className="hover:bg-accent hover:text-accent-foreground"
                  >
                    {employee.first_name} {employee.last_name} ({employee.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Can't find your name? Contact your manager.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeSelector;