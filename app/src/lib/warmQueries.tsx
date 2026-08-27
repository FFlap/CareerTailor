import { useAuth } from "@clerk/tanstack-react-start";
import { Authenticated, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

import { api } from "@/lib/convex";
import { clearQueryCache } from "@/lib/useCachedQuery";

export const TZ_OFFSET_MINUTES = new Date().getTimezoneOffset();

export const STATS_ARGS = { weeks: 12, tzOffsetMinutes: TZ_OFFSET_MINUTES };
export const JOBS_ARGS = { limit: 100 };
export const DOCUMENTS_ARGS = { limit: 100 };
export const REVIEWS_ARGS = { limit: 100 };
export const NO_ARGS = {};

function WarmQueries() {
  useQuery(api.stats.getMyStatistics, STATS_ARGS);
  useQuery(api.jobs.listMyJobs, JOBS_ARGS);
  useQuery(api.documents.listMyRecentDocuments, DOCUMENTS_ARGS);
  useQuery(api.documents.listMyFavoriteDocuments, NO_ARGS);
  useQuery(api.reviews.listMyReviews, REVIEWS_ARGS);
  useQuery(api.reviews.listMyFavoriteReviews, NO_ARGS);
  useQuery(api.profiles.myProfile, NO_ARGS);
  useQuery(api.settings.mySettings, NO_ARGS);
  useQuery(api.customTemplates.listMyTemplates, NO_ARGS);
  return null;
}

function ForgetCachedQueriesOnUserChange() {
  const { userId } = useAuth();
  const seen = useRef(userId);

  useEffect(() => {
    if (seen.current === userId) return;
    seen.current = userId;
    clearQueryCache();
  }, [userId]);

  return null;
}

export function WarmWorkspaceData() {
  return (
    <>
      <ForgetCachedQueriesOnUserChange />
      <Authenticated>
        <WarmQueries />
      </Authenticated>
    </>
  );
}
