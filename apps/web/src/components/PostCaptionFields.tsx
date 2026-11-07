import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { POST_CAPTION_LIMITS, POST_CAPTION_MAX } from '@mmp/shared';
import { checkCaptionLimits } from '../lib/scriptTools';

interface PostCaptionFieldsProps {
  caption: string;
  hashtags: string;
  onCaptionChange?: (value: string) => void;
  onHashtagsChange?: (value: string) => void;
  /** After posting: the saved caption and hashtags, shown read-only. */
  readOnly?: boolean;
}

/**
 * The poster's caption (required to post) and hashtags (optional), with the Instagram and
 * LinkedIn counters and Copy buttons. The API applies the same overall limit.
 */
export const PostCaptionFields: React.FC<PostCaptionFieldsProps> = ({
  caption,
  hashtags,
  onCaptionChange,
  onHashtagsChange,
  readOnly = false,
}) => {
  const [copied, setCopied] = useState<'caption' | 'hashtags' | null>(null);
  const stats = checkCaptionLimits(caption, hashtags);
  const copy = (key: 'caption' | 'hashtags', text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  const CopyButton = ({ which, text, label }: { which: 'caption' | 'hashtags'; text: string; label: string }) => (
    <button
      type="button"
      onClick={() => copy(which, text)}
      disabled={!text}
      aria-label={label}
      className="inline-flex items-center gap-1 min-h-[36px] px-2 text-xs font-semibold text-ui-ink hover:underline underline-offset-4 rounded-full disabled:opacity-50"
    >
      {copied === which ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
      {label}
    </button>
  );
  const bar = (label: string, max: number, s: { charCount: number; isOverLimit: boolean; percent: number }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className="text-ui-text">{label} (max {max.toLocaleString('en-US')})</span>
        <span className={s.isOverLimit ? 'status-chip status-changes px-1.5' : 'text-ui-muted'}>
          {s.charCount} / {max.toLocaleString('en-US')}
        </span>
      </div>
      <div className="w-full bg-ui-line h-1.5 rounded-full overflow-hidden" aria-hidden="true">
        <div className={`h-full transition-all ${s.isOverLimit ? 'bg-ui-coral' : 'bg-ui-ink'}`} style={{ width: `${s.percent}%` }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-3" data-testid="post-caption-fields">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="post-caption" className="text-xs font-medium text-ui-muted">
            Post caption {readOnly ? '' : '(required)'}
          </label>
          <CopyButton which="caption" text={caption} label="Copy Caption" />
        </div>
        {readOnly ? (
          <p id="post-caption" className="p-3 rounded-xl bg-white/60 border border-ui-line text-xs text-ui-ink whitespace-pre-wrap" data-testid="post-caption-saved">
            {caption || 'No caption saved.'}
          </p>
        ) : (
          <textarea
            id="post-caption"
            value={caption}
            onChange={(e) => onCaptionChange?.(e.target.value)}
            rows={4}
            maxLength={POST_CAPTION_MAX}
            placeholder="Write the caption for this post"
            className="ui-input ui-textarea w-full"
          />
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="post-hashtags" className="text-xs font-medium text-ui-muted">
            Hashtags {readOnly ? '' : '(optional)'}
          </label>
          <CopyButton which="hashtags" text={hashtags} label="Copy Hashtags" />
        </div>
        {readOnly ? (
          <p id="post-hashtags" className="p-3 rounded-xl bg-white/60 border border-ui-line text-xs font-mono text-ui-ink" data-testid="post-hashtags-saved">
            {hashtags || 'No hashtags.'}
          </p>
        ) : (
          <input
            id="post-hashtags"
            type="text"
            value={hashtags}
            onChange={(e) => onHashtagsChange?.(e.target.value)}
            maxLength={POST_CAPTION_MAX}
            placeholder="#HACA #Launch"
            className="ui-input w-full"
          />
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-ui-line">
        {bar('Instagram', POST_CAPTION_LIMITS.instagram, stats.instagram)}
        {bar('LinkedIn', POST_CAPTION_LIMITS.linkedin, stats.linkedin)}
      </div>
    </div>
  );
};

/** Over the overall limit (LinkedIn's), which the API refuses. */
export const isCaptionTooLong = (caption: string, hashtags: string) => checkCaptionLimits(caption, hashtags).linkedin.isOverLimit;
