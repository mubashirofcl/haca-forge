import React from 'react';
import type { DynamicFieldDefinition } from '@mmp/shared';
import { Calendar, Link as LinkIcon, Check, HelpCircle } from 'lucide-react';

interface DynamicFormRendererProps {
  fields: DynamicFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  fields,
  values,
  onChange,
  errors = {},
  disabled = false,
}) => {
  if (!fields || fields.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-400 glass-card">
        No custom fields defined for this request type.
      </div>
    );
  }

  const handleMultiselectToggle = (fieldKey: string, option: string) => {
    const currentList: string[] = Array.isArray(values[fieldKey]) ? values[fieldKey] : [];
    const exists = currentList.includes(option);
    const updated = exists
      ? currentList.filter((item) => item !== option)
      : [...currentList, option];
    onChange(fieldKey, updated);
  };

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const error = errors[field.fieldKey];
        const value = values[field.fieldKey] ?? '';

        return (
          <div key={field.fieldKey} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span>{field.label}</span>
                {field.required && <span className="text-rose-500 font-bold">*</span>}
              </label>
              {field.helperText && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  <span>{field.helperText}</span>
                </span>
              )}
            </div>

            {/* Field Type Renderers */}
            {field.type === 'text' && (
              <input
                type="text"
                disabled={disabled}
                placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                value={value}
                onChange={(e) => onChange(field.fieldKey, e.target.value)}
                className={`w-full h-12 px-4 rounded-full text-sm bg-white/80 border ${
                  error ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#7a6af6]'
                } focus:outline-none focus:ring-2 focus:ring-[#7a6af6]/20 transition-all`}
              />
            )}

            {field.type === 'url' && (
              <div className="relative">
                <input
                  type="url"
                  disabled={disabled}
                  placeholder={field.placeholder || 'https://example.com'}
                  value={value}
                  onChange={(e) => onChange(field.fieldKey, e.target.value)}
                  className={`w-full h-12 pl-11 pr-4 rounded-full text-sm bg-white/80 border ${
                    error ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#7a6af6]'
                  } focus:outline-none focus:ring-2 focus:ring-[#7a6af6]/20 transition-all`}
                />
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {field.type === 'number' && (
              <input
                type="number"
                disabled={disabled}
                placeholder={field.placeholder || '0'}
                value={value}
                onChange={(e) => onChange(field.fieldKey, e.target.value === '' ? '' : Number(e.target.value))}
                className={`w-full h-12 px-4 rounded-full text-sm bg-white/80 border ${
                  error ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#7a6af6]'
                } focus:outline-none focus:ring-2 focus:ring-[#7a6af6]/20 transition-all`}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                disabled={disabled}
                rows={3}
                placeholder={field.placeholder || `Provide details for ${field.label.toLowerCase()}...`}
                value={value}
                onChange={(e) => onChange(field.fieldKey, e.target.value)}
                className={`w-full p-4 rounded-[22px] text-sm bg-white/80 border ${
                  error ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#7a6af6]'
                } focus:outline-none focus:ring-2 focus:ring-[#7a6af6]/20 transition-all resize-none`}
              />
            )}

            {field.type === 'select' && (
              <div className="relative">
                <select
                  disabled={disabled}
                  value={value}
                  onChange={(e) => onChange(field.fieldKey, e.target.value)}
                  className={`w-full h-12 px-4 rounded-full text-sm bg-white/80 border appearance-none ${
                    error ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#7a6af6]'
                  } focus:outline-none focus:ring-2 focus:ring-[#7a6af6]/20 transition-all`}
                >
                  <option value="">Select an option...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            )}

            {field.type === 'multiselect' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(field.options || []).map((opt) => {
                  const isSelected = Array.isArray(value) && value.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleMultiselectToggle(field.fieldKey, opt)}
                      className={`h-9 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-[#0d0e12] text-white shadow-sm'
                          : 'bg-white/80 border border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {field.type === 'date' && (
              <div className="relative">
                <input
                  type="date"
                  disabled={disabled}
                  value={value ? new Date(value).toISOString().split('T')[0] : ''}
                  onChange={(e) => onChange(field.fieldKey, e.target.value)}
                  className={`w-full h-12 pl-11 pr-4 rounded-full text-sm bg-white/80 border ${
                    error ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#7a6af6]'
                  } focus:outline-none focus:ring-2 focus:ring-[#7a6af6]/20 transition-all`}
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {field.type === 'checkbox' && (
              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={Boolean(value)}
                  onChange={(e) => onChange(field.fieldKey, e.target.checked)}
                  className="w-4 h-4 text-[#7a6af6] rounded focus:ring-[#7a6af6] border-slate-300"
                />
                <span className="text-xs text-slate-600">{field.placeholder || 'Enable this option'}</span>
              </label>
            )}

            {error && <p className="text-xs text-rose-500 font-medium pl-2">{error}</p>}
          </div>
        );
      })}
    </div>
  );
};
