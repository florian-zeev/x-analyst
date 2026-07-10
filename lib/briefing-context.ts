import { getLearningContext } from "@/lib/learning";
import type { AnalystProfile } from "@/lib/profile";
import {
  getActiveWatches,
  getRecentWatchChecks,
  type Watch,
  type WatchCheck
} from "@/lib/watches";

export type BriefingContext = {
  profile: AnalystProfile;
  learning: Awaited<ReturnType<typeof getLearningContext>>;
  activeWatches: Watch[];
  recentWatchChecks: WatchCheck[];
};

export async function getBriefingContext(
  profile: AnalystProfile,
  activeWatches?: Watch[]
): Promise<BriefingContext> {
  const watches = activeWatches ?? (await getActiveWatches(profile.userId));
  const [learning, recentWatchChecks] = await Promise.all([
    getLearningContext(profile.userId),
    getRecentWatchChecks(profile.userId, watches)
  ]);

  return {
    profile,
    learning,
    activeWatches: watches,
    recentWatchChecks
  };
}
