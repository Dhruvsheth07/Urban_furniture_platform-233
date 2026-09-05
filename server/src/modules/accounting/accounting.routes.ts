import { Router } from "express";
import { getAll, getOne, create, update, remove, listJournals, getJournal, createJournal, reverseJournal } from "./accounting.controller";
import { authenticate, blockPortal } from "../../middleware/auth.middleware";

const router = Router();
router.use(authenticate);
router.use(blockPortal);

// Journals
router.get("/journals", listJournals);
router.get("/journals/:id", getJournal);
router.post("/journals", createJournal);
router.post("/journals/:id/reverse", reverseJournal);

// Chart of accounts
router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
