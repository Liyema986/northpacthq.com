export interface TemplateVariable {
  token: string;
  label: string;
  description: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    token: "COMPANY_NAME",
    label: "Company Name",
    description: "Group entity name (if grouped) or single entity name",
  },
  {
    token: "COMPANY_ADDRESS",
    label: "Company Address",
    description: "Registered address of the client entity",
  },
  {
    token: "YEAR_END_DATE",
    label: "Year-End Date",
    description: "Financial year-end date from the proposal (e.g. 28 February)",
  },
  {
    token: "ENGAGEMENT_DATE",
    label: "Engagement Date",
    description: "Date the engagement letter is issued",
  },
  {
    token: "OUR_RESPONSIBILITIES",
    label: "Our Responsibilities",
    description: "Auto-populated from linked services' Our Responsibility text",
  },
  {
    token: "YOUR_RESPONSIBILITIES",
    label: "Your Responsibilities",
    description: "Auto-populated from linked services' Your Responsibility text",
  },
];

export type TemplateData = Record<string, string>;

/**
 * Replace all `{{TOKEN}}` placeholders in a template string with values
 * from the data map. Unmatched tokens are left as-is so they remain
 * visible in the editor.
 */
export function replaceTemplateVariables(
  template: string,
  data: TemplateData
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in data ? data[key] : match;
  });
}
