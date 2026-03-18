import { Hono } from 'hono';
import * as photosService from './photos.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireIntegrateurOrAdmin } from '../../middleware/rbac.middleware';
import { ValidationError } from '../../lib/errors';

const photosRouter = new Hono();

photosRouter.use('*', authMiddleware, requireIntegrateurOrAdmin());

// Upload photo to a room
photosRouter.post('/pieces/:roomId/photos', async (c) => {
  const roomId = c.req.param('roomId');
  const user = c.get('user');

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const caption = formData.get('caption') as string | null;

  if (!file) {
    throw new ValidationError('Fichier requis');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError('Type de fichier non supporté. Formats acceptés: JPEG, PNG, WebP, HEIC');
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new ValidationError('Fichier trop volumineux. Maximum 10MB');
  }

  const photo = await photosService.uploadPhoto(
    roomId,
    file,
    caption || undefined,
    user.userId,
    user.role
  );

  return c.json(photo, 201);
});

// Get photos by room
photosRouter.get('/pieces/:roomId/photos', async (c) => {
  const roomId = c.req.param('roomId');
  const user = c.get('user');
  const photosList = await photosService.getPhotosByRoom(roomId, user.userId, user.role);
  return c.json(photosList);
});

// Delete photo
photosRouter.delete('/photos/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  await photosService.deletePhoto(id, user.userId, user.role);
  return c.json({ message: 'Photo supprimée' });
});

export default photosRouter;
