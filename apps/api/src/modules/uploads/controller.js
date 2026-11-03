import * as uploadService from './service.js';

export async function signUploadHandler(req, res, next) {
  try {
    const signatureData = await uploadService.generateUploadSignature(req.body);
    res.json({ data: signatureData });
  } catch (err) {
    next(err);
  }
}

export async function recordMetadataHandler(req, res, next) {
  try {
    const metadata = await uploadService.recordUploadMetadata(req.body);
    res.status(201).json({ data: metadata });
  } catch (err) {
    next(err);
  }
}

export async function localUploadHandler(req, res, next) {
  try {
    const result = await uploadService.processLocalUploadedFile(req.file, req.body?.kind);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

