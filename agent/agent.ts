import { defineAgent } from "eve";
import { briefingModel } from "@/lib/ai-model";

export default defineAgent({
  model: briefingModel()
});
