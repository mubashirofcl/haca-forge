import React from 'react';
import { ClipboardList, ExternalLink } from 'lucide-react';

export interface FromPlan {
  brief: string;
  workflow?: string | null;
  workflowLabel?: string | null;
  items: { url: string; name: string | null; kind: 'upload' | 'drive' | 'link' }[];
}

/**
 * "From the plan": what a step with no earlier step works from — the row's brief and, for an
 * Edit only reel, its source video. Worked out by the API on each read.
 */
export const FromPlanCard: React.FC<{ fromPlan?: FromPlan | null }> = ({ fromPlan }) => {
  if (!fromPlan) return null;
  const { brief, items, workflowLabel } = fromPlan;
  return (
    <section className="p-4 rounded-ui-card bg-white/60 border border-ui-line space-y-2" aria-labelledby="from-plan-title" data-testid="from-plan">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="from-plan-title" className="flex items-center gap-2 text-xs font-bold text-ui-ink">
          <ClipboardList className="w-4 h-4" aria-hidden="true" />
          From the plan
        </h3>
        {workflowLabel && <span className="text-xs text-ui-muted">{workflowLabel}</span>}
      </div>
      <p className="text-sm text-ui-text whitespace-pre-wrap break-words">{brief || <span className="text-ui-muted">No brief was written for this row.</span>}</p>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.url}>
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-ui-ink underline break-all">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {it.name || 'Link'}
                {it.kind === 'drive' && <span className="text-xs font-normal text-ui-muted">(Google Drive)</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
