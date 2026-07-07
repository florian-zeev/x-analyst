import { defineAgent } from "eve";
import { subagentModel } from "@/lib/ai-model";

export default defineAgent({
  description:
    "Read linked articles and X-native long posts, extracting clean claims, evidence, provenance, and caveats.",
  model: subagentModel()
});
