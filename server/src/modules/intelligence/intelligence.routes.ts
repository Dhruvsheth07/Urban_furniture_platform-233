import { Router } from "express";
import {
  getSmartReorder,
  getCustomerRisk,
  getActionCenter,
  getBusinessHealth,
  getAnomalies,
  getCashFlowForecast,
  previewEmail,
  sendActionEmail,
} from "./intelligence.controller";
import { authenticate, blockPortal } from "../../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
router.use(blockPortal);

router.get("/reorder", getSmartReorder);
router.get("/risk", getCustomerRisk);
router.get("/actions", getActionCenter);
router.get("/health", getBusinessHealth);
router.get("/anomalies", getAnomalies);
router.get("/forecast", getCashFlowForecast);
router.get("/email-preview", previewEmail);
router.post("/send-email", sendActionEmail);

export default router;
