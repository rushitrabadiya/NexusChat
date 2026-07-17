import { Request, Response } from 'express';
import { prisma } from '../../core/db/prisma';
import crypto from 'crypto';

export const createTenant = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    let code = '';
    let isUnique = false;
    while (!isUnique) {
      code = crypto.randomBytes(3).toString('hex').toUpperCase();
      const existing = await prisma.tenant.findUnique({ where: { code } });
      if (!existing) isUnique = true;
    }

    const tenant = await prisma.tenant.create({
      data: { name, code }
    });

    return res.status(201).json(tenant);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create tenant' });
  }
};

export const getTenants = async (req: Request, res: Response): Promise<any> => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(tenants);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch tenants' });
  }
};

export const getTenantByCode = async (req: Request, res: Response): Promise<any> => {
  try {
    const { code } = req.params;
    const tenant = await prisma.tenant.findUnique({ where: { code } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    return res.json(tenant);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch tenant' });
  }
};

export const deleteTenant = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    await prisma.tenant.delete({ where: { id } });
    return res.status(200).json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete tenant' });
  }
};
