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

  return router;
}
