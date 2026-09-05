import { Router } from "express";
import { getAll, getOne, create, update, remove } from "./payments.controller";
import { authenticate, requireRole } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", requireRole("ACCOUNTANT", "SALES", "PURCHASE"), create);
router.put("/:id", requireRole("ACCOUNTANT"), update);
router.delete("/:id", requireRole("ACCOUNTANT"), remove);

export default router;
