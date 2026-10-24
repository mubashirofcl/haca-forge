import mongoose from "mongoose";
import { Campaign } from "./model.js";
import { MonthlyTarget } from "../targets/model.js";
import { WorkItem } from "../workItems/model.js";
import { resolveScope } from "../../lib/scope.js";
import { logActivity, listRecentActivities } from "../activity/service.js";
import { resolveProfileObjectId } from "../referenceData/service.js";

export async function createCampaign(data, user) {
  // 1. Strict Traceability Check: targetId is required
  if (!data.targetId) {
    const error = new Error(
      "Campaign creation strictly requires a valid targetId (MonthlyTarget linkage)",
    );
    error.statusCode = 400;
    error.code = "TARGET_REQUIRED";
    throw error;
  }

  // 2. Strict Traceability Check: relatedOKR is required
  if (!data.relatedOKR || !data.relatedOKR.trim()) {
    const error = new Error(
      "Campaign creation strictly requires a relatedOKR string",
    );
    error.statusCode = 400;
    error.code = "OKR_REQUIRED";
    throw error;
  }

  // Verify that the linked MonthlyTarget exists in database
  const target = await MonthlyTarget.findById(data.targetId);
  if (!target) {
    const error = new Error(
      `Linked MonthlyTarget with ID "${data.targetId}" does not exist`,
    );
    error.statusCode = 400;
    error.code = "INVALID_TARGET";
    throw error;
  }

  // Resolve Profile ObjectId from data.profileId, or fallback to target.profileId
  let resolvedProfileId = await resolveProfileObjectId(data.profileId);
  if (!resolvedProfileId && target.profileId) {
    resolvedProfileId = target.profileId;
  }

  if (!resolvedProfileId) {
    const error = new Error(
      "Profile / Brand linkage is required and could not be resolved",
    );
    error.statusCode = 400;
    error.code = "PROFILE_REQUIRED";
    throw error;
  }

  // 3. Profile Scoping Check: verify user has permission to create campaign in this profile
  const scope = await resolveScope(user);
  const targetProfileIdStr = resolvedProfileId.toString();

  if (
    !scope.canAccessAllProfiles &&
    !scope.allowedProfileIds.includes(targetProfileIdStr)
  ) {
    const error = new Error(
      "You do not have permission to create campaigns for this brand profile",
    );
    error.statusCode = 403;
    error.code = "FORBIDDEN_PROFILE";
    throw error;
  }

  const campaign = await Campaign.create({
    name: data.name,
    profileId: resolvedProfileId,
    targetId: data.targetId,
    relatedOKR: data.relatedOKR.trim(),
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status || "In Progress",
    goalType: data.goalType,
    goalValue: data.goalValue || 0,
    expectedOutcome: data.expectedOutcome || "Lead Generation",
    budget: data.budget || 0,
    spend: data.spend || 0,
    leadsActual: data.leadsActual || 0,
    qualifiedLeadsActual: data.qualifiedLeadsActual || 0,
    ownerId: data.ownerId || user._id || user.userId,
    progressPct: data.progressPct || 0,
    description: data.description || "",
  });

  await logActivity({
    entityType: "campaign",
    entityId: campaign._id,
    profileId: campaign.profileId,
    actor: user,
    action: "campaign.created",
    toStatus: campaign.status,
    metadata: {
      name: campaign.name,
      targetId: campaign.targetId,
      relatedOKR: campaign.relatedOKR,
      goalType: campaign.goalType,
    },
  });

  return Campaign.findById(campaign._id)
    .populate("profileId", "name code active")
    .populate("targetId", "month revenueTarget leadsTarget budget")
    .populate("ownerId", "name email role jobRole");
}

export async function listCampaigns(filters = {}, user) {
  const scope = await resolveScope(user);
  const query = {};

  let filterProfileId = null;
  if (filters.profileId && filters.profileId !== "all") {
    filterProfileId = await resolveProfileObjectId(filters.profileId);
  }

  // Profile Scoping
  if (!scope.canAccessAllProfiles) {
    if (filterProfileId) {
      if (!scope.allowedProfileIds.includes(filterProfileId.toString())) {
        return [];
      }
      query.profileId = filterProfileId;
    } else {
      query.profileId = { $in: scope.allowedProfileIds };
    }
  } else if (filterProfileId) {
    query.profileId = filterProfileId;
  }

  if (filters.status && filters.status !== "all") {
    query.status = filters.status;
  }

  if (filters.targetId) {
    query.targetId = filters.targetId;
  }

  if (filters.ownerId) {
    query.ownerId = filters.ownerId;
  }

  if (filters.goalType) {
    query.goalType = filters.goalType;
  }

  if (filters.search) {
    const searchRegex = new RegExp(filters.search, "i");
    query.$or = [{ name: searchRegex }, { relatedOKR: searchRegex }];
  }

  return Campaign.find(query)
    .populate("profileId", "name code active")
    .populate("targetId", "month revenueTarget leadsTarget budget")
    .populate("ownerId", "name email role jobRole")
    .sort({ startDate: -1, createdAt: -1 });
}

