// Demo/fake seed data (spec section 12) — ~15 fake people across the groups
// the prototype needs to demonstrate, plus the confirmed award rules from
// spec section 6-7 and enough score_inputs to exercise every calculation
// path. Goes entirely through api/data/* (the seam), never raw SQL, and
// never real employee names (spec: "Use fake data... Do not use real names
// from the source").
//
// Run with: npm run seed  (wipes and recreates data-store/app.db)
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../api/connection.js";
import * as departments from "../api/data/departments.js";
import * as competitionGroups from "../api/data/competition-groups.js";
import * as competitionGroupDepartments from "../api/data/competition-group-departments.js";
import * as persons from "../api/data/persons.js";
import * as demoUsers from "../api/data/demo-users.js";
import * as awardYears from "../api/data/award-years.js";
import * as awardRules from "../api/data/award-rules.js";
import * as scoreInputs from "../api/data/score-inputs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data-store", "app.db");
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
}
migrate();

// ---- departments + competition groups ----
const dept = {
  accounting: departments.create({ name: "Accounting" }),
  legal: departments.create({ name: "Legal" }),
  government: departments.create({ name: "Government" }),
  customerCare: departments.create({ name: "Customer Care" }),
  technology: departments.create({ name: "Technology" }),
  data: departments.create({ name: "Data" }),
};

const group = {
  accounting: competitionGroups.create({ name: "Accounting 2026" }),
  legalGov: competitionGroups.create({ name: "Legal & Government 2026" }),
  customerCare: competitionGroups.create({ name: "Customer Care 2026" }),
  technology: competitionGroups.create({ name: "Technology 2026" }),
  directors: competitionGroups.create({ name: "Directors 2026" }),
  vpAvp: competitionGroups.create({ name: "VP/AVP Contest 2026" }),
};

competitionGroupDepartments.create({ competition_group_id: group.accounting.id, department_id: dept.accounting.id });
competitionGroupDepartments.create({ competition_group_id: group.legalGov.id, department_id: dept.legal.id });
competitionGroupDepartments.create({ competition_group_id: group.legalGov.id, department_id: dept.government.id });
competitionGroupDepartments.create({ competition_group_id: group.customerCare.id, department_id: dept.customerCare.id });
competitionGroupDepartments.create({ competition_group_id: group.technology.id, department_id: dept.technology.id });

// ---- persons (fake names only) ----
const taylorBrooks = persons.create({
  name: "Taylor Brooks",
  title: "Accounting Manager",
  level: "MANAGER",
  department_id: dept.accounting.id,
  competition_group_id: group.accounting.id,
});
const jordanBlake = persons.create({
  name: "Jordan Blake",
  level: "ASSOCIATE",
  department_id: dept.accounting.id,
  competition_group_id: group.accounting.id,
  manager_id: taylorBrooks.id,
});
const morganEllis = persons.create({
  name: "Morgan Ellis",
  level: "ASSOCIATE",
  department_id: dept.accounting.id,
  competition_group_id: group.accounting.id,
  manager_id: taylorBrooks.id,
});
const caseyNguyen = persons.create({
  name: "Casey Nguyen",
  level: "ASSOCIATE",
  department_id: dept.accounting.id,
  competition_group_id: group.accounting.id,
  manager_id: taylorBrooks.id,
});

const averyCollins = persons.create({
  name: "Avery Collins",
  level: "ASSOCIATE",
  department_id: dept.legal.id,
  competition_group_id: group.legalGov.id,
});
const reesePatel = persons.create({
  name: "Reese Patel",
  level: "ASSOCIATE",
  department_id: dept.government.id,
  competition_group_id: group.legalGov.id,
});
const devonMarsh = persons.create({
  name: "Devon Marsh",
  level: "ASSOCIATE",
  department_id: dept.legal.id,
  competition_group_id: group.legalGov.id,
});

