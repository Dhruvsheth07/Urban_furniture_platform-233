import { Request, Response } from "express";
import prisma from "../../utils/prisma";

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const take = Math.min(Number(req.query.limit) || 100, 500);
    const data = await prisma.audit_logs.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.audit_logs.findFirst({ where: { id: req.params.id, companyId } });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Audit logs are system-generated; mutations are disabled.
export const create = async (_req: Request, res: Response) => res.status(405).json({ message: "Audit logs are read-only" });
export const update = async (_req: Request, res: Response) => res.status(405).json({ message: "Audit logs are read-only" });
export const remove = async (_req: Request, res: Response) => res.status(405).json({ message: "Audit logs are read-only" });
