// convex/email.ts
"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Resend } from "resend";

/**
 * Send proposal email to client
 */
export const sendProposalEmail = action({
  args: {
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get proposal details using internal helpers
    const proposalDoc = await ctx.runQuery(internal.emailHelpers.getProposalForEmail, {
      proposalId: args.proposalId,
    });

    if (!proposalDoc) {
      throw new Error("Proposal not found");
    }

    // Get client for email
    const client = await ctx.runQuery(internal.emailHelpers.getClientForEmail, {
      clientId: proposalDoc.clientId,
    });

    const proposal = {
      ...proposalDoc,
      clientName: client?.companyName || "Client",
      clientEmail: client?.email || "",
    };

    if (!proposal.clientEmail.trim()) {
      throw new Error(
        "This client has no email address. Add it on the client profile, then try again."
      );
    }

    // Get user and firm details
    const user = await ctx.runQuery(internal.emailHelpers.getUserForEmail, {
      userId: args.userId,
    });

    if (!user || user.firmId !== proposal.firmId) {
      throw new Error("Access denied");
    }

    const firm = await ctx.runQuery(internal.emailHelpers.getFirmForEmail, {
      firmId: user.firmId,
    });

    if (!firm) {
      throw new Error("Firm not found");
    }

    // Enforce approval requirement
    if (firm.requireApprovalBeforeSend && proposalDoc.status !== "approved") {
      throw new Error(
        "This proposal requires internal approval before it can be sent."
      );
    }

    // Create proposal accept session (token for client view/accept)
    const { viewUrl } = await ctx.runMutation(
      internal.emailHelpers.createProposalAcceptSessionInternal,
      {
        firmId: firm._id,
        proposalId: args.proposalId,
      }
    );

    // Initialize Resend (you'll need to set RESEND_API_KEY in Convex environment variables)
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendDomain = process.env.RESEND_DOMAIN || "yourdomain.com";

    if (!resendApiKey) {
      throw new Error("Resend API key not configured. Please add RESEND_API_KEY to your Convex environment variables.");
    }
    if (!process.env.RESEND_DOMAIN || resendDomain === "yourdomain.com" || resendDomain.includes("onboarding.resend.dev")) {
      throw new Error(
        "Resend domain must be a verified domain you own. Add and verify your domain at https://resend.com/domains, " +
        "then set RESEND_DOMAIN in Convex (e.g. npx convex env set RESEND_DOMAIN mail.yourfirm.com). " +
        "The onboarding.resend.dev domain is no longer supported."
      );
    }

    const resend = new Resend(resendApiKey);

    // Generate tracking pixel URL
    const trackingPixelUrl = `${process.env.CONVEX_SITE_URL}/api/track-open/${args.proposalId}`;

    // Format currency for email (use firm/proposal currency, default ZAR)
    const currency = proposal.currency || firm.currency || "ZAR";
    const formatCurrencyEmail = (amount: number) =>
      new Intl.NumberFormat("en-ZA", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(amount) || 0);

    const primaryColor = firm.brandColors?.primary || "#4F46E5";
    const secondaryColor = firm.brandColors?.secondary || "#7C3AED";

    // Create email HTML - professional, clean, balanced (ProposalViewPage-inspired)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New Proposal from ${firm.name}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f8fafc;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;">
    <!-- Header: primary gradient, firm name, Proposal pill -->
    <tr>
      <td style="background:linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);padding:36px 32px;border-radius:12px 12px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em;">${firm.name}</h1>
              <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">${proposal.title}</p>
            </td>
            <td align="right" style="vertical-align:top;">
              <span style="display:inline-block;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:#fff;padding:6px 14px;border-radius:9999px;font-size:11px;font-weight:600;letter-spacing:0.05em;">PROPOSAL</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;color:#334155;">Dear ${proposal.clientName},</p>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;">Thank you for the opportunity to work with you. We're pleased to present our proposal for your review.</p>

        ${args.customMessage ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border-left:4px solid ${primaryColor};border-radius:0 8px 8px 0;">
          <tr><td style="padding:16px 20px;"><p style="margin:0;font-size:14px;color:#475569;"><strong>Personal message</strong></p><p style="margin:8px 0 0;font-size:14px;color:#64748b;">${args.customMessage.replace(/\n/g, "<br>")}</p></td></tr>
        </table>
        ` : ""}

        <!-- Proposal info card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:${primaryColor};letter-spacing:0.05em;text-transform:uppercase;">Proposal details</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:12px;color:#64748b;">Proposal number</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:14px;font-weight:600;color:#1e293b;">${proposal.proposalNumber}</span></td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:12px;color:#64748b;">Date</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:14px;color:#1e293b;">${new Date(proposal.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></td></tr>
              ${proposal.validUntil ? `<tr><td style="padding:8px 0;"><span style="font-size:12px;color:#64748b;">Valid until</span></td><td align="right" style="padding:8px 0;"><span style="font-size:14px;color:#1e293b;">${new Date(proposal.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></td></tr>` : ""}
            </table>
          </td></tr>
        </table>

        <!-- Services summary -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:12px;color:#64748b;">Services</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="font-size:12px;color:#64748b;">Amount</span></td></tr>
          ${proposal.services.map((s: any) => `<tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:14px;color:#334155;">${s.serviceName}</span> <span style="color:#94a3b8;">× ${s.quantity}</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:14px;color:#1e293b;">${formatCurrencyEmail(s.subtotal)}</span></td></tr>`).join("")}
          <tr><td style="padding:14px 0 0;font-size:16px;font-weight:700;color:${primaryColor};">Total</td><td align="right" style="padding:14px 0 0;font-size:18px;font-weight:700;color:${primaryColor};">${formatCurrencyEmail(proposal.total)}</td></tr>
        </table>

        <!-- CTA: View Proposal - prominent, centered -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:32px 0 24px;">
          <tr><td align="center">
            <a href="${viewUrl}" style="display:inline-block;background:${primaryColor};color:#fff !important;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.12);">View Proposal</a>
          </td></tr>
        </table>

        <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Review the proposal online, accept or decline, and sign digitally. If you have any questions, please reach out.</p>

        <p style="margin:0;font-size:15px;color:#334155;">Best regards,<br><strong>${user.name}</strong><br>${firm.name}</p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:24px 32px;background:linear-gradient(135deg,#e0f2fe 0%,#f3e8ff 50%,#e0e7ff 100%);border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">${firm.name}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Powered by ProposalPro</p>
      </td>
    </tr>
  </table>
  <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">
</body>
</html>
    `;

    // Plain text version (clean, scannable)
    const emailText = `
New Proposal from ${firm.name}

Dear ${proposal.clientName},

Thank you for the opportunity to work with you. We're pleased to present our proposal for your review.

${args.customMessage ? `\nPersonal message:\n${args.customMessage}\n` : ""}

PROPOSAL DETAILS
- Proposal: ${proposal.title}
- Number: ${proposal.proposalNumber}
- Date: ${new Date(proposal.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
${proposal.validUntil ? `- Valid until: ${new Date(proposal.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}

SERVICES
${proposal.services.map((s: any) => `- ${s.serviceName} × ${s.quantity}: ${formatCurrencyEmail(s.subtotal)}`).join("\n")}

Total: ${formatCurrencyEmail(proposal.total)}

View proposal: ${viewUrl}

Review the proposal online, accept or decline, and sign digitally. If you have any questions, please reach out.

Best regards,
${user.name}
${firm.name}
    `;

    // Insert email record (queued)
    const emailId = await ctx.runMutation(
      internal.emailHelpers.insertEmailRecordInternal,
      {
        firmId: firm._id,
        proposalId: args.proposalId,
        to: proposal.clientEmail,
        subject: `Proposal: ${proposal.title}`,
        status: "queued",
        createdBy: args.userId,
      }
    );

    try {
      // Attach PDF if stored
      const attachments: { filename: string; content: Buffer }[] = [];
      if (proposalDoc.pdfUrl) {
        const pdfUrl = await ctx.runQuery(api.storage.getStorageUrl, {
          storageId: proposalDoc.pdfUrl,
        });
        if (pdfUrl) {
          const res = await fetch(pdfUrl);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            attachments.push({
              filename: `proposal-${proposal.proposalNumber}.pdf`,
              content: Buffer.from(arrayBuffer),
            });
          }
        }
      }

      // Send email via Resend
      const { data, error } = await resend.emails.send({
        from: `${firm.name} <proposals@${resendDomain}>`,
        to: [proposal.clientEmail],
        replyTo: user.email,
        subject: `Proposal: ${proposal.title}`,
        html: emailHtml,
        text: emailText,
        ...(attachments.length > 0 && { attachments }),
      });

      if (error) {
        await ctx.runMutation(internal.emailHelpers.updateEmailRecordInternal, {
          emailId,
          status: "failed",
          error: error.message,
        });
        const msg = String(error.message);
        if (msg.includes("not verified") || msg.includes("verify your domain")) {
          throw new Error(
            `Resend domain "${resendDomain}" is not verified. Add and verify your domain at https://resend.com/domains, ` +
            `then set RESEND_DOMAIN in Convex: npx convex env set RESEND_DOMAIN your-verified-domain.com`
          );
        }
        throw new Error(`Failed to send email: ${error.message}`);
      }

      // Update email record
      await ctx.runMutation(internal.emailHelpers.updateEmailRecordInternal, {
        emailId,
        status: "sent",
        resendId: data?.id,
        sentAt: Date.now(),
      });

      // Update proposal status
      await ctx.runMutation(internal.emailHelpers.updateProposalStatusEmail, {
        proposalId: args.proposalId,
        status: "sent",
        sentAt: Date.now(),
      });

      // Log activity
      await ctx.runMutation(internal.emailHelpers.logEmailSentInternal, {
        userId: args.userId,
        proposalId: args.proposalId,
        to: proposal.clientEmail,
        emailId: data?.id,
      });

      return {
        success: true,
        message: "Proposal sent successfully!",
        emailId: data?.id,
      };
    } catch (error: any) {
      // Update email record if we have one
      try {
        await ctx.runMutation(internal.emailHelpers.updateEmailRecordInternal, {
          emailId,
          status: "failed",
          error: error?.message || String(error),
        });
      } catch (_) {}
      // Log error
      await ctx.runMutation(internal.emailHelpers.logEmailErrorInternal, {
        userId: args.userId,
        proposalId: args.proposalId,
        error: error.message,
      });

      throw new Error(`Failed to send proposal: ${error.message}`);
    }
  },
});

/**
 * Process a scheduled email when its send time is reached.
 */
export const processScheduledEmail = internalAction({
  args: {
    emailId: v.id("emails"),
    userId: v.id("users"),
    proposalId: v.id("proposals"),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const emailRecord = await ctx.runQuery(
      internal.emailHelpers.getEmailForProcessInternal,
      { emailId: args.emailId }
    );
    if (!emailRecord || emailRecord.status !== "scheduled") {
      return; // Already processed or cancelled
    }

    const proposalDoc = await ctx.runQuery(
      internal.emailHelpers.getProposalForEmail,
      { proposalId: args.proposalId }
    );
    if (!proposalDoc) return;

    const client = await ctx.runQuery(
      internal.emailHelpers.getClientForEmail,
      { clientId: proposalDoc.clientId }
    );
    const user = await ctx.runQuery(internal.emailHelpers.getUserForEmail, {
      userId: args.userId,
    });
    const firm = await ctx.runQuery(internal.emailHelpers.getFirmForEmail, {
      firmId: proposalDoc.firmId,
    });
    if (!user || !firm) return;

    const proposal = {
      ...proposalDoc,
      clientName: client?.companyName || "Client",
      clientEmail: client?.email || "",
    };

    const { viewUrl } = await ctx.runMutation(
      internal.emailHelpers.createProposalAcceptSessionInternal,
      {
        firmId: firm._id,
        proposalId: args.proposalId,
      }
    );

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendDomain = process.env.RESEND_DOMAIN || "yourdomain.com";

    if (!resendApiKey) {
      await ctx.runMutation(internal.emailHelpers.updateEmailRecordInternal, {
        emailId: args.emailId,
        status: "failed",
        error: "Resend API key not configured",
      });
      return;
    }
    if (!process.env.RESEND_DOMAIN || resendDomain === "yourdomain.com" || resendDomain.includes("onboarding.resend.dev")) {
      await ctx.runMutation(internal.emailHelpers.updateEmailRecordInternal, {
        emailId: args.emailId,
        status: "failed",
        error: "Resend domain must be a verified domain you own. Add and verify at https://resend.com/domains, then set RESEND_DOMAIN in Convex.",
      });
      return;
    }

    const resend = new Resend(resendApiKey);
    const trackingPixelUrl = `${process.env.CONVEX_SITE_URL}/api/track-open/${args.proposalId}`;
    const currency = proposal.currency || firm.currency || "ZAR";
    const formatCurrencyEmail = (amount: number) =>
      new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(Number(amount) || 0);

    const primaryColor = firm.brandColors?.primary || "#4F46E5";
    const secondaryColor = firm.brandColors?.secondary || "#7C3AED";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New Proposal from ${firm.name}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f8fafc;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;">
    <tr>
      <td style="background:linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);padding:36px 32px;border-radius:12px 12px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">${firm.name}</h1>
              <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">${proposal.title}</p>
            </td>
            <td align="right" style="vertical-align:top;">
              <span style="display:inline-block;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:#fff;padding:6px 14px;border-radius:9999px;font-size:11px;font-weight:600;letter-spacing:0.05em;">PROPOSAL</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;color:#334155;">Dear ${proposal.clientName},</p>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;">Thank you for the opportunity to work with you. We're pleased to present our proposal for your review.</p>
        ${args.customMessage ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border-left:4px solid ${primaryColor};border-radius:0 8px 8px 0;"><tr><td style="padding:16px 20px;"><p style="margin:0;font-size:14px;color:#475569;"><strong>Personal message</strong></p><p style="margin:8px 0 0;font-size:14px;color:#64748b;">${args.customMessage.replace(/\n/g, "<br>")}</p></td></tr></table>` : ""}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b;">${proposal.proposalNumber}</p>
            <p style="margin:0;font-size:14px;color:#64748b;">Services: ${proposal.services?.map((s: any) => `${s.serviceName} × ${s.quantity}`).join(", ")}</p>
            <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:${primaryColor};">Total: ${formatCurrencyEmail(proposal.total)}</p>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:32px 0 24px;">
          <tr><td align="center">
            <a href="${viewUrl}" style="display:inline-block;background:${primaryColor};color:#fff !important;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.12);">View Proposal</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:15px;color:#334155;">Best regards,<br><strong>${user.name}</strong><br>${firm.name}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;background:linear-gradient(135deg,#e0f2fe 0%,#f3e8ff 50%,#e0e7ff 100%);border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">${firm.name}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Powered by ProposalPro</p>
      </td>
    </tr>
  </table>
  <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">
</body>
</html>`;

    const emailText = `New Proposal from ${firm.name}\n\nDear ${proposal.clientName},\n\nThank you for the opportunity to work with you. We're pleased to present our proposal for your review.\n\nProposal: ${proposal.title}\nNumber: ${proposal.proposalNumber}\nTotal: ${formatCurrencyEmail(proposal.total)}\n\nView proposal: ${viewUrl}\n\nBest regards,\n${user.name}\n${firm.name}`;

    try {
      const attachments: { filename: string; content: Buffer }[] = [];
      if (proposalDoc.pdfUrl) {
        const pdfUrl = await ctx.runQuery(api.storage.getStorageUrl, {
          storageId: proposalDoc.pdfUrl,
        });
        if (pdfUrl) {
          const res = await fetch(pdfUrl);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            attachments.push({
              filename: `proposal-${proposal.proposalNumber}.pdf`,
              content: Buffer.from(buf),
            });
          }
        }
      }

      const { data, error } = await resend.emails.send({
        from: `${firm.name} <proposals@${resendDomain}>`,
        to: [proposal.clientEmail],
        replyTo: user.email,
        subject: `Proposal: ${proposal.title}`,
        html: emailHtml,
        text: emailText,
        ...(attachments.length > 0 && { attachments }),
      });

      if (error) {
        const msg = String(error.message);
        const friendlyError = (msg.includes("not verified") || msg.includes("verify your domain"))
          ? `Resend domain "${resendDomain}" is not verified. Add and verify at https://resend.com/domains, then set RESEND_DOMAIN in Convex.`
          : error.message;
        await ctx.runMutation(internal.emailHelpers.updateEmailRecordInternal, {
          emailId: args.emailId,
          status: "failed",
          error: friendlyError,
        });
        return;
      }

      await ctx.runMutation(internal.emailHelpers.updateEmailRecordInternal, {
        emailId: args.emailId,
        status: "sent",
        resendId: data?.id,
        sentAt: Date.now(),
      });

      await ctx.runMutation(internal.emailHelpers.updateProposalStatusEmail, {
        proposalId: args.proposalId,
        status: "sent",
        sentAt: Date.now(),
      });

      await ctx.runMutation(internal.emailHelpers.logEmailSentInternal, {
        userId: args.userId,
        proposalId: args.proposalId,
        to: proposal.clientEmail,
        emailId: data?.id,
      });
    } catch (err: any) {
      await ctx.runMutation(internal.emailHelpers.updateEmailRecordInternal, {
        emailId: args.emailId,
        status: "failed",
        error: err?.message || String(err),
      });
    }
  },
});

/**
 * Replace merge tags in Wahoo email content.
 */
function replaceMergeTags(
  text: string,
  vars: Record<string, string>
): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\[${key}\\]`, "gi"), value ?? "");
    result = result.replace(new RegExp(`#\\[${key}\\]`, "g"), value ?? "");
  }
  return result;
}

/**
 * Send Wahoo emails (Client + Staff) when a proposal is accepted.
 * Uses configured templates from Engagement Letters > Emails.
 * Called automatically on proposal acceptance, or manually via "Resend Wahoo Emails".
 */
export const sendWahooEmails = action({
  args: {
    proposalId: v.id("proposals"),
    templateType: v.union(v.literal("signed"), v.literal("acceptance")),
    userId: v.optional(v.id("users")), // For manual resend; otherwise uses proposal.createdBy
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const proposal = await ctx.runQuery(internal.emailHelpers.getProposalForEmail, { proposalId: args.proposalId });
    if (!proposal) {
      return { success: false, error: "Proposal not found" };
    }

    const client = await ctx.runQuery(internal.emailHelpers.getClientForEmail, { clientId: proposal.clientId });
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    const staffUserId = args.userId ?? proposal.createdBy;
    const user = await ctx.runQuery(internal.emailHelpers.getUserForEmail, { userId: staffUserId });
    if (!user) {
      return { success: false, error: "Staff user not found" };
    }

    const firm = await ctx.runQuery(internal.emailHelpers.getFirmForEmail, { firmId: proposal.firmId });
    if (!firm) {
      return { success: false, error: "Firm not found" };
    }

    const templates = firm.engagementEmailTemplates?.[args.templateType];
    if (!templates) {
      return { success: true }; // No templates configured - nothing to send
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendDomain = process.env.RESEND_DOMAIN || "yourdomain.com";
    if (!resendApiKey || !process.env.RESEND_DOMAIN || resendDomain === "yourdomain.com" || resendDomain.includes("onboarding.resend.dev")) {
      return { success: false, error: "Email (Resend) not configured. Configure RESEND_API_KEY and RESEND_DOMAIN in Convex." };
    }

    const sessionInfo = await ctx.runQuery(internal.emailHelpers.getProposalAcceptSessionByProposalInternal, { proposalId: args.proposalId });
    const viewUrl = sessionInfo?.viewUrl ?? "";

    const contactParts = (client.contactName || client.companyName || "").trim().split(/\s+/);
    const firstName = contactParts[0] ?? client.companyName ?? "Client";
    const lastName = contactParts.length > 1 ? contactParts.slice(1).join(" ") : "";
    const startDate = proposal.validUntil
      ? new Date(proposal.validUntil).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : "TBD";

    const vars: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      company_name: client.companyName ?? "",
      staff_name: user.name ?? "",
      staff_email: user.email ?? "",
      staff_phone: "", // Users don't have phone in schema - leave blank
      start_date: startDate,
      additional_signatory_first_name: "",
      additional_signatory_last_name: "",
      sign_button: viewUrl ? `<a href="${viewUrl}" style="display:inline-block;background:#10B981;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">Approve Proposal</a>` : "[Approve Proposal]",
      proposal_number: proposal.proposalNumber ?? "",
      proposal_id: String(proposal._id),
      proposal_type: proposal.template ?? "proposal",
    };

    const resend = new Resend(resendApiKey);
    const from = `Proposals <proposals@${resendDomain}>`;

    try {
      if (templates.clientSubject && templates.clientContent && client.email) {
        const subject = replaceMergeTags(templates.clientSubject, vars);
        const html = replaceMergeTags(templates.clientContent, vars);
        const bodyHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6;">
${html.replace(/<br>/gi, "<br>")}
<p style="margin-top:24px;font-size:14px;color:#64748b;">Best regards,<br><strong>${user.name}</strong><br>${firm.name}</p>
</body></html>`;
        await resend.emails.send({
          from,
          to: client.email,
          subject,
          html: bodyHtml,
        });
      }

      if (templates.staffSubject && templates.staffContent && user.email) {
        const subject = replaceMergeTags(templates.staffSubject, vars);
        const html = replaceMergeTags(templates.staffContent, vars);
        const bodyHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6;">
${html.replace(/<br>/gi, "<br>")}
</body></html>`;
        await resend.emails.send({
          from,
          to: user.email,
          subject,
          html: bodyHtml,
        });
        if (templates.additionallyEmailTo?.trim()) {
          await resend.emails.send({
            from,
            to: templates.additionallyEmailTo.trim(),
            subject: replaceMergeTags(templates.staffSubject, vars),
            html: bodyHtml,
          });
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Failed to send emails" };
    }
  },
});

/**
 * Track proposal email opens
 */
export const trackProposalOpen = internalAction({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    // Update proposal with viewed timestamp
    await ctx.runMutation(internal.emailHelpers.updateProposalStatusEmail, {
      proposalId: args.proposalId,
      viewedAt: Date.now(),
    });

    // Log activity
    await ctx.runMutation(internal.emailHelpers.logProposalViewedInternal, {
      proposalId: args.proposalId,
    });

    return { success: true };
  },
});

/**
 * Team workspace invite — link opens /auth?invite=… so the invitee can sign up with Clerk.
 * syncClerkUser links the Convex user row by email when they complete signup.
 */
export const sendTeamInviteEmail = internalAction({
  args: {
    to: v.string(),
    firmName: v.string(),
    inviterName: v.optional(v.string()),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendDomain = process.env.RESEND_DOMAIN || "yourdomain.com";
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured in Convex");
    }
    if (
      !process.env.RESEND_DOMAIN ||
      resendDomain === "yourdomain.com" ||
      resendDomain.includes("onboarding.resend.dev")
    ) {
      throw new Error(
        "RESEND_DOMAIN must be a verified domain. Set it in Convex (npx convex env set RESEND_DOMAIN mail.yourdomain.com)."
      );
    }
    if (!baseUrl) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is not set in Convex. Set your app URL: npx convex env set NEXT_PUBLIC_SITE_URL https://your-domain.com"
      );
    }

    const resend = new Resend(resendApiKey);
    const from = `NorthPact <team@${resendDomain}>`;
    const inviteUrl = `${baseUrl}/auth?invite=${encodeURIComponent(args.token)}&tab=signup`;

    await resend.emails.send({
      from,
      to: args.to,
      subject: `You're invited to join ${args.firmName} on NorthPact`,
      html: `
        <p>Hi there,</p>
        <p>${args.inviterName ? `${args.inviterName} has invited you to join` : "You've been invited to join"} <strong>${args.firmName}</strong> on NorthPact.</p>
        <p><a href="${inviteUrl}" style="color:#1e3a5f;font-weight:600;">Accept invitation and create your account</a></p>
        <p>This invitation expires in 7 days.</p>
        <p>— The NorthPact Team</p>
      `,
    });
    return null;
  },
});
