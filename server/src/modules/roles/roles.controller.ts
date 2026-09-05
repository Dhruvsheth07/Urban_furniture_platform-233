import { Request, Response } from "express";
import prisma from "../../utils/prisma";

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.roles.findMany({
      where: { companyId },
      include: { _count: { select: { user_roles: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(data.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, isSystem: r.isSystem, userCount: (r as any)._count.user_roles })));
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.roles.findFirst({ where: { id: req.params.id, companyId } });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { key, name, description } = req.body;
    if (!key || !name) return res.status(400).json({ message: "key and name are required" });
    const data = await prisma.roles.create({
      data: { id: `role-${Date.now()}`, companyId, key, name, description, isSystem: false, updatedAt: new Date() },
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.roles.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { name, description } = req.body;
    const data = await prisma.roles.update({ where: { id: req.params.id }, data: { name, description, updatedAt: new Date() } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.roles.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (existing.isSystem) return res.status(400).json({ message: "Cannot delete a system role" });
    await prisma.roles.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
