import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  MessageSquare,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  Tv,
  ListOrdered,
  Layers,
} from 'lucide-react';
import {
  calculateDurationStats,
  checkHook,
  checkCaptionLimits,
  extractSceneTableData,
  type ScriptDurationStats,
  type HookCheckResult,
  type CaptionAnalysis,
  type ShotListItem,
} from '../../../lib/scriptTools';
import { Avatar } from '../../../components/Avatar';

export type SidebarTab = 'brief' | 'tools' | 'comments';

export interface CommentItem {
  _id: string;
  authorId: { _id?: string; name: string; email?: string; role?: string };
  text: string;
  anchor?: {
    type: 'text' | 'timecode' | 'point' | 'page';
    range?: { from?: number; to?: number; text?: string };
  };
  resolved: boolean;
  createdAt: string;
  parentId?: string | null;
  replies?: CommentItem[];
}

export interface SnippetItem {
  id: string;
  title: string;
  content: string;
}

interface WritingStudioSidebarProps {
  editor: Editor | null;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  briefData?: {
    objective?: string;
    targetAudience?: string;
    tone?: string;
    program?: string;
    contentLink?: string;
    assetsLink?: string;
    description?: string;
  };
  upstreamOutputs?: Array<{
    stageKey: string;
    deliverableUrl?: string;
    status: string;
    ownerName?: string;
  }>;
  targetDuration: number;
  setTargetDuration: (target: number) => void;
  wpm: number;
  setWpm: (wpm: number) => void;
  captionText: string;
  setCaptionText: (text: string) => void;
  hashtagsText: string;
  setHashtagsText: (text: string) => void;
  comments: CommentItem[];
  onAddComment: (text: string, range?: { from: number; to: number; text: string }) => Promise<void>;
  onReplyComment: (parentId: string, text: string) => Promise<void>;
  onResolveComment: (commentId: string) => Promise<void>;
  onOpenTeleprompter: () => void;
  onShotListExtracted?: (shotList: ShotListItem[]) => void;
}

