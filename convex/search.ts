import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Global Search Query
 * Searches across all entities: proposals, clients, services, templates
 * Returns grouped results with max 5 per type
 */
export const globalSearch = query({
  args: {
    userId: v.id("users"),
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    proposals: v.array(v.object({
      _id: v.id("proposals"),
      title: v.string(),
      clientName: v.string(),
      status: v.string(),
      total: v.number(),
    })),
    clients: v.array(v.object({
      _id: v.id("clients"),
      companyName: v.string(),
      contactName: v.string(),
      email: v.string(),
      industry: v.optional(v.string()),
    })),
    services: v.array(v.object({
      _id: v.id("services"),
      name: v.string(),
      category: v.string(),
      price: v.number(),
    })),
    templates: v.array(v.object({
      _id: v.id("proposalTemplates"),
      name: v.string(),
      serviceType: v.string(),
      isDefault: v.boolean(),
    })),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, searchTerm, limit = 5 } = args;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return {
        proposals: [],
        clients: [],
        services: [],
        templates: [],
        totalCount: 0,
      };
    }

    const searchLower = searchTerm.toLowerCase().trim();

    // Get user's firm
    const user = await ctx.db.get(userId);
    if (!user || !user.firmId) {
      return {
        proposals: [],
        clients: [],
        services: [],
        templates: [],
        totalCount: 0,
      };
    }

    // Search Proposals - need to join with clients for clientName
    const allProposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    
    // Build client lookup for proposal search
    const clientIds = [...new Set(allProposals.map(p => p.clientId))];
    const clientMap = new Map();
    for (const clientId of clientIds) {
      const client = await ctx.db.get(clientId);
      if (client) {
        clientMap.set(clientId.toString(), client);
      }
    }
    
    const matchingProposals = allProposals
      .filter((p) => {
        const client = clientMap.get(p.clientId.toString());
        return (
          p.title.toLowerCase().includes(searchLower) ||
          p.proposalNumber?.toLowerCase().includes(searchLower) ||
          client?.companyName?.toLowerCase().includes(searchLower) ||
          client?.email?.toLowerCase().includes(searchLower)
        );
      })
      .slice(0, limit)
      .map((p) => {
        const client = clientMap.get(p.clientId.toString());
        return {
          _id: p._id,
          title: p.title,
          clientName: client?.companyName || "Unknown Client",
          status: p.status,
          total: p.total || 0,
        };
      });

    // Search Clients - filter out archived
    const allClients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    
    const matchingClients = allClients
      .filter((c) => 
        c.status !== "archived" &&
        (c.companyName.toLowerCase().includes(searchLower) ||
         c.contactName.toLowerCase().includes(searchLower) ||
         c.email.toLowerCase().includes(searchLower) ||
         c.industry?.toLowerCase().includes(searchLower))
      )
      .slice(0, limit)
      .map((c) => ({
        _id: c._id,
        companyName: c.companyName,
        contactName: c.contactName,
        email: c.email,
        industry: c.industry,
      }));

    // Search Services - use fixedPrice or hourlyRate
    const allServices = await ctx.db
      .query("services")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    
    const matchingServices = allServices
      .filter((s) => 
        s.isActive &&
        (s.name.toLowerCase().includes(searchLower) ||
         s.category.toLowerCase().includes(searchLower) ||
         s.description?.toLowerCase().includes(searchLower))
      )
      .slice(0, limit)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        category: s.category,
        price: s.fixedPrice || s.hourlyRate || 0,
      }));

    // Search Templates
    const allTemplates = await ctx.db
      .query("proposalTemplates")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .collect();
    
    const matchingTemplates = allTemplates
      .filter((t) => 
        t.name.toLowerCase().includes(searchLower) ||
        t.serviceType.toLowerCase().includes(searchLower)
      )
      .slice(0, limit)
      .map((t) => ({
        _id: t._id,
        name: t.name,
        serviceType: t.serviceType,
        isDefault: t.isDefault || false,
      }));

    const totalCount = 
      matchingProposals.length + 
      matchingClients.length + 
      matchingServices.length + 
      matchingTemplates.length;

    return {
      proposals: matchingProposals,
      clients: matchingClients,
      services: matchingServices,
      templates: matchingTemplates,
      totalCount,
    };
  },
});

/**
 * Get search suggestions based on recent activity
 */
export const getSearchSuggestions = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(v.object({
    type: v.string(),
    label: v.string(),
    value: v.string(),
  })),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.firmId) {
      return [];
    }

    const suggestions: { type: string; label: string; value: string }[] = [];

    // Get recent proposals
    const recentProposals = await ctx.db
      .query("proposals")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .order("desc")
      .take(3);
    
    recentProposals.forEach((p) => {
      suggestions.push({
        type: "proposal",
        label: p.title,
        value: p.title,
      });
    });

    // Get top clients (non-archived)
    const topClients = await ctx.db
      .query("clients")
      .withIndex("by_firm", (q) => q.eq("firmId", user.firmId))
      .take(5);
    
    topClients.forEach((c) => {
      if (c.status !== "archived") {
        suggestions.push({
          type: "client",
          label: c.companyName,
          value: c.companyName,
        });
      }
    });

    return suggestions.slice(0, 5);
  },
});
