/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as approvals from "../approvals.js";
import type * as auth from "../auth.js";
import type * as authFunctions from "../authFunctions.js";
import type * as clearData from "../clearData.js";
import type * as clerk from "../clerk.js";
import type * as clerkSync from "../clerkSync.js";
import type * as clients from "../clients.js";
import type * as collaboration from "../collaboration.js";
import type * as content_afsCompilationEngagementLetterBody from "../content/afsCompilationEngagementLetterBody.js";
import type * as content_auditEngagementLetterBody from "../content/auditEngagementLetterBody.js";
import type * as content_legalPractitionersEngagementLetterBody from "../content/legalPractitionersEngagementLetterBody.js";
import type * as content_propertyPractitionersEngagementLetterBody from "../content/propertyPractitionersEngagementLetterBody.js";
import type * as content_reviewEngagementLetterBody from "../content/reviewEngagementLetterBody.js";
import type * as dashboard from "../dashboard.js";
import type * as documents from "../documents.js";
import type * as email from "../email.js";
import type * as emailHelpers from "../emailHelpers.js";
import type * as emailScheduling from "../emailScheduling.js";
import type * as engagementLetters from "../engagementLetters.js";
import type * as firms from "../firms.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as internal_ from "../internal.js";
import type * as lib_afsLetterLegacy from "../lib/afsLetterLegacy.js";
import type * as lib_auditLog from "../lib/auditLog.js";
import type * as lib_cashFlowDefaults from "../lib/cashFlowDefaults.js";
import type * as lib_letterText from "../lib/letterText.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as lineItems from "../lineItems.js";
import type * as notifications from "../notifications.js";
import type * as packageTemplates from "../packageTemplates.js";
import type * as pdfGeneration from "../pdfGeneration.js";
import type * as pricing from "../pricing.js";
import type * as pricingTool from "../pricingTool.js";
import type * as principals from "../principals.js";
import type * as proposalAccept from "../proposalAccept.js";
import type * as proposals from "../proposals.js";
import type * as search from "../search.js";
import type * as seedTemplates from "../seedTemplates.js";
import type * as services from "../services.js";
import type * as signatures from "../signatures.js";
import type * as storage from "../storage.js";
import type * as stripe from "../stripe.js";
import type * as stripeWebhook from "../stripeWebhook.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";
import type * as workPlanning from "../workPlanning.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  approvals: typeof approvals;
  auth: typeof auth;
  authFunctions: typeof authFunctions;
  clearData: typeof clearData;
  clerk: typeof clerk;
  clerkSync: typeof clerkSync;
  clients: typeof clients;
  collaboration: typeof collaboration;
  "content/afsCompilationEngagementLetterBody": typeof content_afsCompilationEngagementLetterBody;
  "content/auditEngagementLetterBody": typeof content_auditEngagementLetterBody;
  "content/legalPractitionersEngagementLetterBody": typeof content_legalPractitionersEngagementLetterBody;
  "content/propertyPractitionersEngagementLetterBody": typeof content_propertyPractitionersEngagementLetterBody;
  "content/reviewEngagementLetterBody": typeof content_reviewEngagementLetterBody;
  dashboard: typeof dashboard;
  documents: typeof documents;
  email: typeof email;
  emailHelpers: typeof emailHelpers;
  emailScheduling: typeof emailScheduling;
  engagementLetters: typeof engagementLetters;
  firms: typeof firms;
  http: typeof http;
  integrations: typeof integrations;
  internal: typeof internal_;
  "lib/afsLetterLegacy": typeof lib_afsLetterLegacy;
  "lib/auditLog": typeof lib_auditLog;
  "lib/cashFlowDefaults": typeof lib_cashFlowDefaults;
  "lib/letterText": typeof lib_letterText;
  "lib/permissions": typeof lib_permissions;
  "lib/rateLimiter": typeof lib_rateLimiter;
  lineItems: typeof lineItems;
  notifications: typeof notifications;
  packageTemplates: typeof packageTemplates;
  pdfGeneration: typeof pdfGeneration;
  pricing: typeof pricing;
  pricingTool: typeof pricingTool;
  principals: typeof principals;
  proposalAccept: typeof proposalAccept;
  proposals: typeof proposals;
  search: typeof search;
  seedTemplates: typeof seedTemplates;
  services: typeof services;
  signatures: typeof signatures;
  storage: typeof storage;
  stripe: typeof stripe;
  stripeWebhook: typeof stripeWebhook;
  templates: typeof templates;
  users: typeof users;
  workPlanning: typeof workPlanning;
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
