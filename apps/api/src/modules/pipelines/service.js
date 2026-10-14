import { PipelineTemplate } from './model.js';
import { Task } from '../tasks/model.js';
import { ContentItem } from '../content/model.js';
import { User } from '../users/model.js';
import { getNextSequenceId } from '../requests/counter.model.js';
import { transitionStatus } from '../common/transition.service.js';
import { createNotification } from '../notifications/service.js';
import { logger } from '../../lib/logger.js';

export const DEFAULT_PIPELINE_TEMPLATES = [
  {
    format: 'static_post',
    name: 'Static Post / Poster',
    defaultLeadTimeDays: 3,
    stages: [
      {
        order: 1,
        stageKey: 'content_copy',
        name: 'Copywriting & Caption',
        team: 'content',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.4,
        autoAssign: true,
      },
      {
        order: 2,
        stageKey: 'graphics_design',
        name: 'Graphic Design & Creative',
        team: 'graphics',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.4,
        autoAssign: true,
      },
      {
        order: 3,
        stageKey: 'lead_review',
        name: 'Marketing Lead Final Review',
        team: 'lead',
        type: 'review',
        defaultRole: 'lead',
        leadTimeShare: 0.2,
        autoAssign: false,
      },
    ],
  },
  {
    format: 'carousel',
    name: 'Carousel Post',
    defaultLeadTimeDays: 4,
    stages: [
      {
        order: 1,
        stageKey: 'content_copy',
        name: 'Carousel Storyboard & Copy',
        team: 'content',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.35,
        autoAssign: true,
      },
      {
        order: 2,
        stageKey: 'graphics_design',
        name: 'Multi-slide Graphic Design',
        team: 'graphics',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.45,
        autoAssign: true,
      },
      {
        order: 3,
        stageKey: 'lead_review',
        name: 'Marketing Lead Review',
        team: 'lead',
        type: 'review',
        defaultRole: 'lead',
        leadTimeShare: 0.2,
        autoAssign: false,
      },
    ],
  },
  {
    format: 'story',
    name: 'Social Media Story',
    defaultLeadTimeDays: 2,
    stages: [
      {
        order: 1,
        stageKey: 'content_copy',
        name: 'Story Concept & Text',
        team: 'content',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.4,
        autoAssign: true,
      },
      {
        order: 2,
        stageKey: 'graphics_design',
        name: 'Story Asset Production',
        team: 'graphics',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.4,
        autoAssign: true,
      },
      {
        order: 3,
        stageKey: 'lead_review',
        name: 'Lead Review',
        team: 'lead',
        type: 'review',
        defaultRole: 'lead',
        leadTimeShare: 0.2,
        autoAssign: false,
      },
    ],
  },
  {
    format: 'reel',
    name: 'Short-Form Reel / Video',
    defaultLeadTimeDays: 7,
    stages: [
      {
        order: 1,
        stageKey: 'content_script',
        name: 'Script & Shot List',
        team: 'content',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.25,
        autoAssign: true,
      },
      {
        order: 2,
        stageKey: 'cinematography_shoot',
        name: 'Video Shoot & Footage Capture',
        team: 'cinematography',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.35,
        autoAssign: true,
      },
      {
        order: 3,
        stageKey: 'editor_video',
        name: 'Video Edit & Color Grading',
        team: 'editor',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.25,
        autoAssign: true,
      },
      {
        order: 4,
        stageKey: 'lead_review',
        name: 'Lead Video Review & Approval',
        team: 'lead',
        type: 'review',
        defaultRole: 'lead',
        leadTimeShare: 0.15,
        autoAssign: false,
      },
    ],
  },
  {
    format: 'ad_creative',
    name: 'Paid Ad Creative',
    defaultLeadTimeDays: 4,
    stages: [
      {
        order: 1,
        stageKey: 'content_ad_copy',
        name: 'Ad Copy & Hook',
        team: 'content',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.35,
        autoAssign: true,
      },
      {
        order: 2,
        stageKey: 'graphics_ad',
        name: 'Ad Creative Design',
        team: 'graphics',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.45,
        autoAssign: true,
      },
      {
        order: 3,
        stageKey: 'lead_review',
        name: 'Performance Lead Review',
        team: 'lead',
        type: 'review',
        defaultRole: 'lead',
        leadTimeShare: 0.2,
        autoAssign: false,
      },
    ],
  },
  {
    format: 'brochure',
    name: 'Brochure / Sales Material',
    defaultLeadTimeDays: 5,
    stages: [
      {
        order: 1,
        stageKey: 'content_copy',
        name: 'Sales Copy & Architecture',
        team: 'content',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.35,
        autoAssign: true,
      },
      {
        order: 2,
        stageKey: 'graphics_layout',
        name: 'Print & Digital Layout',
        team: 'graphics',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.45,
        autoAssign: true,
      },
      {
        order: 3,
        stageKey: 'lead_review',
        name: 'Sales Collateral Review',
        team: 'lead',
        type: 'review',
        defaultRole: 'lead',
        leadTimeShare: 0.2,
        autoAssign: false,
      },
    ],
  },
  {
    format: 'academic_creative',
    name: 'Academic / Course Creative',
    defaultLeadTimeDays: 4,
    stages: [
      {
        order: 1,
        stageKey: 'content_copy',
        name: 'Course Copywriting',
        team: 'content',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.35,
        autoAssign: true,
      },
      {
        order: 2,
        stageKey: 'graphics_layout',
        name: 'Webinar & Course Graphic',
        team: 'graphics',
        type: 'work',
        defaultRole: 'worker',
        leadTimeShare: 0.45,
        autoAssign: true,
      },
      {
        order: 3,
        stageKey: 'lead_review',
        name: 'Academic Lead Review',
        team: 'lead',
        type: 'review',
        defaultRole: 'lead',
        leadTimeShare: 0.2,
        autoAssign: false,
      },
    ],
  },
];

