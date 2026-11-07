import React from 'react';
import { Download, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { isAppUploadPath, isDriveLink } from '@mmp/shared';
import { safeUrl } from '../lib/safeUrl';

export type AssetKind = 'upload' | 'drive' | 'link';

export interface AssetItem {
  url: string;
  name?: string | null;
  kind?: AssetKind;
}

/** upload | drive | link, using the same shared rule as the API. */
export function assetKind(url: string): AssetKind {
  if (isAppUploadPath(url)) return 'upload';
  if (isDriveLink(url)) return 'drive';
  return 'link';
}

const fileName = (url: string) => {
  try {
    const last = decodeURIComponent(url.split('?')[0].split('/').filter(Boolean).pop() || '');
    return last || url;
  } catch {
    return url;
  }
};

/**
 * Approved outputs handed to the next person: an uploaded file downloads, a Google Drive link
 * opens in Drive, and an older external link opens as a plain link.
 */
export const AssetLinks: React.FC<{ items: AssetItem[]; emptyText?: string; testId?: string }> = ({
  items,
  emptyText = 'No files yet.',
  testId = 'asset-links',
}) => {
  const safe = items
    .map((item) => ({ ...item, href: safeUrl(item.url), kind: item.kind || assetKind(item.url) }))
    .filter((item) => item.href);
  if (safe.length === 0) {
    return <p className="text-xs text-ui-muted italic">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2" data-testid={testId}>
      {safe.map((item, i) => {
        const label = item.name || (item.kind === 'upload' ? fileName(item.url) : item.kind === 'drive' ? 'Google Drive file' : item.url);
        return (
          <li
            key={`${item.url}-${i}`}
            className="p-3 rounded-xl bg-white/60 border border-ui-line flex items-center justify-between gap-3 text-xs"
          >
            <span className="font-semibold text-ui-ink truncate" title={item.url}>
              {label}
            </span>
            {item.kind === 'upload' ? (
              <a
                href={item.href}
                download
                data-kind="upload"
                className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg bg-ui-ink hover:bg-black text-white font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Download
              </a>
            ) : (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                data-kind={item.kind}
                className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-ui-line hover:bg-white text-ui-ink font-semibold flex items-center gap-1.5"
              >
                {item.kind === 'drive' ? (
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {item.kind === 'drive' ? 'Open in Drive' : 'Open link'}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
};
