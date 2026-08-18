import type { ModuleGuide } from '@/lib/guides';
import { Lightbulb } from 'lucide-react';

/** Renders the full body of a single module guide. */
export const GuideContent = ({ guide }: { guide: ModuleGuide }) => (
  <div className="space-y-6">
    <p className="text-sm text-muted-foreground">{guide.summary}</p>

    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Quick walkthrough</h4>
      <ol className="space-y-3">
        {guide.tour.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{step.title}</div>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>

    {guide.sections.map((section) => (
      <div key={section.heading} className="space-y-2">
        <h4 className="text-sm font-semibold">{section.heading}</h4>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    ))}

    {guide.tips?.length ? (
      <div className="rounded-md border border-border bg-muted/40 p-3">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-primary" /> Tips
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {guide.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
);

export default GuideContent;
