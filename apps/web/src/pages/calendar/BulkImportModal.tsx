import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface BulkImportModalProps {
  onClose: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Preview Mutation
  const previewMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await fetch('/api/calendar/import/preview', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to parse spreadsheet');
      }

      return res.json();
    },
    onSuccess: (data) => {
      setPreviewData(data.data);
      setStep('preview');
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'File validation failed');
    },
  });

  // 2. Commit Mutation
  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!previewData || !previewData.preview) return;

      const res = await fetch('/api/calendar/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: previewData.preview,
          batchId: previewData.batchId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to commit import');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['teamCapacity'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Commit failed');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setErrorMessage('');
      previewMutation.mutate(selected);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/calendar/template', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="glass-panel w-full max-w-2xl rounded-[28px] border border-white shadow-2xl p-6 bg-white space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#7a6af6]/10 text-[#7a6af6] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Bulk Import Deliverables</h3>
              <p className="text-xs text-slate-500">Upload Excel (.xlsx) or CSV content calendar schedules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Upload & Download Template */}
        {step === 'upload' && (
          <div className="space-y-6 py-2">
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-indigo-950">1. Download Template Spreadsheet</span>
                <p className="text-[11px] text-indigo-700">
                  Pre-configured with headers, date formats, and supported platform & format keys.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2 rounded-full bg-white hover:bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-800 shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template (.xlsx)</span>
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div className="border-2 border-dashed border-slate-300 hover:border-[#7a6af6] rounded-2xl p-8 text-center transition-colors">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-800 mb-1">
                {previewMutation.isPending ? 'Validating spreadsheet...' : 'Select or drop your spreadsheet'}
              </p>
              <p className="text-[11px] text-slate-400 mb-4">
                Supported formats: Microsoft Excel (.xlsx) or Comma-Separated Values (.csv)
              </p>

              <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold transition-all shadow-sm">
                <Upload className="w-3.5 h-3.5" />
                <span>{file ? file.name : 'Choose File to Validate'}</span>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Interactive Validation Preview */}
        {step === 'preview' && previewData && (
          <div className="space-y-4">
            {/* KPI Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Rows</span>
                <strong className="text-base font-bold text-slate-900">{previewData.totalRows}</strong>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Valid Entries
                </span>
                <strong className="text-base font-bold text-emerald-700">{previewData.validCount}</strong>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] text-rose-600 block font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Row Errors
                </span>
                <strong className="text-base font-bold text-rose-700">{previewData.errorCount}</strong>
              </div>
            </div>

            {/* Errors List */}
            {previewData.errorCount > 0 && (
              <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 max-h-36 overflow-y-auto space-y-1">
                <span className="text-[11px] font-bold text-rose-900 block mb-1">
                  The following rows will be skipped due to formatting errors:
                </span>
                {previewData.errors.map((err: any, idx: number) => (
                  <div key={idx} className="text-[11px] text-rose-700 flex items-start gap-1.5">
                    <span className="font-mono font-bold">Row {err.row}:</span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Valid Rows Preview Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-52 overflow-y-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Platform</th>
                    <th className="p-2.5">Format</th>
                    <th className="p-2.5">Theme / Topic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {previewData.preview.map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-mono">{p.date}</td>
                      <td className="p-2.5 capitalize font-semibold">{p.platform}</td>
                      <td className="p-2.5">{p.format.replace('_', ' ')}</td>
                      <td className="p-2.5 truncate max-w-xs">{p.theme}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setPreviewData(null);
                }}
                className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Upload Different File
              </button>

              <button
                type="button"
                disabled={commitMutation.isPending || previewData.validCount === 0}
                onClick={() => commitMutation.mutate()}
                className="px-6 py-2.5 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {commitMutation.isPending
                    ? 'Importing...'
                    : `Commit ${previewData.validCount} Valid Deliverables`}
                </span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
