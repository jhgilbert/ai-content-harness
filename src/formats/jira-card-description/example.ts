import type { JiraCardDescriptionInput } from "./schema.ts";

export const example: JiraCardDescriptionInput = {
  summary: "Let admins export the member list as CSV",
  userStory: {
    role: "workspace admin",
    goal: "export every member with their role",
    benefit: "audit access in a spreadsheet",
  },
  acceptanceCriteria: [
    "Given I am an admin, when I click Export, then a CSV downloads.",
    "Given I am not an admin, when I open the members page, then the Export button is hidden.",
  ],
  openQuestions: ["Should deactivated members be included?"],
};
