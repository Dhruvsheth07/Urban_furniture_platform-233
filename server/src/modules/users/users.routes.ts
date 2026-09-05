import { Router } from "express";
import { getAll, getOne, create, update, remove } from "./users.controller";
import { authenticate, blockPortal, requireRole } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);
router.use(blockPortal);
router.use(requireRole()); // OWNER/ADMIN only — user administration

router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