export const WritingStudioSidebar: React.FC<WritingStudioSidebarProps> = ({
  editor,
  activeTab,
  setActiveTab,
  briefData,
  upstreamOutputs,
  targetDuration,
  setTargetDuration,
  wpm,
  setWpm,
  captionText,
  setCaptionText,
  hashtagsText,
  setHashtagsText,
  comments,
  onAddComment,
  onReplyComment,
  onResolveComment,
  onOpenTeleprompter,
  onShotListExtracted,
}) => {
  // Stats
  const [durationStats, setDurationStats] = useState<ScriptDurationStats>({
    wordCount: 0,
    wpm: 130,
    estimatedSeconds: 0,
    targetSeconds: targetDuration,
    isOverTarget: false,
    diffSeconds: 0,
  });

  const [hookStats, setHookStats] = useState<HookCheckResult>({
    openingText: '',
    wordCount: 0,
    passes: true,
  });

  const [captionStats, setCaptionStats] = useState<CaptionAnalysis>(checkCaptionLimits(captionText, hashtagsText));
  const [shotList, setShotList] = useState<ShotListItem[]>([]);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);
  const [copiedShotList, setCopiedShotList] = useState(false);

  // New Comment state
  const [newCommentText, setNewCommentText] = useState('');
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  // Personal Snippets (Stored locally per user)
  const [snippets, setSnippets] = useState<SnippetItem[]>(() => {
    try {
      const stored = localStorage.getItem('haca_personal_snippets');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: '1',
        title: 'HACA Value Proposition',
        content: '<p>At HACA, we believe in hands-on building, industry-grade mentorship, and zero fluff.</p>',
      },
      {
        id: '2',
        title: 'Admission Urgency Disclaimer',
        content: '<p><em>Seats are strictly limited to 25 candidates per batch to ensure personalized lab coaching.</em></p>',
      },
      {
        id: '3',
        title: 'Standard CTA Block',
        content: '<p><strong>Tap the link in bio or visit haca.edu to schedule your campus consultation today!</strong></p>',
      },
    ];
  });
  const [newSnippetTitle, setNewSnippetTitle] = useState('');
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [showAddSnippet, setShowAddSnippet] = useState(false);

  // Recompute stats whenever editor content changes
  useEffect(() => {
    if (!editor) return;

    const updateAnalysis = () => {
      const text = editor.getText();
      const html = editor.getHTML();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;

      // 1. Duration stats
      const dStats = calculateDurationStats(words, targetDuration, wpm);
      setDurationStats(dStats);

      // 2. Hook stats
      const hStats = checkHook(text);
      setHookStats(hStats);

      // 3. Scene table extraction & Shot list
      const extracted = extractSceneTableData(html);
      setShotList(extracted.shotList);
      if (onShotListExtracted) {
        onShotListExtracted(extracted.shotList);
      }
    };

    updateAnalysis();
    editor.on('update', updateAnalysis);
    return () => {
      editor.off('update', updateAnalysis);
    };
  }, [editor, targetDuration, wpm]);

  // Recompute captions whenever inputs change
  useEffect(() => {
    setCaptionStats(checkCaptionLimits(captionText, hashtagsText));
  }, [captionText, hashtagsText]);

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(captionText);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyHashtags = () => {
    navigator.clipboard.writeText(hashtagsText);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
  };

  const handleCopyShotList = () => {
    const text = shotList.map((s) => `Scene ${s.sceneNumber}: ${s.visual}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedShotList(true);
    setTimeout(() => setCopiedShotList(false), 2000);
  };

  // Add Comment on selection
  const handleCreateComment = async () => {
    if (!newCommentText.trim() || !editor) return;

    const { from, to } = editor.state.selection;
    let selectedText = '';
    if (from !== to) {
      selectedText = editor.state.doc.textBetween(from, to, ' ');
    }

    await onAddComment(
      newCommentText.trim(),
      from !== to ? { from, to, text: selectedText } : undefined
    );
    setNewCommentText('');
  };

  // Snippets management
  const handleSaveSnippet = () => {
    if (!newSnippetTitle.trim() || !newSnippetContent.trim()) return;
    const updated = [
      ...snippets,
      {
        id: Date.now().toString(),
        title: newSnippetTitle.trim(),
        content: `<p>${newSnippetContent.trim()}</p>`,
      },
    ];
    setSnippets(updated);
    localStorage.setItem('haca_personal_snippets', JSON.stringify(updated));
    setNewSnippetTitle('');
    setNewSnippetContent('');
    setShowAddSnippet(false);
  };

  const handleDeleteSnippet = (id: string) => {
    const updated = snippets.filter((s) => s.id !== id);
    setSnippets(updated);
    localStorage.setItem('haca_personal_snippets', JSON.stringify(updated));
  };

  const handleInsertSnippet = (content: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(content).run();
  };

  // Jump to comment anchor
  const handleJumpToComment = (comment: CommentItem) => {
    if (!editor || !comment.anchor?.range) return;
    const { from, to } = comment.anchor.range;
    if (typeof from === 'number' && typeof to === 'number') {
      editor.chain().focus().setTextSelection({ from, to }).run();
    }
  };

  return (
    <div className="writing-studio-sidebar w-80 lg:w-96 bg-white/95 backdrop-blur-md border-l border-slate-200/90 flex flex-col h-full shadow-lg z-20">
      {/* 1. Sidebar Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 bg-slate-50/80">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('brief')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'brief'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Brief
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tools'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Script Tools
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'comments'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Comments
            {comments.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                {comments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Sidebar Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-slate-800">
        {/* ================= TAB 1: BRIEF ================= */}
        {activeTab === 'brief' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <FileText className="w-4 h-4" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider">Creative Brief</h3>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Objective</label>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">
                  {briefData?.objective || briefData?.description || 'Build high-converting script aligned with student recruitment.'}
                </p>
              </div>

              {briefData?.targetAudience && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Target Audience</label>
                  <p className="text-xs font-medium text-slate-700 mt-0.5">{briefData.targetAudience}</p>
                </div>
              )}

              {briefData?.tone && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Tone of Voice</label>
                  <p className="text-xs font-medium text-slate-700 mt-0.5">{briefData.tone}</p>
                </div>
              )}

              {briefData?.program && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400">Program / Event</label>
                  <p className="text-xs font-medium text-slate-700 mt-0.5">{briefData.program}</p>
                </div>
              )}

              {briefData?.contentLink && (
                <div className="pt-2 border-t border-slate-200">
                  <a
                    href={briefData.contentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Reference Material / Link
                  </a>
                </div>
              )}
            </div>

            {/* Upstream Outputs Accordion */}
            {upstreamOutputs && upstreamOutputs.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Upstream Stage Outputs
                </label>
                <div className="space-y-1.5">
                  {upstreamOutputs.map((out, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-900">{out.stageKey}</span>
                        {out.ownerName && <p className="text-[11px] text-slate-500">By {out.ownerName}</p>}
                      </div>
                      {out.deliverableUrl ? (
                        <a
                          href={out.deliverableUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">{out.status}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: SCRIPT TOOLS ================= */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            {/* 1. Duration Estimator */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-xs">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Duration Estimator
                </div>
                <select
                  value={wpm}
                  onChange={(e) => setWpm(Number(e.target.value))}
                  className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                  title="Words Per Minute"
                >
                  <option value={110}>110 WPM (Slow)</option>
                  <option value={130}>130 WPM (Standard)</option>
                  <option value={150}>150 WPM (Fast)</option>
                </select>
              </div>

              {/* Target Duration Chips */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400">Reel Target Duration</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[15, 30, 60, 90].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setTargetDuration(sec)}
                      className={`py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        targetDuration === sec
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Metrics Display */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Words</span>
                  <div className="text-base font-extrabold text-slate-900">{durationStats.wordCount}</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Estimated Spoken</span>
                  <div className="text-base font-extrabold text-slate-900">{durationStats.estimatedSeconds}s</div>
                </div>
              </div>

              {/* Warning Alert if duration exceeds target */}
              {durationStats.isOverTarget ? (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Over Target: </span>
                    {durationStats.warningMessage}
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Pacing is within target duration ({durationStats.estimatedSeconds}s / {targetDuration}s).
                </div>
              )}
            </div>

            {/* 2. Hook Check */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Hook Check (0–3s)
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    hookStats.passes ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {hookStats.passes ? 'Pass' : 'Warning'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Opening Line Detected:</div>
                <p className="font-semibold text-slate-800 italic line-clamp-2">
                  {hookStats.openingText ? `"${hookStats.openingText}"` : 'No opening text written yet.'}
                </p>
                <div className="text-[11px] text-slate-500 pt-1">
                  Words: <strong>{hookStats.wordCount}</strong> / 12 limit
                </div>
              </div>

              {!hookStats.passes && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>{hookStats.warningMessage}</div>
                </div>
              )}
            </div>

            {/* 3. Automatic Shot List Generator */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-xs">
                  <ListOrdered className="w-4 h-4 text-emerald-600" />
                  Automatic Shot List ({shotList.length})
                </div>
                {shotList.length > 0 && (
                  <button
                    onClick={handleCopyShotList}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    {copiedShotList ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedShotList ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              {shotList.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {shotList.map((shot, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded-xl border border-slate-200 text-xs flex items-start gap-2"
                    >
                      <span className="font-extrabold text-indigo-600 shrink-0">#{shot.sceneNumber}</span>
                      <p className="text-slate-800 font-medium line-clamp-2">{shot.visual}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Insert a Scene Table in the editor. Visual actions will automatically extract into a shot list for the
                  Videographer!
                </p>
              )}
            </div>

            {/* 4. Captions & Hashtags Section */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-xs">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Captions & Hashtags
                </div>
              </div>

              {/* Caption Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-400">Post Caption</label>
                  <button
                    onClick={handleCopyCaption}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    {copiedCaption ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </div>
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Ready to build the future of robotics? Join HACA Winter 2026..."
                  rows={3}
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Hashtags Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-slate-400">Hashtags</label>
                  <button
                    onClick={handleCopyHashtags}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    {copiedHashtags ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </div>
                <input
                  type="text"
                  value={hashtagsText}
                  onChange={(e) => setHashtagsText(e.target.value)}
                  placeholder="#Robotics #HACA #TechEducation #KeralaTech"
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Platform Limits Progress Bars */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                {/* Instagram */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-700">Instagram (max 2,200)</span>
                    <span className={captionStats.instagram.isOverLimit ? 'text-rose-600' : 'text-slate-500'}>
                      {captionStats.instagram.charCount} / 2,200
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        captionStats.instagram.isOverLimit ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${captionStats.instagram.percent}%` }}
                    />
                  </div>
                </div>

                {/* LinkedIn */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-700">LinkedIn (max 3,000)</span>
                    <span className={captionStats.linkedin.isOverLimit ? 'text-rose-600' : 'text-slate-500'}>
                      {captionStats.linkedin.charCount} / 3,000
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        captionStats.linkedin.isOverLimit ? 'bg-rose-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${captionStats.linkedin.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Personal Snippets Library */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-xs">
                  <Layers className="w-4 h-4 text-purple-600" />
                  Personal Snippets
                </div>
                <button
                  onClick={() => setShowAddSnippet(!showAddSnippet)}
                  className="p-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold flex items-center"
                  title="Add New Snippet"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAddSnippet && (
                <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2">
                  <input
                    type="text"
                    value={newSnippetTitle}
                    onChange={(e) => setNewSnippetTitle(e.target.value)}
                    placeholder="Snippet Title..."
                    className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-1.5"
                  />
                  <textarea
                    value={newSnippetContent}
                    onChange={(e) => setNewSnippetContent(e.target.value)}
                    placeholder="Snippet content / copy..."
                    rows={2}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setShowAddSnippet(false)}
                      className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSnippet}
                      className="px-2.5 py-1 text-xs font-bold bg-indigo-600 text-white rounded"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {snippets.map((snip) => (
                  <div
                    key={snip.id}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between group hover:border-indigo-300 transition-all"
                  >
                    <div className="flex-1 mr-2">
                      <div className="text-xs font-bold text-slate-900">{snip.title}</div>
                      <div
                        className="text-[11px] text-slate-500 line-clamp-1"
                        dangerouslySetInnerHTML={{ __html: snip.content }}
                      />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleInsertSnippet(snip.content)}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-bold"
                        title="Insert at cursor"
                      >
                        Insert
                      </button>
                      <button
                        onClick={() => handleDeleteSnippet(snip.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete snippet"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Teleprompter quick button */}
            <button
              onClick={onOpenTeleprompter}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Tv className="w-4 h-4 text-yellow-400" />
              Launch Teleprompter Mode
            </button>
          </div>
        )}

        {/* ================= TAB 3: COMMENTS ================= */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-indigo-600">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">Comments & Feedback</h3>
              </div>
              <span className="text-xs font-bold text-slate-500">{comments.length} total</span>
            </div>

            {/* Add Comment Input */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add comment on document or selection..."
                rows={2}
                className="w-full text-xs font-medium border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleCreateComment}
                  disabled={!newCommentText.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  Post Comment
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No comments yet. Reviewer comments will anchor directly to your script.
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment._id}
                    onClick={() => handleJumpToComment(comment)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      comment.resolved
                        ? 'bg-slate-50/60 border-slate-200/60 opacity-60'
                        : 'bg-white border-slate-200 shadow-xs hover:border-indigo-300'
                    }`}
                  >
                    {/* Comment Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          url={(comment.authorId as any)?.avatarUrl}
                          name={comment.authorId?.name || 'Reviewer'}
                          userId={comment.authorId?._id}
                          size="xs"
                        />
                        <span className="text-xs font-bold text-slate-900">
                          {comment.authorId?.name || 'Reviewer'}
                        </span>
                        {comment.authorId?.role && (
                          <span className="text-[10px] font-bold text-slate-400 capitalize">
                            ({comment.authorId.role})
                          </span>
                        )}
                      </div>

                      {/* Resolve Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolveComment(comment._id);
                        }}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors ${
                          comment.resolved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        {comment.resolved ? 'Resolved' : 'Resolve'}
                      </button>
                    </div>

                    {/* Anchored Quote if available */}
                    {comment.anchor?.range?.text && (
                      <div className="my-2 p-2 bg-amber-50/80 border-l-2 border-amber-400 rounded-r-lg text-[11px] text-amber-900 italic line-clamp-2">
                        "{comment.anchor.range.text}"
                      </div>
                    )}

                    {/* Comment Body */}
                    <p className="text-xs font-medium text-slate-800 mt-1.5">{comment.text}</p>

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 border-slate-100 space-y-2">
                        {comment.replies.map((reply) => (
                          <div key={reply._id} className="text-xs space-y-0.5">
                            <span className="font-bold text-slate-800">{reply.authorId?.name}: </span>
                            <span className="text-slate-700 font-medium">{reply.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {!comment.resolved && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={replyInputs[comment._id] || ''}
                          onChange={(e) =>
                            setReplyInputs({ ...replyInputs, [comment._id]: e.target.value })
                          }
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Reply to comment..."
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 focus:bg-white"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = replyInputs[comment._id];
                              if (val && val.trim()) {
                                onReplyComment(comment._id, val.trim());
                                setReplyInputs({ ...replyInputs, [comment._id]: '' });
                              }
                            }
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const val = replyInputs[comment._id];
                            if (val && val.trim()) {
                              onReplyComment(comment._id, val.trim());
                              setReplyInputs({ ...replyInputs, [comment._id]: '' });
                            }
                          }}
                          className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
