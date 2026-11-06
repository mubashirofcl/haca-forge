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
    <div className="writing-studio-sidebar w-full md:w-80 lg:w-96 h-[45vh] md:h-full shrink-0 bg-ui-card/95 backdrop-blur-md border-t md:border-t-0 md:border-l border-ui-line flex flex-col z-20">
      {/* 1. Sidebar Tab Switcher */}
      <div className="border-b border-ui-line px-3 py-2">
        <div className="ui-tabs w-full grid grid-cols-3">
          <button
            type="button"
            aria-pressed={activeTab === 'brief'}
            onClick={() => setActiveTab('brief')}
            className={`ui-tab justify-center px-2 text-xs ${activeTab === 'brief' ? 'is-active' : ''}`}
          >
            Brief
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'tools'}
            onClick={() => setActiveTab('tools')}
            className={`ui-tab justify-center px-2 text-xs ${activeTab === 'tools' ? 'is-active' : ''}`}
          >
            Script Tools
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'comments'}
            onClick={() => setActiveTab('comments')}
            className={`ui-tab justify-center gap-1 px-2 text-xs ${activeTab === 'comments' ? 'is-active' : ''}`}
          >
            Comments
            {comments.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-white text-ui-ink">
                {comments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Sidebar Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-ui-text">
        {/* ================= TAB 1: BRIEF ================= */}
        {activeTab === 'brief' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-ui-ink">
              <FileText className="w-4 h-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Creative Brief</h3>
            </div>

            <div className="bg-white/60 rounded-ui-card p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-ui-muted">Objective</label>
                <p className="text-xs font-semibold text-ui-ink mt-0.5">
                  {briefData?.objective || briefData?.description || 'Build high-converting script aligned with student recruitment.'}
                </p>
              </div>

              {briefData?.targetAudience && (
                <div>
                  <label className="text-xs font-medium text-ui-muted">Target Audience</label>
                  <p className="text-xs font-medium text-ui-text mt-0.5">{briefData.targetAudience}</p>
                </div>
              )}

              {briefData?.tone && (
                <div>
                  <label className="text-xs font-medium text-ui-muted">Tone of Voice</label>
                  <p className="text-xs font-medium text-ui-text mt-0.5">{briefData.tone}</p>
                </div>
              )}

              {briefData?.program && (
                <div>
                  <label className="text-xs font-medium text-ui-muted">Program / Event</label>
                  <p className="text-xs font-medium text-ui-text mt-0.5">{briefData.program}</p>
                </div>
              )}

              {briefData?.contentLink && (
                <div className="pt-2 border-t border-ui-line">
                  <a
                    href={briefData.contentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2 text-xs font-semibold text-ui-ink hover:underline underline-offset-4 rounded-full -ml-2 mr-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    Reference Material / Link
                  </a>
                </div>
              )}
            </div>

            {/* Upstream Outputs Accordion */}
            {upstreamOutputs && upstreamOutputs.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-ui-muted flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Upstream Stage Outputs
                </label>
                <div className="space-y-1.5">
                  {upstreamOutputs.map((out, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-xl flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="text-xs font-semibold text-ui-ink">{out.stageKey}</span>
                        {out.ownerName && <p className="text-[11px] text-ui-muted">By {out.ownerName}</p>}
                      </div>
                      {out.deliverableUrl ? (
                        <a
                          href={out.deliverableUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ui-btn ui-btn-secondary h-11 gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] font-semibold text-ui-muted">{out.status}</span>
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
            <div className="bg-white/60 rounded-ui-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-ui-ink font-semibold text-xs">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  Duration Estimator
                </div>
                <select
                  value={wpm}
                  onChange={(e) => setWpm(Number(e.target.value))}
                  aria-label="Speaking pace" className="ui-select text-xs"
                  title="Words Per Minute"
                >
                  <option value={110}>110 WPM (Slow)</option>
                  <option value={130}>130 WPM (Standard)</option>
                  <option value={150}>150 WPM (Fast)</option>
                </select>
              </div>

              {/* Target Duration Chips */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ui-muted">Reel Target Duration</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[15, 30, 60, 90].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      aria-pressed={targetDuration === sec}
                      onClick={() => setTargetDuration(sec)}
                      className={`min-h-[44px] rounded-xl text-xs font-semibold transition-colors ${
                        targetDuration === sec
                          ? 'bg-ui-ink text-white'
                          : 'bg-white border border-ui-line text-ui-text hover:bg-white/70'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Metrics Display */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-white p-2.5 rounded-xl">
                  <span className="text-xs font-medium text-ui-muted">Words</span>
                  <div className="text-base font-bold text-ui-ink tabular-nums">{durationStats.wordCount}</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl">
                  <span className="text-xs font-medium text-ui-muted">Estimated Spoken</span>
                  <div className="text-base font-bold text-ui-ink tabular-nums">{durationStats.estimatedSeconds}s</div>
                </div>
              </div>

              {/* Warning Alert if duration exceeds target */}
              {durationStats.isOverTarget ? (
                <div className="p-2.5 status-tint status-changes rounded-xl flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-bold">Over Target: </span>
                    {durationStats.warningMessage}
                  </div>
                </div>
              ) : (
                <div className="p-2 status-tint status-approved rounded-xl flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Pacing is within target duration ({durationStats.estimatedSeconds}s / {targetDuration}s).
                </div>
              )}
            </div>

            {/* 2. Hook Check */}
            <div className="bg-white/60 rounded-ui-card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-ui-ink font-semibold text-xs">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  Hook Check (0–3s)
                </div>
                <span
                  className={`status-chip px-2 py-0.5 text-[11px] font-semibold ${
                    hookStats.passes ? 'status-approved' : 'status-changes'
                  }`}
                >
                  {hookStats.passes ? 'Pass' : 'Warning'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl text-xs space-y-1">
                <div className="text-xs font-medium text-ui-muted">Opening Line Detected:</div>
                <p className="font-semibold text-ui-ink italic line-clamp-2">
                  {hookStats.openingText ? `"${hookStats.openingText}"` : 'No opening text written yet.'}
                </p>
                <div className="text-[11px] text-ui-muted pt-1">
                  Words: <strong>{hookStats.wordCount}</strong> / 12 limit
                </div>
              </div>

              {!hookStats.passes && (
                <div className="p-2.5 status-tint status-waiting rounded-xl flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>{hookStats.warningMessage}</div>
                </div>
              )}
            </div>

            {/* 3. Automatic Shot List Generator */}
            <div className="bg-white/60 rounded-ui-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-ui-ink font-semibold text-xs">
                  <ListOrdered className="w-4 h-4" aria-hidden="true" />
                  Automatic Shot List ({shotList.length})
                </div>
                {shotList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyShotList}
                    className="inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2 text-xs font-semibold text-ui-ink hover:underline underline-offset-4 rounded-full"
                  >
                    {copiedShotList ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" />}
                    {copiedShotList ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              {shotList.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {shotList.map((shot, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded-xl text-xs flex items-start gap-2"
                    >
                      <span className="font-semibold text-ui-ink shrink-0">#{shot.sceneNumber}</span>
                      <p className="text-ui-text font-medium line-clamp-2">{shot.visual}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ui-muted italic">
                  Insert a Scene Table in the editor. Visual actions will automatically extract into a shot list for the
                  Videographer!
                </p>
              )}
            </div>

            {/* 4. Captions & Hashtags Section */}
            <div className="bg-white/60 rounded-ui-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-ui-ink font-semibold text-xs">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  Captions & Hashtags
                </div>
              </div>

              {/* Caption Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="ws-caption" className="text-xs font-medium text-ui-muted">Post Caption</label>
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2 text-xs font-semibold text-ui-ink hover:underline underline-offset-4 rounded-full"
                  >
                    {copiedCaption ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </div>
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Ready to build the future of robotics? Join HACA Winter 2026..."
                  rows={3}
                  id="ws-caption"
                  className="ui-input ui-textarea w-full"
                />
              </div>

              {/* Hashtags Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="ws-hashtags" className="text-xs font-medium text-ui-muted">Hashtags</label>
                  <button
                    type="button"
                    onClick={handleCopyHashtags}
                    className="inline-flex items-center gap-1 min-h-[44px] px-2 -mr-2 text-xs font-semibold text-ui-ink hover:underline underline-offset-4 rounded-full"
                  >
                    {copiedHashtags ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </div>
                <input
                  type="text"
                  value={hashtagsText}
                  onChange={(e) => setHashtagsText(e.target.value)}
                  placeholder="#Robotics #HACA #TechEducation #KeralaTech"
                  id="ws-hashtags"
                  className="ui-input w-full"
                />
              </div>

              {/* Platform Limits Progress Bars */}
              <div className="space-y-2 pt-2 border-t border-ui-line">
                {/* Instagram */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-ui-text">Instagram (max 2,200)</span>
                    <span className={captionStats.instagram.isOverLimit ? 'status-chip status-changes px-1.5' : 'text-ui-muted'}>
                      {captionStats.instagram.charCount} / 2,200
                    </span>
                  </div>
                  <div className="w-full bg-ui-line h-1.5 rounded-full overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full transition-all ${
                        captionStats.instagram.isOverLimit ? 'bg-ui-coral' : 'bg-ui-ink'
                      }`}
                      style={{ width: `${captionStats.instagram.percent}%` }}
                    />
                  </div>
                </div>

                {/* LinkedIn */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-ui-text">LinkedIn (max 3,000)</span>
                    <span className={captionStats.linkedin.isOverLimit ? 'status-chip status-changes px-1.5' : 'text-ui-muted'}>
                      {captionStats.linkedin.charCount} / 3,000
                    </span>
                  </div>
                  <div className="w-full bg-ui-line h-1.5 rounded-full overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full transition-all ${
                        captionStats.linkedin.isOverLimit ? 'bg-ui-coral' : 'bg-ui-ink'
                      }`}
                      style={{ width: `${captionStats.linkedin.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Personal Snippets Library */}
            <div className="bg-white/60 rounded-ui-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-ui-ink font-semibold text-xs">
                  <Layers className="w-4 h-4" aria-hidden="true" />
                  Personal Snippets
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSnippet(!showAddSnippet)}
                  aria-expanded={showAddSnippet}
                  aria-label="Add snippet"
                  className="ui-icon-btn border-transparent"
                  title="Add New Snippet"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAddSnippet && (
                <div className="p-3 bg-white rounded-xl space-y-2">
                  <input
                    type="text"
                    value={newSnippetTitle}
                    onChange={(e) => setNewSnippetTitle(e.target.value)}
                    placeholder="Snippet Title..."
                    aria-label="Snippet title"
                    className="ui-input w-full"
                  />
                  <textarea
                    value={newSnippetContent}
                    onChange={(e) => setNewSnippetContent(e.target.value)}
                    placeholder="Snippet content / copy..."
                    rows={2}
                    aria-label="Snippet text"
                    className="ui-input ui-textarea w-full"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddSnippet(false)}
                      className="ui-btn ui-btn-secondary h-11"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSnippet}
                      className="ui-btn ui-btn-primary h-11"
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
                    className="p-2.5 bg-white rounded-xl flex items-center justify-between gap-2 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ui-ink">{snip.title}</div>
                      <div
                        className="text-[11px] text-ui-muted line-clamp-1"
                        dangerouslySetInnerHTML={{ __html: snip.content }}
                      />
                    </div>
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleInsertSnippet(snip.content)}
                        className="ui-btn ui-btn-secondary h-11 px-3"
                        title="Insert at cursor"
                      >
                        Insert
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSnippet(snip.id)}
                        className="ui-icon-btn border-transparent"
                        title="Delete snippet"
                        aria-label="Delete snippet"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Teleprompter quick button */}
            <button
              type="button"
              onClick={onOpenTeleprompter}
              className="ui-btn ui-btn-secondary h-11 w-full gap-2"
            >
              <Tv className="w-4 h-4" aria-hidden="true" />
              Launch Teleprompter Mode
            </button>
          </div>
        )}

        {/* ================= TAB 3: COMMENTS ================= */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-ui-ink">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Comments & Feedback</h3>
              </div>
              <span className="text-xs font-medium text-ui-muted">{comments.length} total</span>
            </div>

            {/* Add Comment Input */}
            <div className="bg-white/60 rounded-ui-card p-3 space-y-2">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add comment on document or selection..."
                aria-label="New comment"
                rows={2}
                className="ui-input ui-textarea w-full"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateComment}
                  disabled={!newCommentText.trim()}
                  className="ui-btn ui-btn-primary h-11 gap-1.5"
                >
                  <Send className="w-3 h-3" aria-hidden="true" />
                  Post Comment
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-ui-muted text-xs">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
                  No comments yet. Reviewer comments will anchor directly to your script.
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment._id}
                    className={`p-3.5 rounded-2xl border transition-colors ${
                      comment.resolved ? 'bg-white/50 border-ui-line' : 'bg-white border-ui-line'
                    }`}
                  >
                    {/* Comment Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar
                          url={(comment.authorId as any)?.avatarUrl}
                          name={comment.authorId?.name || 'Reviewer'}
                          userId={comment.authorId?._id}
                          size="xs"
                        />
                        <span className="text-xs font-semibold text-ui-ink truncate">
                          {comment.authorId?.name || 'Reviewer'}
                        </span>
                        {comment.authorId?.role && (
                          <span className="text-[11px] font-medium text-ui-muted capitalize">
                            ({comment.authorId.role})
                          </span>
                        )}
                      </div>

                      {/* Resolve Toggle */}
                      <button
                        type="button"
                        aria-pressed={Boolean(comment.resolved)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolveComment(comment._id);
                        }}
                        className={`shrink-0 text-xs font-semibold min-h-[44px] px-3 rounded-full flex items-center gap-1 transition-colors ${
                          comment.resolved ? 'status-chip status-approved' : 'text-ui-text hover:bg-white/70 border border-ui-line'
                        }`}
                      >
                        <Check className="w-3 h-3" aria-hidden="true" />
                        {comment.resolved ? 'Resolved' : 'Resolve'}
                      </button>
                    </div>

                    {/* Quote + body: one button that jumps to the anchored text */}
                    <button
                      type="button"
                      onClick={() => handleJumpToComment(comment)}
                      title="Go to this text in the document"
                      className={`block w-full text-left rounded-lg mt-1 ${comment.resolved ? 'opacity-70' : ''}`}
                    >
                      {comment.anchor?.range?.text && (
                        <span className="block my-1.5 p-2 bg-white/70 border-l-2 border-ui-ink rounded-r-lg text-[11px] text-ui-text italic line-clamp-2">
                          "{comment.anchor.range.text}"
                        </span>
                      )}
                      <span className="block text-xs font-medium text-ui-ink py-1">{comment.text}</span>
                    </button>

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 border-ui-line space-y-2">
                        {comment.replies.map((reply) => (
                          <div key={reply._id} className="text-xs space-y-0.5">
                            <span className="font-semibold text-ui-ink">{reply.authorId?.name}: </span>
                            <span className="text-ui-text font-medium">{reply.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {!comment.resolved && (
                      <div className="mt-2.5 pt-2 border-t border-ui-line flex items-center gap-1.5">
                        <input
                          type="text"
                          value={replyInputs[comment._id] || ''}
                          onChange={(e) =>
                            setReplyInputs({ ...replyInputs, [comment._id]: e.target.value })
                          }
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Reply to comment..."
                          aria-label="Reply to comment"
                          className="ui-input flex-1 min-w-0"
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
                          type="button"
                          aria-label="Send reply"
                          className="ui-icon-btn shrink-0 bg-ui-ink text-white border-transparent hover:bg-ui-ink"
                        >
                          <Send className="w-3 h-3" aria-hidden="true" />
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
