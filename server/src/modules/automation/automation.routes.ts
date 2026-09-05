import { Router } from "express";
import { runAutomations, listRules, listRuns, toggleRule } from "./automation.controller";
import { authenticate, blockPortal } from "../../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
router.use(blockPortal);

router.get("/rules", listRules);
router.patch("/rules/:id/toggle", toggleRule);
router.get("/runs", listRuns);
router.post("/run", runAutomations);

export default router;
