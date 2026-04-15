import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Constants for login attempt lockout
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// System uses Rands (ZAR) only
const CURRENCY_ZAR = "ZAR";

/**
 * Register a new firm with the first user as owner.
 * Creates both firm and user records in a single transaction.
 */
export const registerFirm = mutation({
  args: {
    firmName: v.string(),
    email: v.string(),
    password: v.string(),
    userName: v.string(),
    jurisdiction: v.optional(
      v.union(
        v.literal("US"),
        v.literal("UK"),
        v.literal("CA"),
        v.literal("AU"),
        v.literal("NZ"),
        v.literal("ZA")
      )
    ),
  },
  returns: v.object({
    firmId: v.id("firms"),
    userId: v.id("users"),
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if email is already registered
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();

    if (existingUser) {
      return {
        firmId: "" as any,
        userId: "" as any,
        success: false,
        error: "Email already registered",
      };
    }

    const jurisdiction = args.jurisdiction || "ZA";

    // Create the firm (Rands only)
    const firmId = await ctx.db.insert("firms", {
      name: args.firmName,
      brandColors: {
        primary: "#5DBEB4", // Default teal
        secondary: "#4A90E2", // Default indigo
      },
      billingEmail: args.email.toLowerCase(),
      subscriptionStatus: "trial",
      subscriptionPlan: "starter",
      jurisdiction,
      currency: CURRENCY_ZAR,
      trialEndsAt: now + 14 * 24 * 60 * 60 * 1000, // 14-day trial
      createdAt: now,
      updatedAt: now,
    });

    // Hash the password (simple hash for now - in production use bcrypt via action)
    // Note: For production, implement proper password hashing via an action
    const passwordHash = await simpleHash(args.password);

    // Create the first user as owner
    const userId = await ctx.db.insert("users", {
      firmId,
      email: args.email.toLowerCase(),
      name: args.userName,
      role: "owner",
      lastActiveAt: now,
      createdAt: now,
      passwordHash,
      loginAttempts: 0,
    });

    return {
      firmId,
      userId,
      success: true,
    };
  },
});

/**
 * Login with email and password.
 * Implements 5-attempt lockout for security.
 */
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id("users")),
    firmId: v.optional(v.id("firms")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const email = args.email.toLowerCase();

    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!user) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutesRemaining = Math.ceil((user.lockedUntil - now) / 60000);
      return {
        success: false,
        error: `Account locked. Try again in ${minutesRemaining} minutes.`,
      };
    }

    // Reset lockout if expired
    if (user.lockedUntil && user.lockedUntil <= now) {
      await ctx.db.patch(user._id, {
        loginAttempts: 0,
        lockedUntil: undefined,
      });
    }

    // Verify password
    const passwordValid = await verifyPassword(args.password, user.passwordHash || "");

    if (!passwordValid) {
      // Increment failed attempts
      const attempts = (user.loginAttempts || 0) + 1;

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        // Lock the account
        await ctx.db.patch(user._id, {
          loginAttempts: attempts,
          lastLoginAttempt: now,
          lockedUntil: now + LOCKOUT_DURATION_MS,
        });
        return {
          success: false,
          error: `Too many failed attempts. Account locked for 15 minutes.`,
        };
      }

      await ctx.db.patch(user._id, {
        loginAttempts: attempts,
        lastLoginAttempt: now,
      });

      return {
        success: false,
        error: `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - attempts} attempts remaining.`,
      };
    }

    // Successful login - reset attempts and update lastActiveAt
    await ctx.db.patch(user._id, {
      loginAttempts: 0,
      lastLoginAttempt: undefined,
      lockedUntil: undefined,
      lastActiveAt: now,
    });

    return {
      success: true,
      userId: user._id,
      firmId: user.firmId,
    };
  },
});

/**
 * Get current user profile with firm data.
 */
