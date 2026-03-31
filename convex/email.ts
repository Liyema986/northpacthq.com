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

    // NorthPact system palette — consistent across all emails
    const navyColor = "#243E63";
    const goldColor = "#C8A96E";
    const ctaColor = firm.brandColors?.primary || goldColor;
    const firmLogoUrl = (firm as any).logoUrl as string | undefined;

    // Create email HTML — Outlook-safe (no border-radius, no gradient, VML button)
    const emailHtml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Proposal from ${firm.name}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Outer wrapper for background color -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Email card -->
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">

        <!-- Header bar — solid color, Outlook-safe -->
        <tr>
          <td bgcolor="${navyColor}" style="background-color:${navyColor};padding:28px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                ${firmLogoUrl ? `<td width="48" valign="middle" style="padding-right:14px;"><img src="${firmLogoUrl}" width="44" height="44" alt="${firm.name}" style="display:block;border:0;outline:none;width:44px;height:44px;object-fit:contain;" /></td>` : ""}
                <td>
                  <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">${firm.name}</h1>
                  <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);font-family:Arial,Helvetica,sans-serif;">${proposal.title}</p>
                </td>
                <td align="right" valign="top" width="90">
                  <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background-color:${goldColor};padding:5px 14px;font-size:10px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">PROPOSAL</td></tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Gold accent strip -->
        <tr><td bgcolor="${goldColor}" style="background-color:${goldColor};height:3px;font-size:1px;line-height:1px;">&nbsp;</td></tr>

        <!-- Body content -->
        <tr>
          <td style="padding:32px 32px 24px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 8px;font-size:15px;color:#334155;">Dear ${proposal.clientName},</p>
            <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">Thank you for the opportunity to work with you. We&rsquo;re pleased to present our proposal for your review.</p>

            ${args.customMessage ? `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
              <tr>
                <td width="4" bgcolor="${goldColor}" style="background-color:${goldColor};"></td>
                <td bgcolor="#f8fafc" style="background-color:#f8fafc;padding:14px 18px;">
                  <p style="margin:0;font-size:12px;font-weight:700;color:#475569;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.04em;">Personal message</p>
                  <p style="margin:8px 0 0;font-size:14px;color:#64748b;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${args.customMessage.replace(/\n/g, "<br>")}</p>
                </td>
              </tr>
            </table>
            ` : ""}

            <!-- Proposal details card -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;margin:0 0 28px;">
              <tr><td style="padding:18px 22px;">
                <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:${goldColor};letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Proposal Details</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr><td style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">Proposal number</td><td align="right" style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">${proposal.proposalNumber}</td></tr>
                  <tr><td style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">Date</td><td align="right" style="padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">${new Date(proposal.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</td></tr>
                  ${proposal.validUntil ? `<tr><td style="padding:7px 0;font-size:12px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">Valid until</td><td align="right" style="padding:7px 0;font-size:13px;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">${new Date(proposal.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</td></tr>` : ""}
                </table>
              </td></tr>
            </table>

            <!-- Services table -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
              <tr><td style="padding:7px 0;border-bottom:1px solid #cbd5e1;font-size:11px;font-weight:700;color:#64748b;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.04em;">Service</td><td align="right" style="padding:7px 0;border-bottom:1px solid #cbd5e1;font-size:11px;font-weight:700;color:#64748b;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.04em;">Amount</td></tr>
              ${proposal.services.map((s: any) => `<tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;font-family:Arial,Helvetica,sans-serif;">${s.serviceName} <span style="color:#94a3b8;">&times; ${s.quantity}</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">${formatCurrencyEmail(s.subtotal)}</td></tr>`).join("")}
              <tr><td style="padding:14px 0 0;font-size:15px;font-weight:700;color:${navyColor};font-family:Arial,Helvetica,sans-serif;">Total</td><td align="right" style="padding:14px 0 0;font-size:17px;font-weight:700;color:${goldColor};font-family:Arial,Helvetica,sans-serif;">${formatCurrencyEmail(proposal.total)}</td></tr>
            </table>

            <!-- CTA button — gold with navy text, Outlook VML fallback -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 28px;">
              <tr><td align="center">
                <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${viewUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="0%" fillcolor="${navyColor}" stroke="f"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">View Proposal</center></v:roundrect><![endif]-->
                <!--[if !mso]><!--><a href="${viewUrl}" style="display:inline-block;background-color:${navyColor};color:#ffffff;padding:14px 44px;text-decoration:none;font-weight:700;font-size:15px;font-family:Arial,Helvetica,sans-serif;border-radius:6px;">View Proposal</a><!--<![endif]-->
              </td></tr>
            </table>

            <p style="margin:0 0 28px;font-size:13px;color:#94a3b8;text-align:center;font-family:Arial,Helvetica,sans-serif;">Review the proposal online, accept or decline, and sign digitally.<br>If you have any questions, please reach out.</p>

            <p style="margin:0;font-size:14px;color:#334155;font-family:Arial,Helvetica,sans-serif;">Best regards,<br><strong>${user.name}</strong><br><span style="color:#64748b;">${firm.name}</span></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="#f8fafc" style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td><p style="margin:0;font-size:12px;font-weight:700;color:#334155;font-family:Arial,Helvetica,sans-serif;">${firm.name}</p><p style="margin:3px 0 0;font-size:11px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">Powered by NorthPact</p></td>
                <td align="right" valign="middle"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background-color:${goldColor};width:28px;height:3px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
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

    const navyColor = "#243E63";
    const goldColor = "#C8A96E";
    const firmLogoUrl = (firm as any).logoUrl as string | undefined;

    const emailHtml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Proposal from ${firm.name}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
        <tr><td bgcolor="${navyColor}" style="background-color:${navyColor};padding:28px 32px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            ${firmLogoUrl ? `<td width="48" valign="middle" style="padding-right:14px;"><img src="${firmLogoUrl}" width="44" height="44" alt="${firm.name}" style="display:block;border:0;outline:none;width:44px;height:44px;object-fit:contain;" /></td>` : ""}
            <td><h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">${firm.name}</h1><p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);font-family:Arial,Helvetica,sans-serif;">${proposal.title}</p></td>
            <td align="right" valign="top" width="90"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background-color:${goldColor};padding:5px 14px;font-size:10px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">PROPOSAL</td></tr></table></td>
          </tr></table>
        </td></tr>
        <tr><td bgcolor="${goldColor}" style="background-color:${goldColor};height:3px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 24px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 8px;font-size:15px;color:#334155;">Dear ${proposal.clientName},</p>
          <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">Thank you for the opportunity to work with you. We&rsquo;re pleased to present our proposal for your review.</p>
          ${args.customMessage ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;"><tr><td width="4" bgcolor="${goldColor}" style="background-color:${goldColor};"></td><td bgcolor="#f8fafc" style="background-color:#f8fafc;padding:14px 18px;"><p style="margin:0;font-size:12px;font-weight:700;color:#475569;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.04em;">Personal message</p><p style="margin:8px 0 0;font-size:14px;color:#64748b;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${args.customMessage.replace(/\n/g, "<br>")}</p></td></tr></table>` : ""}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;margin:0 0 28px;">
            <tr><td style="padding:18px 22px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">${proposal.proposalNumber}</p>
              <p style="margin:0;font-size:13px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">Services: ${proposal.services?.map((s: any) => `${s.serviceName} &times; ${s.quantity}`).join(", ")}</p>
              <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:${goldColor};font-family:Arial,Helvetica,sans-serif;">Total: ${formatCurrencyEmail(proposal.total)}</p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 28px;">
            <tr><td align="center">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${viewUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="0%" fillcolor="${navyColor}" stroke="f"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">View Proposal</center></v:roundrect><![endif]-->
              <!--[if !mso]><!--><a href="${viewUrl}" style="display:inline-block;background-color:${navyColor};color:#ffffff;padding:14px 44px;text-decoration:none;font-weight:700;font-size:15px;font-family:Arial,Helvetica,sans-serif;border-radius:6px;">View Proposal</a><!--<![endif]-->
            </td></tr>
          </table>
          <p style="margin:0;font-size:14px;color:#334155;font-family:Arial,Helvetica,sans-serif;">Best regards,<br><strong>${user.name}</strong><br><span style="color:#64748b;">${firm.name}</span></p>
        </td></tr>
        <tr><td bgcolor="#f8fafc" style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            <td><p style="margin:0;font-size:12px;font-weight:700;color:#334155;font-family:Arial,Helvetica,sans-serif;">${firm.name}</p><p style="margin:3px 0 0;font-size:11px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">Powered by NorthPact</p></td>
            <td align="right" valign="middle"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background-color:${goldColor};width:28px;height:3px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
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

/**
 * [Internal] Send the engagement letter signing link to the client after they
 * accept a proposal. Calls generateAndLinkSigningSession to create the letter
 * (if not yet generated) and the signing session, then emails the link via Resend.
 * Scheduled automatically from proposalAccept.acceptProposal.
 */
export const sendEngagementLetterEmail = action({
  args: {
    proposalId: v.id("proposals"),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const proposal = await ctx.runQuery(internal.emailHelpers.getProposalForEmail, {
      proposalId: args.proposalId,
    });
    if (!proposal) return { success: false, error: "Proposal not found" };

    const client = await ctx.runQuery(internal.emailHelpers.getClientForEmail, {
      clientId: proposal.clientId,
    });
    if (!client?.email) return { success: false, error: "Client email not set" };

    const firm = await ctx.runQuery(internal.emailHelpers.getFirmForEmail, {
      firmId: proposal.firmId,
    });
    if (!firm) return { success: false, error: "Firm not found" };

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendDomain = process.env.RESEND_DOMAIN || "";
    if (!resendApiKey || !resendDomain || resendDomain === "yourdomain.com") {
      return { success: false, error: "Email (Resend) not configured" };
    }

    // Generate (or reuse) engagement letter + signing session
    const result = await ctx.runMutation(
      internal.engagementLetters.generateAndLinkSigningSession,
      { proposalId: args.proposalId, createdByUserId: proposal.createdBy }
    );

    if (!result) {
      // No scope-library templates linked — skip silently (not an error)
      return { success: true };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.CONVEX_SITE_URL ?? "";
    const signingUrl = `${siteUrl}${result.signingUrl}`;
    const primaryColor = firm.brandColors?.primary ?? "#C8A96E";
    const secondaryColor = firm.brandColors?.secondary ?? "#243E63";
    const clientName =
      (client as any).contactName || (client as any).companyName || "Client";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f8fafc;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;">
    <tr>
      <td style="background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);padding:36px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">${firm.name}</h1>
        <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Engagement Letter — ready to sign</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;color:#334155;">Dear ${clientName},</p>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;">
          Thank you for accepting our proposal. Please review and sign your engagement letter at your earliest convenience.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${primaryColor};letter-spacing:0.05em;text-transform:uppercase;">Letter details</p>
            <p style="margin:0;font-size:14px;color:#334155;"><strong>Letter number:</strong> ${result.letterNumber}</p>
            <p style="margin:6px 0 0;font-size:14px;color:#334155;"><strong>Proposal:</strong> ${proposal.title}</p>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:32px 0 24px;">
          <tr><td align="center">
            <a href="${signingUrl}" style="display:inline-block;background:${primaryColor};color:#fff !important;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.12);">Sign Engagement Letter</a>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;text-align:center;">Or copy this link:<br>${signingUrl}</p>
        <p style="margin:24px 0 0;font-size:15px;color:#334155;">Kind regards,<br><strong>${firm.name}</strong></p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;background:linear-gradient(135deg,#e0f2fe 0%,#f3e8ff 50%,#e0e7ff 100%);border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#64748b;">Powered by NorthPact</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `Dear ${clientName},\n\nThank you for accepting our proposal. Please sign your engagement letter (${result.letterNumber}) using the link below:\n\n${signingUrl}\n\nKind regards,\n${firm.name}`;

    const resend = new Resend(resendApiKey);
    try {
      await resend.emails.send({
        from: `${firm.name} <proposals@${resendDomain}>`,
        to: [client.email],
        subject: `Please sign your Engagement Letter — ${result.letterNumber}`,
        html,
        text,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Failed to send engagement letter email" };
    }
  },
});

/**
 * [Internal] Notify the firm by email when a client signs their engagement letter.
 * Scheduled automatically from signatures.submitSignature.
 */
export const sendEngagementLetterSignedEmail = action({
  args: {
    letterId: v.id("engagementLetters"),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const letter = await ctx.runQuery(internal.engagementLetters.getLetterByIdInternal, {
      letterId: args.letterId,
    });
    if (!letter) return { success: false, error: "Letter not found" };

    const client = await ctx.runQuery(internal.emailHelpers.getClientForEmail, {
      clientId: letter.clientId,
    });

    const firm = await ctx.runQuery(internal.emailHelpers.getFirmForEmail, {
      firmId: letter.firmId,
    });
    if (!firm) return { success: false, error: "Firm not found" };

    // Look up the proposal to find its creator (engagement letters don't store createdBy)
    const proposal = await ctx.runQuery(internal.emailHelpers.getProposalForEmail, {
      proposalId: letter.proposalId,
    });
    const staffUserId = proposal?.createdBy;
    if (!staffUserId) return { success: false, error: "Could not resolve staff user" };

    const staffUser = await ctx.runQuery(internal.emailHelpers.getUserForEmail, {
      userId: staffUserId,
    });
    if (!staffUser?.email) return { success: false, error: "Staff user email not set" };

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendDomain = process.env.RESEND_DOMAIN || "";
    if (!resendApiKey || !resendDomain || resendDomain === "yourdomain.com") {
      return { success: false, error: "Email (Resend) not configured" };
    }

    const primaryColor = firm.brandColors?.primary ?? "#C8A96E";
    const clientName = (client as any)?.companyName ?? "Client";
    const signerName = letter.signatureData?.signerName ?? clientName;
    const signedAt = letter.signedAt
      ? new Date(letter.signedAt).toLocaleString("en-ZA", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "just now";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f8fafc;color:#1e293b;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;">
    <tr>
      <td style="background:${primaryColor};padding:36px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">Engagement Letter Signed</h1>
        <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">${letter.letterNumber}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 24px;font-size:15px;color:#475569;">
          <strong>${signerName}</strong> from <strong>${clientName}</strong> has signed engagement letter <strong>${letter.letterNumber}</strong>.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#16a34a;letter-spacing:0.05em;text-transform:uppercase;">Signature confirmed</p>
            <p style="margin:0;font-size:14px;color:#334155;"><strong>Signer:</strong> ${signerName}</p>
            <p style="margin:6px 0 0;font-size:14px;color:#334155;"><strong>Client:</strong> ${clientName}</p>
            <p style="margin:6px 0 0;font-size:14px;color:#334155;"><strong>Signed at:</strong> ${signedAt}</p>
            <p style="margin:6px 0 0;font-size:14px;color:#334155;"><strong>Letter:</strong> ${letter.letterNumber}</p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;color:#64748b;">Log in to NorthPact to view the signed document.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;background:linear-gradient(135deg,#e0f2fe 0%,#f3e8ff 50%,#e0e7ff 100%);border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#64748b;">Powered by NorthPact</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `Engagement Letter Signed\n\n${signerName} from ${clientName} has signed engagement letter ${letter.letterNumber}.\n\nSigned at: ${signedAt}\n\nLog in to NorthPact to view the signed document.`;

    const resend = new Resend(resendApiKey);
    try {
      await resend.emails.send({
        from: `NorthPact <proposals@${resendDomain}>`,
        to: [staffUser.email],
        subject: `Engagement letter signed — ${letter.letterNumber} (${clientName})`,
        html,
        text,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Failed to send signed notification" };
    }
  },
});
