import HelpButton from './HelpButton';
import ModuleTour from './ModuleTour';

/**
 * Drop-in help affordance for a module screen: the contextual "?" panel plus
 * the one-time first-visit walkthrough.
 */
export const ModuleHelp = ({ moduleKey }: { moduleKey: string }) => (
  <>
    <ModuleTour moduleKey={moduleKey} />
    <div className="flex justify-end">
      <HelpButton moduleKey={moduleKey} className="text-muted-foreground" />
    </div>
  </>
);

export default ModuleHelp;
