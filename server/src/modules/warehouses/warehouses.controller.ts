import { Request, Response } from "express";
import prisma from "../../utils/prisma";

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.warehouses.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.warehouses.findFirst({ where: { id: req.params.id, companyId } });
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    const data = await prisma.warehouses.create({
      data: { id: `wh-${Date.now()}`, companyId, name, location, updatedAt: new Date() },
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.warehouses.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const { name, location, isActive } = req.body;
    const data = await prisma.warehouses.update({ where: { id: req.params.id }, data: { name, location, isActive, updatedAt: new Date() } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.warehouses.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.warehouses.update({ where: { id: req.params.id }, data: { isActive: false, updatedAt: new Date() } });
    res.json({ message: "Deactivated" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