const rowanFisher = persons.create({
  name: "Rowan Fisher",
  title: "Customer Care Manager",
  level: "MANAGER",
  department_id: dept.customerCare.id,
  competition_group_id: group.customerCare.id,
});
const skylerDiaz = persons.create({
  name: "Skyler Diaz",
  level: "ASSOCIATE",
  department_id: dept.customerCare.id,
  competition_group_id: group.customerCare.id,
  manager_id: rowanFisher.id,
});
const harperLin = persons.create({
  name: "Harper Lin",
  level: "ASSOCIATE",
  department_id: dept.customerCare.id,
  competition_group_id: group.customerCare.id,
  manager_id: rowanFisher.id,
});

const quinnOsei = persons.create({
  name: "Quinn Osei",
  level: "ASSOCIATE",
  department_id: dept.technology.id,
  competition_group_id: group.technology.id,
});
const baileyCruz = persons.create({
  name: "Bailey Cruz",
  level: "ASSOCIATE",
  department_id: dept.technology.id,
  competition_group_id: group.technology.id,
});
const emersonWolfe = persons.create({
  name: "Emerson Wolfe",
  level: "ASSOCIATE",
  department_id: dept.technology.id,
  competition_group_id: group.technology.id,
});

const peytonSalas = persons.create({
  name: "Peyton Salas",
  title: "Director of Technology",
  level: "DIRECTOR",
  department_id: dept.technology.id,
  competition_group_id: group.directors.id,
});

const laneWhitfield = persons.create({
  name: "Lane Whitfield",
  title: "VP, Data",
  level: "VP_AVP",
  department_id: dept.data.id,
  competition_group_id: group.vpAvp.id,
});

// ---- award year ----
const year2026 = awardYears.create({ year: 2026 });

