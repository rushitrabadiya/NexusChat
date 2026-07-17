import { Request, Response } from 'express';
import { documentQueue } from '../../core/queue/bullmq';
import { prisma } from '../../core/db/prisma';

export const uploadDocuments = async (req: Request, res: Response): Promise<any> => {
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required' });
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const documents = [];

    for (const file of files) {
      const document = await prisma.document.create({
        data: {
          tenantId,
          filename: file.originalname,
          fileType: file.mimetype,
          filePath: file.path,
          status: 'PENDING',
        }
      });

      documents.push(document);

      await documentQueue.add('processDocument', {
        documentId: document.id,
        filePath: file.path,
        fileType: file.mimetype,
        tenantId
      });
    }

    return res.status(202).json({ message: 'Documents queued for processing', documents });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Upload failed' });
  }
};

export const getDocuments = async (req: Request, res: Response): Promise<any> => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) return res.status(400).json({ error: 'Tenant ID is required' });

  try {
    const documents = await prisma.document.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(documents);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

export const retryDocument = async (req: Request, res: Response): Promise<any> => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { id } = req.params;

  if (!tenantId) return res.status(400).json({ error: 'Tenant ID is required' });

  try {
    const document = await prisma.document.findUnique({
      where: { id, tenantId }
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });
    
    // Strict validation: Only allow retry on FAILED
    if (document.status !== 'FAILED') {
      return res.status(400).json({ error: 'Only failed documents can be retried' });
    }

    if (!document.filePath) {
      return res.status(400).json({ error: 'Original file not found for retry' });
    }

    // Reset status and error
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'PENDING', error: null }
    });

    await documentQueue.add('processDocument', {
      documentId: document.id,
      filePath: document.filePath,
      fileType: document.fileType,
      tenantId
    });

    return res.status(202).json({ message: 'Document queued for retry' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Retry failed' });
  }
};

export const deleteDocument = async (req: Request, res: Response): Promise<any> => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { id } = req.params;

  if (!tenantId) return res.status(400).json({ error: 'Tenant ID is required' });

  try {
    const document = await prisma.document.findUnique({
      where: { id, tenantId }
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });

    await prisma.document.delete({
      where: { id }
    });

    return res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
};
