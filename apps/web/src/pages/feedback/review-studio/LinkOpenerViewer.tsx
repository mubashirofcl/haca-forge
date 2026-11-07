import React from 'react';
import { ExternalLink, Globe, ShieldCheck, Copy, Check } from 'lucide-react';
import { DRIVE_LINK_HINT } from '@mmp/shared';
import { safeUrl } from '../../../lib/safeUrl';
import { AssetLinks, type AssetItem } from '../../../components/AssetLinks';

interface LinkOpenerViewerProps {
  url: string;
  title?: string;
  notes?: string;
  /** Every link in the version, when there is more than one (e.g. a design's slides). */
  links?: AssetItem[];
}

export const LinkOpenerViewer: React.FC<LinkOpenerViewerProps> = ({
  url,
  title = 'External Link Submission',
  notes,
  links = [],
}) => {
  const [copied, setCopied] = React.useState(false);

  const getHostname = (link: string) => {
    try {
      const parsed = new URL(link);
      return parsed.hostname;
    } catch {
      return link;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEmbeddable = (link: string) => {
    // Only certain trusted platforms allow iframe embedding
    return link.includes('figma.com/embed') || link.includes('youtube.com/embed');
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950/80 rounded-xl overflow-hidden border border-white/10 p-6 items-center justify-center">
      {isEmbeddable(url) ? (
        <iframe
          src={url}
          title={title}
          className="w-full h-full rounded-lg border border-white/10"
          allowFullScreen
        />
      ) : (
        <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-8 shadow-2xl text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-200 mb-5">
            <Globe className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-400 mb-6 font-mono break-all px-4 py-2 bg-slate-950/60 rounded-lg border border-white/5 w-full">
            {url}
          </p>

          {notes && (
            <div className="w-full mb-6 p-3 rounded-lg bg-white/5 border border-white/5 text-left text-xs text-slate-300">
              <span className="font-semibold text-slate-400 block mb-1">Creator Notes:</span>
              <p>{notes}</p>
            </div>
          )}

          <div className="flex items-center gap-3 w-full justify-center">
            <a
              href={safeUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 font-semibold text-sm transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </a>
            <button
              onClick={handleCopy}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-sm font-medium transition-colors flex items-center gap-2"
              title="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {links.length > 1 && (
            <div className="w-full mt-6 text-left">
              <span className="text-xs font-semibold text-slate-400 block mb-2">All links in this version ({links.length})</span>
              <AssetLinks items={links} testId="review-link-list" />
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">{DRIVE_LINK_HINT}</p>

          <div className="flex items-center gap-1.5 mt-6 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>External destination on {getHostname(url)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
