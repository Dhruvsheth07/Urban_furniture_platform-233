import { Request, Response } from "express";
import prisma from "../../utils/prisma";
import bcrypt from "bcrypt";

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.users.findMany({
      where: { companyId },
      select: { id: true, email: true, name: true, isActive: true, contactId: true, createdAt: true, user_roles: { include: { roles: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(data.map((u) => ({
      id: u.id, email: u.email, name: u.name, isActive: u.isActive, contactId: u.contactId,
      role: u.user_roles[0]?.roles?.name || null, roleKey: u.user_roles[0]?.roles?.key || null,
    })));
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.users.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true, email: true, name: true, isActive: true, contactId: true, user_roles: { include: { roles: true } } },
    });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { email, name, password, roleId } = req.body;
    if (!email || !password || !name) return res.status(400).json({ message: "email, name and password are required" });
    const passwordHash = await bcrypt.hash(password, 10);
    const id = `user-${Date.now()}`;
    const data = await prisma.users.create({
      data: {
        id, companyId, email, name, passwordHash, updatedAt: new Date(),
        ...(roleId ? { user_roles: { create: { id: `ur-${Date.now()}`, companyId, roleId } } } : {}),
      },
    });
    res.status(201).json({ id: data.id, email: data.email, name: data.name });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.users.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { name, isActive, password } = req.body;
    const patch: any = { updatedAt: new Date() };
    if (name !== undefined) patch.name = name;
    if (isActive !== undefined) patch.isActive = isActive;
    if (password) patch.passwordHash = await bcrypt.hash(password, 10);
    const data = await prisma.users.update({ where: { id: req.params.id }, data: patch });
    res.json({ id: data.id, email: data.email, name: data.name, isActive: data.isActive });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.users.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    // Soft-delete to preserve audit trail
    await prisma.users.update({ where: { id: req.params.id }, data: { isActive: false, updatedAt: new Date() } });
    res.json({ message: "Deactivated" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
