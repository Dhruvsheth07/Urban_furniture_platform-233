import { Router } from "express";
import { getAll, getOne, create, update, remove } from "./audit.controller";
import { authenticate, blockPortal, requireRole } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);
router.use(blockPortal);
router.use(requireRole("ACCOUNTANT")); // audit trail: OWNER/ADMIN/ACCOUNTANT

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
