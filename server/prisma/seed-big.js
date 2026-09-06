/**
 * BIG SEED — Urban Furniture (INR)
 * Generates:
 *   - 25 furniture products
 *   - 45 customers + 15 vendors
 *   - 300 sales invoices (with line items, payments, accounting journals)
 *   - ~120 vendor bills (with line items, some payments, inventory IN)
 *
 * Run: node prisma/seed-big.js   (server must be built first: npm run build)
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { AccountingService } = require('../dist/services/accounting.service');

const prisma = new PrismaClient();
const companyId = 'comp-demo';
const GST = 18;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const daysAgo   = (d) => new Date(Date.now() - d * 86400000);
const daysAhead = (d) => new Date(Date.now() + d * 86400000);
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randF = (min, max, dec = 0) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));

// ─── WIPE (demo-company-scoped) ─────────────────────────────────────────────
async function wipe() {
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
  await prisma.warehouses.deleteMany(c);
  await prisma.accounts.deleteMany(c);
  await prisma.user_roles.deleteMany(c);
  await prisma.sessions.deleteMany({ where: { users: { companyId } } });
  await prisma.users.deleteMany(c);
  await prisma.role_permissions.deleteMany({ where: { roles: { companyId } } });
  await prisma.roles.deleteMany(c);
  await prisma.contacts.deleteMany(c);
}

// ─── MASTER DATA ─────────────────────────────────────────────────────────────
const PRODUCT_DEFS = [
  { name: 'Executive Teak Desk',        sku: 'DESK-TEK-001', mat: 'Teak',      col: 'Walnut Brown',  sale: 42000, cost: 24000, reorder: 5  },
  { name: 'L-Shape Office Desk',        sku: 'DESK-LSH-002', mat: 'MDF',       col: 'White',         sale: 28000, cost: 16000, reorder: 8  },
  { name: 'Standing Desk Frame',        sku: 'DESK-STD-003', mat: 'Steel',     col: 'Matte Black',   sale: 19500, cost: 11000, reorder: 10 },
  { name: 'Ergonomic Mesh Chair',       sku: 'CHAR-ERG-001', mat: 'Mesh',      col: 'Black',         sale: 15000, cost: 8500,  reorder: 15 },
  { name: 'Executive Leather Chair',    sku: 'CHAR-LEA-002', mat: 'PU Leather',col: 'Dark Brown',    sale: 22000, cost: 13000, reorder: 10 },
  { name: 'Visitor Chair Set (2)',       sku: 'CHAR-VIS-003', mat: 'Fabric',    col: 'Grey',          sale: 8500,  cost: 4800,  reorder: 12 },
  { name: 'Conference Table 10-seater', sku: 'TABL-CON-001', mat: 'Laminate',  col: 'Wenge',         sale: 65000, cost: 38000, reorder: 3  },
  { name: 'Round Coffee Table',         sku: 'TABL-COF-002', mat: 'Glass',     col: 'Clear',         sale: 12000, cost: 6500,  reorder: 10 },
  { name: 'Dining Table 6-seater',      sku: 'TABL-DIN-003', mat: 'Sheesham', col: 'Natural Teak',  sale: 38000, cost: 21000, reorder: 5  },
  { name: '4-Door Wardrobe',            sku: 'WARD-4DR-001', mat: 'Plywood',   col: 'White Oak',     sale: 32000, cost: 18000, reorder: 6  },
  { name: 'Sliding Mirror Wardrobe',    sku: 'WARD-SLI-002', mat: 'Plywood',   col: 'Beige',         sale: 45000, cost: 26000, reorder: 4  },
  { name: 'Bedside Table Pair',         sku: 'BEDS-PAI-001', mat: 'MDF',       col: 'White',         sale: 7500,  cost: 4000,  reorder: 15 },
  { name: 'King Size Bed Frame',        sku: 'BED-KNG-001',  mat: 'Sheesham', col: 'Honey Brown',   sale: 55000, cost: 32000, reorder: 4  },
  { name: 'Queen Size Bed Frame',       sku: 'BED-QUE-002',  mat: 'Teak',      col: 'Walnut',        sale: 42000, cost: 24500, reorder: 5  },
  { name: 'Hydraulic Storage Bed',      sku: 'BED-HYD-003',  mat: 'Plywood',   col: 'Grey Oak',      sale: 38000, cost: 21000, reorder: 6  },
  { name: '3-Seater Sofa',             sku: 'SOFA-3SE-001', mat: 'Fabric',    col: 'Dark Blue',     sale: 28000, cost: 15500, reorder: 8  },
  { name: 'L-Shape Sectional Sofa',    sku: 'SOFA-LSC-002', mat: 'Fabric',    col: 'Light Grey',    sale: 52000, cost: 30000, reorder: 4  },
  { name: 'Recliner Chair',            sku: 'SOFA-REC-003', mat: 'PU Leather',col: 'Burgundy',      sale: 18000, cost: 10000, reorder: 8  },
  { name: '4-Shelf Bookcase',          sku: 'BOOK-4SH-001', mat: 'MDF',       col: 'White',         sale: 8500,  cost: 4500,  reorder: 12 },
  { name: 'TV Unit with Storage',      sku: 'TVUN-001',     mat: 'Plywood',   col: 'Wenge',         sale: 15000, cost: 8500,  reorder: 8  },
  { name: 'Shoe Rack (6-tier)',        sku: 'SHOE-6TR-001', mat: 'Steel',     col: 'Chrome',        sale: 4200,  cost: 2200,  reorder: 20 },
  { name: 'Study Table with Shelves',  sku: 'STDY-SHL-001', mat: 'MDF',       col: 'Oak',           sale: 9500,  cost: 5200,  reorder: 10 },
  { name: 'Outdoor Garden Bench',      sku: 'OUTD-BEN-001', mat: 'Teak',      col: 'Natural',       sale: 14000, cost: 7800,  reorder: 8  },
  { name: 'Bar Stool Set (4)',         sku: 'BARS-SET-001', mat: 'Steel',     col: 'Black',         sale: 11000, cost: 6000,  reorder: 10 },
  { name: 'Folding Dining Chair Set',  sku: 'CHAR-FLD-004', mat: 'Steel',     col: 'Silver',        sale: 6000,  cost: 3200,  reorder: 20 },
];

const CUSTOMER_NAMES = [
  'Orchid Interiors', 'Greenwood Homes', 'Skyline Offices LLP', 'Lotus Hospitality',
  'Odoo Systems Pvt Ltd', 'Prestige Developers', 'Nexus Coworking', 'BluePeak Hotels',
  'Harmony Residences', 'Crown Decor Studio', 'Arjun & Sons Furniture', 'RealSpace India',
  'Zenith Office Solutions', 'Bright Home Décor', 'GreenLeaf Apartments', 'Majestic Interiors',
  'Urban Living Co', 'Sunrise Properties', 'Pinnacle Workspace', 'Pearl Hospitality Group',
  'Saffron Interiors', 'Cascade Living', 'Sterling Homes', 'Metro Office Furnishings',
  'Horizon Hotels', 'Nirvana Décor', 'Royal Nest India', 'Maple Grove Residences',
  'Phoenix Coworking', 'Vista Interior Studio', 'Lotus Garden Homes', 'Elara Furniture Hub',
  'Coastal Stays', 'GrandVista Hotels', 'KSK Interior Design', 'Aspire Living Solutions',
  'Vega Workspaces', 'Serene Homes', 'Indigo Interiors', 'Woodcraft Enterprises',
  'Nova Office Park', 'Magnolia Living', 'Amber Properties', 'TechPark Interiors', 'CityEdge Spaces',
];

const VENDOR_NAMES = [
  'Sagwan Teak Traders', 'Metro Hardware & Fittings', 'ComfortFoam India',
  'Greenply Plywoods', 'Kailash Steel Supplies', 'National Fabric House',
  'Premium MDF Works', 'Sheesham Wood Depot', 'Excel Glass & Mirrors',
  'IndoChrome Metal Works', 'Sunrise Plywood Co', 'Heritage Timber Mart',
  'Mehta Hardware Stores', 'PU Leather Distributors', 'Deluxe Hardware & Hinges',
];

const CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai',
  'Ahmedabad', 'Kolkata', 'Jaipur', 'Surat', 'Lucknow', 'Nagpur',
];
const STATES = {
  Mumbai: 'Maharashtra', Delhi: 'Delhi', Bengaluru: 'Karnataka', Pune: 'Maharashtra',
  Hyderabad: 'Telangana', Chennai: 'Tamil Nadu', Ahmedabad: 'Gujarat', Kolkata: 'West Bengal',
  Jaipur: 'Rajasthan', Surat: 'Gujarat', Lucknow: 'Uttar Pradesh', Nagpur: 'Maharashtra',
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🗑  Wiping existing demo data…');
  await wipe();

  // ── 1. Company (upsert) ──
  await prisma.companies.upsert({
    where: { id: companyId },
    update: {},
    create: {
      id: companyId, name: 'Urban Furniture', legalName: 'Urban Furniture Pvt Ltd',
      gstin: '27AABCU9603R1ZX', baseCurrency: 'INR', email: 'accounts@urbanfurniture.in',
      phone: '+91 98765 00001', city: 'Mumbai', state: 'Maharashtra',
      country: 'IN', pincode: '400001', updatedAt: new Date(),
    },
  });
  console.log('✅ Company ready');

  // ── 2. Roles ──
  const roles = [
    { id: 'role-owner', key: 'OWNER', name: 'Owner', desc: 'Full access' },
    { id: 'role-admin', key: 'ADMIN', name: 'Admin', desc: 'Full access' },
    { id: 'role-acct',  key: 'ACCOUNTANT', name: 'Accountant', desc: 'Finance & reports' },
    { id: 'role-sales', key: 'SALES', name: 'Sales', desc: 'Sales & invoices' },
    { id: 'role-pur',   key: 'PURCHASE', name: 'Purchase', desc: 'Purchase & bills' },
    { id: 'role-inv',   key: 'INVENTORY', name: 'Inventory', desc: 'Warehouse & stock' },
  ];
  for (const r of roles) {
    await prisma.roles.upsert({
      where: { id: r.id }, update: {},
      create: { id: r.id, companyId, key: r.key, name: r.name, description: r.desc, isSystem: true, updatedAt: new Date() },
    });
  }

  // ── 3. Users ──
  const users = [
    { id: 'user-admin', email: 'admin@urban.com',    name: 'Dhruv Sheth',     roleId: 'role-owner', pw: 'admin123' },
    { id: 'user-acct',  email: 'accounts@urban.com', name: 'Priya Mehta',     roleId: 'role-acct',  pw: 'account123' },
    { id: 'user-sales', email: 'sales@urban.com',    name: 'Rohan Kapoor',    roleId: 'role-sales', pw: 'sales123' },
    { id: 'user-pur',   email: 'purchase@urban.com', name: 'Anita Sharma',    roleId: 'role-pur',   pw: 'purchase123' },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.pw, 10);
    await prisma.users.upsert({
      where: { id: u.id }, update: {},
      create: { id: u.id, companyId, email: u.email, name: u.name, passwordHash: hash, isActive: true, updatedAt: new Date() },
    });
    await prisma.user_roles.upsert({
      where: { userId_roleId: { userId: u.id, roleId: u.roleId } }, update: {},
      create: { id: `ur-${u.id}`, companyId, userId: u.id, roleId: u.roleId },
    });
  }
  console.log('✅ Users & roles');

  // ── 4. Chart of accounts ──
  await AccountingService.ensureSystemAccounts(companyId);
  console.log('✅ Accounts');

  // ── 5. Warehouse ──
  const warehouseId = 'wh-main';
  await prisma.warehouses.upsert({
    where: { id: warehouseId }, update: {},
    create: { id: warehouseId, companyId, name: 'Main Warehouse', location: 'Bhiwandi, Maharashtra', isActive: true, updatedAt: new Date() },
  });

  // ── 6. Tax rate ──
  const taxId = 'tax-gst18';
  await prisma.tax_rates.upsert({
    where: { id: taxId }, update: {},
    create: { id: taxId, companyId, name: 'GST 18%', rate: 18, isActive: true, updatedAt: new Date() },
  });

  // ── 7. Products (25) ──
  console.log('⏳ Creating 25 products…');
  const productIds = [];
  for (let i = 0; i < PRODUCT_DEFS.length; i++) {
    const p = PRODUCT_DEFS[i];
    const id = `prod-${String(i + 1).padStart(3, '0')}`;
    productIds.push(id);
    const openQty = rand(20, 80);
    await prisma.products.create({
      data: {
        id, companyId, sku: p.sku, name: p.name, material: p.mat, color: p.col,
        type: 'GOODS', salePrice: p.sale, purchasePrice: p.cost, avgCost: p.cost,
        onHandQty: openQty, openingQty: openQty, reorderLevel: p.reorder,
        trackInventory: true, isActive: true, updatedAt: new Date(),
      },
    });
  }
  console.log(`✅ ${PRODUCT_DEFS.length} products`);

  // ── 8. Customers (45) ──
  console.log('⏳ Creating 45 customers…');
  const customerIds = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const id = `cust-${String(i + 1).padStart(3, '0')}`;
    customerIds.push(id);
    const city = pick(CITIES);
    await prisma.contacts.create({
      data: {
        id, companyId, type: 'CUSTOMER', name: CUSTOMER_NAMES[i],
        email: `billing@${CUSTOMER_NAMES[i].toLowerCase().replace(/[^a-z]/g, '')}.com`,
        phone: `+91 ${rand(7000000000, 9999999999)}`,
        gstin: `${rand(10, 37)}AAAC${String.fromCharCode(rand(65,90))}${rand(1000, 9999)}R1Z${String.fromCharCode(rand(65,90))}`,
        billingLine1: `${rand(1, 999)}, ${pick(['MG Road', 'Station Road', 'Park Street', 'Commercial Ave', 'Ring Road'])}`,
        billingCity: city, billingState: STATES[city], billingPincode: String(rand(100000, 999999)),
        isActive: true, updatedAt: new Date(),
      },
    });
  }
  console.log(`✅ ${CUSTOMER_NAMES.length} customers`);

  // ── 9. Vendors (15) ──
  console.log('⏳ Creating 15 vendors…');
  const vendorIds = [];
  for (let i = 0; i < VENDOR_NAMES.length; i++) {
    const id = `vend-${String(i + 1).padStart(3, '0')}`;
    vendorIds.push(id);
    const city = pick(CITIES);
    await prisma.contacts.create({
      data: {
        id, companyId, type: 'VENDOR', name: VENDOR_NAMES[i],
        email: `supply@${VENDOR_NAMES[i].toLowerCase().replace(/[^a-z]/g, '')}.com`,
        phone: `+91 ${rand(7000000000, 9999999999)}`,
        gstin: `${rand(10, 37)}AABV${String.fromCharCode(rand(65,90))}${rand(1000, 9999)}R1Z${String.fromCharCode(rand(65,90))}`,
        billingLine1: `Plot ${rand(1, 50)}, ${pick(['MIDC', 'Industrial Area', 'Timber Market', 'Trade Zone'])}`,
        billingCity: city, billingState: STATES[city], billingPincode: String(rand(100000, 999999)),
        isActive: true, updatedAt: new Date(),
      },
    });
  }
  console.log(`✅ ${VENDOR_NAMES.length} vendors`);

  // ─── Helper: get account id ──
  async function accId(code) {
    const a = await prisma.accounts.findFirst({ where: { companyId, code } });
    if (!a) throw new Error(`Account ${code} not found`);
    return a.id;
  }
  async function nextJnlNo() {
    const count = await prisma.journals.count({ where: { companyId } });
    return `JNL-${String(count + 1).padStart(5, '0')}`;
  }

  // ── 10. VENDOR BILLS (~120) ──
  console.log('⏳ Creating ~120 vendor bills…');
  const NUM_BILLS = 120;
  for (let i = 0; i < NUM_BILLS; i++) {
    const billNum = `BILL-${String(i + 1).padStart(4, '0')}`;
    const vendorId = pick(vendorIds);
    const daysBack = rand(5, 540); // up to ~1.5 years of history
    const billDate = daysAgo(daysBack);
    const dueDays  = pick([30, 45, 60]);
    const dueDate  = new Date(billDate.getTime() + dueDays * 86400000);

    // 2-4 line items per bill
    const lineCount = rand(2, 4);
    let net = 0, tax = 0;
    const lineData = [];
    for (let j = 0; j < lineCount; j++) {
      const pIdx = rand(0, PRODUCT_DEFS.length - 1);
      const qty  = rand(2, 15);
      const price = PRODUCT_DEFS[pIdx].cost * randF(0.9, 1.1, 2);
      const lineNet = round2(qty * price);
      const lineTax = round2(lineNet * GST / 100);
      net += lineNet;
      tax += lineTax;
      lineData.push({ prodId: productIds[pIdx], qty, price: round2(price), total: lineNet + lineTax });
    }
    net = round2(net); tax = round2(tax);
    const gross = round2(net + tax);

    const bill = await prisma.vendor_bills.create({
      data: {
        id: `bill-${String(i + 1).padStart(4, '0')}`,
        companyId, vendorId, billNumber: billNum,
        date: billDate, dueDate,
        status: 'OPEN', totalAmount: gross, paidAmount: 0,
        notes: `Purchase of furniture components`, updatedAt: new Date(),
        lines: {
          create: lineData.map((l, k) => ({
            id: `bl-${String(i + 1).padStart(4, '0')}-${k}`,
            productId: l.prodId, quantity: l.qty, unitPrice: l.price,
            taxRate: GST, total: l.total,
          })),
        },
      },
    });

    // Inventory IN
    for (const l of lineData) {
      const prod = await prisma.products.findUnique({ where: { id: l.prodId } });
      const oldQty = Number(prod.onHandQty);
      const oldCost = Number(prod.avgCost) || Number(prod.purchasePrice);
      const newQty  = oldQty + l.qty;
      const newAvg  = newQty > 0 ? (oldQty * oldCost + l.qty * l.price) / newQty : l.price;
      await prisma.products.update({
        where: { id: l.prodId },
        data: { onHandQty: newQty, avgCost: round2(newAvg), purchasePrice: l.price, updatedAt: new Date() },
      });
      await prisma.stock_movements.create({
        data: {
          id: `sm-in-${i}-${l.prodId}-${Date.now()}-${rand(1,99999)}`,
          companyId, warehouseId, productId: l.prodId,
          quantity: l.qty, type: 'IN', reference: `BILL:${billNum}`,
          createdAt: billDate,
        },
      });
    }

    // Accounting journal
    await prisma.$transaction(async (tx) => {
      await AccountingService.recordVendorBill(companyId, bill.id, { net, tax }, tx);
    });

    // 60% bills are paid (fully or partially)
    if (Math.random() < 0.60) {
      const isPartial = Math.random() < 0.2;
      const paidAmt = isPartial ? round2(gross * randF(0.3, 0.7, 2)) : gross;
      const payDate = new Date(dueDate.getTime() - rand(0, 10) * 86400000);
      const method  = pick(['BANK_TRANSFER', 'CASH', 'UPI', 'CHEQUE']);

      await prisma.payments.create({
        data: {
          id: `pay-bill-${i}-${Date.now()}`, companyId,
          contactId: vendorId, billId: bill.id,
          amount: paidAmt, method, date: payDate, updatedAt: new Date(),
        },
      });
      await prisma.vendor_bills.update({
        where: { id: bill.id },
        data: {
          paidAmount: paidAmt,
          status: isPartial ? 'PARTIAL' : 'PAID',
          updatedAt: new Date(),
        },
      });
    }
  }
  console.log(`✅ ${NUM_BILLS} vendor bills`);

  // ── 11. SALES INVOICES (300) ──
  console.log('⏳ Creating 300 invoices… (this may take ~2 min)');
  const NUM_INV = 300;
  let invCounter = 1000;

  for (let i = 0; i < NUM_INV; i++) {
    invCounter++;
    const invoiceNumber = `INV-${invCounter}`;
    const customerId    = pick(customerIds);
    const daysBack      = rand(1, 540);
    const invDate       = daysAgo(daysBack);
    const dueDays       = pick([15, 30, 45]);
    const dueDate       = new Date(invDate.getTime() + dueDays * 86400000);

    // 1-4 line items
    const lineCount = rand(1, 4);
    let net = 0, tax = 0;
    const lineData = [];

    for (let j = 0; j < lineCount; j++) {
      const pIdx     = rand(0, PRODUCT_DEFS.length - 1);
      const qty      = rand(1, 6);
      const price    = PRODUCT_DEFS[pIdx].sale * randF(0.95, 1.05, 2);
      const lineNet  = round2(qty * price);
      const lineTax  = round2(lineNet * GST / 100);
      const avgCost  = PRODUCT_DEFS[pIdx].cost;
      net += lineNet;
      tax += lineTax;
      lineData.push({ prodId: productIds[pIdx], qty, price: round2(price), avgCost, total: lineNet + lineTax });
    }
    net = round2(net); tax = round2(tax);
    const gross = round2(net + tax);

    const inv = await prisma.invoices.create({
      data: {
        id: `inv-${String(i + 1).padStart(5, '0')}`,
        companyId, customerId,
        invoiceNumber, date: invDate, dueDate,
        status: 'OPEN', totalAmount: gross, paidAmount: 0,
        notes: pick([null, 'Delivery within 7 days', 'COD terms apply', 'Project installation included', null]),
        updatedAt: new Date(),
        lines: {
          create: lineData.map((l, k) => ({
            id: `invl-${String(i + 1).padStart(5, '0')}-${k}`,
            productId: l.prodId, quantity: l.qty, unitPrice: l.price,
            taxRate: GST, total: l.total,
          })),
        },
      },
    });

    // Inventory OUT
    let cogs = 0;
    for (const l of lineData) {
      const prod = await prisma.products.findUnique({ where: { id: l.prodId } });
      if (prod && prod.trackInventory) {
        cogs += Number(prod.avgCost) * l.qty;
        await prisma.products.update({
          where: { id: l.prodId },
          data: { onHandQty: { decrement: l.qty }, updatedAt: new Date() },
        });
        await prisma.stock_movements.create({
          data: {
            id: `sm-out-${i}-${l.prodId}-${Date.now()}-${rand(1,99999)}`,
            companyId, warehouseId, productId: l.prodId,
            quantity: -l.qty, type: 'OUT', reference: `INV:${invoiceNumber}`,
            createdAt: invDate,
          },
        });
      }
    }
    cogs = round2(cogs);

    // Accounting journal for the sale
    await prisma.$transaction(async (tx) => {
      await AccountingService.recordSaleInvoice(companyId, inv.id, { net, tax, cogs }, tx);
    });

    // Payment status — use realistic distribution
    const rand100 = Math.random() * 100;
    let paidAmt = 0;
    let newStatus = 'OPEN';

    if (rand100 < 40) {
      // 40% PAID fully
      paidAmt = gross;
      newStatus = 'PAID';
    } else if (rand100 < 55) {
      // 15% PARTIAL
      paidAmt = round2(gross * randF(0.2, 0.8, 2));
      newStatus = 'PARTIAL';
    }
    // remaining 45% stay OPEN (some will be overdue based on dueDate)

    if (paidAmt > 0) {
      const payDate = new Date(Math.min(dueDate.getTime() + rand(-5, 15) * 86400000, Date.now()));
      await prisma.payments.create({
        data: {
          id: `pay-inv-${i}-${Date.now()}`, companyId,
          contactId: customerId, invoiceId: inv.id,
          amount: paidAmt, method: pick(['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH']),
          date: payDate, updatedAt: new Date(),
        },
      });
      await prisma.invoices.update({
        where: { id: inv.id },
        data: { paidAmount: paidAmt, status: newStatus, updatedAt: new Date() },
      });
    }

    if ((i + 1) % 50 === 0) console.log(`  → ${i + 1} / ${NUM_INV} invoices done`);
  }

  console.log(`✅ ${NUM_INV} invoices`);
  console.log('\n🎉 Big seed complete!\n');
  console.log('  Products  :', PRODUCT_DEFS.length);
  console.log('  Customers :', CUSTOMER_NAMES.length);
  console.log('  Vendors   :', VENDOR_NAMES.length);
  console.log('  Invoices  :', NUM_INV);
  console.log('  Bills     :', NUM_BILLS);
  console.log('\nLogin → admin@urban.com / admin123');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
