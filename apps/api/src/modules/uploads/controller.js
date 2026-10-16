import * as uploadService from './service.js';

export async function signUploadHandler(req, res, next) {
  try {
    const signatureData = await uploadService.generateUploadSignature(req.body);
    res.json({ data: signatureData });
  } catch (err) {
    next(err);
  }
}
