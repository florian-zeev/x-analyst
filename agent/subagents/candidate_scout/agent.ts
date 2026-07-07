import { defineAgent } from "eve";
import { webSubagentModel } from "@/lib/ai-model";

export default defineAgent({
  description:
    "Scan X and open-web candidate material broadly, identify high-signal items, and suppress obvious repeats before deeper analysis.",
  model: webSubagentModel()
});