// ---- award rules: confirmed associate rules (spec section 6) ----
const serviceExcellenceWinner = awardRules.create({
  name: "Service Excellence Winner",
  applies_to_levels: ["ASSOCIATE"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 15,
});
awardRules.create({
  name: "Service Excellence Nomination",
  applies_to_levels: ["ASSOCIATE"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 10,
});
const recognizeBadgePointsAssociate = awardRules.create({
  name: "Recognize Badge Points",
  applies_to_levels: ["ASSOCIATE"],
  calculation_type: "QUARTERLY_SUM_TIMES_RATE",
  rate: 2,
  quarters: 1,
  description: "2 points per badge, summed across Q1-Q4 helper counts.",
});
awardRules.create({
  name: "Refers Individual Who is Hired",
  applies_to_levels: ["ASSOCIATE", "MANAGER"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 5,
});
const spotBonus = awardRules.create({
  name: "Receives a Spot Bonus",
  applies_to_levels: ["ASSOCIATE", "MANAGER", "DIRECTOR"],
  calculation_type: "CAPPED_PER_OCCURRENCE",
  rate: 5,
  max_points: 25,
});
awardRules.create({
  name: "Acts as a Buddy",
  applies_to_levels: ["ASSOCIATE"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 5,
});
awardRules.create({
  name: "Associate of the Year",
  applies_to_levels: ["ASSOCIATE"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 20,
});
awardRules.create({
  name: "Max Award",
  applies_to_levels: ["ASSOCIATE"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 20,
  description: "Prototype assumption - exact meaning and repeatability unconfirmed (spec section 16).",
});
awardRules.create({
  name: "Accounting Associate of the Week",
  applies_to_levels: ["ASSOCIATE"],
  competition_group_ids: [group.accounting.id],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 5,
  description:
    "Scoped to Accounting only. It also appears on Sales Ops source pages as a possible copy artifact (spec section 8.2) - not scored there without confirmation.",
});
// Contest Winner / External Shoutout-Pardot report / Files appear on the
// Customer Care Coordinators & Licensing sheets and the "with extra
// categories" associate template in the source PDF, but NOT on Accounting,
// Legal & Government, or Technology - scoped to Customer Care accordingly,
// not to every associate.
const contestWinner = awardRules.create({
  name: "Contest Winner",
  applies_to_levels: ["ASSOCIATE"],
  competition_group_ids: [group.customerCare.id],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 2,
});
awardRules.create({
  name: "External Shoutout-Pardot report",
  applies_to_levels: ["ASSOCIATE"],
  competition_group_ids: [group.customerCare.id],
  calculation_type: "CAPPED_PER_OCCURRENCE",
  rate: 2,
  max_points: 20,
});
awardRules.create({
  name: "Files",
  applies_to_levels: ["ASSOCIATE"],
  competition_group_ids: [group.customerCare.id],
  calculation_type: "UNKNOWN",
  formula_confirmed: 0,
  description: "Purpose/points unknown (spec section 8.4) - not scored until clarified.",
});

// ---- manager/director rules ----
const managerOfMonthWinner = awardRules.create({
  name: "Manager of the Month Winner",
  applies_to_levels: ["MANAGER", "DIRECTOR"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 15,
});
awardRules.create({
  name: "Manager of the Month Nomination",
  applies_to_levels: ["MANAGER", "DIRECTOR"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 10,
});
const recognizeBadgePointsManager = awardRules.create({
  name: "Recognize Badge Points",
  applies_to_levels: ["MANAGER", "DIRECTOR"],
  calculation_type: "BADGES_PER_POINT",
  rate: 10,
  quarters: 1,
  description: "1 point per 10 badges - rounding is a prototype assumption (floor), unconfirmed (spec section 6).",
});
const leadershipImpactScore = awardRules.create({
  name: "Leadership Impact Score",
  applies_to_levels: ["MANAGER", "DIRECTOR"],
  calculation_type: "SCORE_INPUT",
  description: "Raw/helper input only - see Leadership Impact Points for the (unresolved) point mapping.",
});
awardRules.create({
  name: "Leadership Impact Points",
  applies_to_levels: ["MANAGER", "DIRECTOR"],
  calculation_type: "MAPPED_SCORE_TBD",
  formula_confirmed: 0,
  description: "Formula not provided by the source (spec section 6/16) - excluded from Total until confirmed.",
});

// ---- director + VP/AVP shared engagement rules ----
const febEngagementScore = awardRules.create({
  name: "FEB Engagement Score",
  applies_to_levels: ["DIRECTOR", "VP_AVP"],
  calculation_type: "SCORE_INPUT",
});
awardRules.create({
  name: "Feb Engagement Points",
  applies_to_levels: ["DIRECTOR", "VP_AVP"],
  calculation_type: "MAPPED_SCORE_TBD",
  formula_confirmed: 0,
  description: "Formula TBD (spec section 6/16).",
});
awardRules.create({
  name: "AUG Engagement Score",
  applies_to_levels: ["DIRECTOR", "VP_AVP"],
  calculation_type: "SCORE_INPUT",
});
awardRules.create({
  name: "Aug Engagement Points",
  applies_to_levels: ["DIRECTOR", "VP_AVP"],
  calculation_type: "MAPPED_SCORE_TBD",
  formula_confirmed: 0,
  description: "Formula TBD (spec section 6/16).",
});

// ---- VP/AVP-only rules ----
const momWinnerFromTeam = awardRules.create({
  name: "Manager of the Month Winner from Team",
  applies_to_levels: ["VP_AVP"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 5,
});
awardRules.create({
  name: "Service Excellence Winner from Team",
  applies_to_levels: ["VP_AVP"],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 5,
});
awardRules.create({
  name: "Retention Score",
  applies_to_levels: ["VP_AVP"],
  calculation_type: "SCORE_INPUT",
  quarters: 1,
});
awardRules.create({
  name: "Retention Points",
  applies_to_levels: ["VP_AVP"],
  calculation_type: "MAPPED_SCORE_TBD",
  formula_confirmed: 0,
  description: "Formula TBD per quarter (spec section 6/16).",
});

// ---- score inputs demonstrating every calculation path (spec section 12) ----
// Confirmed example: [2,3,1,4] badges => 20 points.
[
  [1, 2],
  [2, 3],
  [3, 1],
  [4, 4],
].forEach(([quarter, rawValue]) => {
  scoreInputs.create({
    year_id: year2026.id,
    person_id: jordanBlake.id,
    rule_id: recognizeBadgePointsAssociate.id,
    quarter: quarter as 1 | 2 | 3 | 4,
    raw_value: rawValue,
  });
});

// Confirmed example: spot bonus count 7 => capped at 25 points.
scoreInputs.create({ year_id: year2026.id, person_id: morganEllis.id, rule_id: spotBonus.id, raw_value: 7 });

// Extra category (Customer Care-only rule - see contestWinner scoping above).
scoreInputs.create({ year_id: year2026.id, person_id: skylerDiaz.id, rule_id: contestWinner.id, raw_value: 1 });

// Service Excellence Winner for the Legal & Government group, for ranking demo.
scoreInputs.create({ year_id: year2026.id, person_id: devonMarsh.id, rule_id: serviceExcellenceWinner.id, raw_value: 1 });
scoreInputs.create({ year_id: year2026.id, person_id: averyCollins.id, rule_id: serviceExcellenceWinner.id, raw_value: 1 });

// Manager badge points: 29 badges => floor(29/10) = 2 points (prototype rounding assumption).
[
  [1, 8],
  [2, 9],
  [3, 6],
  [4, 6],
].forEach(([quarter, rawValue]) => {
  scoreInputs.create({
    year_id: year2026.id,
    person_id: taylorBrooks.id,
    rule_id: recognizeBadgePointsManager.id,
    quarter: quarter as 1 | 2 | 3 | 4,
    raw_value: rawValue,
  });
});

scoreInputs.create({ year_id: year2026.id, person_id: taylorBrooks.id, rule_id: managerOfMonthWinner.id, raw_value: 1 });

// Unresolved rule with a clear TBD badge: raw score entered, but the points
// mapping is unconfirmed, so it must show as unresolved rather than scored.
scoreInputs.create({ year_id: year2026.id, person_id: taylorBrooks.id, rule_id: leadershipImpactScore.id, raw_value: 78 });
scoreInputs.create({ year_id: year2026.id, person_id: peytonSalas.id, rule_id: leadershipImpactScore.id, raw_value: 85 });

// VP/AVP: a from-team win plus an unresolved engagement score.
scoreInputs.create({ year_id: year2026.id, person_id: laneWhitfield.id, rule_id: momWinnerFromTeam.id, raw_value: 1 });
scoreInputs.create({ year_id: year2026.id, person_id: laneWhitfield.id, rule_id: febEngagementScore.id, raw_value: 82 });

// ---- demo personas (spec section 9.A) ----
demoUsers.create({ name: "Admin User", role: "ADMIN", assigned_competition_group_ids: [], managed_person_ids: [] });
demoUsers.create({
  name: "EA - Accounting",
  role: "EA",
  assigned_competition_group_ids: [group.accounting.id],
  managed_person_ids: [],
});
demoUsers.create({
  name: "EA - Legal & Government",
  role: "EA",
  assigned_competition_group_ids: [group.legalGov.id],
  managed_person_ids: [],
});
demoUsers.create({
  name: "Manager - Accounting Team A",
  role: "MANAGER",
  assigned_competition_group_ids: [],
  managed_person_ids: [jordanBlake.id, morganEllis.id, caseyNguyen.id],
});

console.log("Seed complete:");
console.log(`  departments: ${departments.list().length}`);
console.log(`  competition groups: ${competitionGroups.list().length}`);
console.log(`  persons: ${persons.list().length}`);
console.log(`  award rules: ${awardRules.list().length}`);
console.log(`  score inputs: ${scoreInputs.listForYear(year2026.id).length}`);
console.log(`  demo users: ${demoUsers.list().length}`);
console.log(`  award year: ${year2026.year} (${year2026.status})`);
console.log("\nDemo user ids for the frontend persona switcher:");
for (const user of demoUsers.list()) {
  console.log(`  ${user.id}: ${user.name} (${user.role})`);
}
