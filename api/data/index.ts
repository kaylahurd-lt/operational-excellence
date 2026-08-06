// The data-access seam. One module per table lives in this folder, each
// exporting a repository object with list/get/create/update/remove. They are
// the ONLY place api/connection.ts may be imported.
export * as departments from "./departments.js";
export * as competitionGroups from "./competition-groups.js";
export * as competitionGroupDepartments from "./competition-group-departments.js";
export * as persons from "./persons.js";
export * as demoUsers from "./demo-users.js";
export * as awardYears from "./award-years.js";
export * as awardRules from "./award-rules.js";
export * as scoreInputs from "./score-inputs.js";
export * as auditLogEntries from "./audit-log-entries.js";
