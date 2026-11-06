import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { formatGridDate, PLAN_GRID_DISPLAY_COLUMNS } from '@mmp/shared';
import { useDialogFocus } from '../../../lib/useDialogFocus';
import type { GridCellInput, GridSaveResponse } from './types';

const headerFor = (field: string) => {
  if (field.startsWith('deadline.')) return `${field.slice(9)} deadline`;
  return PLAN_GRID_DISPLAY_COLUMNS.find((c) => c.key === field)?.header || (field === 'row' ? 'Row' : field);
};

interface Props {
  title: string;
  source: 'paste' | 'upload';
  preview: GridSaveResponse;
  inputs: Record<string, GridCellInput>;
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shows what a paste or upload will save, before saving: the date and type each cell
 * was read as, and every cell error. Nothing is written until "Save".
 */
export const PlanGridPreviewDialog: React.FC<Props> = ({ title, source, preview, inputs, isSaving, onConfirm, onCancel }) => {
  const ref = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(ref, true, onCancel, { initialFocusRef: confirmRef });

  const ready = preview.results.filter((r) => r.status === 'valid').length;
  const needFix = preview.results.length - ready;
  const ignored = [...new Set(preview.results.flatMap((r) => r.ignoredCells))].map(headerFor);
  const unknownHeaders = preview.paste?.unknownHeaders || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-grid-preview-title"
        className="glass-modal w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-ui-line">
          <div>
            <h2 id="plan-grid-preview-title" className="text-lg font-bold text-ui-ink">{title}</h2>
            <p className="text-sm text-ui-muted mt-1">
              {ready} {ready === 1 ? 'row is' : 'rows are'} ready{needFix ? `, ${needFix} ${needFix === 1 ? 'needs' : 'need'} fixing` : ''}.
              {preview.upload?.layout === 'legacy' && ' This file uses the older template; owner emails were matched to people.'}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="ui-icon-btn h-11 w-11" aria-label="Close preview">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {ignored.length > 0 && (
            <p className="text-sm text-ui-muted">
              Filled by the app, so not saved from the {source}: {ignored.join(', ')}.
            </p>
          )}
          {unknownHeaders.length > 0 && (
            <p className="text-sm text-ui-muted">Columns not used: {unknownHeaders.join(', ')}.</p>
          )}
          {preview.warnings.map((w, i) => (
            <p key={i} className="text-sm status-tint status-waiting rounded-ui-control px-3 py-2">{w.message}</p>
          ))}

          <div className="overflow-x-auto">
            <table className="ui-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Posting date</th>
                  <th className="py-2 px-2">Topic</th>
                  <th className="py-2 px-2">Type</th>
                  <th className="py-2 px-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.results.map((r, i) => {
                  const input = inputs[r.clientKey] || {};
                  const date = r.resolved?.postingDate;
                  const type = r.resolved?.type;
                  const errors = Object.entries(r.cellErrors);
                  return (
                    <tr key={r.clientKey} className="align-top">
                      <td className="py-2 px-2 text-ui-muted">{i + 1}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {date ? (
                          <>
                            <span className="font-semibold text-ui-ink">{formatGridDate(date.value)}</span>
                            {date.input !== formatGridDate(date.value) && (
                              <span className="block text-xs text-ui-muted">
                                from “{date.input}”{date.byMonth ? ', read using the grid month' : ''}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-ui-muted">{String(input.postingDate ?? '')}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-ui-ink">{String(input.topic ?? '')}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {type ? (
                          <>
                            <span className="text-ui-ink">{type.value}</span>
                            <span className="block text-xs text-ui-muted">from “{type.input}”</span>
                          </>
                        ) : (
                          String(input.type ?? '')
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {r.status === 'valid' ? (
                          <span className="status-chip status-approved text-[11px]">Ready</span>
                        ) : (
                          <>
                            <span className={`status-chip ${r.status === 'locked' ? 'status-locked' : 'status-changes'} text-[11px]`}>
                              {r.status === 'locked' ? 'Locked' : 'Needs fixing'}
                            </span>
                            <ul className="mt-1 space-y-0.5 text-xs text-ui-text">
                              {errors.map(([field, msgs]) =>
                                msgs.map((m, j) => (
                                  <li key={`${field}-${j}`}>
                                    <span className="font-semibold">{headerFor(field)}:</span> {m}
                                  </li>
                                ))
                              )}
                            </ul>
                          </>
                        )}
                        {r.warnings.map((w, j) => (
                          <p key={j} className="mt-1 text-xs text-ui-muted">{w.message}</p>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 p-5 border-t border-ui-line">
          {needFix > 0 && (
            <p className="text-xs text-ui-muted mr-auto">
              Rows that need fixing are added to the grid unsaved, with the problem cells marked.
            </p>
          )}
          <button type="button" onClick={onCancel} className="ui-btn ui-btn-secondary h-11">
            Cancel
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={isSaving} className="ui-btn ui-btn-primary h-11">
            {isSaving ? 'Saving…' : ready > 0 ? `Save ${ready} ${ready === 1 ? 'row' : 'rows'}` : 'Add to grid to fix'}
          </button>
        </div>
      </div>
    </div>
  );
};