/**
 * Ensures all 7 standard pipeline templates are seeded
 */
export async function seedPipelineTemplates() {
  for (const tpl of DEFAULT_PIPELINE_TEMPLATES) {
    await PipelineTemplate.findOneAndUpdate(
      { format: tpl.format },
      { $set: tpl },
      { upsert: true, new: true }
    );
  }
}

/**
 * Finds the least-loaded active team member not on leave
 * @param {string} team - Production team key
 * @returns {Promise<Object|null>} Best assignee user document
 */
export async function findLeastLoadedWorker(team, targetDate = new Date()) {
  if (!team || team === 'lead') return null;

  // Dynamically import LeaveRequest
  const { LeaveRequest } = await import('../leave/model.js');
  const checkDate = new Date(targetDate);

  // Find workers on leave for checkDate
  const activeLeaves = await LeaveRequest.find({
    status: 'approved',
    startDate: { $lte: checkDate },
    endDate: { $gte: checkDate },
  }).select('userId');
  const leaveUserIds = activeLeaves.map((l) => l.userId.toString());

  // Find active users in this team who are NOT on leave
  const candidates = await User.find({
    status: 'active',
    $or: [
      { teamId: { $regex: new RegExp(`^${team}$`, 'i') } },
      { team },
      { skills: team },
    ],
    attendance: { $ne: 'on_leave' },
    onLeave: { $ne: true },
    _id: { $nin: leaveUserIds },
  });

  if (!candidates.length) return null;

  // Calculate open active tasks for each candidate
  const candidateIds = candidates.map((c) => c._id);
  const openTasks = await Task.aggregate([
    {
      $match: {
        assignee: { $in: candidateIds },
        status: { $in: ['assigned', 'in_progress'] },
      },
    },
    {
      $group: {
        _id: '$assignee',
        totalHours: { $sum: '$estimateHours' },
        taskCount: { $sum: 1 },
      },
    },
  ]);

  const taskMap = new Map();
  openTasks.forEach((t) => taskMap.set(String(t._id), t.totalHours));

  // Sort by lowest utilization ratio (total planned hours / weekly capacity)
  candidates.sort((a, b) => {
    const hoursA = taskMap.get(String(a._id)) || 0;
    const hoursB = taskMap.get(String(b._id)) || 0;
    const ratioA = hoursA / (a.weeklyCapacityHours || 40);
    const ratioB = hoursB / (b.weeklyCapacityHours || 40);
    return ratioA - ratioB;
  });

  return candidates[0] || null;
}

/**
 * Generates tasks for a new ContentItem from its pipeline template
 * @param {Object} contentItem - Saved ContentItem document
 * @param {Object} user - Creator user
 * @param {Object} [io] - Socket.io instance
 * @returns {Promise<Array>} Created task documents
 */
