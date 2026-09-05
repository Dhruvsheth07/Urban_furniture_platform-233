import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

export const auditLog = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;

  res.send = function (body) {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const user = (req as any).user;
      
      // Async fire and forget
      if (user) {
        prisma.audit_logs.create({
          data: {
            id: `audit-${Date.now()}-${Math.random()}`,
            companyId: user.companyId,
            userId: user.id,
            action: `${req.method} ${req.originalUrl}`,
            entityType: req.originalUrl.split('/')[2] || 'unknown',
            entityId: (req.params.id as string) || null,
            summary: `${req.method} by user ${user.id}`,
          }
        }).catch(err => console.error("Audit Log Error:", err));
      }
    }
    return originalSend.call(this, body);
  };
  
  next();
};
