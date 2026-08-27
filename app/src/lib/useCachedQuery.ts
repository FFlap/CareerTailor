import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import type { FunctionReference, FunctionReturnType } from "convex/server";

const lastKnown = new Map<string, unknown>();

export function clearQueryCache() {
  lastKnown.clear();
}

export function useCachedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"] | "skip",
): FunctionReturnType<Query> | undefined {
  const live = useQuery(query, args as any);

  if (typeof window === "undefined" || args === "skip") return live;

  const key = `${getFunctionName(query)}:${JSON.stringify(args)}`;
  if (live !== undefined) {
    lastKnown.set(key, live);
    return live;
  }
  return lastKnown.get(key) as FunctionReturnType<Query> | undefined;
}
