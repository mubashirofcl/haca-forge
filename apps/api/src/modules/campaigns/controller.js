import * as campaignService from './service.js';

export async function listCampaigns(req, res, next) {
  try {
    const campaigns = await campaignService.listCampaigns(req.query, req.user);
    return res.status(200).json({ data: campaigns });
  } catch (error) {
    next(error);
  }
}

export async function getCampaign(req, res, next) {
  try {
    const campaign = await campaignService.getCampaignById(req.params.id, req.user);
    return res.status(200).json({ data: campaign });
  } catch (error) {
    next(error);
  }
}

export async function createCampaign(req, res, next) {
  try {
    const campaign = await campaignService.createCampaign(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCampaign(req, res, next) {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: 'Campaign updated successfully',
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCampaign(req, res, next) {
  try {
    const result = await campaignService.deleteCampaign(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCampaignActivities(req, res, next) {
  try {
    const activities = await campaignService.getCampaignActivities(req.params.id, req.user);
    return res.status(200).json({ data: activities });
  } catch (error) {
    next(error);
  }
}
