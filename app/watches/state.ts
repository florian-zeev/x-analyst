export type WatchActionState = {
  type: "idle" | "success" | "error" | "limit";
  message: string;
  watchId?: string;
};

export const initialWatchActionState: WatchActionState = {
  type: "idle",
  message: ""
};
