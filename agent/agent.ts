import { defineAgent } from "eve";
import { briefingModel } from "@/lib/ai-model";
import { generatedDailyBriefSchema } from "@/lib/brief";

export default defineAgent({
  model: briefingModel(),
  outputSchema: generatedDailyBriefSchema
});