export const getCurrentUser = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      user: v.object({
        _id: v.id("users"),
        email: v.string(),
        name: v.string(),
        role: v.string(),
        avatar: v.optional(v.string()),
        lastActiveAt: v.number(),
        createdAt: v.number(),
      }),
      firm: v.object({
        _id: v.id("firms"),
        name: v.string(),
        logo: v.optional(v.id("_storage")),
        brandColors: v.object({
          primary: v.string(),
          secondary: v.string(),
        }),
        jurisdiction: v.string(),
        currency: v.string(),
        subscriptionStatus: v.string(),
        subscriptionPlan: v.string(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const firm = await ctx.db.get(user.firmId);
    if (!firm) return null;

    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
      },
      firm: {
        _id: firm._id,
        name: firm.name,
        logo: firm.logo,
        brandColors: firm.brandColors,
        jurisdiction: firm.jurisdiction,
        currency: firm.currency,
        subscriptionStatus: firm.subscriptionStatus,
        subscriptionPlan: firm.subscriptionPlan,
      },
    };
  },
});

/**
 * Update user's last active timestamp.
 */
export const updateLastActive = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastActiveAt: Date.now(),
    });
    return null;
  },
});

// Simple hash function (for development - use bcrypt in production via action)
async function simpleHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "proposalpro_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify password against hash
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await simpleHash(password);
  return passwordHash === hash;
}

/**
 * Generate upload URL for firm logo (max 2MB PNG/SVG).
 */
export const generateLogoUploadUrl = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get current user's firm (for Settings and app config).
 */
export const getFirmForUser = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("firms"),
      name: v.string(),
      billingEmail: v.string(),
      jurisdiction: v.string(),
      currency: v.string(),
      brandColors: v.object({ primary: v.string(), secondary: v.string() }),
      logo: v.optional(v.id("_storage")),
      proposalNumberPrefix: v.optional(v.string()),
      defaultProposalValidityDays: v.optional(v.number()),
      currentProposalNumber: v.optional(v.number()),
      showProposalVersionNumbers: v.optional(v.boolean()),
      requireApprovalBeforeSend: v.optional(v.boolean()),
      vatRegistered: v.optional(v.boolean()),
      vatNumber: v.optional(v.string()),
      appLanguage: v.optional(v.string()),
      landingPagePreference: v.optional(
        v.union(v.literal("dashboard"), v.literal("create-proposal"))
      ),
      headingsFont: v.optional(v.string()),
      generalTextFont: v.optional(v.string()),
      logoProposalHeader: v.optional(v.id("_storage")),
      logoCreateProposalPage: v.optional(v.id("_storage")),
      bannerImage: v.optional(v.id("_storage")),
      useDifferentLogoProposalHeader: v.optional(v.boolean()),
      useDifferentLogoCreateProposalPage: v.optional(v.boolean()),
      subscriptionPlan: v.optional(v.string()),
      subscriptionStatus: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      stripeSubscriptionId: v.optional(v.string()),
      proposalBuilderDocumentTypes: v.optional(v.array(v.string())),
      proposalBuilderEnableQuote: v.optional(v.boolean()),
      proposalBuilderRequiredSteps: v.optional(v.array(v.string())),
      proposalBuilderDefaultIntro: v.optional(v.string()),
      proposalBuilderDefaultTerms: v.optional(v.string()),
      packageTemplateOptions: v.optional(v.array(v.string())),
      packageDocumentsOptions: v.optional(v.array(v.string())),
      pdfFooterText: v.optional(v.string()),
      pdfFooterAddress: v.optional(v.string()),
      pdfDisclaimer: v.optional(v.string()),
      pdfHeaderTitleStyle: v.optional(v.string()),
      pdfSignOffBlock: v.optional(v.string()),
      pdfBankingDetails: v.optional(v.string()),
      pdfCoverImage: v.optional(v.id("_storage")),
      pdfFooterImage: v.optional(v.id("_storage")),
      pdfLastPageImage: v.optional(v.id("_storage")),
      letterheadDirectorsList: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const firm = await ctx.db.get(user.firmId);
    if (!firm) return null;
    return {
      _id: firm._id,
      name: firm.name,
      billingEmail: firm.billingEmail,
      jurisdiction: firm.jurisdiction,
      currency: firm.currency,
      brandColors: firm.brandColors,
      logo: firm.logo,
      proposalNumberPrefix: firm.proposalNumberPrefix,
      defaultProposalValidityDays: firm.defaultProposalValidityDays,
      currentProposalNumber: firm.currentProposalNumber,
      showProposalVersionNumbers: firm.showProposalVersionNumbers,
      requireApprovalBeforeSend: firm.requireApprovalBeforeSend,
      vatRegistered: firm.vatRegistered,
      vatNumber: firm.vatNumber,
      appLanguage: firm.appLanguage,
      landingPagePreference: firm.landingPagePreference,
      headingsFont: firm.headingsFont,
      generalTextFont: firm.generalTextFont,
      logoProposalHeader: firm.logoProposalHeader,
      logoCreateProposalPage: firm.logoCreateProposalPage,
      bannerImage: firm.bannerImage,
      useDifferentLogoProposalHeader: firm.useDifferentLogoProposalHeader,
      useDifferentLogoCreateProposalPage: firm.useDifferentLogoCreateProposalPage,
      subscriptionPlan: firm.subscriptionPlan,
      subscriptionStatus: firm.subscriptionStatus,
      stripeCustomerId: firm.stripeCustomerId,
      stripeSubscriptionId: firm.stripeSubscriptionId,
      proposalBuilderDocumentTypes: firm.proposalBuilderDocumentTypes,
      proposalBuilderEnableQuote: firm.proposalBuilderEnableQuote,
      proposalBuilderRequiredSteps: firm.proposalBuilderRequiredSteps,
      proposalBuilderDefaultIntro: firm.proposalBuilderDefaultIntro,
      proposalBuilderDefaultTerms: firm.proposalBuilderDefaultTerms,
      packageTemplateOptions: firm.packageTemplateOptions,
      packageDocumentsOptions: firm.packageDocumentsOptions,
      pdfFooterText: firm.pdfFooterText,
      pdfFooterAddress: firm.pdfFooterAddress,
      pdfDisclaimer: firm.pdfDisclaimer,
      pdfHeaderTitleStyle: firm.pdfHeaderTitleStyle,
      pdfSignOffBlock: firm.pdfSignOffBlock,
      pdfBankingDetails: firm.pdfBankingDetails,
      pdfCoverImage: firm.pdfCoverImage,
      pdfFooterImage: firm.pdfFooterImage,
      pdfLastPageImage: firm.pdfLastPageImage,
      letterheadDirectorsList: firm.letterheadDirectorsList,
    };
  },
});

