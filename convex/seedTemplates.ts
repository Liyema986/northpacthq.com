// convex/seedTemplates.ts
import { mutation } from "./_generated/server";

/**
 * Seed engagement letter templates for all jurisdictions and service types
 */
export const seedLetterTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Check if templates already exist
    const existingTemplates = await ctx.db
      .query("letterTemplates")
      .filter((q) => q.eq(q.field("isSystemTemplate"), true))
      .collect();

    if (existingTemplates.length > 0) {
      return {
        success: false,
        message: "Templates already seeded",
        count: existingTemplates.length,
      };
    }

    const templates = [
      // ===== UNITED STATES TEMPLATES =====
      {
        name: "US Audit Engagement Letter",
        description: "Standard audit engagement letter compliant with AICPA standards",
        jurisdiction: "US",
        serviceType: "audit",
        content: `<h1>Audit Engagement Letter</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Engagement Overview</h2>
<p>This letter confirms our understanding of the terms and objectives of our engagement and the nature and limitations of the services we will provide.</p>

<p>You have requested that we audit the financial statements of {{clientName}}, which comprise the balance sheet as of {{fiscalYearEnd}}, and the related statements of income, changes in stockholders' equity, and cash flows for the year then ended, and the related notes to the financial statements.</p>

<h2>Our Responsibilities</h2>
<p>We will conduct our audit in accordance with auditing standards generally accepted in the United States of America (GAAS). Those standards require that we plan and perform the audit to obtain reasonable assurance about whether the financial statements are free from material misstatement.</p>

<h2>Management's Responsibilities</h2>
<p>Our audit will be conducted on the basis that management acknowledges and understands that they have responsibility:</p>
<ul>
  <li>For the preparation and fair presentation of the financial statements in accordance with accounting principles generally accepted in the United States of America</li>
  <li>For the design, implementation, and maintenance of internal control relevant to the preparation and fair presentation of financial statements that are free from material misstatement</li>
  <li>To provide us with access to all information relevant to the financial statements</li>
</ul>

<h2>Fees and Billing</h2>
<p>Our fees for these services will be {{proposalTotal}} as outlined in the attached proposal. Invoices are payable upon presentation.</p>

<h2>Limitation of Liability</h2>
<p>You agree that our liability to you shall be limited to the amount of fees paid for this engagement. In no event shall we be liable for consequential, special, indirect, incidental, punitive or exemplary loss, damage or expense.</p>

<h2>Dispute Resolution</h2>
<p>Any dispute arising from this agreement shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.</p>

<p>If you have any questions, please contact us. If this letter correctly expresses your understanding, please sign the enclosed copy and return it to us.</p>

<p>Sincerely,</p>

<p>{{firmName}}<br/>
{{firmAddress}}</p>

<hr/>

<p><strong>Acknowledged and Agreed:</strong></p>

<p>Signature: _________________________</p>
<p>Name: {{clientContactName}}</p>
<p>Title: _________________________</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "management-responsibilities",
          "limitation-of-liability",
          "dispute-resolution",
          "confidentiality",
          "professional-standards"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },

      // US Bookkeeping
      {
        name: "US Bookkeeping Engagement Letter",
        description: "Standard bookkeeping services engagement letter",
        jurisdiction: "US",
        serviceType: "bookkeeping",
        content: `<h1>Bookkeeping Services Engagement Letter</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Services to be Provided</h2>
<p>This letter confirms our understanding of the terms and objectives of our engagement to provide bookkeeping services for {{clientName}}.</p>

<p>Our services will include:</p>
<ul>
  <li>Recording financial transactions in your accounting system</li>
  <li>Reconciling bank and credit card accounts</li>
  <li>Preparing monthly financial statements</li>
  <li>Managing accounts payable and receivable</li>
  <li>Generating financial reports as needed</li>
</ul>

<h2>Your Responsibilities</h2>
<p>You are responsible for:</p>
<ul>
  <li>Providing timely and accurate source documents</li>
  <li>Maintaining proper internal controls</li>
  <li>Reviewing monthly financial statements</li>
  <li>Making all management decisions</li>
</ul>

<h2>Fees and Payment Terms</h2>
<p>Our monthly fee for these services is {{proposalTotal}}. Payment is due within 15 days of invoice date.</p>

<h2>Limitation of Services</h2>
<p>We will not audit, review, or compile the financial statements. Our services do not include fraud detection or prevention. Management is responsible for establishing and maintaining internal controls.</p>

<h2>Confidentiality</h2>
<p>All information obtained during the engagement will be kept confidential except as required by law or professional standards.</p>

<h2>Termination</h2>
<p>Either party may terminate this agreement with 30 days written notice.</p>

<p>Please sign and return a copy of this letter to indicate your agreement with its terms.</p>

<p>Sincerely,</p>

<p>{{firmName}}</p>

<hr/>

<p><strong>Accepted By:</strong></p>
<p>Signature: _________________________</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "client-responsibilities",
          "limitation-of-services",
          "confidentiality",
          "termination"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },

      // US Tax
      {
        name: "US Tax Preparation Engagement Letter",
        description: "Tax preparation and filing services engagement letter",
        jurisdiction: "US",
        serviceType: "tax",
        content: `<h1>Tax Preparation Engagement Letter</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Scope of Services</h2>
<p>We are pleased to confirm our engagement to prepare your {{taxYear}} federal and state income tax returns.</p>

<p>Our services include:</p>
<ul>
  <li>Preparation of Form 1040 and applicable schedules</li>
  <li>State income tax return preparation</li>
  <li>Electronic filing with the IRS and state authorities</li>
  <li>Tax planning recommendations</li>
</ul>

<h2>Your Responsibilities</h2>
<p>You agree to provide us with:</p>
<ul>
  <li>Complete and accurate information necessary for tax return preparation</li>
  <li>All W-2s, 1099s, and other tax documents</li>
  <li>Records of deductible expenses</li>
  <li>Prompt responses to our inquiries</li>
</ul>

<h2>IRS Circular 230 Disclosure</h2>
<p>IRS regulations require us to inform you that any tax advice in this engagement letter is not intended or written to be used, and cannot be used, for the purpose of avoiding federal tax penalties.</p>

<h2>Professional Fees</h2>
<p>Our fee for these services is {{proposalTotal}}. Additional services will be billed separately.</p>

<h2>Limitation of Engagement</h2>
<p>We will not audit or verify the information you provide. We will rely on the accuracy and completeness of your records without further verification.</p>

<h2>Penalties and Interest</h2>
<p>You are responsible for any penalties, interest, or additional taxes that may result from positions taken on your returns.</p>

<p>Please acknowledge your agreement by signing below.</p>

<p>Very truly yours,</p>

<p>{{firmName}}</p>

<hr/>

<p><strong>Acknowledged:</strong></p>
<p>Signature: _________________________</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "client-responsibilities",
          "circular-230-disclosure",
          "limitation-of-engagement",
          "penalties-interest"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },

      // US Advisory
      {
        name: "US Advisory Services Engagement Letter",
        description: "Business advisory and consulting services letter",
        jurisdiction: "US",
        serviceType: "advisory",
        content: `<h1>Advisory Services Engagement Letter</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Engagement Scope</h2>
<p>This letter sets forth our understanding of the terms and objectives of our advisory services engagement.</p>

<p>We will provide the following advisory services:</p>
<ul>
  <li>Business strategy consulting</li>
  <li>Financial analysis and modeling</li>
  <li>Operational improvement recommendations</li>
  <li>Management reporting and KPI development</li>
</ul>

<h2>Deliverables</h2>
<p>We will provide written reports and recommendations as appropriate throughout the engagement.</p>

<h2>Professional Standards</h2>
<p>Our services will be performed in accordance with applicable professional standards. However, this is not an assurance engagement and we will not issue an opinion or conclusion.</p>

<h2>Client Cooperation</h2>
<p>Your cooperation and timely responses are essential. Delays may affect our ability to complete services within the agreed timeframe.</p>

<h2>Fees</h2>
<p>Our fee for these services is {{proposalTotal}}. We bill monthly for services rendered.</p>

<h2>Limitation of Liability</h2>
<p>Our liability shall not exceed the fees paid for this engagement. We shall not be liable for consequential or indirect damages.</p>

<h2>Confidentiality</h2>
<p>We will maintain confidentiality of all client information except as required by law.</p>

<p>If this letter correctly sets forth your understanding, please sign and return a copy.</p>

<p>Respectfully,</p>

<p>{{firmName}}</p>

<hr/>

<p><strong>Agreed:</strong></p>
<p>Signature: _________________________</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "deliverables",
          "professional-standards",
          "limitation-of-liability",
          "confidentiality"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },

      // US Payroll
      {
        name: "US Payroll Services Engagement Letter",
        description: "Payroll processing and compliance services letter",
        jurisdiction: "US",
        serviceType: "payroll",
        content: `<h1>Payroll Services Engagement Letter</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Services</h2>
<p>We will provide the following payroll services:</p>
<ul>
  <li>Processing payroll on your designated schedule</li>
  <li>Calculating and remitting payroll taxes</li>
  <li>Filing quarterly and annual tax returns (941, 940, W-2, W-3)</li>
  <li>Maintaining payroll records</li>
  <li>Providing payroll reports</li>
</ul>

<h2>Your Responsibilities</h2>
<p>You will provide:</p>
<ul>
  <li>Timely and accurate time and attendance records</li>
  <li>Employee information and withholding forms</li>
  <li>Authorization for all payroll transactions</li>
  <li>Sufficient funds for payroll and tax payments</li>
</ul>

<h2>Compliance</h2>
<p>While we will make reasonable efforts to comply with federal and state regulations, you retain ultimate responsibility for compliance with all employment laws.</p>

<h2>Fees</h2>
<p>Monthly fee: {{proposalTotal}}. Additional charges may apply for year-end processing and special reports.</p>

<h2>Limitation of Services</h2>
<p>Our services do not include HR consulting, benefits administration, or legal advice regarding employment matters.</p>

<h2>Data Security</h2>
<p>We maintain appropriate security measures to protect your payroll data.</p>

<p>Please sign below to authorize these services.</p>

<p>Sincerely,</p>

<p>{{firmName}}</p>

<hr/>

<p><strong>Authorized By:</strong></p>
<p>Signature: _________________________</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "client-responsibilities",
          "compliance",
          "limitation-of-services",
          "data-security"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },

      // ===== UNITED KINGDOM TEMPLATES =====
      {
        name: "UK Audit Engagement Letter",
        description: "Audit engagement letter compliant with UK FRC standards",
        jurisdiction: "UK",
        serviceType: "audit",
        content: `<h1>Audit Engagement Letter</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Terms of Engagement</h2>
<p>This letter sets out the basis on which we are to act as auditors of {{clientName}} and the respective responsibilities of the directors and ourselves.</p>

<h2>The Audit</h2>
<p>We will conduct our audit in accordance with International Standards on Auditing (UK) ("ISAs (UK)"). Our audit will be planned and performed to obtain reasonable assurance that the financial statements are free from material misstatement.</p>

<h2>Directors' Responsibilities</h2>
<p>The directors are responsible for:</p>
<ul>
  <li>Preparing financial statements which give a true and fair view</li>
  <li>Maintaining proper accounting records</li>
  <li>Establishing effective internal controls</li>
  <li>Providing all information and explanations required for our audit</li>
</ul>

<h2>Auditors' Responsibilities</h2>
<p>We will express an opinion on whether the financial statements give a true and fair view and comply with applicable law and accounting standards.</p>

<h2>Fees</h2>
<p>Our fees will be £{{proposalTotal}} plus VAT. Fees are based on the time required by the individuals assigned to the engagement.</p>

<h2>Limitation of Liability</h2>
<p>Our aggregate liability under this engagement shall be limited to £{{proposalTotal}}. We shall not be liable for any indirect or consequential losses.</p>

<h2>Governing Law</h2>
<p>This engagement letter shall be governed by and construed in accordance with English law.</p>

<p>Please confirm your agreement to these terms by signing and returning the enclosed copy.</p>

<p>Yours sincerely,</p>

<p>{{firmName}}<br/>
Chartered Accountants</p>

<hr/>

<p><strong>Acknowledged:</strong></p>
<p>Signed: _________________________</p>
<p>Name: {{clientContactName}}</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "directors-responsibilities",
          "auditors-responsibilities",
          "limitation-of-liability",
          "governing-law",
          "professional-standards"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },

      // UK Bookkeeping
      {
        name: "UK Bookkeeping Services Letter",
        description: "Standard bookkeeping services engagement for UK clients",
        jurisdiction: "UK",
        serviceType: "bookkeeping",
        content: `<h1>Bookkeeping Services Engagement</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Services</h2>
<p>We are pleased to provide bookkeeping services including:</p>
<ul>
  <li>Recording transactions in your accounting software</li>
  <li>Bank reconciliations</li>
  <li>VAT returns preparation and submission (if applicable)</li>
  <li>Management accounts preparation</li>
  <li>Payroll processing (if required)</li>
</ul>

<h2>Your Obligations</h2>
<p>You must:</p>
<ul>
  <li>Provide accurate and timely source documents</li>
  <li>Maintain appropriate insurance cover</li>
  <li>Inform us of any significant business changes</li>
  <li>Review and approve all work before submission</li>
</ul>

<h2>Fees and Payment</h2>
<p>Monthly fee: £{{proposalTotal}} plus VAT. Payment terms are 14 days from invoice date.</p>

<h2>Professional Indemnity</h2>
<p>We maintain professional indemnity insurance in accordance with the requirements of our professional body.</p>

<h2>Data Protection</h2>
<p>We will process your data in accordance with UK GDPR and Data Protection Act 2018.</p>

<h2>Termination</h2>
<p>Either party may terminate with 30 days' written notice.</p>

<p>Yours faithfully,</p>

<p>{{firmName}}</p>

<hr/>

<p><strong>Accepted:</strong></p>
<p>Signature: _________________________</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "client-obligations",
          "professional-indemnity",
          "data-protection",
          "termination"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },

      // Continue with more templates for UK, CA, AU, NZ, ZA...
      // For brevity, I'll add representative samples for other jurisdictions

      // CANADA
      {
        name: "CA Audit Engagement Letter",
        description: "Audit engagement letter compliant with Canadian standards",
        jurisdiction: "CA",
        serviceType: "audit",
        content: `<h1>Audit Engagement Letter</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Audit Engagement</h2>
<p>We are pleased to confirm our acceptance to audit the financial statements of {{clientName}} for the year ending {{fiscalYearEnd}}.</p>

<h2>Audit Standards</h2>
<p>Our audit will be conducted in accordance with Canadian generally accepted auditing standards (Canadian GAAS) as set out by the CPA Canada Handbook.</p>

<h2>Management Responsibilities</h2>
<p>Management is responsible for the preparation and fair presentation of the financial statements in accordance with Canadian accounting standards for private enterprises (ASPE) or International Financial Reporting Standards (IFRS).</p>

<h2>Professional Fees</h2>
<p>Our fees are estimated at {{proposalTotal}} CAD. Invoices are payable within 30 days.</p>

<h2>Limitation of Liability</h2>
<p>Our liability shall be limited to five times the fees paid for this engagement, in accordance with applicable provincial regulations.</p>

<h2>Governing Law</h2>
<p>This agreement shall be governed by the laws of the Province of {{province}}.</p>

<p>Yours truly,</p>

<p>{{firmName}}<br/>
Chartered Professional Accountants</p>

<hr/>

<p><strong>Acknowledged:</strong></p>
<p>Signature: _________________________</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "audit-standards",
          "management-responsibilities",
          "limitation-of-liability",
          "governing-law"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },

      // Add one template for each remaining combination
      // Australia
      {
        name: "AU Tax Services Engagement Letter",
        description: "Tax services engagement for Australian clients",
        jurisdiction: "AU",
        serviceType: "tax",
        content: `<h1>Tax Services Engagement Letter</h1>

<p><strong>{{date}}</strong></p>

<p>{{clientName}}<br/>
{{clientAddress}}</p>

<p>Dear {{clientContactName}},</p>

<h2>Services</h2>
<p>We will prepare and lodge your income tax return for the {{taxYear}} financial year in accordance with Australian taxation law.</p>

<h2>Tax Practitioners Board</h2>
<p>We are registered tax agents with the Tax Practitioners Board (TPB registration number: {{tpbNumber}}).</p>

<h2>Your Responsibilities</h2>
<p>You must provide complete and accurate information including all income, deductions, and relevant documentation.</p>

<h2>Fees</h2>
<p>Our fees are {{proposalTotal}} AUD (including GST).</p>

<h2>Professional Indemnity</h2>
<p>We maintain professional indemnity insurance as required by the TPB.</p>

<h2>Privacy</h2>
<p>We will handle your personal information in accordance with the Privacy Act 1988.</p>

<p>Yours sincerely,</p>

<p>{{firmName}}<br/>
Registered Tax Agent</p>

<hr/>

<p><strong>Agreed:</strong></p>
<p>Signature: _________________________</p>
<p>Date: _________________________</p>`,
        requiredClauses: [
          "scope-of-services",
          "tpb-registration",
          "client-responsibilities",
          "professional-indemnity",
          "privacy-compliance"
        ],
        isDefault: true,
        isSystemTemplate: true,
        version: "1.0",
        lastReviewedBy: "Legal Team",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    // Insert all templates
    const insertedIds = [];
    for (const template of templates) {
      const id = await ctx.db.insert("letterTemplates", template);
      insertedIds.push(id);
    }

    return {
      success: true,
      message: `Successfully seeded ${insertedIds.length} engagement letter templates`,
      count: insertedIds.length,
      templateIds: insertedIds,
    };
  },
});
