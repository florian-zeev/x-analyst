import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_WATCH_QUERY_LENGTH,
  normalizeWatchQuery,
  resolveWatchQueryQuality,
  watchCoversFollowup,
  watchQueries
} from "../lib/watch-helpers.ts";
import { interleavePosts, mergePosts, type XPost } from "../lib/x.ts";

test("normalizes a compact X query", () => {
  assert.equal(
    normalizeWatchQuery("  agent\n provenance\t rollback  "),
    "agent\nprovenance rollback"
  );
  assert.deepEqual(watchQueries("agent\nprovenance rollback"), [
    "agent",
    "provenance rollback"
  ]);
  assert.throws(() => normalizeWatchQuery("\n\t"), /cannot be empty/);
  assert.throws(
    () => normalizeWatchQuery("x".repeat(MAX_WATCH_QUERY_LENGTH + 1)),
    /characters or fewer/
  );
  assert.throws(
    () => normalizeWatchQuery("one\ntwo\nthree\nfour"),
    /at most 3 searches/
  );
});

test("only treats an exact watch contract as covered", () => {
  const watch = {
    title: "Agent provenance and replay",
    objective: "Track durable evidence and replay."
  };
  assert.equal(
    watchCoversFollowup(watch, {
      watchTitle: "Agent provenance and replay",
      watchObjective: "Track durable evidence and replay."
    }),
    true
  );
  assert.equal(
    watchCoversFollowup(watch, {
      watchTitle: "Model routing",
      watchObjective: "Track control-plane infrastructure."
    }),
    false
  );
});

test("rejects a sample set with matches but no relevant posts as noisy", () => {
  assert.equal(resolveWatchQueryQuality("useful", 10, 0), "noisy");
  assert.equal(resolveWatchQueryQuality("useful", 10, 2), "noisy");
  assert.equal(resolveWatchQueryQuality("too_narrow", 0, 0), "too_narrow");
  assert.equal(resolveWatchQueryQuality("useful", 10, 3), "useful");
});

test("unions source and watch provenance for duplicate X posts", () => {
  const merged = mergePosts([
    post("1", ["list"], []),
    post("1", ["watch:a"], ["a"]),
    post("1", ["watch:b"], ["b"])
  ]);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0]?.sourceIds, ["list", "watch:a", "watch:b"]);
  assert.deepEqual(merged[0]?.watchIds, ["a", "b"]);
});

test("reserves capacity for each active watch", () => {
  const posts = [
    ...Array.from({ length: 40 }, (_, index) =>
      post(`list-${index}`, ["list"], [])
    ),
    ...Array.from({ length: 35 }, (_, index) =>
      post(`discovery-${index}`, ["discovery:0"], [])
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      post(`watch-a-${index}`, ["watch:a"], ["a"])
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      post(`watch-b-${index}`, ["watch:b"], ["b"])
    )
  ];
  const selected = interleavePosts(posts, ["a", "b"]);

  assert.equal(selected.length, 80);
  assert.equal(selected.filter((item) => item.watchIds.includes("a")).length, 5);
  assert.equal(selected.filter((item) => item.watchIds.includes("b")).length, 5);
});

function post(id: string, sourceIds: string[], watchIds: string[]): XPost {
  return {
    id,
    text: id,
    urls: [],
    source: sourceIds[0] ?? "unknown",
    sourceIds,
    watchIds
  };
}
