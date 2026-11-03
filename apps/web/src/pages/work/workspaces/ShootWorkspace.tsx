import React, { useState, useEffect, useCallback } from 'react';
import {
  Film,
  FileText,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  X,
  ListChecks,
  Info,
  Calendar,
  Send,
} from 'lucide-react';
import { MediaItemType } from '@mmp/shared';
import { apiFetch } from '../../../lib/api';
import { UploadManager, useGlobalUploadQueue } from './UploadManager';
import { ClipCard } from './ClipCard';
import { VideoPlayer } from './VideoPlayer';
import { MediaThread } from './MediaThread';

interface ShootWorkspaceProps {
  workItem: {
    id: string;
    title: string;
    stageKey?: string;
    status?: string;
    targetDate?: string;
    description?: string;
    revisions?: number;
  };
  brief?: {
    title?: string;
    description?: string;
    channel?: string;
    targetAudience?: string;
    hookIdea?: string;
    [key: string]: any;
  };
  scriptContent?: string;
  shotList?: Array<{ sceneNumber?: number; visual: string; audio?: string; shotRef?: string }>;
  shootDate?: string;
  onSubmit?: (data?: any) => Promise<void>;
  isSubmitting?: boolean;
}

export const ShootWorkspace: React.FC<ShootWorkspaceProps> = ({
  workItem,
  brief: propBrief,
  scriptContent: propScriptContent,
  shotList: propShotList = [],
  shootDate: propShootDate,
  onSubmit,
  isSubmitting: propIsSubmitting = false,
}) => {
  const stageItemId = workItem.id;
  const brief =
    propBrief ||
    (typeof (workItem as any).brief === 'string'
      ? { description: (workItem as any).brief }
      : (workItem as any).brief);
  const scriptContent = propScriptContent || (workItem as any).scriptContent || '';
  const shootDate = propShootDate || (workItem as any).shootDate || workItem.targetDate;

  // Active uploads queue for this step
  const activeUploads = useGlobalUploadQueue(stageItemId);

  // Clips and shot coverage state
  const [clips, setClips] = useState<MediaItemType[]>([]);
  const [availableShots, setAvailableShots] = useState<any[]>(propShotList);
  const [coverageString, setCoverageString] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Right Panel Tabs: 'shotlist' | 'script' | 'brief'
  const [rightTab, setRightTab] = useState<'shotlist' | 'script' | 'brief'>('shotlist');

  // Player & Thread view modal / bottom sheet
  const [activeClip, setActiveClip] = useState<MediaItemType | null>(null);
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);
  const [momentTimestamp, setMomentTimestamp] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Fetch clips and shot coverage from backend
  const fetchClips = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await apiFetch<any>(`/api/work/${stageItemId}/clips`);
      const data = res?.data || res;
      const loadedClips: MediaItemType[] = data.clips || [];
      setClips(loadedClips);
      if (data.shotList && data.shotList.length > 0) {
        setAvailableShots(data.shotList);
      }
      setCoverageString(data.coverage || '');

      // If active clip was opened, keep it synced
      if (activeClip) {
        const found = loadedClips.find((c) => c._id === activeClip._id);
        if (found) setActiveClip(found);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to load clips');
    } finally {
      setLoading(false);
    }
  }, [stageItemId, activeClip?._id]);

  useEffect(() => {
    if (stageItemId) {
      fetchClips();
    }
  }, [stageItemId]);

  // Submission Validation Rules
  const uploadsRunning = activeUploads.some(
    (u) => u.status === 'uploading' || u.status === 'queued'
  );
  const hasClips = clips.length > 0;

  // Flagged clips that require replacement
  const flaggedClips = clips.filter((c) => c.status === 'reshoot_needed');
  const unreplacedFlaggedClips = flaggedClips.filter(
    (flagged) => !clips.some((c) => c.replacesId && c.replacesId.toString() === flagged._id.toString())
  );
  const hasUnreplacedFlagged = unreplacedFlaggedClips.length > 0;

  let submitDisabledReason: string | null = null;
  if (uploadsRunning) {
    submitDisabledReason = 'Wait for all uploads to complete before submitting';
  } else if (!hasClips) {
    submitDisabledReason = 'At least one clip is required to submit for approval';
  } else if (hasUnreplacedFlagged) {
    submitDisabledReason = `${unreplacedFlaggedClips.length} flagged clip(s) must be replaced before resubmitting`;
  }

  const isSubmitValid = !submitDisabledReason && !isSubmitting && !propIsSubmitting;

  // Handle Submit for Approval
  const handleSubmitForApproval = async () => {
    if (!isSubmitValid) return;
    try {
      setIsSubmitting(true);
      setErrorBanner(null);
      if (onSubmit) {
        await onSubmit({
          videoUrls: clips.map((c) => c.url),
          notes: 'Clips submitted for review',
        });
      } else {
        await apiFetch(`/api/work/${stageItemId}/submit-clips`, { method: 'POST' });
      }
      setSubmitSuccess(true);
      await fetchClips();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to submit clips for approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update clip metadata inline
  const handleUpdateClipMetadata = async (clipId: string, updates: Partial<MediaItemType>) => {
    try {
      const res = await apiFetch<any>(`/api/clips/${clipId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const updated = res?.data || res;
      setClips((prev) => prev.map((c) => (c._id === clipId ? { ...c, ...updated } : c)));
      if (activeClip?._id === clipId) {
        setActiveClip((prev) => (prev ? { ...prev, ...updated } : null));
      }
      // Re-fetch to update coverage if shotRef changed
      if (updates.shotRef !== undefined) {
        fetchClips();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update clip metadata');
    }
  };

  // Delete clip
  const handleDeleteClip = async (clipId: string) => {
    try {
      await apiFetch(`/api/clips/${clipId}`, { method: 'DELETE' });
      setClips((prev) => prev.filter((c) => c._id !== clipId));
      if (activeClip?._id === clipId) setActiveClip(null);
      fetchClips();
    } catch (err: any) {
      alert(err.message || 'Failed to delete clip');
    }
  };

  // Replace clip file
  const handleReplaceClip = async (clipId: string, file: File) => {
    try {
      const { ResumableUploadTask } = await import('../../../lib/uploadManager');
      const task = new ResumableUploadTask({ file, workItemId: stageItemId });
      const result = await task.start();

      const res = await apiFetch<any>(`/api/clips/${clipId}/replace`, {
        method: 'POST',
        body: JSON.stringify({
          url: result.fileUrl,
          thumbnailUrl: result.fileUrl,
          sizeBytes: file.size,
          width: result.metadata.width,
          height: result.metadata.height,
          durationSeconds: result.metadata.duration,
        }),
      });

      const newClip = res?.data || res;
      setClips((prev) => [...prev, newClip]);
      await fetchClips();
    } catch (err: any) {
      alert(err.message || 'Failed to replace clip');
    }
  };

  // One-click shot linking
  const handleLinkShotToActiveClip = async (shotRef: string) => {
    if (!activeClip) return;
    await handleUpdateClipMetadata(activeClip._id, { shotRef });
  };

  // Drag and drop reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData('text/plain');
    if (!dragIndexStr) return;
    const dragIndex = parseInt(dragIndexStr, 10);
    if (isNaN(dragIndex) || dragIndex === dropIndex) return;

    const reordered = [...clips];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setClips(reordered);

    // Save reorder to backend
    try {
      await apiFetch(`/api/work/${stageItemId}/clips/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ clipIds: reordered.map((c) => c._id) }),
      });
    } catch {
      fetchClips();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Banner / Error notice */}
      {errorBanner && (
        <div className="p-3 bg-rose-500/20 border-b border-rose-500/40 text-rose-200 text-xs flex items-center justify-between px-6 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="p-1 hover:bg-rose-500/30 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Success banner after submit */}
      {submitSuccess && (
        <div className="p-3 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between px-6 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Footage submitted for review! The Creative Head will be notified.</span>
          </div>
          <button onClick={() => setSubmitSuccess(false)} className="p-1 hover:bg-emerald-500/30 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Upload Manager + Clip Cards Grid + Persistent Submit Bar */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 gap-6">
          {/* Upload Dropzone */}
          <section>
            <UploadManager
              stageItemId={stageItemId}
              onClipCreated={() => fetchClips()}
              maxClips={10}
              currentClipsCount={clips.length}
            />
          </section>

          {/* Clips Grid Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Footage Clips ({clips.length} of 10)
                </h2>
              </div>
              {coverageString && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {coverageString}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Loading footage clips...
              </div>
            ) : clips.length === 0 ? (
              <div className="p-8 border border-white/10 rounded-2xl bg-white/5 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <Film className="w-8 h-8 text-slate-600" />
                <p className="font-semibold text-slate-300">No clips uploaded yet</p>
                <p className="text-[11px] text-slate-400">
                  Drag and drop clips above, or use your phone camera to record clips directly.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {clips.map((clip, index) => (
                  <ClipCard
                    key={clip._id}
                    clip={clip}
                    isSelected={activeClip?._id === clip._id}
                    onSelect={() => setActiveClip(clip)}
                    onUpdateMetadata={(updates) => handleUpdateClipMetadata(clip._id, updates)}
                    onDelete={() => handleDeleteClip(clip._id)}
                    onReplace={(file) => handleReplaceClip(clip._id, file)}
                    availableShots={availableShots}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, index)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Persistent Submit Bar at Bottom of Left Panel */}
          <div className="mt-auto pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 backdrop-blur-md sticky bottom-0 py-3 z-10">
            <div>
              <p className="text-xs font-bold text-white">
                {clips.length} clip{clips.length === 1 ? '' : 's'} ready
                {coverageString ? `, ${coverageString}` : ''}
              </p>
              {submitDisabledReason ? (
                <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{submitDisabledReason}</span>
                </p>
              ) : (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  <span>Ready for review submission</span>
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!isSubmitValid}
              onClick={handleSubmitForApproval}
              className="min-h-[44px] px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit for approval'}</span>
            </button>
          </div>
        </div>

        {/* Right Docked Panel: Tabs (Shot List, Script, Brief) */}
        <div className="w-full md:w-80 lg:w-96 bg-slate-900/60 border-t md:border-t-0 md:border-l border-white/10 flex flex-col flex-shrink-0 backdrop-blur-xl">
          {/* Tabs bar */}
          <div className="flex items-center border-b border-white/10 bg-slate-900/80 px-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setRightTab('shotlist')}
              className={`flex-1 min-h-[44px] py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                rightTab === 'shotlist'
                  ? 'border-indigo-500 text-white bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
              <span>Shot List</span>
            </button>

            <button
              type="button"
              onClick={() => setRightTab('script')}
              className={`flex-1 min-h-[44px] py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                rightTab === 'script'
                  ? 'border-indigo-500 text-white bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Script</span>
            </button>

            <button
              type="button"
              onClick={() => setRightTab('brief')}
              className={`flex-1 min-h-[44px] py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                rightTab === 'brief'
                  ? 'border-indigo-500 text-white bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Brief</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Tab 1: Shot List Checklist */}
            {rightTab === 'shotlist' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Shot Coverage Checklist</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {coverageString || `${availableShots.length} shots`}
                  </span>
                </div>

                {availableShots.length === 0 ? (
                  <p className="text-slate-500 italic p-4 text-center">
                    No visual shot list was extracted from the script scenes.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableShots.map((shot, idx) => {
                      const shotRefKey = shot.shotRef || String(shot.sceneNumber ?? idx + 1);
                      const isCovered = clips.some(
                        (c) =>
                          c.shotRef &&
                          (c.shotRef === shotRefKey ||
                            c.shotRef === String(shot.sceneNumber) ||
                            (shot.visual && c.shotRef.toLowerCase() === shot.visual.toLowerCase()))
                      );

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border transition-all ${
                            isCovered
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                              : 'bg-white/5 border-white/10 text-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isCovered ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-slate-500 flex-shrink-0" />
                              )}
                              <span className="font-bold text-xs text-white">
                                {shotRefKey}: {shot.visual || 'Scene shot'}
                              </span>
                            </div>

                            {/* One-click link button to open clip */}
                            {activeClip && !isCovered && (
                              <button
                                type="button"
                                onClick={() => handleLinkShotToActiveClip(shotRefKey)}
                                className="min-h-[32px] px-2 rounded bg-indigo-600/60 hover:bg-indigo-600 text-[10px] font-semibold text-white transition-all flex items-center gap-1"
                              >
                                <LinkIcon className="w-3 h-3" />
                                <span>Link</span>
                              </button>
                            )}
                          </div>

                          {shot.audio && (
                            <p className="text-[11px] text-slate-400 italic mt-1.5 pl-6">
                              Audio: "{shot.audio}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Script Content */}
            {rightTab === 'script' && (
              <div className="space-y-2">
                <span className="font-semibold text-slate-200">Approved Script</span>
                {scriptContent ? (
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-slate-300 whitespace-pre-wrap leading-relaxed select-text font-serif">
                    {scriptContent}
                  </div>
                ) : (
                  <p className="text-slate-500 italic p-4 text-center">
                    No approved script available for this content piece yet.
                  </p>
                )}
              </div>
            )}

            {/* Tab 3: Brief */}
            {rightTab === 'brief' && (
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Topic
                  </span>
                  <p className="font-semibold text-white">{brief?.title || workItem.title}</p>

                  {brief?.description && (
                    <>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block pt-2">
                        Objective / Brief
                      </span>
                      <p className="text-slate-300 whitespace-pre-wrap">{brief.description}</p>
                    </>
                  )}

                  {brief?.targetAudience && (
                    <>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block pt-2">
                        Target Audience
                      </span>
                      <p className="text-slate-300">{brief.targetAudience}</p>
                    </>
                  )}

                  {brief?.hookIdea && (
                    <>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block pt-2">
                        Hook Concept
                      </span>
                      <p className="text-slate-300 italic">"{brief.hookIdea}"</p>
                    </>
                  )}

                  {shootDate && (
                    <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Target Date: {new Date(shootDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal / Bottom Sheet: Large Video Player + WhatsApp Thread */}
      {activeClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col md:items-center md:justify-center p-0 md:p-6 animate-fadeIn">
          <div className="w-full h-full md:max-w-6xl md:max-h-[90vh] bg-slate-900 border border-white/20 rounded-none md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="h-14 bg-slate-950/80 border-b border-white/10 px-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Film className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <h3 className="text-sm font-bold text-white truncate">{activeClip.title}</h3>
                <span className="text-xs text-slate-400">
                  (Take {activeClip.take || 1})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveClip(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: Player (left) + WhatsApp Thread (right / bottom sheet on phone) */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Large Video Player */}
              <div className="flex-1 p-4 flex flex-col justify-center min-w-0 bg-black/40">
                <VideoPlayer
                  url={activeClip.url}
                  thumbnailUrl={activeClip.thumbnailUrl}
                  seekToSeconds={seekSeconds}
                  onReferenceMoment={(formatted) => setMomentTimestamp(formatted)}
                  className="w-full h-full max-h-[500px]"
                />
              </div>

              {/* Thread beside player */}
              <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-white/10 h-72 md:h-auto flex-shrink-0">
                <MediaThread
                  clipId={activeClip._id}
                  clipTitle={activeClip.title}
                  onSeekTime={(secs) => setSeekSeconds(secs)}
                  externalTimestamp={momentTimestamp}
                  onClearTimestamp={() => setMomentTimestamp(null)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
