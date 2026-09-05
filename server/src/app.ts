import express, { Express } from 'express';
import cors from 'cors';
import { auditLog } from './middleware/audit.middleware';

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(auditLog);

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import rolesRoutes from './modules/roles/roles.routes';
import contactsRoutes from './modules/contacts/contacts.routes';
import productsRoutes from './modules/products/products.routes';
import warehousesRoutes from './modules/warehouses/warehouses.routes';
import accountingRoutes from './modules/accounting/accounting.routes';
import auditRoutes from './modules/audit/audit.routes';
import salesOrdersRoutes from './modules/salesOrders/salesOrders.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import purchaseOrdersRoutes from './modules/purchaseOrders/purchaseOrders.routes';
import vendorBillsRoutes from './modules/vendorBills/vendorBills.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import stockMovementsRoutes from './modules/stockMovements/stockMovements.routes';
import reportsRoutes from './modules/reports/reports.routes';
import aiRoutes from './modules/ai/ai.routes';
import intelligenceRoutes from './modules/intelligence/intelligence.routes';
import automationRoutes from './modules/automation/automation.routes';

// Routes will be added here
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/sales-orders', salesOrdersRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/vendor-bills', vendorBillsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/stock-movements', stockMovementsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/automation', automationRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
