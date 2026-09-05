import { Router } from "express";
import { getAll, getOne, create, update, remove, convertToBill } from "./purchaseOrders.controller";
import { authenticate, blockPortal } from "../../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
router.use(blockPortal);

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", create);
router.post("/:id/bill", convertToBill);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