/**
 * Get firm package dropdown options only (for Create Package modal).
 */
export const getFirmPackageOptions = query({
  args: { userId: v.id("users") },
  returns: v.object({
    packageTemplateOptions: v.array(v.string()),
    packageDocumentsOptions: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const firm = await ctx.db.get(user.firmId);
    if (!firm) throw new Error("Firm not found");
    const DEFAULT_TEMPLATES = [
      "New Client",
      "Virtual: New Client",
      "Existing Client",
      "Virtual: Existing Client",
      "GLOSS Review™",
      "Additional Services - Mid Year",
    ];
    const DEFAULT_DOCUMENTS = ["Proposal & Letter of Engagement", "Proposal"];
    return {
      packageTemplateOptions: firm.packageTemplateOptions?.length
        ? firm.packageTemplateOptions
        : DEFAULT_TEMPLATES,
      packageDocumentsOptions: firm.packageDocumentsOptions?.length
        ? firm.packageDocumentsOptions
        : DEFAULT_DOCUMENTS,
    };
  },
});

/**
 * Update firm details (onboarding + Settings: Account, Proposals, Pricing, Workflow).
 */
export const updateFirm = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    jurisdiction: v.optional(
      v.union(
        v.literal("US"),
        v.literal("UK"),
        v.literal("CA"),
        v.literal("AU"),
        v.literal("NZ"),
        v.literal("ZA")
      )
    ),
    currency: v.optional(v.string()),
    brandColors: v.optional(
      v.object({
        primary: v.string(),
        secondary: v.string(),
      })
    ),
    logo: v.optional(v.id("_storage")),
    proposalNumberPrefix: v.optional(v.string()),
    defaultProposalValidityDays: v.optional(v.number()),
    currentProposalNumber: v.optional(v.number()),
    showProposalVersionNumbers: v.optional(v.boolean()),
    requireApprovalBeforeSend: v.optional(v.boolean()),
    vatRegistered: v.optional(v.boolean()),
    vatNumber: v.optional(v.string()),
    appLanguage: v.optional(v.string()),
    landingPagePreference: v.optional(
      v.union(v.literal("dashboard"), v.literal("create-proposal"))
    ),
    headingsFont: v.optional(v.string()),
    generalTextFont: v.optional(v.string()),
    logoProposalHeader: v.optional(v.id("_storage")),
    logoCreateProposalPage: v.optional(v.id("_storage")),
    bannerImage: v.optional(v.id("_storage")),
    useDifferentLogoProposalHeader: v.optional(v.boolean()),
    useDifferentLogoCreateProposalPage: v.optional(v.boolean()),
    subscriptionPlan: v.optional(
      v.union(
        v.literal("starter"),
        v.literal("professional"),
        v.literal("enterprise")
      )
    ),
    subscriptionStatus: v.optional(
      v.union(
        v.literal("trial"),
        v.literal("active"),
        v.literal("past_due"),
        v.literal("cancelled")
      )
    ),
    proposalBuilderDocumentTypes: v.optional(v.array(v.string())),
    proposalBuilderEnableQuote: v.optional(v.boolean()),
    proposalBuilderRequiredSteps: v.optional(v.array(v.string())),
    proposalBuilderDefaultIntro: v.optional(v.string()),
    proposalBuilderDefaultTerms: v.optional(v.string()),
    packageTemplateOptions: v.optional(v.array(v.string())),
    packageDocumentsOptions: v.optional(v.array(v.string())),
    pdfFooterText: v.optional(v.string()),
    pdfFooterAddress: v.optional(v.string()),
    pdfDisclaimer: v.optional(v.string()),
    pdfHeaderTitleStyle: v.optional(v.string()),
    pdfSignOffBlock: v.optional(v.string()),
    pdfBankingDetails: v.optional(v.string()),
    pdfCoverImage: v.optional(v.id("_storage")),
    pdfFooterImage: v.optional(v.id("_storage")),
    pdfLastPageImage: v.optional(v.id("_storage")),
    letterheadDirectorsList: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const updates: Record<string, unknown> = { updatedAt: now };
    if (args.name !== undefined) updates.name = args.name;
    if (args.billingEmail !== undefined) updates.billingEmail = args.billingEmail;
    if (args.jurisdiction !== undefined) updates.jurisdiction = args.jurisdiction;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.brandColors !== undefined) updates.brandColors = args.brandColors;
    if (args.logo !== undefined) {
      updates.logo = args.logo;
      const resolvedUrl = await ctx.storage.getUrl(args.logo);
      if (resolvedUrl) updates.logoUrl = resolvedUrl;
    }
    if (args.proposalNumberPrefix !== undefined)
      updates.proposalNumberPrefix = args.proposalNumberPrefix;
    if (args.defaultProposalValidityDays !== undefined)
      updates.defaultProposalValidityDays = args.defaultProposalValidityDays;
    if (args.currentProposalNumber !== undefined)
      updates.currentProposalNumber = args.currentProposalNumber;
    if (args.showProposalVersionNumbers !== undefined)
      updates.showProposalVersionNumbers = args.showProposalVersionNumbers;
    if (args.requireApprovalBeforeSend !== undefined)
      updates.requireApprovalBeforeSend = args.requireApprovalBeforeSend;
    if (args.vatRegistered !== undefined) updates.vatRegistered = args.vatRegistered;
    if (args.vatNumber !== undefined) updates.vatNumber = args.vatNumber;
    if (args.appLanguage !== undefined) updates.appLanguage = args.appLanguage;
    if (args.landingPagePreference !== undefined)
      updates.landingPagePreference = args.landingPagePreference;
    if (args.headingsFont !== undefined) updates.headingsFont = args.headingsFont;
    if (args.generalTextFont !== undefined)
      updates.generalTextFont = args.generalTextFont;
    if (args.logoProposalHeader !== undefined)
      updates.logoProposalHeader = args.logoProposalHeader;
    if (args.logoCreateProposalPage !== undefined)
      updates.logoCreateProposalPage = args.logoCreateProposalPage;
    if (args.bannerImage !== undefined) updates.bannerImage = args.bannerImage;
    if (args.useDifferentLogoProposalHeader !== undefined)
      updates.useDifferentLogoProposalHeader = args.useDifferentLogoProposalHeader;
    if (args.useDifferentLogoCreateProposalPage !== undefined)
      updates.useDifferentLogoCreateProposalPage = args.useDifferentLogoCreateProposalPage;
    if (args.subscriptionPlan !== undefined)
      updates.subscriptionPlan = args.subscriptionPlan;
    if (args.subscriptionStatus !== undefined)
      updates.subscriptionStatus = args.subscriptionStatus;
    if (args.proposalBuilderDocumentTypes !== undefined)
      updates.proposalBuilderDocumentTypes = args.proposalBuilderDocumentTypes;
    if (args.proposalBuilderEnableQuote !== undefined)
      updates.proposalBuilderEnableQuote = args.proposalBuilderEnableQuote;
    if (args.proposalBuilderRequiredSteps !== undefined)
      updates.proposalBuilderRequiredSteps = args.proposalBuilderRequiredSteps;
    if (args.proposalBuilderDefaultIntro !== undefined)
      updates.proposalBuilderDefaultIntro = args.proposalBuilderDefaultIntro;
    if (args.proposalBuilderDefaultTerms !== undefined)
      updates.proposalBuilderDefaultTerms = args.proposalBuilderDefaultTerms;
    if (args.packageTemplateOptions !== undefined)
      updates.packageTemplateOptions = args.packageTemplateOptions;
    if (args.packageDocumentsOptions !== undefined)
      updates.packageDocumentsOptions = args.packageDocumentsOptions;
    if (args.pdfFooterText !== undefined) updates.pdfFooterText = args.pdfFooterText;
    if (args.pdfFooterAddress !== undefined) updates.pdfFooterAddress = args.pdfFooterAddress;
    if (args.pdfDisclaimer !== undefined) updates.pdfDisclaimer = args.pdfDisclaimer;
    if (args.pdfHeaderTitleStyle !== undefined)
      updates.pdfHeaderTitleStyle = args.pdfHeaderTitleStyle;
    if (args.pdfSignOffBlock !== undefined) updates.pdfSignOffBlock = args.pdfSignOffBlock;
    if (args.pdfBankingDetails !== undefined) updates.pdfBankingDetails = args.pdfBankingDetails;
    if (args.pdfCoverImage !== undefined) updates.pdfCoverImage = args.pdfCoverImage;
    if (args.pdfFooterImage !== undefined) updates.pdfFooterImage = args.pdfFooterImage;
    if (args.pdfLastPageImage !== undefined) updates.pdfLastPageImage = args.pdfLastPageImage;
    if (args.letterheadDirectorsList !== undefined)
      updates.letterheadDirectorsList = args.letterheadDirectorsList;

    await ctx.db.patch(user.firmId, updates);
    return { success: true };
  },
});

/**
 * Clear firm logo (remove logo from firm).
 */
export const clearFirmLogo = mutation({
  args: { userId: v.id("users") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const now = Date.now();
    await ctx.db.patch(user.firmId, { updatedAt: now, logo: undefined, logoUrl: undefined });
    return { success: true };
  },
});

/**
 * Clear optional PDF image (footer or last page).
 */
export const clearFirmPdfImage = mutation({
  args: {
    userId: v.id("users"),
    field: v.union(v.literal("pdfCoverImage"), v.literal("pdfFooterImage"), v.literal("pdfLastPageImage")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const now = Date.now();
    await ctx.db.patch(user.firmId, { updatedAt: now, [args.field]: undefined });
    return { success: true };
  },
});

/**
 * Clear firm banner image (Create Proposal page).
 */
export const clearFirmBanner = mutation({
  args: { userId: v.id("users") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const now = Date.now();
    await ctx.db.patch(user.firmId, { updatedAt: now, bannerImage: undefined });
    return { success: true };
  },
});
