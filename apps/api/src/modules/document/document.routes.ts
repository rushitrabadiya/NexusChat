import { Router } from 'express';
import multer from 'multer';
import { uploadDocuments, getDocuments, retryDocument, deleteDocument, crawlWebsite } from './document.controller';
import fs from 'fs';

const router: Router = Router();

const uploadDir: string = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

router.post('/upload', upload.array('files'), uploadDocuments);
router.post('/crawl', crawlWebsite);
router.get('/', getDocuments);
router.post('/:id/retry', retryDocument);
router.delete('/:id', deleteDocument);

export default router;
