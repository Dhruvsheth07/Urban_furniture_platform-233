import { Request, Response } from "express";
import prisma from "../../utils/prisma";

export const getAll = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const type = req.query.type ? String(req.query.type) : undefined;
    const where: any = { companyId };
    if (type === 'CUSTOMER') where.type = { in: ['CUSTOMER', 'BOTH'] };
    else if (type === 'VENDOR') where.type = { in: ['VENDOR', 'BOTH'] };
    const data = await prisma.contacts.findMany({ where, orderBy: { name: 'asc' } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const data = await prisma.contacts.findFirst({
      where: { id: req.params.id, companyId },
      include: { invoices: true, vendor_bills: true, payments: true },
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
    const b = req.body;
    if (!b.name) return res.status(400).json({ message: "name is required" });
    const data = await prisma.contacts.create({
      data: {
        id: `contact-${Date.now()}`,
        companyId,
        type: b.type || 'CUSTOMER',
        name: b.name,
        displayName: b.displayName,
        gstin: b.gstin,
        email: b.email,
        phone: b.phone,
        billingLine1: b.billingLine1,
        billingCity: b.billingCity,
        billingState: b.billingState,
        billingPincode: b.billingPincode,
        notes: b.notes,
        updatedAt: new Date(),
      },
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.contacts.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const b = req.body;
    const patch: any = { updatedAt: new Date() };
    for (const f of ['name', 'displayName', 'gstin', 'email', 'phone', 'billingLine1', 'billingCity', 'billingState', 'billingPincode', 'notes', 'type', 'isActive']) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    const data = await prisma.contacts.update({ where: { id: req.params.id }, data: patch });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user.companyId;
    const existing = await prisma.contacts.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.contacts.update({ where: { id: req.params.id }, data: { isActive: false, updatedAt: new Date() } });
    res.json({ message: "Deactivated" });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
