import { defineAgent } from "eve";
import { briefingModel } from "@/lib/ai-model";

export default defineAgent({
  description:
    "Group related candidates, identify duplicates and near-duplicates, and choose the most canonical source for each story.",
  model: briefingModel()
});
