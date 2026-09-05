import { Router } from "express";
import {
  getProfitAndLoss,
  getBalanceSheet,
  getTrialBalance,
  getGeneralLedger,
  getAccountsReceivable,
  getAccountsPayable,
  getCashFlow,
  getDashboard,
} from "./reports.controller";
import { exportReport } from "./reports.export";
import { authenticate, blockPortal } from "../../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
router.use(blockPortal);

router.get("/pl", getProfitAndLoss);
router.get("/balance-sheet", getBalanceSheet);
router.get("/trial-balance", getTrialBalance);
router.get("/general-ledger", getGeneralLedger);
router.get("/ar", getAccountsReceivable);
router.get("/ap", getAccountsPayable);
router.get("/cash-flow", getCashFlow);
router.get("/dashboard", getDashboard);
router.get("/export", exportReport);

export default router;
