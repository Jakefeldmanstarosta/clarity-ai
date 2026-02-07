import express from 'express';
import multer from 'multer';

export function createRoutes(container) {
  const router = express.Router();
  const upload = multer();

  const { speechController } = container.controllers;

  // Health check endpoint
  router.get('/health', (req, res) => speechController.health(req, res));

  // Main processing endpoint
  router.post(
    '/process',
    upload.single('audio'),
    (req, res, next) => speechController.process(req, res, next)
  );

  // Split processing endpoints
  router.post(
    '/process/transcribe',
    upload.single('audio'),
    (req, res, next) => speechController.transcribe(req, res, next)
  );

  router.post(
    '/process/simplify',
    (req, res, next) => speechController.simplify(req, res, next)
  );

  router.post(
    '/process/synthesize',
    (req, res, next) => speechController.synthesize(req, res, next)
  );

  return router;
}
