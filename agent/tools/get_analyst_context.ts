import { defineTool } from "eve/tools";
import { z } from "zod";
import { getLearningContext } from "@/lib/learning";
import { createAdminClient } from "@/lib/supabase/admin";

export default defineTool({
  description:
    "Fetch the stored X Analyst interest profile, source preferences, priority handles, and learning context for a user.",
  inputSchema: z.object({
    email: z.string().email().optional(),
    userId: z.string().uuid().optional()
  }),
  async execute(input) {
    if (!input.email && !input.userId) {
      throw new Error("Provide either email or userId.");
    }

    const admin = createAdminClient();
    let query = admin.from("analyst_profiles").select("*");

    if (input.userId) {
      query = query.eq("user_id", input.userId);
    } else if (input.email) {
      query = query.eq("email", input.email.toLowerCase());
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("No analyst profile found.");
    }

    const profile = {
      userId: data.user_id,
      email: data.email,
      digestEmail: data.digest_email,
      interestProfileMd: data.interest_profile_md,
      xListId: data.x_list_id,
      discoveryQueries: data.discovery_queries,
      priorityHandles: data.priority_handles ?? []
    };
    const learning = await getLearningContext(profile.userId);

    return {
      userId: profile.userId,
      email: profile.email,
      digestEmail: profile.digestEmail,
      interestProfileMd: profile.interestProfileMd,
      xListId: profile.xListId,
      discoveryQueries: profile.discoveryQueries,
      priorityHandles: profile.priorityHandles,
      learning
    };
  }
});
