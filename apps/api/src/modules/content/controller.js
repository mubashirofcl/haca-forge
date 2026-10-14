import * as contentService from './service.js';

export async function createContentItemHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const contentItem = await contentService.createContentItem(req.body, req.user, io);
    res.status(201).json({ data: contentItem });
  } catch (err) {
    next(err);
  }
}

export async function listContentItemsHandler(req, res, next) {
  try {
    const result = await contentService.listContentItems(req.query, req.user);
    res.json({ data: result.items, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function getContentItemByIdHandler(req, res, next) {
  try {
    const result = await contentService.getContentItemById(req.params.id, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateContentItemHandler(req, res, next) {
  try {
    const io = req.app.get('io');
    const updated = await contentService.updateContentItem(req.params.id, req.body, req.user, io);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}
