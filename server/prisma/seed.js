/**
 * Realistic Indian-business seed for Urban Furniture (INR).
 * Reuses the compiled AccountingService so every journal is balanced and
 * consistent with the runtime controllers. Run: node prisma/seed.js
 * (build first: npm run build)
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { AccountingService } = require('../dist/services/accounting.service');

const prisma = new PrismaClient();
const companyId = 'comp-demo';
const GST = 18; // % — standard rate for furniture in India

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const daysAgo = (d) => new Date(Date.now() - d * 86400000);
const daysAhead = (d) => new Date(Date.now() + d * 86400000);

async function wipe() {
  // Delete in FK-safe order, scoped to the demo company.
  const c = { where: { companyId } };
  await prisma.journal_lines.deleteMany(c);
  await prisma.journals.deleteMany(c);
  await prisma.payments.deleteMany(c);
  await prisma.invoice_lines.deleteMany({ where: { invoice: { companyId } } });
  await prisma.invoices.deleteMany(c);
  await prisma.vendor_bill_lines.deleteMany({ where: { bill: { companyId } } });
  await prisma.vendor_bills.deleteMany(c);
  await prisma.sales_order_lines.deleteMany({ where: { order: { companyId } } });
  await prisma.sales_orders.deleteMany(c);
  await prisma.purchase_order_lines.deleteMany({ where: { order: { companyId } } });
  await prisma.purchase_orders.deleteMany(c);
  await prisma.stock_movements.deleteMany(c);
  await prisma.budgets.deleteMany(c);
  await prisma.anomalies.deleteMany(c);
  await prisma.action_items.deleteMany(c);
  await prisma.automation_runs.deleteMany(c);
  await prisma.automation_rules.deleteMany(c);
  await prisma.notifications.deleteMany(c);
  await prisma.products.deleteMany(c);
  await prisma.categories.deleteMany(c);
  await prisma.units.deleteMany(c);
  await prisma.tax_rates.deleteMany(c);
  await prisma.budgets.deleteMany(c);
  await prisma.warehouses.deleteMany(c);
  await prisma.journal_lines.deleteMany(c);
  await prisma.journals.deleteMany(c);
  await prisma.accounts.deleteMany(c);
  await prisma.user_roles.deleteMany(c);
  await prisma.sessions.deleteMany({ where: { users: { companyId } } });
  await prisma.users.deleteMany(c);
  await prisma.role_permissions.deleteMany({ where: { roles: { companyId } } });
  await prisma.roles.deleteMany(c);
  await prisma.contacts.deleteMany(c);
}

async function main() {
  console.log('Resetting demo company data...');
  await wipe();

  // ---- Company ----
  await prisma.companies.upsert({
    where: { id: companyId },
    update: {
      name: 'Urban Furniture Pvt Ltd', legalName: 'Urban Furniture Private Limited',
      gstin: '29ABCDE1234F1Z5', baseCurrency: 'INR', addressLine1: '14, Industrial Layout',
      addressLine2: 'Peenya', city: 'Bengaluru', state: 'Karnataka', stateCode: '29',
      pincode: '560058', country: 'IN', email: 'hello@urbanfurniture.in', phone: '+91 80 4123 5678',
      updatedAt: new Date(),
    },
    create: {
      id: companyId, name: 'Urban Furniture Pvt Ltd', legalName: 'Urban Furniture Private Limited',
      gstin: '29ABCDE1234F1Z5', baseCurrency: 'INR', addressLine1: '14, Industrial Layout',
      addressLine2: 'Peenya', city: 'Bengaluru', state: 'Karnataka', stateCode: '29',
      pincode: '560058', country: 'IN', email: 'hello@urbanfurniture.in', phone: '+91 80 4123 5678',
      fiscalYearStartMonth: 4, updatedAt: new Date(),
    },
  });

  // ---- Roles (RBAC) ----
  const roleDefs = [
    ['OWNER', 'Owner'], ['ADMIN', 'Administrator'], ['ACCOUNTANT', 'Accountant'],
    ['SALES', 'Sales'], ['PURCHASE', 'Purchase'], ['INVENTORY', 'Inventory'], ['PORTAL', 'Customer Portal'],
  ];
  const roles = {};
  for (const [key, name] of roleDefs) {
    roles[key] = await prisma.roles.create({
      data: { id: `role-${companyId}-${key}`, companyId, key, name, isSystem: true, updatedAt: new Date() },
    });
  }

  // ---- Chart of accounts (system) ----
  const acc = await AccountingService.ensureSystemAccounts(companyId, prisma);

  // ---- Reference data ----
  const unitPcs = await prisma.units.create({ data: { id: `unit-${companyId}-pcs`, companyId, name: 'Pieces', symbol: 'PCS', updatedAt: new Date() } });
  const tax18 = await prisma.tax_rates.create({ data: { id: `tax-${companyId}-18`, companyId, name: 'GST 18%', rate: GST, updatedAt: new Date() } });
  const catSeating = await prisma.categories.create({ data: { id: `cat-${companyId}-seating`, companyId, name: 'Seating', updatedAt: new Date() } });
  const catTables = await prisma.categories.create({ data: { id: `cat-${companyId}-tables`, companyId, name: 'Tables', updatedAt: new Date() } });
  const catStorage = await prisma.categories.create({ data: { id: `cat-${companyId}-storage`, companyId, name: 'Storage', updatedAt: new Date() } });

  const whMain = await prisma.warehouses.create({ data: { id: `wh-${companyId}-main`, companyId, name: 'Peenya Main Warehouse', location: 'Bengaluru, Karnataka', updatedAt: new Date() } });
  await prisma.warehouses.create({ data: { id: `wh-${companyId}-hsr`, companyId, name: 'HSR Layout Showroom', location: 'Bengaluru, Karnataka', updatedAt: new Date() } });

  // ---- Users ----
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.users.create({
    data: {
      id: `user-${companyId}-owner`, companyId, email: 'admin@urban.com', name: 'Ravi Menon', passwordHash, updatedAt: new Date(),
      user_roles: { create: { id: `ur-${companyId}-owner`, companyId, roleId: roles.OWNER.id } },
    },
  });
  const acctHash = await bcrypt.hash('account123', 10);
  await prisma.users.create({
    data: {
      id: `user-${companyId}-acct`, companyId, email: 'accounts@urban.com', name: 'Priya Nair', passwordHash: acctHash, updatedAt: new Date(),
      user_roles: { create: { id: `ur-${companyId}-acct`, companyId, roleId: roles.ACCOUNTANT.id } },
    },
  });

  // ---- Contacts ----
  const customers = [
    { id: 'cust-orchid', name: 'Orchid Interiors', gstin: '29AAACO1234M1Z2', email: 'accounts@orchidinteriors.in', phone: '+91 98450 11223', city: 'Bengaluru', state: 'Karnataka', code: '29' },
    { id: 'cust-lotus', name: 'Lotus Hospitality', gstin: '27AABCL5678N1Z9', email: 'purchase@lotushotels.in', phone: '+91 98200 44556', city: 'Mumbai', state: 'Maharashtra', code: '27' },
    { id: 'cust-skyline', name: 'Skyline Offices LLP', gstin: '07AACCS9012P1Z1', email: 'admin@skylineoffices.in', phone: '+91 99100 77889', city: 'New Delhi', state: 'Delhi', code: '07' },
    { id: 'cust-green', name: 'Greenwood Homes', gstin: '33AADCG3456Q1Z7', email: 'projects@greenwoodhomes.in', phone: '+91 98400 22110', city: 'Chennai', state: 'Tamil Nadu', code: '33' },
    { id: 'cust-nova', name: 'Nova Coworking', gstin: '36AAECN7890R1Z3', email: 'ops@novacowork.in', phone: '+91 90000 33445', city: 'Hyderabad', state: 'Telangana', code: '36' },
  ];
  for (const c of customers) {
    await prisma.contacts.create({
      data: {
        id: c.id, companyId, type: 'CUSTOMER', name: c.name, gstin: c.gstin, email: c.email, phone: c.phone,
        billingLine1: `${Math.floor(Math.random() * 200) + 1}, Business Park`, billingCity: c.city, billingState: c.state,
        stateCode: c.code, billingPincode: '560001', billingCountry: 'IN', updatedAt: new Date(),
      },
    });
  }
  // Portal user tied to first customer
  const portalHash = await bcrypt.hash('portal123', 10);
  await prisma.users.create({
    data: {
      id: `user-${companyId}-portal`, companyId, email: 'portal@orchidinteriors.in', name: 'Orchid Portal', passwordHash: portalHash, contactId: 'cust-orchid', updatedAt: new Date(),
      user_roles: { create: { id: `ur-${companyId}-portal`, companyId, roleId: roles.PORTAL.id } },
    },
  });

  const vendors = [
    { id: 'vend-teak', name: 'Sagwan Teak Traders', gstin: '29AAAFS1111A1Z0', email: 'sales@sagwanteak.in', phone: '+91 98860 10101', city: 'Bengaluru', state: 'Karnataka', code: '29' },
    { id: 'vend-foam', name: 'ComfortFoam India', gstin: '29AABCF2222B1Z8', email: 'orders@comfortfoam.in', phone: '+91 97400 20202', city: 'Bengaluru', state: 'Karnataka', code: '29' },
    { id: 'vend-hardware', name: 'Metro Hardware & Fittings', gstin: '27AACFM3333C1Z6', email: 'supply@metrohardware.in', phone: '+91 98190 30303', city: 'Pune', state: 'Maharashtra', code: '27' },
  ];
  for (const v of vendors) {
    await prisma.contacts.create({
      data: {
        id: v.id, companyId, type: 'VENDOR', name: v.name, gstin: v.gstin, email: v.email, phone: v.phone,
        billingLine1: `${Math.floor(Math.random() * 100) + 1}, Industrial Estate`, billingCity: v.city, billingState: v.state,
        stateCode: v.code, billingPincode: '560058', billingCountry: 'IN', updatedAt: new Date(),
      },
    });
  }

  // ---- Products with opening stock ----
  const productDefs = [
    { id: 'prod-exec-chair', sku: 'CHR-EXEC-01', name: 'Executive Leather Chair', cat: catSeating.id, sale: 12500, cost: 7200, open: 40, reorder: 10, material: 'Leather', color: 'Black' },
    { id: 'prod-mesh-chair', sku: 'CHR-MESH-02', name: 'Ergonomic Mesh Chair', cat: catSeating.id, sale: 8500, cost: 4800, open: 60, reorder: 15, material: 'Mesh', color: 'Grey' },
    { id: 'prod-sofa-3s', sku: 'SOFA-3S-01', name: '3-Seater Fabric Sofa', cat: catSeating.id, sale: 34000, cost: 21000, open: 15, reorder: 4, material: 'Fabric', color: 'Beige' },
    { id: 'prod-desk-exec', sku: 'DSK-EXEC-01', name: 'Executive Office Desk', cat: catTables.id, sale: 22000, cost: 13500, open: 25, reorder: 6, material: 'Teak Veneer', color: 'Walnut' },
    { id: 'prod-conf-table', sku: 'TBL-CONF-08', name: '8-Seater Conference Table', cat: catTables.id, sale: 48000, cost: 29000, open: 8, reorder: 2, material: 'Engineered Wood', color: 'Oak' },
    { id: 'prod-dining-6', sku: 'TBL-DIN-06', name: '6-Seater Dining Set', cat: catTables.id, sale: 41000, cost: 25500, open: 12, reorder: 3, material: 'Sheesham', color: 'Honey' },
    { id: 'prod-bookshelf', sku: 'STG-BKS-01', name: '5-Tier Bookshelf', cat: catStorage.id, sale: 9800, cost: 5600, open: 35, reorder: 8, material: 'Engineered Wood', color: 'White' },
    { id: 'prod-wardrobe', sku: 'STG-WRD-03', name: '3-Door Wardrobe', cat: catStorage.id, sale: 28500, cost: 17800, open: 18, reorder: 5, material: 'Plywood', color: 'Wenge' },
    { id: 'prod-filing', sku: 'STG-FIL-04', name: '4-Drawer Filing Cabinet', cat: catStorage.id, sale: 11200, cost: 6400, open: 30, reorder: 8, material: 'Steel', color: 'Grey' },
    { id: 'prod-side-table', sku: 'TBL-SIDE-02', name: 'Minimalist Side Table', cat: catTables.id, sale: 4500, cost: 2300, open: 5, reorder: 12, material: 'Mango Wood', color: 'Natural' }, // intentionally below reorder
  ];

  let openingInventoryValue = 0;
  const products = {};
  for (const p of productDefs) {
    openingInventoryValue += p.open * p.cost;
    products[p.id] = await prisma.products.create({
      data: {
        id: `${companyId}-${p.id}`, companyId, sku: p.sku, name: p.name, categoryId: p.cat, unitId: unitPcs.id, taxRateId: tax18.id,
        hsnCode: '9403', salePrice: p.sale, purchasePrice: p.cost, material: p.material, color: p.color,
        trackInventory: true, reorderLevel: p.reorder, openingQty: p.open, openingCost: p.cost,
        onHandQty: p.open, avgCost: p.cost, updatedAt: new Date(),
      },
    });
    if (p.open > 0) {
      await prisma.stock_movements.create({
        data: { id: `sm-open-${p.id}`, companyId, warehouseId: whMain.id, productId: `${companyId}-${p.id}`, quantity: p.open, type: 'IN', reference: 'Opening stock' },
      });
    }
  }

  // Opening balance journal: Dr Inventory, Dr Bank (working capital), Cr Owner Equity
  const openingBank = 1500000;
  await AccountingService.postJournal(
    companyId,
    { date: daysAgo(150), memo: 'Opening balances', type: 'OPENING', source: 'SEED', idempotencyKey: 'SEED:OPENING' },
    [
      { accountId: acc.inventory.id, debit: round2(openingInventoryValue), credit: 0, description: 'Opening inventory' },
      { accountId: acc.bank.id, debit: openingBank, credit: 0, description: 'Opening bank' },
      { accountId: acc.equity.id, debit: 0, credit: round2(openingInventoryValue + openingBank), description: 'Owner capital' },
    ],
  );

  // ---- Purchase bills (increase stock, weighted-avg cost, post AP) ----
  const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  let billCounter = 1;
  async function createBill(vendorId, when, dueIn, linesDef, status) {
    const billNumber = `BILL-${String(billCounter++).padStart(4, '0')}`;
    let net = 0, tax = 0;
    const lines = linesDef.map((l) => {
      const lineNet = l.qty * l.price;
      const lineTax = round2(lineNet * (GST / 100));
      net += lineNet; tax += lineTax;
      return { productId: l.productId, quantity: l.qty, unitPrice: l.price, taxRate: GST, total: round2(lineNet + lineTax) };
    });
    net = round2(net); tax = round2(tax);
    const total = round2(net + tax);
    await prisma.$transaction(async (tx) => {
      const bill = await tx.vendor_bills.create({
        data: {
          id: `bill-${companyId}-${billNumber}`, companyId, vendorId, billNumber, date: when, dueDate: new Date(when.getTime() + dueIn * 86400000),
          status, totalAmount: total, paidAmount: 0, updatedAt: new Date(),
          lines: { create: lines.map((l, i) => ({ id: `bl-${billNumber}-${i}`, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, total: l.total })) },
        },
      });
      for (const l of linesDef) {
        const prod = await tx.products.findUnique({ where: { id: l.productId } });
        const oldQty = Number(prod.onHandQty), oldCost = Number(prod.avgCost);
        const newQty = oldQty + l.qty;
        const newAvg = newQty > 0 ? round2((oldQty * oldCost + l.qty * l.price) / newQty) : oldCost;
        await tx.products.update({ where: { id: l.productId }, data: { onHandQty: newQty, avgCost: newAvg, purchasePrice: l.price, updatedAt: new Date() } });
        await tx.stock_movements.create({ data: { id: `sm-${bill.id}-${l.productId}`, companyId, warehouseId: whMain.id, productId: l.productId, quantity: l.qty, type: 'IN', reference: billNumber } });
      }
      await AccountingService.recordVendorBill(companyId, bill.id, { net, tax }, tx);

      if (status === 'PAID') {
        const payment = await tx.payments.create({
          data: {
            id: `pay-bill-${bill.id}`, companyId, contactId: vendorId, billId: bill.id, amount: total,
            method: 'BANK_TRANSFER', reference: `${billNumber}-PMT`, date: new Date(when.getTime() + 15 * 86400000), updatedAt: new Date(),
          },
        });
        await tx.vendor_bills.update({ where: { id: bill.id }, data: { paidAmount: total, status: 'PAID', updatedAt: new Date() } });
        await AccountingService.recordVendorPayment(companyId, payment.id, total, tx);
      }
    });
    return billNumber;
  }

  await createBill('vend-teak', daysAgo(120), 30, [
    { productId: `${companyId}-prod-desk-exec`, qty: 20, price: 13200 },
    { productId: `${companyId}-prod-conf-table`, qty: 6, price: 28500 },
  ], 'PAID');
  await createBill('vend-foam', daysAgo(75), 30, [
    { productId: `${companyId}-prod-exec-chair`, qty: 30, price: 7100 },
    { productId: `${companyId}-prod-mesh-chair`, qty: 40, price: 4700 },
  ], 'OPEN');
  await createBill('vend-hardware', daysAgo(20), 30, [
    { productId: `${companyId}-prod-filing`, qty: 20, price: 6300 },
    { productId: `${companyId}-prod-bookshelf`, qty: 25, price: 5500 },
  ], 'OPEN');

  // ---- Sales invoices (decrease stock at avg cost = COGS, post AR/Revenue/GST) ----
  let invCounter = 1;
  async function createInvoice(customerId, when, dueIn, linesDef, paidStatus) {
    const invoiceNumber = `INV-${String(invCounter++).padStart(4, '0')}`;
    let net = 0, tax = 0, cogs = 0;
    const created = await prisma.$transaction(async (tx) => {
      const linesData = [];
      for (const l of linesDef) {
        const prod = await tx.products.findUnique({ where: { id: l.productId } });
        const lineNet = l.qty * l.price;
        const lineTax = round2(lineNet * (GST / 100));
        net += lineNet; tax += lineTax;
        const unitCost = Number(prod.avgCost) || Number(prod.purchasePrice);
        cogs += unitCost * l.qty;
        linesData.push({ id: `il-${invoiceNumber}-${l.productId}`, productId: l.productId, quantity: l.qty, unitPrice: l.price, taxRate: GST, total: round2(lineNet + lineTax) });
        await tx.products.update({ where: { id: l.productId }, data: { onHandQty: Number(prod.onHandQty) - l.qty, updatedAt: new Date() } });
        await tx.stock_movements.create({ data: { id: `sm-inv-${invoiceNumber}-${l.productId}`, companyId, warehouseId: whMain.id, productId: l.productId, quantity: -l.qty, type: 'OUT', reference: invoiceNumber } });
      }
      net = round2(net); tax = round2(tax); cogs = round2(cogs);
      const total = round2(net + tax);
      const dueDate = new Date(when.getTime() + dueIn * 86400000);
      const inv = await tx.invoices.create({
        data: {
          id: `inv-${companyId}-${invoiceNumber}`, companyId, customerId, invoiceNumber, date: when, dueDate,
          status: 'OPEN', totalAmount: total, paidAmount: 0, updatedAt: new Date(),
          lines: { create: linesData },
        },
      });
      await AccountingService.recordSaleInvoice(companyId, inv.id, { net, tax, cogs }, tx);
      return { inv, total };
    });
    return created;
  }

  const salesPlan = [
    { cust: 'cust-orchid', when: daysAgo(95), due: 30, lines: [{ productId: `${companyId}-prod-exec-chair`, qty: 6, price: 12500 }, { productId: `${companyId}-prod-desk-exec`, qty: 6, price: 22000 }], pay: 'PAID' },
    { cust: 'cust-lotus', when: daysAgo(70), due: 30, lines: [{ productId: `${companyId}-prod-sofa-3s`, qty: 4, price: 34000 }, { productId: `${companyId}-prod-side-table`, qty: 4, price: 4500 }], pay: 'PAID' },
    { cust: 'cust-skyline', when: daysAgo(55), due: 45, lines: [{ productId: `${companyId}-prod-mesh-chair`, qty: 20, price: 8500 }, { productId: `${companyId}-prod-conf-table`, qty: 1, price: 48000 }], pay: 'PARTIAL' },
    { cust: 'cust-green', when: daysAgo(40), due: 30, lines: [{ productId: `${companyId}-prod-dining-6`, qty: 3, price: 41000 }, { productId: `${companyId}-prod-wardrobe`, qty: 2, price: 28500 }], pay: 'OPEN' },
    { cust: 'cust-nova', when: daysAgo(50), due: 15, lines: [{ productId: `${companyId}-prod-mesh-chair`, qty: 15, price: 8500 }, { productId: `${companyId}-prod-filing`, qty: 8, price: 11200 }], pay: 'OVERDUE' },
    { cust: 'cust-orchid', when: daysAgo(10), due: 30, lines: [{ productId: `${companyId}-prod-bookshelf`, qty: 10, price: 9800 }], pay: 'OPEN' },
    { cust: 'cust-lotus', when: daysAgo(35), due: 15, lines: [{ productId: `${companyId}-prod-exec-chair`, qty: 4, price: 12500 }], pay: 'OVERDUE' },
  ];

  const paymentsToMake = [];
  for (const s of salesPlan) {
    const { inv, total } = await createInvoice(s.cust, s.when, s.due, s.lines, s.pay);
    if (s.pay === 'PAID') paymentsPush(paymentsToMake, inv, s.cust, total, s.when);
    else if (s.pay === 'PARTIAL') paymentsPush(paymentsToMake, inv, s.cust, round2(total * 0.4), s.when);
    // OPEN / OVERDUE: no payment
  }

  function paymentsPush(arr, inv, contactId, amount, when) { arr.push({ inv, contactId, amount, when }); }

  // ---- Customer payments ----
  let payCounter = 1;
  for (const p of paymentsToMake) {
    const paymentNumber = `PAY-${String(payCounter++).padStart(4, '0')}`;
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payments.create({
        data: {
          id: `pay-${companyId}-${paymentNumber}`, companyId, contactId: p.contactId, invoiceId: p.inv.id,
          amount: p.amount, method: 'BANK_TRANSFER', reference: paymentNumber, date: new Date(p.when.getTime() + 10 * 86400000), updatedAt: new Date(),
        },
      });
      const invoice = await tx.invoices.findUnique({ where: { id: p.inv.id } });
      const newPaid = round2(Number(invoice.paidAmount) + p.amount);
      const status = newPaid >= Number(invoice.totalAmount) - 0.01 ? 'PAID' : 'PARTIAL';
      await tx.invoices.update({ where: { id: p.inv.id }, data: { paidAmount: newPaid, status, updatedAt: new Date() } });
      await AccountingService.recordCustomerPayment(companyId, payment.id, p.amount, tx);
    });
  }

  // ---- Open sales & purchase orders (pipeline) ----
  const so = await prisma.sales_orders.create({
    data: {
      id: `so-${companyId}-0001`, companyId, customerId: 'cust-skyline', orderNumber: 'SO-0001', date: daysAgo(5), status: 'CONFIRMED', totalAmount: round2(10 * 8500 * 1.18), updatedAt: new Date(),
      lines: { create: [{ id: 'sol-0001-1', productId: `${companyId}-prod-mesh-chair`, quantity: 10, unitPrice: 8500, taxRate: GST, total: round2(10 * 8500 * 1.18) }] },
    },
  });
  await prisma.purchase_orders.create({
    data: {
      id: `po-${companyId}-0001`, companyId, vendorId: 'vend-teak', orderNumber: 'PO-0001', date: daysAgo(3), status: 'CONFIRMED', totalAmount: round2(10 * 13200 * 1.18), updatedAt: new Date(),
      lines: { create: [{ id: 'pol-0001-1', productId: `${companyId}-prod-desk-exec`, quantity: 10, unitPrice: 13200, taxRate: GST, total: round2(10 * 13200 * 1.18) }] },
    },
  });

  // ---- Budgets (expense accounts) ----
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  await prisma.budgets.create({ data: { id: `bud-${companyId}-cogs`, companyId, accountId: acc.cogs.id, amount: 500000, periodStart: monthStart, periodEnd: monthEnd, notes: 'Monthly COGS budget', updatedAt: new Date() } });
  await prisma.budgets.create({ data: { id: `bud-${companyId}-opex`, companyId, accountId: acc.opex.id, amount: 200000, periodStart: monthStart, periodEnd: monthEnd, notes: 'Monthly operating expenses', updatedAt: new Date() } });

  // ---- Automation rules ----
  await prisma.automation_rules.create({ data: { id: `ar-${companyId}-overdue`, companyId, triggerEvent: 'INVOICE_OVERDUE', actionType: 'SEND_EMAIL', condition: 'dueDate < today', isActive: true, updatedAt: new Date() } });
  await prisma.automation_rules.create({ data: { id: `ar-${companyId}-lowstock`, companyId, triggerEvent: 'LOW_STOCK', actionType: 'CREATE_ACTION_ITEM', condition: 'onHand <= reorderLevel', isActive: true, updatedAt: new Date() } });

  console.log('Seed completed. Login: admin@urban.com / admin123 (Owner), accounts@urban.com / account123 (Accountant), portal@orchidinteriors.in / portal123 (Portal)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
