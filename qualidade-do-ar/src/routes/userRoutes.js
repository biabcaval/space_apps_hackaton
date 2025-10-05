import express from 'express';
import UserController from '../controllers/UserController.js';

const router = express.Router();

// Rotas para usuários
router.post('/users', UserController.createUser);
router.get('/users', UserController.getAllUsers);
router.get('/users/:id', UserController.getUserById);
router.put('/users/:id', UserController.updateUser);
router.delete('/users/:id', UserController.deleteUser);
router.patch('/users/:id/toggle-active', UserController.toggleUserActive);

export default router;