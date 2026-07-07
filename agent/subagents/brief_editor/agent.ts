import { defineAgent } from "eve";
import { briefingModel } from "@/lib/ai-model";

export default defineAgent({
  description:
    "Write the final concise X Analyst dossier from selected, deduplicated evidence and the reader interest profile.",
  model: briefingModel()
});
