// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // ===== CONVEX AUTH TABLES =====
  ...authTables,

  // ===== USERS & FIRMS =====
  firms: defineTable({
    name: v.string(),
    logo: v.optional(v.id("_storage")), // File storage reference
    logoUrl: v.optional(v.string()),   // Resolved CDN URL — stored at upload time for reliable sidebar display
    brandColors: v.object({
      primary: v.string(), // Hex color
      secondary: v.string(),
    }),
    billingEmail: v.string(),
    phone: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()), // cus_xxx - links firm to Stripe customer
    stripeSubscriptionId: v.optional(v.string()), // sub_xxx - active subscription
    subscriptionStatus: v.union(
      v.literal("trial"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("cancelled")
    ),
    subscriptionPlan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
    jurisdiction: v.union(
      v.literal("US"),
      v.literal("UK"),
      v.literal("CA"),
      v.literal("AU"),
      v.literal("NZ"),
      v.literal("ZA")
    ),
    currency: v.string(), // "ZAR", "USD", "GBP", "EUR", etc.
    trialEndsAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Settings: Proposals
    proposalNumberPrefix: v.optional(v.string()), // e.g. "PROP"
    defaultProposalValidityDays: v.optional(v.number()), // e.g. 30
    currentProposalNumber: v.optional(v.number()), // next number to use (e.g. 3127)
    showProposalVersionNumbers: v.optional(v.boolean()),
    // Proposal Builder (Settings > Proposals)
    proposalBuilderDocumentTypes: v.optional(v.array(v.string())), // proposal_only, letter_only, proposal_and_letter, quote
    proposalBuilderEnableQuote: v.optional(v.boolean()),
    proposalBuilderRequiredSteps: v.optional(v.array(v.string())), // "1".."6" - which steps required
    proposalBuilderDefaultIntro: v.optional(v.string()),
    proposalBuilderDefaultTerms: v.optional(v.string()),
    // Settings: Workflow
    requireApprovalBeforeSend: v.optional(v.boolean()),
    autoExpireProposals: v.optional(v.boolean()),
    autoExpireDays: v.optional(v.number()),
    sendFollowUpReminders: v.optional(v.boolean()),
    followUpReminderDays: v.optional(v.number()),
    requireClientSignature: v.optional(v.boolean()),
    // Settings: Proposals
    defaultPaymentFrequency: v.optional(v.union(v.literal("monthly"), v.literal("quarterly"), v.literal("annually"), v.literal("as_delivered"))),
    // Settings: Pricing defaults
    showTaxInclusive: v.optional(v.boolean()),
    roundPrices: v.optional(v.boolean()),
    defaultTaxRate: v.optional(v.number()),
    // Account: Region and tax
    vatRegistered: v.optional(v.boolean()),
    vatNumber: v.optional(v.string()),
    // Account: App settings
    appLanguage: v.optional(v.string()), // e.g. "en"
    landingPagePreference: v.optional(v.union(v.literal("dashboard"), v.literal("create-proposal"))),
    // Account: Branding
    headingsFont: v.optional(v.string()),
    generalTextFont: v.optional(v.string()),
    logoProposalHeader: v.optional(v.id("_storage")),
    logoCreateProposalPage: v.optional(v.id("_storage")),
    bannerImage: v.optional(v.id("_storage")),
    useDifferentLogoProposalHeader: v.optional(v.boolean()),
    useDifferentLogoCreateProposalPage: v.optional(v.boolean()),
    // Package dropdowns (Create Package modal - Settings > Account)
    packageTemplateOptions: v.optional(v.array(v.string())), // e.g. ["New Client", "Virtual: New Client"]
    packageDocumentsOptions: v.optional(v.array(v.string())), // e.g. ["Proposal & Letter of Engagement", "Proposal"]
    // PDF generation (Settings > Proposals): header, footer, last page
    pdfFooterText: v.optional(v.string()),
    pdfFooterAddress: v.optional(v.string()),
    pdfDisclaimer: v.optional(v.string()),
    pdfHeaderTitleStyle: v.optional(v.string()), // "default" | "minimal"
    pdfSignOffBlock: v.optional(v.string()),
    pdfBankingDetails: v.optional(v.string()),
    pdfCoverImage: v.optional(v.id("_storage")), // optional cover/first page image for PDFs
    pdfFooterImage: v.optional(v.id("_storage")), // optional footer image for PDFs
    pdfLastPageImage: v.optional(v.id("_storage")), // optional last page image/background
    // Engagement Letters: Wahoo email templates (Configure > Engagement Letters > Emails)
    engagementEmailTemplates: v.optional(
      v.object({
        signed: v.optional(
          v.object({
            clientSubject: v.optional(v.string()),
            clientContent: v.optional(v.string()),
            additionalSignatorySubject: v.optional(v.string()),
            additionalSignatoryContent: v.optional(v.string()),
            staffSubject: v.optional(v.string()),
            staffContent: v.optional(v.string()),
            additionallyEmailTo: v.optional(v.string()),
          })
        ),
        acceptance: v.optional(
          v.object({
            clientSubject: v.optional(v.string()),
            clientContent: v.optional(v.string()),
            additionalSignatorySubject: v.optional(v.string()),
            additionalSignatoryContent: v.optional(v.string()),
            staffSubject: v.optional(v.string()),
            staffContent: v.optional(v.string()),
            additionallyEmailTo: v.optional(v.string()),
          })
        ),
      })
    ),
    // Engagement Letters: Key Dates settings (Configure > Engagement Letters > Key Dates)
    keyDatesSettings: v.optional(
      v.object({
        keyDatesTableIntroduction: v.optional(v.string()),
        infoDeadlineHeading: v.optional(v.string()),
        filingDeadlineHeading: v.optional(v.string()),
      })
    ),
    // Engagement Letters: Suite global settings (Terms, Privacy, Schedule intro, Agreement)
    engagementSuiteSettings: v.optional(
      v.object({
        termsAndConditions: v.optional(v.string()),
        privacyNoticeEnabled: v.optional(v.boolean()),
        privacyNoticeContent: v.optional(v.string()),
        scheduleOfServicesIntroduction: v.optional(v.string()),
        agreementSignatureVersion: v.optional(v.string()),
        agreementNoSignatureVersion: v.optional(v.string()),
        includePrincipalSignature: v.optional(v.boolean()),
      })
    ),
    /** Letterhead: directors / partners / members block (engagement letters) */
    letterheadDirectorsList: v.optional(v.string()),
  }).index("by_subscription_status", ["subscriptionStatus"]),

  // Engagement Letter Versions (Scope Library - each letter version)
  engagementLetterVersions: defineTable({
    firmId: v.id("firms"),
    name: v.string(),
    introduction: v.optional(v.string()),
    scope: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_sort", ["firmId", "sortOrder"]),

  users: defineTable({
    firmId: v.id("firms"),
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("senior"),
      v.literal("staff"),
      v.literal("view-only")
    ),
    avatar: v.optional(v.string()), // URL or base64
    lastActiveAt: v.number(),
    createdAt: v.number(),
    // Auth-related fields
    authUserId: v.optional(v.string()), // Links to Convex Auth user
    passwordHash: v.optional(v.string()), // Hashed password for email/password auth
    // Login attempt tracking for 5-attempt lockout
    loginAttempts: v.optional(v.number()),
    lastLoginAttempt: v.optional(v.number()),
    lockedUntil: v.optional(v.number()), // Timestamp when lockout expires
    deactivatedAt: v.optional(v.number()), // When set, user is deactivated (admin-only)
    // Pending invite (email link → /auth?invite=…); cleared when Clerk account links
    inviteToken: v.optional(v.string()),
    inviteExpiresAt: v.optional(v.number()),
    // Notification preferences (Settings > Account)
    emailNotifications: v.optional(v.boolean()),
    notificationDigest: v.optional(
      v.union(v.literal("instant"), v.literal("daily"), v.literal("weekly"))
    ),
    notificationPreferences: v.optional(v.object({
      proposalAccepted: v.optional(v.boolean()),
      proposalRejected: v.optional(v.boolean()),
      proposalViewed: v.optional(v.boolean()),
      engagementLetterSigned: v.optional(v.boolean()),
      approvalRequired: v.optional(v.boolean()),
      workPlanDue: v.optional(v.boolean()),
    })),
  })
    .index("by_firm", ["firmId"])
    .index("by_email", ["email"])
    .index("by_auth_user", ["authUserId"])
    .index("by_invite_token", ["inviteToken"]),

  // ===== CLIENTS =====
  clients: defineTable({
    firmId: v.id("firms"),
    contactType: v.optional(
      v.union(v.literal("organisation"), v.literal("individual"))
    ), // Xero: org vs person; used for stats + sync
    companyName: v.string(),
    contactName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    industry: v.optional(v.string()),
    companySize: v.optional(
      v.union(
        v.literal("1-10"),
        v.literal("11-50"),
        v.literal("51-200"),
        v.literal("201+")
      )
    ),
    annualRevenue: v.optional(v.string()),
    currentSoftware: v.optional(v.array(v.string())), // ["Xero", "Stripe"]
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    // Xero / accounting sync fields (full contact data)
    xeroContactId: v.optional(v.string()), // Xero ContactID for sync tracking
    contactGroupIds: v.optional(v.array(v.string())), // Xero ContactGroup IDs (organisations can have groups)
    website: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    companyNumber: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    status: v.union(
      v.literal("prospect"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Denormalized for full-text search (companyName + contactName + email)
    searchText: v.optional(v.string()),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_and_status", ["firmId", "status"])
    .index("by_firm_created", ["firmId", "createdAt"])
    .index("by_firm_and_email", ["firmId", "email"])
    .index("by_firm_and_xeroContactId", ["firmId", "xeroContactId"])
    .index("by_email", ["email"])
    .searchIndex("search_client", {
      searchField: "searchText",
      filterFields: ["firmId"],
    }),

  // ===== LINE ITEMS: SECTIONS (service categories for proposal generator) =====
  serviceSections: defineTable({
    firmId: v.id("firms"),
    name: v.string(),
    description: v.optional(v.string()),
    iconName: v.optional(v.string()),
    iconColor: v.optional(v.string()),
    /** HTML: shown once in the engagement letter when any service from this section is on the proposal */
    engagementParagraphHtml: v.optional(v.string()),
    ourResponsibilityText: v.optional(v.string()),
    yourResponsibilityText: v.optional(v.string()),
    linkedLetterVersionId: v.optional(v.id("engagementLetterVersions")),
    sortOrder: v.number(),
    isPublished: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_sort", ["firmId", "sortOrder"]),

  // ===== PRICING =====
  services: defineTable({
    firmId: v.id("firms"),
    sectionId: v.optional(v.id("serviceSections")), // Service belongs to this section
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(), // "Bookkeeping", "Tax", "Payroll", "Advisory" (kept for backward compat)
    billingFrequency: v.optional(v.union(v.literal("monthly"), v.literal("one_off"))),
    pricingType: v.union(
      v.literal("fixed"),        // Fixed price
      v.literal("hourly"),       // Hourly rate
      v.literal("tiered"),       // Number Range Price (custom from/to ranges)
      v.literal("recurring"),    // Annual Revenue Price (predefined SA revenue brackets)
      v.literal("variation"),    // Variation Price (dropdown options)
      v.literal("income_range")  // Income Tax Range Price (predefined SA income brackets)
    ),
    taxRate: v.optional(v.string()),    // e.g. "default" | "vat15" | "exempt" | "zero"
    fieldLabel: v.optional(v.string()), // Label shown on variation dropdown in proposals
    pricingTiers: v.optional(
      v.array(
        v.object({
          name: v.string(), // "Small Business"
          price: v.number(), // 500
          description: v.string(), // "Up to 50 transactions/mo"
          criteria: v.optional(v.string()), // Qualifying criteria
        })
      )
    ),
    hourlyRate: v.optional(v.number()),
    fixedPrice: v.optional(v.number()),
    isActive: v.boolean(),
    sortOrder: v.number(),
    serviceSchedule: v.optional(v.string()), // Engagement letter schedule of services
    applyMinimumFee: v.optional(v.boolean()),
    minMonthlyFee: v.optional(v.number()),
    minFeeType: v.optional(v.union(v.literal("fixed"), v.literal("calculation"))),
    minFeeCurrency: v.optional(v.string()),
    minFeeCalculation: v.optional(v.string()),
    // Calculation variations: when Add Calculation is checked, these define dropdowns shown in Edit Package
    addCalculation: v.optional(v.boolean()),
    calculationVariations: v.optional(
      v.array(
        v.object({
          id: v.string(),
          valueType: v.optional(v.union(v.literal("quantity"), v.literal("static"), v.literal("variations"))),
          label: v.optional(v.string()),
          operation: v.union(v.literal("add"), v.literal("multiply"), v.literal("divide"), v.literal("subtract")),
          options: v.optional(v.array(v.object({ label: v.string(), value: v.number() }))),
          staticValue: v.optional(v.number()),
          quantityFieldLabel: v.optional(v.string()),
        })
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_and_category", ["firmId", "category"])
    .index("by_firm_and_active", ["firmId", "isActive"])
    .index("by_section", ["sectionId"]),

  // ===== PROPOSALS =====
  proposals: defineTable({
    firmId: v.id("firms"),
    clientId: v.id("clients"),
    proposalNumber: v.string(), // "PROP-2026-001"
    title: v.string(), // "Monthly Bookkeeping Services"
    status: v.union(
      v.literal("draft"),
      v.literal("pending-approval"),
      v.literal("approved"),
      v.literal("sent"),
      v.literal("viewed"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    services: v.array(
      v.object({
        serviceId: v.id("services"),
        serviceName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        subtotal: v.number(),
        description: v.optional(v.string()),
        /** Work planning: hours from proposal line (split across entities in sync) */
        estimatedHours: v.optional(v.number()),
        /** Work planning: YYYY-MM when this work is scheduled */
        scheduledMonth: v.optional(v.string()),
        workPlanEntityLabels: v.optional(v.array(v.string())),
        billingCategory: v.optional(v.string()),
        frequency: v.optional(v.string()),
      })
    ),
    subtotal: v.number(),
    discount: v.optional(
      v.object({
        type: v.union(v.literal("percentage"), v.literal("fixed")),
        value: v.number(),
        reason: v.optional(v.string()),
      })
    ),
    tax: v.optional(
      v.object({
        rate: v.number(),
        amount: v.number(),
      })
    ),
    total: v.number(),
    currency: v.string(),
    // Monthly and one-off fee breakdown (optional)
    netMonthlyFee: v.optional(v.number()),
    monthlyTax: v.optional(v.number()),
    grossMonthlyFee: v.optional(v.number()),
    oneOffFee: v.optional(v.number()),
    oneOffTax: v.optional(v.number()),
    grossOneOffFee: v.optional(v.number()),
    introText: v.optional(v.string()),
    termsText: v.optional(v.string()),
    validUntil: v.optional(v.number()), // Expiration date
    // Generator (6-step) optional fields
    packageTemplate: v.optional(v.string()),
    entities: v.optional(
      v.array(
        v.object({
          id: v.number(),
          name: v.string(),
          type: v.string(),
          revenueRange: v.string(),
          incomeTaxRange: v.string(),
        })
      )
    ),
    template: v.optional(v.string()),
    documentType: v.optional(v.string()),
    startMonth: v.optional(v.string()),
    startYear: v.optional(v.string()),
    financialYearEndMonth: v.optional(v.string()),
    financialYearEndYear: v.optional(v.string()),
    addProjectName: v.optional(v.boolean()),
    projectName: v.optional(v.string()),
    pdfUrl: v.optional(v.id("_storage")), // Generated PDF
    // Pricing adjustment metadata (when created via Update Pricing)
    sourceProposalId: v.optional(v.id("proposals")),
    pricingAdjustment: v.optional(
      v.object({
        type: v.union(v.literal("increase"), v.literal("decrease")),
        method: v.union(v.literal("percentage"), v.literal("cost")),
        amount: v.number(),
        scope: v.union(v.literal("all"), v.literal("section")),
        sectionId: v.optional(v.id("serviceSections")),
        sectionName: v.optional(v.string()),
        targetYear: v.optional(v.string()),
      })
    ),
    appsMapData: v.optional(
      v.object({
        apps: v.array(
          v.object({
            id: v.string(),
            name: v.string(),
            logo: v.string(),
            position: v.object({ x: v.number(), y: v.number() }),
          })
        ),
        connections: v.array(
          v.object({
            from: v.string(),
            to: v.string(),
            label: v.string(),
          })
        ),
      })
    ),
    createdBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    signatureData: v.optional(
      v.object({
        signerName: v.string(),
        signatureImage: v.string(),
        signedAt: v.number(),
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    /** Cash flow: how the client pays (set when won / on proposal) */
    paymentSchedule: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("on_completion"),
        v.literal("blended")
      )
    ),
    /** First month recurring revenue hits (YYYY-MM) */
    cashFlowStartMonth: v.optional(v.string()),
    /** Month one-off / completion payment lands (YYYY-MM) */
    oneOffCashMonth: v.optional(v.string()),
    paymentNotes: v.optional(v.string()),
  })
    .index("by_firm", ["firmId"])
    .index("by_client", ["clientId"])
    .index("by_firm_and_status", ["firmId", "status"])
    .index("by_proposal_number", ["proposalNumber"]),

  // ===== WORK PLANNING (firm calendar / capacity; fed from proposal lines + manual tasks) =====
  workPlanTasks: defineTable({
    firmId: v.id("firms"),
    clientId: v.id("clients"),
    proposalId: v.optional(v.id("proposals")),
    proposalServiceIndex: v.optional(v.number()),
    source: v.union(v.literal("manual"), v.literal("proposal")),
    serviceName: v.string(),
    displayLabel: v.string(),
    billingCategory: v.string(),
    frequency: v.string(),
    scheduledMonth: v.string(),
    estimatedHours: v.number(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("overdue")
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_and_month", ["firmId", "scheduledMonth"])
    .index("by_proposal", ["proposalId"]),

  // ===== PROPOSAL VERSIONS (History) =====
  proposalVersions: defineTable({
    firmId: v.id("firms"),
    proposalId: v.id("proposals"), // The parent/current proposal
    versionNumber: v.string(), // "v9", "v8", etc.
    proposalNumber: v.string(), // "RA3110-v9"
    clientName: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    total: v.number(),
    currency: v.string(),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_proposal", ["proposalId"])
    .index("by_firm", ["firmId"]),

  // ===== ENGAGEMENT LETTERS =====
  engagementLetters: defineTable({
    firmId: v.id("firms"),
    proposalId: v.id("proposals"),
    clientId: v.id("clients"),
    letterNumber: v.string(), // "ENG-2026-001"
    templateId: v.optional(v.id("letterTemplates")),
    scopeLibraryVersionId: v.optional(v.id("engagementLetterVersions")),
    jurisdiction: v.string(), // "US", "UK", etc.
    serviceType: v.string(), // "audit", "bookkeeping", etc.
    content: v.string(), // Full letter HTML
    pdfUrl: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("viewed"),
      v.literal("signed"),
      v.literal("expired")
    ),
    signatureData: v.optional(
      v.object({
        signerName: v.string(),
        signatureImage: v.string(), // Base64 or URL
        signedAt: v.number(),
        ipAddress: v.string(),
        userAgent: v.string(),
      })
    ),
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
    signedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_proposal", ["proposalId"])
    .index("by_status", ["status"]),

  // ===== TEMPLATES =====
  letterTemplates: defineTable({
    name: v.string(),
    description: v.string(),
    jurisdiction: v.string(),
    serviceType: v.string(),
    content: v.string(), // HTML template with placeholders
    requiredClauses: v.array(v.string()), // ["limitation-of-liability", "confidentiality"]
    isDefault: v.boolean(),
    isSystemTemplate: v.boolean(), // Built-in vs. custom
    lastReviewedBy: v.optional(v.string()), // Legal reviewer
    lastReviewedAt: v.optional(v.number()),
    version: v.string(), // "1.2"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jurisdiction", ["jurisdiction"])
    .index("by_service_type", ["serviceType"]),

  proposalTemplates: defineTable({
    firmId: v.id("firms"),
    name: v.string(),
    description: v.optional(v.string()),
    serviceType: v.string(), // audit, bookkeeping, tax, advisory, payroll, other
    introText: v.string(),
    termsText: v.string(),
    footerText: v.optional(v.string()),
    isDefault: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    // New template form fields
    minimumMonthlyFee: v.optional(v.number()),
    proposalType: v.optional(v.string()), // e.g. "proposal"
    documentsToSend: v.optional(v.string()), // e.g. "Proposal & Letter of Engagement"
    redirectOnAcceptUrl: v.optional(v.string()),
    emailDeliverability: v.optional(v.union(v.literal("high"), v.literal("low"))),
    sortOrder: v.optional(v.number()),
    // Section toggles and paragraph content (flexible for UI sections)
    sectionConfig: v.optional(
      v.object({
        acceptanceEnabled: v.optional(v.boolean()),
        halfPageGraphicEnabled: v.optional(v.boolean()),
        testimonial1Enabled: v.optional(v.boolean()),
        fullPageGraphic1Enabled: v.optional(v.boolean()),
        proposalIntroduction: v.optional(v.string()),
        testimonial2Enabled: v.optional(v.boolean()),
        feesIntroductionParagraph: v.optional(v.string()),
        pleaseNote: v.optional(v.string()),
        whatHappensNextText: v.optional(v.string()),
        fullPageGraphic2Enabled: v.optional(v.boolean()),
        selectedServicesText: v.optional(v.string()),
        upsellSectionText: v.optional(v.string()),
        testimonial3Enabled: v.optional(v.boolean()),
        fullPageGraphic3Enabled: v.optional(v.boolean()),
      })
    ),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_sort", ["firmId", "sortOrder"]),

  // ===== PACKAGE TEMPLATES (for proposal tool) =====
  packageTemplates: defineTable({
    firmId: v.id("firms"),
    name: v.string(),
    template: v.string(), // e.g. "New Client"
    documentsToSend: v.string(), // e.g. "Proposal"
    annualRevenueRange: v.string(), // e.g. "Not Applicable"
    incomeTaxRange: v.string(), // e.g. "Not Applicable"
    addProjectName: v.boolean(),
    includedServiceIds: v.array(v.id("services")), // which line items (services) are in this package
    // Per-service selected variation values: { [serviceId]: { [variationId]: selectedOptionLabel } }
    includedServiceSettings: v.optional(v.record(v.string(), v.record(v.string(), v.string()))),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_sort", ["firmId", "sortOrder"]),

  // ===== ANALYTICS & TRACKING =====
  proposalViews: defineTable({
    proposalId: v.id("proposals"),
    viewedAt: v.number(),
    ipAddress: v.string(),
    userAgent: v.string(),
    duration: v.optional(v.number()), // Seconds spent viewing
  }).index("by_proposal", ["proposalId"]),

  activities: defineTable({
    firmId: v.id("firms"),
    userId: v.id("users"),
    entityType: v.string(), // "proposal", "client", "engagement"
    entityId: v.string(),
    action: v.string(), // "created", "updated", "sent", "approved"
    metadata: v.optional(v.any()), // Additional data
    timestamp: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_user", ["userId"]),

  // ===== REAL-TIME COLLABORATION =====
  presence: defineTable({
    proposalId: v.id("proposals"),
    userId: v.id("users"),
    userName: v.string(),
    userColor: v.string(), // Hex color for cursor
    cursorPosition: v.optional(
      v.object({
        field: v.string(), // "title", "introText", "termsText"
        offset: v.number(),
      })
    ),
    isActive: v.boolean(),
    lastActiveAt: v.number(),
  })
    .index("by_proposal", ["proposalId"])
    .index("by_user", ["userId"])
    .index("by_proposal_active", ["proposalId", "isActive"]),

  // ===== APPROVAL WORKFLOW =====
  approvalRequests: defineTable({
    firmId: v.id("firms"),
    proposalId: v.id("proposals"),
    requestedBy: v.id("users"),
    assignedTo: v.id("users"), // Approver
    message: v.optional(v.string()), // Optional message from requester
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    reviewedBy: v.optional(v.id("users")),
    reviewComment: v.optional(v.string()),
    requestedAt: v.number(),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_firm", ["firmId"])
    .index("by_proposal", ["proposalId"])
    .index("by_assignee", ["assignedTo", "status"])
    .index("by_requester", ["requestedBy"]),

  // ===== EMAIL MANAGEMENT =====
  emails: defineTable({
    firmId: v.id("firms"),
    proposalId: v.id("proposals"),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("opened")
    ),
    resendId: v.optional(v.string()),
    scheduledAt: v.optional(v.number()), // When to send (for send later)
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_proposal", ["proposalId"])
    .index("by_status", ["status"])
    .index("by_scheduled", ["status", "scheduledAt"])
    .index("by_resend_id", ["resendId"]),

  // ===== PROPOSAL ACCEPT SESSIONS (client view/accept/reject via token) =====
  proposalAcceptSessions: defineTable({
    firmId: v.id("firms"),
    proposalId: v.id("proposals"),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    signerName: v.optional(v.string()),
    signatureImage: v.optional(v.string()), // Base64 PNG from signature pad
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_proposal", ["proposalId"])
    .index("by_token", ["token"]),

  // ===== SIGNING SESSIONS =====
  signingSessions: defineTable({
    firmId: v.id("firms"),
    letterId: v.id("engagementLetters"),
    token: v.string(),
    status: v.union(v.literal("pending"), v.literal("signed"), v.literal("expired")),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    signedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_token", ["token"]),

  // ===== NOTIFICATIONS =====
  notifications: defineTable({
    firmId: v.id("firms"),
    userId: v.id("users"), // Recipient
    type: v.union(
      v.literal("approval-request"),
      v.literal("approval-approved"),
      v.literal("approval-rejected"),
      v.literal("proposal-sent"),
      v.literal("proposal-viewed"),
      v.literal("proposal-accepted")
    ),
    title: v.string(),
    message: v.string(),
    relatedId: v.optional(v.string()), // proposalId, approvalRequestId, etc.
    relatedType: v.optional(v.string()), // "proposal", "approval", etc.
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "isRead"])
    .index("by_firm", ["firmId"]),

  // ===== DOCUMENTS (stub for UI – full implementation later) =====
  documents: defineTable({
    firmId: v.id("firms"),
    documentNumber: v.string(),
    documentType: v.string(),
    title: v.string(),
    clientId: v.id("clients"),
    status: v.string(),
    total: v.number(),
    currency: v.string(),
    createdAt: v.number(),
    validUntil: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.number()),
    typeData: v.optional(v.any()),
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
  }).index("by_firm", ["firmId"]),

  documentVersions: defineTable({
    documentId: v.id("documents"),
    versionNumber: v.string(),
    documentNumber: v.string(),
    clientName: v.string(),
    status: v.string(),
    total: v.number(),
    currency: v.string(),
    createdByName: v.optional(v.string()),
    createdAt: v.number(),
    documentType: v.optional(v.string()),
    firmId: v.optional(v.id("firms")),
  }).index("by_document", ["documentId"]),

  // ===== INTEGRATION CONNECTIONS (Xero, etc.) =====
  integrationConnections: defineTable({
    firmId: v.id("firms"),
    provider: v.string(), // "xero"
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(), // Unix ms when access token expires
    tenantId: v.optional(v.string()),   // Xero tenant/organisation ID
    tenantName: v.optional(v.string()), // Xero organisation display name
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm_provider", ["firmId", "provider"]),

  // ===== FIRM INTEGRATIONS (which integrations are added to Apps Map) =====
  firmIntegrations: defineTable({
    firmId: v.id("firms"),
    provider: v.string(), // "xero"
    createdAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_provider", ["firmId", "provider"]),

  // ===== INTEGRATION SYNC LOGS (for "Syncs today" and "Last sync" stats) =====
  integrationSyncLogs: defineTable({
    firmId: v.id("firms"),
    provider: v.string(),
    syncedAt: v.number(),
    status: v.union(v.literal("success"), v.literal("error")),
    recordCount: v.optional(v.number()),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_synced", ["firmId", "syncedAt"]),

  // ===== INTEGRATION AUTOMATIONS (workflows; for "Automations" stat) =====
  integrationAutomations: defineTable({
    firmId: v.id("firms"),
    name: v.string(),
    provider: v.string(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_enabled", ["firmId", "enabled"]),

  // ===== SUPPORT CHAT =====
  support_messages: defineTable({
    userId: v.string(),            // authUserId (Convex Auth subject)
    role: v.union(v.literal("user"), v.literal("support")),
    content: v.string(),
    createdAt: v.number(),
    isAutoReply: v.optional(v.boolean()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_created", ["userId", "createdAt"]),

  // ===== HELP ARTICLES =====
  help_articles: defineTable({
    collection: v.string(),
    title: v.string(),
    slug: v.string(),
    summary: v.optional(v.string()),
    body: v.optional(v.string()),
    url: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_collection", ["collection"])
    .index("by_slug", ["slug"]),

  // ===== PRINCIPALS (Engagement Letters > Key People) =====
  principals: defineTable({
    firmId: v.id("firms"),
    name: v.string(),
    qualification: v.optional(v.string()),
    signatureStorageId: v.optional(v.id("_storage")),
    roles: v.array(v.string()), // "director" | "principal" | "statutory-auditor"
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_sort", ["firmId", "sortOrder"]),

  // ===== PRICING TOOL SETTINGS (Services > Pricing Tool – one doc per firm) =====
  pricingToolSettings: defineTable({
    firmId: v.id("firms"),
    // Revenue Ranges
    annualRevenueRanges: v.array(v.string()),
    secondStyleRanges: v.array(v.string()),
    // Fees & Display
    showFees: v.union(v.literal("breakdown"), v.literal("total-only")),
    sectionSubTotals: v.boolean(),
    dontRoundPrices: v.boolean(),
    applyMinFee: v.boolean(),
    minMonthlyFee: v.number(),
    currency: v.string(),
    // Tax & Currency – custom tax rates (array)
    taxRates: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        ratePercent: v.number(),
        isDefault: v.boolean(),
      })
    ),
    // Upsell & Annualised
    upsellSection: v.union(v.literal("consider"), v.literal("roadmap")),
    displayFeesUpsell: v.union(
      v.literal("always"),
      v.literal("never"),
      v.literal("optional")
    ),
    enableAnnualised: v.boolean(),
    discountOrIncrease: v.union(v.literal("discount"), v.literal("increase")),
    annualisedDiscount: v.string(),
    // Alignment Fee
    alignmentLineItems: v.string(),
    alignmentProposals: v.array(v.string()),
    alignmentTool: v.string(),
    alignmentPdfMonthly: v.string(),
    alignmentPdfOneoff: v.string(),
    // Multiple Entities
    enableMultipleEntities: v.boolean(),
    businessTypes: v.string(),
    //
    updatedAt: v.number(),
  }).index("by_firm", ["firmId"]),
});
