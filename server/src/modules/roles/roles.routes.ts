import { Router } from "express";
import { getAll, getOne, create, update, remove } from "./roles.controller";
import { authenticate, blockPortal, requireRole } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);
router.use(blockPortal);

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", requireRole(), create);
router.put("/:id", requireRole(), update);
router.delete("/:id", requireRole(), remove);

export default router;
