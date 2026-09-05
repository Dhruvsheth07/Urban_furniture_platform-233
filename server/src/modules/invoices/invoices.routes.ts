import { Router } from "express";
import { getAll, getOne, create, update, remove } from "./invoices.controller";
import { downloadPdf } from "./invoices.pdf";
import { authenticate, requireRole } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

// Read: portal customers see their own invoices (scoped in controller); staff see all.
router.get("/", getAll);
router.get("/:id", getOne);
router.get("/:id/pdf", downloadPdf);

// Write: internal roles only (never portal customers).
router.post("/", requireRole("ACCOUNTANT", "SALES"), create);
router.put("/:id", requireRole("ACCOUNTANT", "SALES"), update);
router.delete("/:id", requireRole("ACCOUNTANT"), remove);

export default router;
