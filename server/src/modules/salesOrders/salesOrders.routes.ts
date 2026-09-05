import { Router } from "express";
import { getAll, getOne, create, update, remove, convertToInvoice } from "./salesOrders.controller";
import { authenticate, blockPortal } from "../../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
router.use(blockPortal);

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", create);
router.post("/:id/invoice", convertToInvoice);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
