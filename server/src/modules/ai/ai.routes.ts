import { Router } from "express";
import multer from "multer";
import { parseSupplierBill, askBusiness } from "./ai.controller";
import { authenticate, blockPortal } from "../../middleware/auth.middleware";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticate);
router.use(blockPortal);

router.post("/parse-bill", upload.single("bill"), parseSupplierBill);
router.post("/ask", askBusiness);

export default router;
