import { Router } from 'express';
import { streamChat, getChatSessions, getChatMessages } from './chat.controller';

const router: Router = Router();

router.get('/', getChatSessions);
router.get('/:id/messages', getChatMessages);
router.post('/stream', streamChat);

export default router;
