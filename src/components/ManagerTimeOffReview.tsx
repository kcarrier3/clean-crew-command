import TimeOffRequests from './TimeOffRequests';

interface ManagerTimeOffReviewProps {
  currentManagerId?: string;
}

const ManagerTimeOffReview = ({ currentManagerId }: ManagerTimeOffReviewProps) => {
  return (
    <TimeOffRequests 
      isManager={true} 
      currentEmployeeId={currentManagerId} 
    />
  );
};

export default ManagerTimeOffReview;