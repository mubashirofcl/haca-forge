import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { apiFetch } from '../../../lib/api';
import { statusClass, statusTone } from '../../../lib/statusTone';
import { useAuth } from '../../../context/AuthContext';
import { getWorkspaceModeInfo } from '@mmp/shared';
import { WritingStudioRibbon, type RibbonTab } from './WritingStudioRibbon';
import { WritingStudioCanvas } from './WritingStudioCanvas';
import { WritingStudioSidebar, type SidebarTab, type CommentItem } from './WritingStudioSidebar';
import { WritingStudioStatusBar } from './WritingStudioStatusBar';
import { VersionHistoryModal, type SubmissionVersion } from './VersionHistoryModal';
import { TeleprompterModal } from './TeleprompterModal';
import { FindReplaceModal } from './FindReplaceModal';
import { exportDocxFile, importDocxFile, downloadBlob } from '../../../lib/docxUtils';
import { extractSceneTableData, type ShotListItem } from '../../../lib/scriptTools';
import {
  ArrowLeft,
  Send,
  Lock,
  Minimize2,
  Clock,
  Link as LinkIcon,
  X,
  RotateCcw,
} from 'lucide-react';

export const WritingStudioPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core Data
  const [workItem, setWorkItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);

  // Studio Document Metadata
  const [documentTitle, setDocumentTitle] = useState('Untitled Script');
  const [initialContent, setInitialContent] = useState<any>(null);
  const [currentHtml, setCurrentHtml] = useState<string>('');
  const [currentText, setCurrentText] = useState<string>('');
  const [targetDuration, setTargetDuration] = useState<number>(60);
  const [wpm, setWpm] = useState<number>(130);
  const [captionText, setCaptionText] = useState<string>('');
  const [hashtagsText, setHashtagsText] = useState<string>('');
  const [shotList, setShotList] = useState<ShotListItem[]>([]);

  // Studio State
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('home');
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('brief');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [fontFamily, setFontFamily] = useState('Plus Jakarta Sans');
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(true);
  const [spellcheckLang, setSpellcheckLang] = useState('en-US');

  // Single-Editor Session Lock
  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [lockHeldBy, setLockHeldBy] = useState<string | null>(null);

  // Autosave & Local Buffer
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline_buffered' | 'error'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<any>(null);

  // Metrics
  const [pageCount, setPageCount] = useState(1);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [charCountNoSpaces, setCharCountNoSpaces] = useState(0);
  const [selectionCount, setSelectionCount] = useState(0);

  // Modals & Panels
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionsList, setVersionsList] = useState<SubmissionVersion[]>([]);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showLinkFallbackModal, setShowLinkFallbackModal] = useState(false);
  const [fallbackLinkUrl, setFallbackLinkUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Comments
  const [comments, setComments] = useState<CommentItem[]>([]);

  // File input refs
  const fileInputDocxRef = useRef<HTMLInputElement>(null);
  const fileInputTxtRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load & Fetch WorkItem, Draft, Versions, Comments
  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    async function loadStudioData() {
      try {
        setLoading(true);

        // Fetch Work Item
        const itemRes = await apiFetch<any>(`/api/work/${id}`);
        const item = itemRes.data;
        if (!isMounted) return;
        setWorkItem(item);
        setDocumentTitle(item.title || 'Untitled Script');

        // Fetch Lock status
        try {
          const lockRes = await apiFetch<any>(`/api/work/${id}/editor-lock`, { method: 'POST' });
          if (lockRes.data?.locked) {
            setIsLockedByOther(true);
            setLockHeldBy(lockRes.data.heldBy);
          }
        } catch {}

        // Fetch Draft
        let draftContent: any = null;
        try {
          const draftRes = await apiFetch<any>(`/api/work/${id}/draft`);
          if (draftRes.data?.document) {
            draftContent = draftRes.data.document.json || draftRes.data.document.htmlSnapshot;
            if (draftRes.data.document.metadata) {
              const meta = draftRes.data.document.metadata;
              if (meta.title) setDocumentTitle(meta.title);
              if (meta.targetDuration) setTargetDuration(meta.targetDuration);
              if (meta.wpm) setWpm(meta.wpm);
              if (meta.caption) setCaptionText(meta.caption);
              if (meta.hashtags) setHashtagsText(meta.hashtags);
              if (meta.shotList) setShotList(meta.shotList);
            }
          }
        } catch {}

        // Check local buffer fallback
        const localKey = `haca_draft_buffer_${id}`;
        const buffered = localStorage.getItem(localKey);
        if (buffered) {
          try {
            const parsed = JSON.parse(buffered);
            if (parsed.content) {
              draftContent = parsed.content.json || parsed.content.html;
            }
          } catch {}
        }

        // If Revision requested (Feedback) and no draft content yet, fetch latest submission
        if (!draftContent && item.status === 'Feedback') {
          try {
            const subsRes = await apiFetch<any>(`/api/work/${id}/submissions`);
            if (subsRes.data && subsRes.data.length > 0) {
              const latest = subsRes.data[subsRes.data.length - 1];
              draftContent = latest.document?.json || latest.document?.htmlSnapshot;
              if (latest.document?.metadata) {
                const meta = latest.document.metadata;
                if (meta.caption) setCaptionText(meta.caption);
                if (meta.hashtags) setHashtagsText(meta.hashtags);
                if (meta.shotList) setShotList(meta.shotList);
              }
            }
          } catch {}
        }

        setInitialContent(draftContent);

        // Fetch Comments
        try {
          const commentsRes = await apiFetch<any>(`/api/work/${id}/comments`);
          if (commentsRes.data) {
            setComments(commentsRes.data);
          }
        } catch {}

        // Fetch Versions
        try {
          const vRes = await apiFetch<any>(`/api/work/${id}/submissions`);
          if (vRes.data) {
            setVersionsList(vRes.data);
          }
        } catch {}
      } catch (err: any) {
        console.error('Failed to load Writing Studio:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadStudioData();

    // Setup Editor Heartbeat (every 20s)
    const heartbeatInterval = setInterval(async () => {
      try {
        await apiFetch(`/api/work/${id}/editor-lock`, { method: 'POST' });
      } catch {}
    }, 20000);

    // Release lock on unmount
    return () => {
      isMounted = false;
      clearInterval(heartbeatInterval);
      try {
        apiFetch(`/api/work/${id}/editor-lock`, { method: 'DELETE' }).catch(() => {});
      } catch {}
    };
  }, [id]);

  // 2. Autosave Engine
  const performSave = useCallback(
    async (_manual: boolean = false) => {
      if (!id || !editor || isLockedByOther) return;

      const json = editor.getJSON();
      const html = editor.getHTML();
      const text = editor.getText();

      const extracted = extractSceneTableData(html);

      const metadata = {
        title: documentTitle,
        targetDuration,
        wpm,
        caption: captionText,
        hashtags: hashtagsText,
        shotList: shotList.length > 0 ? shotList : extracted.shotList,
      };

      const payload = {
        document: {
          json,
          htmlSnapshot: html,
          metadata,
        },
      };

      // Buffer locally first for resilience
      const localKey = `haca_draft_buffer_${id}`;
      localStorage.setItem(
        localKey,
        JSON.stringify({
          updatedAt: new Date().toISOString(),
          content: { json, html, text },
          metadata,
        })
      );

      try {
        setSaveStatus('saving');
        await apiFetch(`/api/work/${id}/draft`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (err) {
        console.warn('Autosave network error, buffered in localStorage:', err);
        setSaveStatus('offline_buffered');
      }
    },
    [id, editor, isLockedByOther, documentTitle, targetDuration, wpm, captionText, hashtagsText, shotList]
  );

  // Content change handler (debounced 3s autosave)
  const handleContentChange = useCallback(
    ({ html, text }: { html: string; text: string }) => {
      setCurrentHtml(html);
      setCurrentText(text);

      // Update metrics
      const trimmed = text.trim();
      const words = trimmed ? trimmed.split(/\s+/).length : 0;
      setWordCount(words);
      setCharCount(text.length);
      setCharCountNoSpaces(text.replace(/\s+/g, '').length);

      if (editor) {
        const { from, to } = editor.state.selection;
        setSelectionCount(to - from);
      }

      // Debounce autosave
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus('saving');
      saveTimeoutRef.current = setTimeout(() => {
        performSave();
      }, 3000);
    },
    [editor, performSave]
  );

  // Selection change listener
  useEffect(() => {
    if (!editor) return;
    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      setSelectionCount(to - from);
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor]);

  // Canonical workspace mode computation
  const modeInfo = useMemo(() => {
    return getWorkspaceModeInfo(user, workItem);
  }, [user, workItem]);

  // Read-only condition: if step is not in edit mode or locked by another user
  const isReadOnly = modeInfo.mode !== 'edit' || isLockedByOther;

  // Under review check: waiting for approval or in read/review mode during Feedback state
  const isUnderReview =
    workItem?.status === 'Pending' ||
    (workItem?.status === 'Feedback' && modeInfo.mode !== 'edit');

  // Sync editor editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isReadOnly);
  }, [editor, isReadOnly]);

  // Empty document check (Task 5: disabled while document is empty)
  const isDocumentEmpty = !currentText.trim() || currentText.trim() === 'Start writing your script...';

  // Submit for Approval Handler
  const handleSubmitForApproval = async () => {
    if (!id || !editor || isDocumentEmpty || isReadOnly) return;

    try {
      setSubmitting(true);
      await performSave(true);

      const json = editor.getJSON();
      const html = editor.getHTML();
      const extracted = extractSceneTableData(html);

      const metadata = {
        title: documentTitle,
        targetDuration,
        wpm,
        caption: captionText,
        hashtags: hashtagsText,
        shotList: extracted.shotList,
      };

      await apiFetch(`/api/work/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          kind: 'document',
          document: {
            json,
            htmlSnapshot: html,
            metadata,
          },
          notes: `Submitted from Writing Studio (${wordCount} words, ~${Math.round((wordCount / wpm) * 60)}s)`,
        }),
      });

      // Clear local buffer
      localStorage.removeItem(`haca_draft_buffer_${id}`);

      // Refresh workItem
      const updatedRes = await apiFetch<any>(`/api/work/${id}`);
      setWorkItem(updatedRes.data);
      alert('Your script has been submitted for Creative Head approval.');
    } catch (err: any) {
      alert(`Submission failed: ${err.message || 'Please check your connection and try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Fallback Link Submission (Task 6)
  const handleFallbackLinkSubmit = async () => {
    if (!id || !fallbackLinkUrl.trim()) return;

    try {
      setSubmitting(true);
      await apiFetch(`/api/work/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          kind: 'document',
          linkUrl: fallbackLinkUrl.trim(),
          notes: 'Submitted via external document link fallback',
        }),
      });

      setShowLinkFallbackModal(false);
      const updatedRes = await apiFetch<any>(`/api/work/${id}`);
      setWorkItem(updatedRes.data);
      alert('External document link submitted for Creative Head approval.');
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Comments Operations
  const handleAddComment = async (text: string, range?: { from: number; to: number; text: string }) => {
    if (!id || !text) return;
    try {
      const res = await apiFetch<any>(`/api/work/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          anchor: range
            ? {
                type: 'text',
                range,
              }
            : undefined,
        }),
      });
      setComments([...comments, res.data]);
    } catch (err: any) {
      alert(`Could not add comment: ${err.message}`);
    }
  };

  const handleReplyComment = async (parentId: string, text: string) => {
    if (!id || !text) return;
    try {
      await apiFetch<any>(`/api/work/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          parentId,
        }),
      });
      // Refresh comments
      const commentsRes = await apiFetch<any>(`/api/work/${id}/comments`);
      setComments(commentsRes.data);
    } catch (err: any) {
      alert(`Could not add reply: ${err.message}`);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      await apiFetch(`/api/submissions/comments/${commentId}/resolve`, {
        method: 'PATCH',
      });
      setComments(
        comments.map((c) => (c._id === commentId ? { ...c, resolved: !c.resolved } : c))
      );
    } catch (err: any) {
      alert(`Could not resolve comment: ${err.message}`);
    }
  };

  // Import / Export Handlers
  const handleExportDocx = async () => {
    if (!editor) return;
    try {
      const blob = await exportDocxFile(documentTitle, editor.getHTML(), editor.getText());
      downloadBlob(blob, `${documentTitle.replace(/\s+/g, '_')}.docx`);
    } catch (err: any) {
      alert(`DOCX export failed: ${err.message}`);
    }
  };

  const handleImportDocx = () => {
    fileInputDocxRef.current?.click();
  };

  const handleDocxFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    try {
      const html = await importDocxFile(file);
      editor.commands.setContent(html);
      alert('DOCX imported successfully.');
    } catch (err: any) {
      alert(`DOCX import failed: ${err.message}`);
    }
    e.target.value = '';
  };

  const handleExportTxt = () => {
    if (!editor) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${documentTitle.replace(/\s+/g, '_')}.txt`);
  };

  const handleImportTxt = () => {
    fileInputTxtRef.current?.click();
  };

  const handleTxtFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const text = await file.text();
    const html = text
      .split('\n')
      .map((line) => `<p>${line.trim()}</p>`)
      .join('');
    editor.commands.setContent(html);
    e.target.value = '';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRestoreVersion = (version: SubmissionVersion) => {
    if (!editor) return;
    if (version.document?.json) {
      editor.commands.setContent(version.document.json);
    } else if (version.document?.htmlSnapshot) {
      editor.commands.setContent(version.document.htmlSnapshot);
    }
    if (version.document?.metadata) {
      const meta = version.document.metadata;
      if (meta.title) setDocumentTitle(meta.title);
      if (meta.targetDuration) setTargetDuration(meta.targetDuration);
      if (meta.caption) setCaptionText(meta.caption);
      if (meta.hashtags) setHashtagsText(meta.hashtags);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-300">Loading Writing Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/90 text-slate-900 select-none">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputDocxRef}
        onChange={handleDocxFileSelected}
        accept=".docx"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputTxtRef}
        onChange={handleTxtFileSelected}
        accept=".txt"
        className="hidden"
      />

      {/* Focus Mode Floating Exit Button */}
      {isFocusMode && (
        <button
          onClick={() => setIsFocusMode(false)}
          className="fixed top-4 right-4 z-50 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-bold backdrop-blur-md shadow-lg flex items-center gap-1.5 cursor-pointer"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          Exit Focus Mode
        </button>
      )}

      {/* 1. Writing Studio Top Header Bar (Hidden in Focus Mode & Print) */}
      {!isFocusMode && (
        <header className="writing-studio-header h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-30">
          {/* Back & Document Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/work/${id}`)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              title="Return to Step Page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Step</span>
            </button>

            <span className="text-slate-300">|</span>

            <div className="truncate">
              <span className="text-xs font-extrabold text-slate-900 truncate">
                {documentTitle}
              </span>
              <span className="hidden md:inline text-[11px] font-bold text-indigo-600 ml-2 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
                {workItem?.stageKey || 'Script'} Studio
              </span>
            </div>
          </div>

          {/* Right Status & Submit Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Status Badge */}
            <span
              className={`status-chip ${statusClass(
                isUnderReview ? 'waiting' : statusTone(workItem?.status || 'In Progress')
              )} px-2.5 py-1 text-xs font-black uppercase tracking-wider gap-1`}
            >
              {isUnderReview ? (
                <>
                  <Clock className="w-3 h-3" />
                  Waiting for approval
                </>
              ) : workItem?.status === 'Feedback' ? (
                <>
                  <RotateCcw className="w-3 h-3" />
                  Changes requested
                </>
              ) : (
                workItem?.status || 'In Progress'
              )}
            </span>

            {/* Fallback Option (Task 6) */}
            <button
              onClick={() => setShowLinkFallbackModal(true)}
              disabled={isReadOnly}
              className="hidden lg:flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
              title="Use external Google Docs or Drive link instead"
            >
              <LinkIcon className="w-3 h-3" />
              Use a link instead
            </button>

            {/* Submit for Approval Button */}
            {isUnderReview ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs font-extrabold">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                Under Review
              </div>
            ) : (
              <button
                onClick={handleSubmitForApproval}
                disabled={isDocumentEmpty || isReadOnly || submitting}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                  isDocumentEmpty || isReadOnly
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                }`}
                title={
                  isDocumentEmpty
                    ? 'Document is empty. Write your script before submitting.'
                    : isReadOnly
                    ? 'Studio is read-only or locked by another editor.'
                    : 'Submit script for Creative Head approval'
                }
              >
                <Send className="w-3.5 h-3.5" />
                {submitting
                  ? 'Submitting...'
                  : (workItem?.revisions || 0) > 0
                  ? `Resubmit (v${(workItem.revisions || 0) + 1})`
                  : 'Submit for Approval'}
              </button>
            )}
          </div>
        </header>
      )}

      {/* 2. Read-Only / Concurrency Banner */}
      {isLockedByOther && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-inner">
          <Lock className="w-4 h-4" />
          <span>
            {lockHeldBy || 'Another user'} is currently editing this document. You are in read-only view.
          </span>
        </div>
      )}

      {isUnderReview && !isLockedByOther && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-inner">
          <Clock className="w-4 h-4" />
          <span>This step is currently waiting for Creative Head approval. The studio is in read-only view.</span>
        </div>
      )}

      {/* 3. Ribbon Toolbar (Hidden in Focus Mode & Print) */}
      {!isFocusMode && (
        <WritingStudioRibbon
          editor={editor}
          activeTab={activeRibbonTab}
          setActiveTab={setActiveRibbonTab}
          zoom={zoom}
          setZoom={setZoom}
          isFocusMode={isFocusMode}
          setIsFocusMode={setIsFocusMode}
          onOpenVersionHistory={() => setShowVersionHistory(true)}
          onOpenTeleprompter={() => setShowTeleprompter(true)}
          onOpenFindReplace={() => setShowFindReplace(true)}
          onExportDocx={handleExportDocx}
          onImportDocx={handleImportDocx}
          onExportTxt={handleExportTxt}
          onImportTxt={handleImportTxt}
          onPrint={handlePrint}
          documentTitle={documentTitle}
          onRenameDocument={(newTitle) => {
            setDocumentTitle(newTitle);
            performSave(true);
          }}
          spellcheckLang={spellcheckLang}
          setSpellcheckLang={setSpellcheckLang}
          spellcheckEnabled={spellcheckEnabled}
          setSpellcheckEnabled={setSpellcheckEnabled}
          commentsCount={comments.length}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
        />
      )}

      {/* 4. Main Body: A4 Canvas + Docked Sidebar */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Canvas Area */}
        <WritingStudioCanvas
          initialContent={initialContent}
          initialHtml={workItem?.deliverableUrl ? undefined : undefined}
          isReadOnly={isReadOnly}
          zoom={zoom}
          fontFamily={fontFamily}
          spellcheckEnabled={spellcheckEnabled}
          spellcheckLang={spellcheckLang}
          onEditorReady={setEditor}
          onContentChange={handleContentChange}
          onManualSave={() => performSave(true)}
          onOpenFindReplace={() => setShowFindReplace(true)}
          onPageCountChange={setPageCount}
        />

        {/* Docked Collapsible Sidebar (Hidden in Focus Mode & Print) */}
        {!isFocusMode && sidebarOpen && (
          <WritingStudioSidebar
            editor={editor}
            activeTab={activeSidebarTab}
            setActiveTab={setActiveSidebarTab}
            briefData={{
              objective: workItem?.brief?.description || workItem?.description,
              targetAudience: workItem?.profileId?.name,
              tone: 'Authentic, High-energy, Builder-focused',
              program: workItem?.contentPieceId?.title || workItem?.title,
              contentLink: workItem?.contentLink || workItem?.brief?.contentLink,
              assetsLink: workItem?.assetsLink || workItem?.brief?.assetsLink,
              description: workItem?.description,
            }}
            upstreamOutputs={
              workItem?.previousStage
                ? [
                    {
                      stageKey: workItem.previousStage.stageKey,
                      deliverableUrl: workItem.previousStage.deliverableUrl,
                      status: workItem.previousStage.status,
                      ownerName: workItem.previousStage.owner?.name,
                    },
                  ]
                : []
            }
            targetDuration={targetDuration}
            setTargetDuration={setTargetDuration}
            wpm={wpm}
            setWpm={setWpm}
            captionText={captionText}
            setCaptionText={setCaptionText}
            hashtagsText={hashtagsText}
            setHashtagsText={setHashtagsText}
            comments={comments}
            onAddComment={handleAddComment}
            onReplyComment={handleReplyComment}
            onResolveComment={handleResolveComment}
            onOpenTeleprompter={() => setShowTeleprompter(true)}
            onShotListExtracted={(extracted) => setShotList(extracted)}
          />
        )}
      </main>

      {/* 5. Bottom Status Bar (Hidden in Focus Mode & Print) */}
      {!isFocusMode && (
        <WritingStudioStatusBar
          pageCount={pageCount}
          currentPage={1}
          wordCount={wordCount}
          charCount={charCount}
          charCountNoSpaces={charCountNoSpaces}
          selectionCount={selectionCount}
          zoom={zoom}
          setZoom={setZoom}
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          spellcheckLang={spellcheckLang}
        />
      )}

      {/* 6. Modals */}
      <VersionHistoryModal
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        versions={versionsList}
        onRestoreVersion={handleRestoreVersion}
      />

      <TeleprompterModal
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
        title={documentTitle}
        scriptHtml={currentHtml || editor?.getHTML() || ''}
      />

      <FindReplaceModal
        isOpen={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        editor={editor}
      />

      {/* Fallback External Link Modal (Task 6) */}
      {showLinkFallbackModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <LinkIcon className="w-4 h-4 text-indigo-600" />
                Submit via External Link
              </h3>
              <button
                onClick={() => setShowLinkFallbackModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              If you worked outside the Writing Studio, provide your external document link (e.g. Google Docs, Notion, or
              OneDrive).
            </p>

            <input
              type="url"
              value={fallbackLinkUrl}
              onChange={(e) => setFallbackLinkUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLinkFallbackModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleFallbackLinkSubmit}
                disabled={!fallbackLinkUrl.trim() || submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white shadow-xs"
              >
                {submitting ? 'Submitting...' : 'Submit Link for Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