export async function getCampaignById(id, user) {
  const campaign = await Campaign.findById(id)
    .populate("profileId", "name code active")
    .populate("targetId", "month revenueTarget leadsTarget budget")
    .populate("ownerId", "name email role jobRole");

  if (!campaign) {
    const error = new Error("Campaign not found");
    error.statusCode = 404;
    throw error;
  }

  const scope = await resolveScope(user);
  const campaignProfileId = (
    campaign.profileId?._id || campaign.profileId
  )?.toString();
  if (
    !scope.canAccessAllProfiles &&
    !scope.allowedProfileIds.includes(campaignProfileId)
  ) {
    const error = new Error(
      "You do not have permission to view campaigns for this brand profile",
    );
    error.statusCode = 403;
    throw error;
  }

  return campaign;
}

export async function updateCampaign(id, data, user) {
  const campaign = await Campaign.findById(id);
  if (!campaign) {
    const error = new Error("Campaign not found");
    error.statusCode = 404;
    throw error;
  }

  const scope = await resolveScope(user);
  const campaignProfileId = (
    campaign.profileId?._id || campaign.profileId
  )?.toString();
  if (
    !scope.canAccessAllProfiles &&
    !scope.allowedProfileIds.includes(campaignProfileId)
  ) {
    const error = new Error(
      "You do not have permission to update campaigns for this brand profile",
    );
    error.statusCode = 403;
    throw error;
  }

  // If targetId is modified, ensure target exists
  if (data.targetId && data.targetId !== campaign.targetId?.toString()) {
    const target = await MonthlyTarget.findById(data.targetId);
    if (!target) {
      const error = new Error(
        `Target with ID "${data.targetId}" does not exist`,
      );
      error.statusCode = 400;
      throw error;
    }
    campaign.targetId = data.targetId;
  }

  // If relatedOKR is modified, ensure not empty
  if (data.relatedOKR !== undefined) {
    if (!data.relatedOKR.trim()) {
      const error = new Error("relatedOKR cannot be empty");
      error.statusCode = 400;
      throw error;
    }
    campaign.relatedOKR = data.relatedOKR.trim();
  }

  const prevStatus = campaign.status;

  if (data.name) campaign.name = data.name.trim();
  if (data.startDate) campaign.startDate = data.startDate;
  if (data.endDate) campaign.endDate = data.endDate;
  if (data.status) campaign.status = data.status;
  if (data.goalType) campaign.goalType = data.goalType;
  if (data.goalValue !== undefined) campaign.goalValue = data.goalValue;
  if (data.expectedOutcome) campaign.expectedOutcome = data.expectedOutcome;
  if (data.budget !== undefined) campaign.budget = data.budget;
  if (data.spend !== undefined) campaign.spend = data.spend;
  if (data.leadsActual !== undefined) campaign.leadsActual = data.leadsActual;
  if (data.qualifiedLeadsActual !== undefined)
    campaign.qualifiedLeadsActual = data.qualifiedLeadsActual;
  if (data.ownerId) campaign.ownerId = data.ownerId;
  if (data.progressPct !== undefined) campaign.progressPct = data.progressPct;
  if (data.profileId) {
    const resolvedProfileId = await resolveProfileObjectId(data.profileId);
    if (resolvedProfileId) campaign.profileId = resolvedProfileId;
  }

  await campaign.save();

  // Log activity event
  const isStatusChange = data.status && data.status !== prevStatus;
  await logActivity({
    entityType: "campaign",
    entityId: campaign._id,
    profileId: campaign.profileId,
    actor: user,
    action: isStatusChange ? "campaign.status_changed" : "campaign.updated",
    fromStatus: prevStatus,
    toStatus: campaign.status,
    metadata: {
      isStatusChange,
      name: campaign.name,
      status: campaign.status,
    },
  });

  return Campaign.findById(campaign._id)
    .populate("profileId", "name code active")
    .populate("targetId", "month revenueTarget leadsTarget budget")
    .populate("ownerId", "name email role jobRole");
}

export async function deleteCampaign(id, user) {
  const campaign = await Campaign.findById(id);
  if (!campaign) {
    const error = new Error("Campaign not found");
    error.statusCode = 404;
    throw error;
  }

  const scope = await resolveScope(user);
  const campaignProfileId = (
    campaign.profileId?._id || campaign.profileId
  )?.toString();
  if (
    !scope.canAccessAllProfiles &&
    !scope.allowedProfileIds.includes(campaignProfileId)
  ) {
    const error = new Error(
      "You do not have permission to delete this campaign",
    );
    error.statusCode = 403;
    throw error;
  }

  const linkedWorkItemCount = await WorkItem.countDocuments({ campaignId: id });
  if (linkedWorkItemCount > 0) {
    const error = new Error(
      `Cannot delete campaign: ${linkedWorkItemCount} work item(s) are linked to this campaign. Archive the campaign instead.`,
    );
    error.statusCode = 400;
    error.code = "CAMPAIGN_HAS_WORK_ITEMS";
    throw error;
  }

  await Campaign.findByIdAndDelete(id);

  await logActivity({
    entityType: "campaign",
    entityId: id,
    profileId: campaign.profileId,
    actor: user,
    action: "campaign.deleted",
    metadata: { name: campaign.name },
  });

  return { success: true, message: "Campaign deleted successfully" };
}

export async function getCampaignActivities(id, user) {
  const campaign = await getCampaignById(id, user);
  return listRecentActivities({
    entityType: "campaign",
    entityId: campaign._id,
    limit: 50,
  });
}
