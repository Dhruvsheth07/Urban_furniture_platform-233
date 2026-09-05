import { Request, Response } from "express";
import prisma from "../../utils/prisma";
import nodemailer from "nodemailer";

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// ---- List automation rules ----
export const listRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = (req as any).user.companyId;
    const rules = await prisma.automation_rules.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Recent automation runs (audit trail) ----
export const listRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = (req as any).user.companyId;
    const runs = await prisma.automation_runs.findMany({ where: { companyId }, orderBy: { executedAt: 'desc' }, take: 50 });
    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Toggle a rule on/off ----
export const toggleRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = (req as any).user.companyId;
    const rule = await prisma.automation_rules.findFirst({ where: { id: req.params.id, companyId } });
    if (!rule) { res.status(404).json({ message: "Rule not found" }); return; }
    const updated = await prisma.automation_rules.update({ where: { id: rule.id }, data: { isActive: !rule.isActive, updatedAt: new Date() } });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ---- Run active automations. Notifications only; never posts accounting entries. ----
export const runAutomations = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = (req as any).user.companyId;
    const rules = await prisma.automation_rules.findMany({ where: { companyId, isActive: true } });

    const now = new Date();
    const results: string[] = [];
    const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
    let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
    if (hasSmtp) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
      });
    }

    for (const rule of rules) {
      const ruleResults: string[] = [];
      try {
        if (rule.triggerEvent === 'INVOICE_OVERDUE') {
          const overdueInvoices = await prisma.invoices.findMany({
            where: { companyId, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: now } },
            include: { customer: true },
          });

          for (const inv of overdueInvoices) {
            const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
            if (outstanding <= 0) continue;
            const days = inv.dueDate ? Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000) : 0;

            if (rule.actionType === 'SEND_EMAIL' && transporter && inv.customer.email) {
              try {
                await transporter.sendMail({
                  from: process.env.SMTP_FROM || '"Urban Furniture" <finance@urbanfurniture.com>',
                  to: inv.customer.email,
                  subject: `Payment Reminder: Invoice ${inv.invoiceNumber}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                      <h2 style="color: #0f172a;">Payment Reminder</h2>
                      <p>Dear ${inv.customer.name},</p>
                      <p>Invoice <strong>${inv.invoiceNumber}</strong> is <strong>${days} day(s)</strong> overdue.</p>
                      <p>Amount outstanding: <strong>${inr(outstanding)}</strong></p>
                      <p>We would appreciate settlement at the earliest. Thank you for your business.</p>
                    </div>`,
                });
              } catch (mailErr) {
                // Fall through to notification even if email delivery fails
              }
            }

            // Always record a notification so the reminder is visible in-app
            await prisma.notifications.create({
              data: {
                id: `notif-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                companyId,
                title: 'Payment reminder',
                message: `Invoice ${inv.invoiceNumber} for ${inv.customer.name} is ${days} day(s) overdue — ${inr(outstanding)} outstanding.`,
              },
            });
            ruleResults.push(`Reminder for ${inv.invoiceNumber} (${inr(outstanding)}, ${days}d overdue)`);
          }
        }

        if (rule.triggerEvent === 'LOW_STOCK' && rule.actionType === 'CREATE_ACTION_ITEM') {
          const products = await prisma.products.findMany({ where: { companyId, trackInventory: true, isActive: true } });
          for (const prod of products) {
            const onHand = Number(prod.onHandQty);
            const reorderLevel = Number(prod.reorderLevel);
            if (reorderLevel > 0 && onHand <= reorderLevel) {
              // Avoid duplicate open action items for the same product
              const existing = await prisma.action_items.findFirst({ where: { companyId, referenceId: prod.id, type: 'PO_PROPOSAL', status: 'OPEN' } });
              if (existing) continue;
              await prisma.action_items.create({
                data: {
                  id: `act-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                  companyId,
                  type: 'PO_PROPOSAL',
                  title: `Reorder ${prod.name}`,
                  description: `${onHand} on hand at or below reorder level ${reorderLevel}. Consider raising a purchase order.`,
                  priority: 'HIGH',
                  referenceId: prod.id,
                  updatedAt: new Date(),
                },
              });
              ruleResults.push(`PO proposal for ${prod.name} (${onHand} ≤ ${reorderLevel})`);
            }
          }
        }

        await prisma.automation_runs.create({
          data: { id: `run-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, companyId, ruleId: rule.id, status: 'SUCCESS', details: `${ruleResults.length} action(s): ${ruleResults.join('; ') || 'nothing to do'}` },
        });
        results.push(...ruleResults);
      } catch (err: any) {
        await prisma.automation_runs.create({
          data: { id: `run-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, companyId, ruleId: rule.id, status: 'FAILED', details: err?.message || 'Unknown error' },
        });
      }
    }

    res.json({ message: "Automations processed", emailEnabled: hasSmtp, count: results.length, results });
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
