import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Demo Seed...");
  
  // Clear db (careful in prod)
  await prisma.payments.deleteMany();
  await prisma.invoice_lines.deleteMany();
  await prisma.invoices.deleteMany();
  await prisma.vendor_bill_lines.deleteMany();
  await prisma.vendor_bills.deleteMany();
  await prisma.stock_movements.deleteMany();
  await prisma.products.deleteMany();
  await prisma.contacts.deleteMany();
  await prisma.journal_lines.deleteMany();
  await prisma.journals.deleteMany();
  await prisma.user_roles.deleteMany();
  await prisma.users.deleteMany();
  await prisma.roles.deleteMany();
  await prisma.companies.deleteMany();

  const company: any = await prisma.companies.create({
    data: { id: 'comp-demo', name: 'Urban Furniture HQ', baseCurrency: 'USD', updatedAt: new Date() } as any
  });

  const adminRole: any = await prisma.roles.create({
    data: { id: 'role-admin', companyId: company.id, key: 'ADMIN', name: 'Admin', updatedAt: new Date() } as any
  });

  const customerRole: any = await prisma.roles.create({
    data: { id: 'role-customer', companyId: company.id, key: 'PORTAL', name: 'Customer', updatedAt: new Date() } as any
  });

  const adminUser: any = await prisma.users.create({
    data: {
      id: 'user-admin',
      companyId: company.id,
      email: 'admin@urban.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Admin User',
      
      updatedAt: new Date(),
      user_roles: { create: { id: 'ur-admin', companyId: company.id, roleId: adminRole.id } }
    } as any
  });

  const customerContact: any = await prisma.contacts.create({
    data: { id: 'contact-cust1', companyId: company.id, name: 'Acme Corp', type: 'CUSTOMER', email: 'acme@example.com', updatedAt: new Date() } as any
  });

  await prisma.users.create({
    data: {
      id: 'user-cust1',
      companyId: company.id,
      contactId: customerContact.id, // For portal isolation
      email: 'customer@urban.com',
      passwordHash: await bcrypt.hash('customer123', 10),
      name: 'Acme Customer',
      
      updatedAt: new Date(),
      user_roles: { create: { id: 'ur-cust', companyId: company.id, roleId: customerRole.id } }
    } as any
  });

  const vendorContact: any = await prisma.contacts.create({
    data: { id: 'contact-vend1', companyId: company.id, name: 'Wood Suppliers Inc', type: 'VENDOR', email: 'wood@suppliers.com', updatedAt: new Date() } as any
  });

  const product1: any = await prisma.products.create({
    data: { id: 'prod-1', companyId: company.id, name: 'Ergonomic Office Chair', sku: 'CHR-001', type: 'GOODS', salePrice: 250, purchasePrice: 100, onHandQty: 50, updatedAt: new Date() } as any
  });
  const product2: any = await prisma.products.create({
    data: { id: 'prod-2', companyId: company.id, name: 'Oak Executive Desk', sku: 'DSK-001', type: 'GOODS', salePrice: 850, purchasePrice: 300, onHandQty: 5, updatedAt: new Date() } as any
  });

  // Create an overdue invoice to trigger risk & reminders
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 15);
  
  await prisma.invoices.create({
    data: {
      id: 'inv-demo-1',
      companyId: company.id,
      customerId: customerContact.id,
      invoiceNumber: 'INV-1001',
      date: oldDate,
      dueDate: oldDate,
      status: 'OPEN',
      totalAmount: 2500,
      updatedAt: new Date(),
      lines: {
        create: [
          { id: 'il-1', productId: product1.id, quantity: 10, unitPrice: 250, total: 2500 }
        ]
      }
    } as any
  });

  // Create an automation rule
  await prisma.automation_rules.create({
    data: {
      id: 'auto-1',
      companyId: company.id,
      triggerEvent: 'INVOICE_OVERDUE',
      actionType: 'SEND_EMAIL',
      condition: 'days_overdue > 0',
      isActive: true,
      updatedAt: new Date()
    } as any
  });
  await prisma.automation_rules.create({
    data: {
      id: 'auto-2',
      companyId: company.id,
      triggerEvent: 'LOW_STOCK',
      actionType: 'CREATE_ACTION_ITEM',
      isActive: true,
      updatedAt: new Date()
    } as any
  });

  // Create a budget
  

  console.log("Demo Seed Complete! Use admin@urban.com / admin123 or customer@urban.com / customer123");
}

main().catch(console.error).finally(() => prisma.$disconnect());
