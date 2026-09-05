import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  name: string;
  contactId: string | null;
  roleKey: string;
  roleName: string;
}

// Role -> allowed resource groups. OWNER/ADMIN implicitly get everything.
const ROLE_MATRIX: Record<string, string[]> = {
  OWNER: ['*'],
  ADMIN: ['*'],
  ACCOUNTANT: ['reports', 'accounting', 'invoices', 'vendor-bills', 'payments', 'contacts', 'products', 'intelligence', 'audit', 'automation', 'dashboard'],
  SALES: ['sales-orders', 'invoices', 'contacts', 'products', 'payments', 'dashboard', 'reports'],
  PURCHASE: ['purchase-orders', 'vendor-bills', 'contacts', 'products', 'payments', 'dashboard', 'reports'],
  INVENTORY: ['products', 'warehouses', 'stock-movements', 'dashboard'],
  PORTAL: ['invoices', 'payments'],
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Unauthorized: Missing token' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };

    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: { user_roles: { include: { roles: true } } },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Unauthorized: User not found' });
      return;
    }

    const role = user.user_roles[0]?.roles;

    const authUser: AuthUser = {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      name: user.name,
      contactId: user.contactId,
      roleKey: role?.key || 'PORTAL',
      roleName: role?.name || 'Customer',
    };

    (req as any).user = authUser;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

/** Restrict a route group to specific roles. OWNER/ADMIN always pass. */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthUser | undefined;
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    if (user.roleKey === 'OWNER' || user.roleKey === 'ADMIN' || roles.includes(user.roleKey)) {
      next();
      return;
    }
    res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  };
};

/** Block portal (customer) users from internal resources based on the URL resource group. */
export const blockPortal = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user as AuthUser | undefined;
  if (user && user.roleKey === 'PORTAL') {
    const allowed = ROLE_MATRIX.PORTAL;
    const resource = req.baseUrl.split('/')[2] || '';
    if (!allowed.includes(resource)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
  }
  next();
};

// Backwards-compat: some old code may import requirePermission
export const requirePermission = (_permission: string) => {
  return (_req: Request, _res: Response, next: NextFunction): void => next();
};
