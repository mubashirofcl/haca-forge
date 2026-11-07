import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft, AlertCircle, ShieldAlert, Lock } from 'lucide-react';
import { getWorkspaceModeInfo, type WorkspaceMode, getStepStatusLabel } from '@mmp/shared';

import { ShootWorkspace } from './ShootWorkspace';
import { ShootReviewView } from './ShootReviewView';
import { EditWorkspace } from './EditWorkspace';
import { DesignWorkspace } from './DesignWorkspace';
import { PostWorkspace } from './PostWorkspace';
import { EarlierOutputsViewer, StageOutput } from './EarlierOutputsViewer';
import type { AssetItem } from '../../../components/AssetLinks';
import { PostCaptionFields } from '../../../components/PostCaptionFields';

export const MediaWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workItem, setWorkItem] = useState<any | null>(null);
  const [contentPiece, setContentPiece] = useState<any | null>(null);
  const [earlierOutputs, setEarlierOutputs] = useState<StageOutput[]>([]);
  const [scriptShotList, setScriptShotList] = useState<any[]>([]);
  const [scriptContent, setScriptContent] = useState<string>('');
  const [finalAssets, setFinalAssets] = useState<AssetItem[]>([]);
  const [approvedCopy, setApprovedCopy] = useState<any>({});
  const [rawFootageClips, setRawFootageClips] = useState<any[]>([]);
  const [revisionComments, setRevisionComments] = useState<any[]>([]);
  const [pastVersions, setPastVersions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeVideoUrl, setActiveVideoUrl] = useState<string>('');
  const [latestSubmission, setLatestSubmission] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    loadWorkspaceData(id);
  }, [id]);

  const loadWorkspaceData = async (workItemId: string) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch work item (unwrap { data: item })
      const rawItem = await apiFetch<any>(`/api/work-items/${workItemId}`);
      const item = rawItem?.data || rawItem;
      setWorkItem(item);

      // If Script/Content stage, redirect to writing studio
      if (item.stageKey === 'Content' || item.stageKey === 'Script') {
        navigate(`/work/${workItemId}/writing-studio`, { replace: true });
        return;
      }

      // 2. Fetch past submissions / versions for this work item
      const rawSubs = await apiFetch<any>(`/api/submissions?workItemId=${workItemId}`);
      const subs = Array.isArray(rawSubs) ? rawSubs : (rawSubs?.data || []);
      
      const rawDraft = await apiFetch<any>(`/api/work-items/${workItemId}/draft`).catch(() => null);
      const draftData = rawDraft?.data || rawDraft;

      if (subs && subs.length > 0) {
        setPastVersions(
          subs.map((s: any) => ({
            id: s._id || s.id,
            versionNumber: s.versionNumber || s.version || 1,
            submittedAt: s.submittedAt,
            fileUrl: s.fileUrl || s.linkUrl || (s.files && s.files[0]?.url) || '',
            status: s.status,
            notes: s.notes,
          }))
        );
      }

      const latestSub = subs && subs.length > 0 ? subs[0] : null;
      setLatestSubmission(latestSub);

      let resolvedActiveVideo =
        latestSub?.fileUrl ||
        latestSub?.linkUrl ||
        (latestSub?.files && latestSub.files[0]?.url) ||
        item.deliverableUrl ||
        draftData?.linkUrl ||
        (draftData?.files && draftData.files[0]?.url) ||
        '';

      if (!resolvedActiveVideo && Array.isArray(subs) && subs.length > 0) {
        for (const s of subs) {
          const u = s.fileUrl || s.linkUrl || (s.files && s.files[0]?.url);
          if (u) {
            resolvedActiveVideo = u;
            break;
          }
        }
      }
      setActiveVideoUrl(resolvedActiveVideo);

      // Fetch all comments and discussions for this work item
      try {
        const rawComments = await apiFetch<any>(`/api/work-items/${workItemId}/comments`);
        const commentsList = Array.isArray(rawComments) ? rawComments : (rawComments?.data || []);
        let mappedComments = commentsList.map((c: any) => ({
          id: c._id || c.id,
          content: c.content || c.text,
          authorId: c.authorId?._id || c.authorId?.id || (typeof c.authorId === 'string' ? c.authorId : undefined),
          authorName: c.authorId?.name || (c.authorRole ? (c.authorRole === 'creative_head' ? 'Creative Head' : 'Editor') : 'Reviewer'),
          authorRole: c.authorId?.role || c.authorRole,
          createdAt: c.createdAt,
          timecode: c.anchor?.timecode ?? c.anchor?.seconds,
          resolved: !!c.resolved,
        }));

        if (mappedComments.length === 0 && latestSub?.comments && Array.isArray(latestSub.comments)) {
          mappedComments = latestSub.comments.map((c: any) => ({
            id: c._id || c.id,
            content: c.content || c.text,
            authorId: c.authorId?._id || c.authorId?.id,
            authorName: c.authorId?.name || 'Reviewer',
            authorRole: c.authorId?.role,
            createdAt: c.createdAt,
            timecode: c.anchor?.timecode ?? c.anchor?.seconds,
            resolved: !!c.resolved,
          }));
        }

        setRevisionComments(mappedComments);
      } catch {
        // Fallback to latestSub.comments if present
        if (latestSub?.comments && Array.isArray(latestSub.comments)) {
          setRevisionComments(
            latestSub.comments.map((c: any) => ({
              id: c._id || c.id,
              content: c.content || c.text,
              authorId: c.authorId?._id || c.authorId?.id,
              authorName: c.authorId?.name || 'Reviewer',
              authorRole: c.authorId?.role,
              createdAt: c.createdAt,
              timecode: c.anchor?.timecode ?? c.anchor?.seconds,
              resolved: !!c.resolved,
            }))
          );
        }
      }

      // 3. Process sibling stages from item.pieceStages
      const siblingStages: any[] = item.pieceStages || [];
      const outputsList: StageOutput[] = [];
      const footageClips: any[] = [];

      for (const otherItem of siblingStages) {
        const otherId = (otherItem._id || otherItem.id)?.toString();
        if (otherId === workItemId) continue;

        outputsList.push({
          id: otherId,
          stageKey: otherItem.stageKey || otherItem.title,
          workerName: otherItem.ownerId?.name || 'Teammate',
          status: otherItem.status,
          completedAt: otherItem.updatedAt,
          fileUrl: otherItem.deliverableUrl,
          contentUrl: otherItem.contentUrl || otherItem.publishedUrl,
          textContent: otherItem.textContent || otherItem.finalText,
        });

        if (otherItem.stageKey === 'Shoot' && otherItem.deliverableUrl) {
          footageClips.push({
            id: otherId,
            name: otherItem.title || 'Raw Footage',
            url: otherItem.deliverableUrl,
          });
        }

        if (otherItem.stageKey === 'Script' || otherItem.stageKey === 'Content') {
          if (otherItem.metadata?.copySections) {
            setApprovedCopy(otherItem.metadata.copySections);
          } else if (otherItem.textContent) {
            setApprovedCopy({ rawText: otherItem.textContent });
          }
        }
      }

      // 4. Also fetch parent Content Piece if available to gather upstream data
      const pieceId = item.contentPieceId?._id || item.contentPieceId?.id || item.contentPieceId;
      if (pieceId) {
        try {
          const rawPiece = await apiFetch<any>(`/api/content-pieces/${pieceId}`);
          const piece = rawPiece?.data || rawPiece;
          setContentPiece(piece);

          if (piece?.workItems && Array.isArray(piece.workItems) && siblingStages.length === 0) {
            for (const otherItem of piece.workItems) {
              const otherId = (otherItem._id || otherItem.id)?.toString();
              if (otherId === workItemId) continue;

              outputsList.push({
                id: otherId,
                stageKey: otherItem.stageKey || otherItem.title,
                workerName: otherItem.ownerId?.name || 'Teammate',
                status: otherItem.status,
                completedAt: otherItem.updatedAt,
                fileUrl: otherItem.deliverableUrl,
                contentUrl: otherItem.contentUrl,
                textContent: otherItem.textContent || otherItem.finalText,
              });

              if (otherItem.stageKey === 'Shoot' && otherItem.deliverableUrl) {
                footageClips.push({
                  id: otherId,
                  name: otherItem.title || 'Raw Footage',
                  url: otherItem.deliverableUrl,
                });
              }
            }
          }
        } catch {
          // non-critical
        }
      }

      setEarlierOutputs(outputsList);
      setRawFootageClips(footageClips);

      // Phase 5 handoff: the latest approved outputs of the finished steps before this one.
      const handoff: any[] = Array.isArray(item.handoff) ? item.handoff : [];
      const shootEntry = handoff.find((e) => e.stageKey === 'Shoot');
      if (shootEntry) {
        setRawFootageClips(
          (shootEntry.clips || []).map((c: any) => ({ id: c._id, name: c.title, url: c.url, kind: c.kind }))
        );
      }
      // Design receives Content's approved copy. Captions are written by the poster on the Post step.
      const copyEntry = [...handoff].reverse().find((e) => e.stageKey === 'Content');
      if (copyEntry?.text) setApprovedCopy({ rawText: copyEntry.text });
      const finalEntry = [...handoff].reverse().find((e) => e.stageKey === 'Edit' || e.stageKey === 'Design');
      setFinalAssets(finalEntry ? finalEntry.items || [] : []);

      // Attach script content and shot list if present on item
      if (item.scriptContent) {
        setScriptContent(item.scriptContent);
      }
      if (item.scriptShotList && item.scriptShotList.length > 0) {
        setScriptShotList(item.scriptShotList);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading media workspace:', err);
      setError(err?.message || 'Failed to load workspace');
      setLoading(false);
    }
  };

  // Workspace Mode derived from canonical helper
  const modeInfo = useMemo(() => {
    if (!workItem || !user) {
      return { mode: 'none' as WorkspaceMode, isOwner: false, canEdit: false, reason: 'Loading...' };
    }
    return getWorkspaceModeInfo(user, workItem, contentPiece);
  }, [workItem, user, contentPiece]);

  // Submission handler for Shoot, Edit, Design
  const handleSubmission = async (data: {
    fileUrl?: string;
    videoUrls?: string[];
    contentUrl?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }) => {
    if (!workItem) return;
    try {
      setIsSubmitting(true);
      const pieceId = workItem.contentPieceId?._id || workItem.contentPieceId?.id || workItem.contentPieceId;

      await apiFetch('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          workItemId: workItem._id || workItem.id,
          contentPieceId: pieceId || undefined,
          fileUrl: data.fileUrl || (data.videoUrls && data.videoUrls[0]),
          contentUrl: data.contentUrl,
          notes: data.notes,
          metadata: {
            ...data.metadata,
            videoUrls: data.videoUrls,
          },
          submit: true, // triggers status transition to Feedback
        }),
      });

      alert('Deliverable submitted successfully for review!');
      navigate(`/work/${workItem._id || workItem.id}`);
    } catch (err: any) {
      alert(err?.message || 'Failed to submit deliverable');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Posting handler
  const handleMarkAsPosted = async (data: {
    caption: string;
    hashtags?: string;
    publishedUrl: string;
    publishedAt: string;
    deliverableUrl?: string;
    notes?: string;
  }) => {
    if (!workItem) return;
    try {
      setIsSubmitting(true);
      await apiFetch(`/api/work-items/${workItem._id || workItem.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus: 'Published',
          // The poster's caption and hashtags are saved on the Post step.
          caption: data.caption,
          hashtags: data.hashtags || '',
          publishedUrl: data.publishedUrl,
          deliverableUrl: data.deliverableUrl,
          comment: data.notes,
        }),
      });

      alert('Item marked as Published!');
      navigate(`/work/${workItem._id || workItem.id}`);
    } catch (err: any) {
      alert(err?.message || 'Failed to mark as posted');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-ui-canvas flex items-center justify-center text-ui-ink">
        <div className="w-8 h-8 border-4 border-ui-ink border-t-transparent rounded-full motion-safe:animate-spin" />
      </div>
    );
  }

  if (error || !workItem) {
    return (
      <div className="h-screen w-screen bg-white/60 flex flex-col items-center justify-center p-6 text-center text-ui-ink font-sans">
        <AlertCircle className="w-12 h-12 text-rose-800 mb-3" />
        <h2 className="text-lg font-bold text-ui-ink">Workspace Unavailable</h2>
        <p className="text-sm text-ui-muted max-w-md mt-1 mb-6">
          {error || 'Work item could not be loaded.'}
        </p>
        <button
          onClick={() => navigate('/my-work')}
          className="px-5 py-2.5 rounded-full bg-white/60 hover:bg-white text-ui-ink text-xs font-semibold shadow-xs"
        >
          Return to My Work
        </button>
      </div>
    );
  }

  // Locked mode
  if (modeInfo.mode === 'none') {
    return (
      <div className="flex flex-col h-screen w-screen bg-white/60 text-ui-ink font-sans">
        <header className="h-14 bg-white/80 border-b border-ui-line px-4 flex items-center justify-between z-30 flex-shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="ui-icon-btn shrink-0"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="font-bold text-sm text-ui-ink">{workItem.title}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/60 text-ui-muted font-semibold border border-ui-line">
              Locked
            </span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white/80 border border-ui-line text-center space-y-4">
            <div className="status-tint status-waiting w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-ui-ink">Workspace Locked</h2>
            <p className="text-sm text-ui-muted">
              {modeInfo.reason || 'You do not currently have access to edit or view this workspace.'}
            </p>
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-full bg-white/60 hover:bg-white text-ui-ink text-xs font-semibold shadow-xs transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Read-only view: Teammates or owners in read-only states (Pending, Approved, Skipped)
  if (modeInfo.mode === 'read') {
    if (workItem.stageKey === 'Shoot') {
      return (
        <div className="flex flex-col h-screen w-screen bg-ui-canvas text-ui-ink overflow-hidden font-sans">
          <ShootReviewView
            stageItemId={workItem._id || workItem.id}
            workItemTitle={workItem.title}
            readOnly={true}
            canSeeThreads={modeInfo.isOwner || ['admin', 'creative_head', 'sm_manager'].includes(String(user?.role))}
            onClose={() => navigate(-1)}
          />
        </div>
      );
    }

    if (workItem.stageKey === 'Edit') {
      return (
        <div className="h-screen w-screen bg-ui-canvas flex flex-col overflow-hidden font-sans">
          <div className="h-12 bg-white/60 border-b border-ui-line px-4 flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => navigate(`/work/${workItem._id || workItem.id}`)}
              className="inline-flex items-center gap-1.5 text-xs text-ui-muted hover:text-ui-ink transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit Workspace to Task Details</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/70 text-ui-text border border-ui-line font-mono text-[11px]">
                {getStepStatusLabel(workItem.status)}
              </span>
              <span className="text-xs font-mono text-ui-muted">
                Owner: <span className="text-ui-ink font-semibold">{workItem.ownerId?.name || user?.name}</span>
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <EditWorkspace
              workItem={{
                id: workItem._id || workItem.id,
                title: workItem.title,
                workType: workItem.workType,
                stageKey: workItem.stageKey,
                status: workItem.status,
                revisions: workItem.revisions,
                deliverableUrl: workItem.deliverableUrl,
              }}
              scriptContent={scriptContent}
              rawFootage={rawFootageClips}
              revisionComments={revisionComments}
              versions={pastVersions}
              activeVideoUrl={activeVideoUrl}
              currentSubmission={latestSubmission}
              onSubmit={handleSubmission}
              isSubmitting={isSubmitting}
              readOnly={true}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-screen w-screen bg-white/60 text-ui-ink overflow-hidden font-sans">
        <header className="h-14 bg-white/80 border-b border-ui-line px-4 flex items-center justify-between z-30 flex-shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="ui-icon-btn shrink-0"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="font-bold text-sm text-ui-ink">{workItem.title}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/60 text-ui-muted font-semibold border border-ui-line">
              Read-Only View
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-white text-ui-ink font-bold border border-ui-ink">
              {workItem.stageKey} Stage
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/60 text-ui-muted font-medium">
              {getStepStatusLabel(workItem.status)}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          <div className="p-5 rounded-3xl bg-white/80 border border-ui-line shadow-xs flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-ui-ink flex items-center justify-center flex-shrink-0 text-ui-ink">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-ui-ink block">
                {modeInfo.isOwner ? "Deliverable in Review / Approved" : "Viewing Teammate's Deliverable"}
              </span>
              <p className="text-xs text-ui-muted mt-1 leading-relaxed">
                {modeInfo.isOwner
                  ? `Your deliverable is currently in status "${getStepStatusLabel(workItem.status)}". All outputs and assets are displayed in read-only mode.`
                  : `${workItem.ownerId?.name || 'The step owner'} is currently responsible for this ${workItem.stageKey || 'work'} stage (${modeInfo.reason || 'Read only'}). All outputs and assets are displayed in read-only mode.`}
              </p>
            </div>
          </div>

          {/* A posted Post step: the caption and hashtags the poster saved, read-only */}
          {workItem.stageKey === 'Post' && workItem.status === 'Published' && (
            <div className="p-5 rounded-2xl bg-white/60 border border-ui-line space-y-3" data-testid="posted-caption">
              <h3 className="text-xs font-bold text-ui-ink">Posted caption & hashtags</h3>
              <PostCaptionFields caption={workItem.postCaption || ''} hashtags={workItem.postHashtags || ''} readOnly />
            </div>
          )}

          <EarlierOutputsViewer outputs={earlierOutputs} currentStageKey={workItem.stageKey} />
        </div>
      </div>
    );
  }

  const stageKey = workItem.stageKey || '';

  return (
    <div className="h-screen w-screen bg-ui-canvas flex flex-col overflow-hidden font-sans">
      {/* Top Bar with back button */}
      <div className="h-12 bg-white/60 border-b border-ui-line px-4 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => navigate(`/work/${workItem._id || workItem.id}`)}
          className="inline-flex items-center gap-1.5 text-xs text-ui-muted hover:text-ui-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Workspace to Task Details</span>
        </button>

        <span className="text-xs font-mono text-ui-muted">
          Owner: <span className="text-ui-ink font-semibold">{user?.name}</span>
        </span>
      </div>

      {/* Role-Specific Workspace Rendering */}
      <div className="flex-1 overflow-hidden">
        {stageKey === 'Shoot' && (
          modeInfo.mode === 'review' ? (
            <ShootReviewView
              stageItemId={workItem._id || workItem.id}
              workItemTitle={workItem.title}
              onFinishReview={() => navigate(`/work/${workItem._id || workItem.id}`)}
              onClose={() => navigate(`/work/${workItem._id || workItem.id}`)}
            />
          ) : (
            <ShootWorkspace
              workItem={{
                id: workItem._id || workItem.id,
                title: workItem.title,
                stageKey: workItem.stageKey,
                status: workItem.status,
                targetDate: workItem.deadline,
                description: workItem.description,
                revisions: workItem.revisions,
              }}
              brief={contentPiece?.brief}
              scriptContent={scriptContent}
              shotList={scriptShotList}
              shootDate={workItem.deadline}
              onSubmit={handleSubmission}
              isSubmitting={isSubmitting}
            />
          )
        )}

        {stageKey === 'Edit' && (
          <EditWorkspace
            workItem={{
              id: workItem._id || workItem.id,
              title: workItem.title,
              workType: workItem.workType,
              stageKey: workItem.stageKey,
              status: workItem.status,
              revisions: workItem.revisions,
              deliverableUrl: workItem.deliverableUrl,
              ownerId: workItem.ownerId,
            }}
            scriptContent={scriptContent}
            rawFootage={rawFootageClips}
            revisionComments={revisionComments}
            versions={pastVersions}
            activeVideoUrl={activeVideoUrl}
            currentSubmission={latestSubmission}
            onSubmit={handleSubmission}
            isSubmitting={isSubmitting}
            readOnly={modeInfo.mode !== 'edit' || !modeInfo.isOwner}
          />
        )}

        {stageKey === 'Design' && (
          <DesignWorkspace
            workItem={{
              id: workItem._id || workItem.id,
              title: workItem.title,
              workType: workItem.workType,
              stageKey: workItem.stageKey,
              status: workItem.status,
            }}
            brief={contentPiece?.brief}
            approvedCopy={approvedCopy}
            revisionComments={revisionComments}
            onSubmit={handleSubmission}
            isSubmitting={isSubmitting}
          />
        )}

        {stageKey === 'Post' && (
          <PostWorkspace
            workItem={{
              id: workItem._id || workItem.id,
              title: workItem.title,
              stageKey: workItem.stageKey,
              status: workItem.status,
              channel: contentPiece?.brief?.channel,
              deliverableUrl: workItem.deliverableUrl,
              publishedUrl: workItem.publishedUrl,
              postCaption: workItem.postCaption,
              postHashtags: workItem.postHashtags,
            }}
            finalAssets={finalAssets}
            onMarkAsPosted={handleMarkAsPosted}
            isSubmitting={isSubmitting}
          />
        )}

        {!['Shoot', 'Edit', 'Design', 'Post'].includes(stageKey) && (
          <div className="p-8 text-center text-ui-muted">
            <p>Standard task workspace. Stage: {stageKey}</p>
          </div>
        )}
      </div>
    </div>
  );
};
