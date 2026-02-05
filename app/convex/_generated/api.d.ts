/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as customTemplates from "../customTemplates.js";
import type * as documents from "../documents.js";
import type * as generation from "../generation.js";
import type * as jobs from "../jobs.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_openrouter from "../lib/openrouter.js";
import type * as lib_openrouterModels from "../lib/openrouterModels.js";
import type * as lib_templates from "../lib/templates.js";
import type * as profiles from "../profiles.js";
import type * as resumeParsing from "../resumeParsing.js";
import type * as roast from "../roast.js";
import type * as settings from "../settings.js";
import type * as stats from "../stats.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  customTemplates: typeof customTemplates;
  documents: typeof documents;
  generation: typeof generation;
  jobs: typeof jobs;
  "lib/auth": typeof lib_auth;
  "lib/openrouter": typeof lib_openrouter;
  "lib/openrouterModels": typeof lib_openrouterModels;
  "lib/templates": typeof lib_templates;
  profiles: typeof profiles;
  resumeParsing: typeof resumeParsing;
  roast: typeof roast;
  settings: typeof settings;
  stats: typeof stats;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
