"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt = require("bcrypt");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var company, adminRole, customerRole, adminUser, _a, _b, customerContact, _c, _d, vendorContact, product1, product2, oldDate;
        var _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    console.log("Starting Demo Seed...");
                    // Clear db (careful in prod)
                    return [4 /*yield*/, prisma.payments.deleteMany()];
                case 1:
                    // Clear db (careful in prod)
                    _j.sent();
                    return [4 /*yield*/, prisma.invoice_lines.deleteMany()];
                case 2:
                    _j.sent();
                    return [4 /*yield*/, prisma.invoices.deleteMany()];
                case 3:
                    _j.sent();
                    return [4 /*yield*/, prisma.vendor_bill_lines.deleteMany()];
                case 4:
                    _j.sent();
                    return [4 /*yield*/, prisma.vendor_bills.deleteMany()];
                case 5:
                    _j.sent();
                    return [4 /*yield*/, prisma.stock_movements.deleteMany()];
                case 6:
                    _j.sent();
                    return [4 /*yield*/, prisma.products.deleteMany()];
                case 7:
                    _j.sent();
                    return [4 /*yield*/, prisma.contacts.deleteMany()];
                case 8:
                    _j.sent();
                    return [4 /*yield*/, prisma.journal_lines.deleteMany()];
                case 9:
                    _j.sent();
                    return [4 /*yield*/, prisma.journals.deleteMany()];
                case 10:
                    _j.sent();
                    return [4 /*yield*/, prisma.user_roles.deleteMany()];
                case 11:
                    _j.sent();
                    return [4 /*yield*/, prisma.users.deleteMany()];
                case 12:
                    _j.sent();
                    return [4 /*yield*/, prisma.roles.deleteMany()];
                case 13:
                    _j.sent();
                    return [4 /*yield*/, prisma.companies.deleteMany()];
                case 14:
                    _j.sent();
                    return [4 /*yield*/, prisma.companies.create({
                            data: { id: 'comp-demo', name: 'Urban Furniture HQ', baseCurrency: 'USD', updatedAt: new Date() }
                        })];
                case 15:
                    company = _j.sent();
                    return [4 /*yield*/, prisma.roles.create({
                            data: { id: 'role-admin', companyId: company.id, key: 'ADMIN', name: 'Admin', updatedAt: new Date() }
                        })];
                case 16:
                    adminRole = _j.sent();
                    return [4 /*yield*/, prisma.roles.create({
                            data: { id: 'role-customer', companyId: company.id, key: 'PORTAL', name: 'Customer', updatedAt: new Date() }
                        })];
                case 17:
                    customerRole = _j.sent();
                    _b = (_a = prisma.users).create;
                    _e = {};
                    _f = {
                        id: 'user-admin',
                        companyId: company.id,
                        email: 'admin@urban.com'
                    };
                    return [4 /*yield*/, bcrypt.hash('admin123', 10)];
                case 18: return [4 /*yield*/, _b.apply(_a, [(_e.data = (_f.passwordHash = _j.sent(),
                            _f.name = 'Admin User',
                            _f.updatedAt = new Date(),
                            _f.user_roles = { create: { id: 'ur-admin', companyId: company.id, roleId: adminRole.id } },
                            _f),
                            _e)])];
                case 19:
                    adminUser = _j.sent();
                    return [4 /*yield*/, prisma.contacts.create({
                            data: { id: 'contact-cust1', companyId: company.id, name: 'Acme Corp', type: 'CUSTOMER', email: 'acme@example.com', updatedAt: new Date() }
                        })];
                case 20:
                    customerContact = _j.sent();
                    _d = (_c = prisma.users).create;
                    _g = {};
                    _h = {
                        id: 'user-cust1',
                        companyId: company.id,
                        contactId: customerContact.id, // For portal isolation
                        email: 'customer@urban.com'
                    };
                    return [4 /*yield*/, bcrypt.hash('customer123', 10)];
                case 21: return [4 /*yield*/, _d.apply(_c, [(_g.data = (_h.passwordHash = _j.sent(),
                            _h.name = 'Acme Customer',
                            _h.updatedAt = new Date(),
                            _h.user_roles = { create: { id: 'ur-cust', companyId: company.id, roleId: customerRole.id } },
                            _h),
                            _g)])];
                case 22:
                    _j.sent();
                    return [4 /*yield*/, prisma.contacts.create({
                            data: { id: 'contact-vend1', companyId: company.id, name: 'Wood Suppliers Inc', type: 'VENDOR', email: 'wood@suppliers.com', updatedAt: new Date() }
                        })];
                case 23:
                    vendorContact = _j.sent();
                    return [4 /*yield*/, prisma.products.create({
                            data: { id: 'prod-1', companyId: company.id, name: 'Ergonomic Office Chair', sku: 'CHR-001', type: 'GOODS', salePrice: 250, purchasePrice: 100, onHandQty: 50, updatedAt: new Date() }
                        })];
                case 24:
                    product1 = _j.sent();
                    return [4 /*yield*/, prisma.products.create({
                            data: { id: 'prod-2', companyId: company.id, name: 'Oak Executive Desk', sku: 'DSK-001', type: 'GOODS', salePrice: 850, purchasePrice: 300, onHandQty: 5, updatedAt: new Date() }
                        })];
                case 25:
                    product2 = _j.sent();
                    oldDate = new Date();
                    oldDate.setDate(oldDate.getDate() - 15);
                    return [4 /*yield*/, prisma.invoices.create({
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
                            }
                        })];
                case 26:
                    _j.sent();
                    // Create an automation rule
                    return [4 /*yield*/, prisma.automation_rules.create({
                            data: {
                                id: 'auto-1',
                                companyId: company.id,
                                triggerEvent: 'INVOICE_OVERDUE',
                                actionType: 'SEND_EMAIL',
                                condition: 'days_overdue > 0',
                                isActive: true,
                                updatedAt: new Date()
                            }
                        })];
                case 27:
                    // Create an automation rule
                    _j.sent();
                    return [4 /*yield*/, prisma.automation_rules.create({
                            data: {
                                id: 'auto-2',
                                companyId: company.id,
                                triggerEvent: 'LOW_STOCK',
                                actionType: 'CREATE_ACTION_ITEM',
                                isActive: true,
                                updatedAt: new Date()
                            }
                        })];
                case 28:
                    _j.sent();
                    // Create a budget
                    console.log("Demo Seed Complete! Use admin@urban.com / admin123 or customer@urban.com / customer123");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error).finally(function () { return prisma.$disconnect(); });