export async function initializeContentPipeline(contentItem, user, io) {
  let template = await PipelineTemplate.findOne({ format: contentItem.format });
  if (!template) {
    template = await PipelineTemplate.findOne({ format: 'static_post' });
  }

  if (!template || !template.stages.length) {
    logger.warn({ format: contentItem.format }, 'No pipeline template found; creating fallback stage');
    return [];
  }

  const publishTime = new Date(contentItem.publishDate).getTime();
  const leadTimeMs = (template.defaultLeadTimeDays || 3) * 24 * 3600 * 1000;
  const productionDeadline = new Date(publishTime - leadTimeMs);

  contentItem.productionDeadline = productionDeadline;

  // Sort stages by order
  const stages = [...template.stages].sort((a, b) => a.order - b.order);
  const createdTasks = [];
  let previousTaskId = null;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const isFirstStage = i === 0;

    // Derive due date for this stage
    const stageShare = stage.leadTimeShare || 0.3;
    const stageDueTime = new Date(
      publishTime - leadTimeMs * (1 - (i + 1) * (1 / stages.length))
    );

    const taskId = await getNextSequenceId('TSK');

    // Assign worker for the first stage if autoAssign is true
    let assignee = null;
    if (isFirstStage && stage.autoAssign) {
      const bestWorker = await findLeastLoadedWorker(stage.team);
      if (bestWorker) {
        assignee = bestWorker._id;
      }
    }

    const taskDoc = await Task.create({
      taskId,
      contentItemId: contentItem._id,
      stageKey: stage.stageKey,
      stageOrder: stage.order,
      title: `${contentItem.title} - ${stage.name}`,
      team: stage.team,
      assignee,
      status: isFirstStage ? 'assigned' : 'assigned',
      estimateHours: 2,
      dueDate: stageDueTime,
      dependencies: previousTaskId ? [previousTaskId] : [],
      subtasks: [
        { title: `Initial review and drafting for ${stage.name}`, completed: false },
        { title: `Finalize deliverable for ${stage.name}`, completed: false },
      ],
    });

    createdTasks.push(taskDoc);
    previousTaskId = taskDoc._id;

    // Notify assignee if assigned
    if (assignee) {
      await createNotification({
        recipient: assignee,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `You were assigned task ${taskId}: ${taskDoc.title}`,
        entityType: 'task',
        entityId: taskDoc._id,
        io,
      });
    }
  }

  contentItem.tasks = createdTasks.map((t) => t._id);
  contentItem.status = 'in_production';
  await contentItem.save();

  return createdTasks;
}

/**
 * Automates pipeline handoff when a stage task is completed
 * @param {Object} task - Task document that just reached 'done' or 'approved'
 * @param {Object} user - User who updated task
 * @param {Object} [io] - Socket.io instance
 */
export async function advancePipelineHandoff(task, user, io) {
  const contentItem = await ContentItem.findById(task.contentItemId).populate('tasks');
  if (!contentItem) return;

  const template = await PipelineTemplate.findOne({ format: contentItem.format });
  if (!template) return;

  const currentOrder = task.stageOrder;
  const nextStage = template.stages.find((s) => s.order === currentOrder + 1);

  if (nextStage) {
    // Find task for next stage
    let nextTask = contentItem.tasks.find((t) => t.stageOrder === nextStage.order);
    if (nextTask) {
      // Auto-assign if unassigned
      if (!nextTask.assignee && nextStage.autoAssign) {
        const bestWorker = await findLeastLoadedWorker(nextStage.team);
        if (bestWorker) {
          nextTask.assignee = bestWorker._id;
          await nextTask.save();

          await createNotification({
            recipient: bestWorker._id,
            type: 'task_assigned',
            title: 'Handoff Task Ready',
            message: `Handoff complete! You are assigned ${nextTask.taskId}: ${nextTask.title}`,
            entityType: 'task',
            entityId: nextTask._id,
            io,
          });
        }
      }
    }

    // Update ContentItem status
    if (nextStage.type === 'review') {
      contentItem.status = 'in_review';
    } else {
      contentItem.status = 'in_production';
    }
    await contentItem.save();
  } else {
    // All stages complete!
    if (contentItem.status !== 'approved' && contentItem.status !== 'published') {
      await transitionStatus({
        entityType: 'ContentItem',
        entity: contentItem,
        toStatus: 'approved',
        user,
        comment: 'All pipeline stages successfully delivered and approved.',
        io,
      });

      // Notify requester
      if (contentItem.requester) {
        await createNotification({
          recipient: contentItem.requester,
          type: 'content_approved',
          title: 'Content Approved',
          message: `Your content item ${contentItem.contentId} (${contentItem.title}) has been approved!`,
          entityType: 'content',
          entityId: contentItem._id,
          io,
        });
      }
    }
  }
}
