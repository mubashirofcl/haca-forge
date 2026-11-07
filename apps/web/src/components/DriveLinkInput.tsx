import React from 'react';
import { DRIVE_LINK_HINT, isDriveLink } from '@mmp/shared';

/** The shared rule (same function the API uses): an https link on drive.google.com or docs.google.com. */
export function driveLinkError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isDriveLink(trimmed) ? null : 'Use an https link on drive.google.com or docs.google.com.';
}

interface DriveLinkInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** A Google Drive / Docs link field with the shared rule and the sharing reminder. */
export const DriveLinkInput: React.FC<DriveLinkInputProps> = ({ id, label, value, onChange, disabled }) => {
  const error = driveLinkError(value);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs text-ui-muted block">
        {label}
      </label>
      <input
        id={id}
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="https://drive.google.com/file/d/..."
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint`}
        className="ui-input w-full font-mono"
      />
      <p id={`${id}-hint`} className={`text-xs ${error ? 'text-red-700' : 'text-ui-muted'}`} role={error ? 'alert' : undefined}>
        {error || DRIVE_LINK_HINT}
      </p>
    </div>
  );
};
