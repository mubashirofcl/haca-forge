import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Download,
  ExternalLink,
  Copy,
  Check,
  FileVideo,
  FileImage,
  FileText,
  Music,
  Link2,
  LayoutGrid,
  List,
  Eye,
  X,
} from 'lucide-react';
import type { DeliverableType } from '@mmp/shared';

interface FileDeliverableItem {
  _id: string;
  version: number;
  type: DeliverableType;
  fileUrl?: string;
  externalLink?: string;
  thumbnail?: string;
  notes?: string;
  status: string;
  createdAt: string;
  uploadedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  taskId?: {
    _id: string;
    taskId: string;
    title: string;
    team: string;
  };
  contentItemId?: {
    _id: string;
    contentId: string;
    title: string;
    format: string;
  };
}

export const FileLibraryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('approved');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const [previewFile, setPreviewFile] = useState<FileDeliverableItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch files from API
  const { data: filesResponse, isLoading } = useQuery({
    queryKey: ['fileLibrary', searchQuery, selectedType, selectedStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedType) params.set('type', selectedType);
      if (selectedStatus) params.set('status', selectedStatus);
      params.set('page', String(page));
      params.set('limit', '24');

      const res = await fetch(`/api/deliverables/files?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load file library');
      return res.json();
    },
  });

  const files: FileDeliverableItem[] = filesResponse?.data || [];
  const total = filesResponse?.total || 0;
  const pages = filesResponse?.pages || 1;

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'video':
        return FileVideo;
      case 'image':
        return FileImage;
      case 'audio':
        return Music;
      case 'document':
        return FileText;
      case 'link':
        return Link2;
      default:
        return FileText;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Asset & File Library</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
              DAM Repository
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global repository of approved media cuts, graphics, copywriting deliverables, and source files.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-full glass-panel border border-white/80 shadow-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === 'grid' ? 'pill-active' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === 'table' ? 'pill-active' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="glass-panel p-4 border border-white/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search assets by title, content ID, or notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
          >
            <option value="">All Categories</option>
            <option value="video">Videos</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
            <option value="audio">Audio</option>
            <option value="copy">Copywriting</option>
            <option value="link">External Links</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
          >
            <option value="approved">Approved Assets Only</option>
            <option value="submitted">In Review / Submitted</option>
            <option value="">All Asset Statuses</option>
          </select>
        </div>
      </div>

      {/* 3. Assets Presentation */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-xs">Loading media assets library...</div>
      ) : files.length === 0 ? (
        <div className="py-20 text-center text-slate-400 text-xs glass-panel rounded-3xl p-12">
          No assets found matching the selected filters.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => {
            const Icon = getIconForType(file.type);
            const isVideo = file.type === 'video';

            return (
              <div
                key={file._id}
                className="glass-panel p-4 border border-white/90 rounded-3xl shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group space-y-3"
              >
                <div className="space-y-2.5">
                  {/* Media Thumbnail Container */}
                  <div
                    onClick={() => setPreviewFile(file)}
                    className="relative aspect-video rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {file.thumbnail ? (
                      <img
                        src={file.thumbnail}
                        alt="Asset preview"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : isVideo && file.fileUrl ? (
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <FileVideo className="w-10 h-10" />
                      </div>
                    ) : (
                      <Icon className="w-10 h-10 text-slate-500" />
                    )}

                    <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-900 shadow-md group-hover:scale-110 transition-transform">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white">
                        v{file.version}
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white uppercase tracking-wider">
                      {file.type}
                    </div>
                  </div>

                  {/* Title & metadata */}
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-xs line-clamp-1 group-hover:text-violet-700 transition-colors">
                      {file.contentItemId?.title || file.taskId?.title || 'Deliverable Asset'}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {file.contentItemId?.contentId || file.taskId?.taskId}
                    </p>
                  </div>

                  {file.notes && (
                    <p className="text-[10px] text-slate-500 italic line-clamp-2 bg-slate-50 p-2 rounded-xl">
                      "{file.notes}"
                    </p>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1">
                    {file.fileUrl && (
                      <>
                        <button
                          onClick={() => handleCopyLink(file.fileUrl!, file._id)}
                          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          title="Copy download link"
                        >
                          {copiedId === file._id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="p-1.5 rounded-full hover:bg-violet-50 text-slate-400 hover:text-violet-700"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}

                    {file.externalLink && (
                      <a
                        href={file.externalLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                        title="Open external link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="glass-panel border border-white/90 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Asset / Content</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {files.map((file) => (
                  <tr key={file._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{file.contentItemId?.title || file.taskId?.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {file.contentItemId?.contentId || file.taskId?.taskId}
                      </div>
                    </td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-500">{file.type}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        v{file.version}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          file.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {file.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-600">{file.uploadedBy?.name || 'Worker'}</td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="px-2.5 py-1 rounded-full border border-slate-200 hover:bg-white text-[11px] font-bold text-slate-700"
                        >
                          Preview
                        </button>
                        {file.fileUrl && (
                          <a
                            href={file.fileUrl}
                            download
                            className="p-1 rounded-full text-slate-400 hover:text-violet-600"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {pages > 1 && (
        <div className="flex items-center justify-between p-4 glass-panel border border-white/80 rounded-2xl text-xs text-slate-500">
          <span>
            Total: <strong className="text-slate-800">{total}</strong> assets (Page {page} of {pages})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* 4. Asset Detail Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded bg-violet-100 text-violet-800">
                  Version v{previewFile.version}
                </span>
                <h3 className="font-black text-slate-900 text-base mt-1">
                  {previewFile.contentItemId?.title || previewFile.taskId?.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center">
                {previewFile.type === 'video' && previewFile.fileUrl ? (
                  <video src={previewFile.fileUrl} controls className="max-h-full max-w-full" autoPlay />
                ) : previewFile.fileUrl ? (
                  <img src={previewFile.fileUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-slate-500 text-xs">External Link / Asset</div>
                )}
              </div>

              {previewFile.notes && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Asset Notes</span>
                  <p className="text-slate-700">{previewFile.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>Uploaded by: <b className="text-slate-800">{previewFile.uploadedBy?.name || 'Worker'}</b></span>
                <div className="flex items-center gap-2">
                  {previewFile.fileUrl && (
                    <a
                      href={previewFile.fileUrl}
                      download
                      className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </a>
                  )}
                  {previewFile.externalLink && (
                    <a
                      href={previewFile.externalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
