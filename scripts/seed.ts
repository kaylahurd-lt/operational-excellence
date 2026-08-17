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
import { hashPassword } from "../api/domain/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data-store", "app.db");
for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(dbPath + suffix)) rmSync(dbPath + suffix);
}
migrate();

// ---- departments + competition groups ----
// The first 6 groups below (Accounting, Legal & Government, Customer Care,
// Technology, Directors, VP/AVP Contest) were hand-modeled directly from the
// PDF. The remaining ~28 sections were extracted from the same source in
// bulk (department/column structure per legacy sheet) and are seeded via the
// loop-driven helpers further down - see seedAssociateSection/
// seedManagerSection. Two master associate templates exist in the source
// ("TEMPLATE - Associates" with Contest Winner/External Shoutout-Pardot
// report/Files/Accounting Associate of the Week, and "TEMPLATE - Associates
// - no extra categories" without them) plus "TEMPLATE - Managers/Directors" -
// these three are pure templates, not real departments, so they aren't
// seeded as their own groups.
const dept = {
  accounting: departments.create({ name: "Accounting" }),
  legal: departments.create({ name: "Legal" }),
  government: departments.create({ name: "Government" }),
  customerCare: departments.create({ name: "Customer Care" }),
  technology: departments.create({ name: "Technology" }),
  data: departments.create({ name: "Data" }),
  accountsReceivable: departments.create({ name: "Accounts Receivable" }),
  clinicalOps: departments.create({ name: "Clinical Operations & Enterprise Solutions" }),
  cvo: departments.create({ name: "CVO" }),
  executiveAssistants: departments.create({ name: "Executive Assistants" }),
  hrHcms: departments.create({ name: "HR/HCMS" }),
  learningDevelopment: departments.create({ name: "Learning & Development" }),
  licensing: departments.create({ name: "Licensing" }),
  marketing: departments.create({ name: "Marketing" }),
  peopleOps: departments.create({ name: "People Ops" }),
  productManagement: departments.create({ name: "Product Management" }),
  salesOps: departments.create({ name: "Sales Ops" }),
  schedulers: departments.create({ name: "Schedulers" }),
  strategyData: departments.create({ name: "Strategy & Data" }),
  talentAcquisition: departments.create({ name: "Talent Acquisition" }),
};

const group = {
  accounting: competitionGroups.create({ name: "Accounting 2026" }),
  legalGov: competitionGroups.create({ name: "Legal & Government 2026" }),
  // Named "Customer Care 2026 - Coordinators" in the source workbook, not
  // plain "Customer Care 2026" (no sheet by that bare name exists there) -
  // it's a mixed associate+manager sheet, hence the manager (Rowan Fisher)
  // sharing a group with associates below.
  customerCare: competitionGroups.create({ name: "Customer Care 2026 - Coordinators" }),
  technology: competitionGroups.create({ name: "Technology 2026" }),
  directors: competitionGroups.create({ name: "Directors 2026" }),
  vpAvp: competitionGroups.create({ name: "VP/AVP Contest 2026" }),
};

competitionGroupDepartments.create({ competition_group_id: group.accounting.id, department_id: dept.accounting.id });
competitionGroupDepartments.create({ competition_group_id: group.legalGov.id, department_id: dept.legal.id });
competitionGroupDepartments.create({ competition_group_id: group.legalGov.id, department_id: dept.government.id });
competitionGroupDepartments.create({ competition_group_id: group.customerCare.id, department_id: dept.customerCare.id });
competitionGroupDepartments.create({ competition_group_id: group.technology.id, department_id: dept.technology.id });

// ---- fake name pool for the bulk-seeded sections below ----
const FAKE_NAME_POOL = [
  "Sasha Reed", "Micah Boone", "Elena Frost", "Dario Voss", "Nadia Kern", "Theo Lang",
  "Priya Shah", "Omar Elias", "Lena Marsh", "Corin Vance", "Isla Wynn", "Beau Tran",
  "Marisol Ortiz", "Kellan Ford", "Yusuf Amin", "Greta Holm", "Tobias Reyes", "Wren Castillo",
  "Sana Iqbal", "Declan Moss", "Freya Lindqvist", "Amara Solis", "Jasper Nkemelu", "Vivian Okoro",
  "Rhys Delgado", "Noor Haddad", "Callum Petrov", "Ingrid Voss", "Malik Osborne", "Tessa Winslow",
  "Idris Farrow", "Camille Duarte", "Soren Bakke", "Anaya Chowdhury", "Felix Marchetti", "Rosalind Okafor",
  "Dashiell Byrne", "Kiana Whitmore", "Leif Andersen", "Paloma Reyes", "Ezra Lindholm", "Junia Alvarado",
  "Otis Blackwood", "Simone Achebe", "Radu Constantin", "Yara Haidari", "Mateo Espinoza", "Bianca Novak",
  "Amir Farouk", "Wynn Hargrove", "Delphine Roux", "Kwame Asante", "Talia Brennan", "Osiris Bello",
];
let fakeNameIndex = 0;
function nextFakeName(): string {
  const name = FAKE_NAME_POOL[fakeNameIndex];
  fakeNameIndex += 1;
  if (!name) throw new Error("FAKE_NAME_POOL exhausted - add more names");
  return name;
}

// Loop-driven seeding for the bulk-extracted sections (spec section 7 legacy
// mapping). Rules are already globally unscoped for ASSOCIATE/MANAGER/
// DIRECTOR level (Service Excellence Winner, Manager of the Month Winner,
// etc.), so creating people here at the right level automatically wires up
// the correct baseline rules with no additional rule rows needed - only the
// per-sheet variant categories (Contest Winner, External Shoutout-Pardot
// report, Files, the Aug Engagement Points orphan) need explicit scoping,
// handled after all these groups exist (see the award rules section below).
interface SectionConfig {
  key: string;
  departmentName?: string;
  department?: departments.Department;
  groupName: string;
  level: "ASSOCIATE" | "MANAGER" | "DIRECTOR";
  count: number;
  withTitle?: boolean;
  withDivision?: boolean;
  titleForLevel?: string;
}

function seedSection(config: SectionConfig): { department: departments.Department; group: { id: number }; people: persons.Person[] } {
  const department = config.department ?? departments.create({ name: config.departmentName! });
  const createdGroup = competitionGroups.create({ name: config.groupName });
  competitionGroupDepartments.create({ competition_group_id: createdGroup.id, department_id: department.id });

  const people: persons.Person[] = [];
  for (let i = 0; i < config.count; i += 1) {
    people.push(
      persons.create({
        name: nextFakeName(),
        level: config.level,
        title: config.withTitle ? (config.titleForLevel ?? `${config.groupName.replace(/\s*2026.*/, "")} ${config.level === "ASSOCIATE" ? "Associate" : "Manager"}`) : null,
        // Source row values for these sheets' Division column didn't extract as
        // text (blank cells in the PDF export) - department name is the closest
        // real value we have, not a guess at the actual sheet contents.
        division: config.withDivision ? department.name : null,
        department_id: department.id,
        competition_group_id: createdGroup.id,
      }),
    );
  }
  return { department, group: createdGroup, people };
}

const clinicalOps = seedSection({ key: "clinicalOps", department: dept.clinicalOps, groupName: "Clinical Operations & Enterprise Solutions 2026", level: "ASSOCIATE", count: 2, withTitle: true, withDivision: true });
const ccCrs = seedSection({ key: "ccCrs", department: dept.customerCare, groupName: "Customer Care 2026 - CRS & Sr. CRS", level: "ASSOCIATE", count: 2, withTitle: true });
const ccTeamLeads = seedSection({ key: "ccTeamLeads", department: dept.customerCare, groupName: "Customer Care 2026 - Team Leads", level: "ASSOCIATE", count: 2, withTitle: true });
const ccTravel = seedSection({ key: "ccTravel", department: dept.customerCare, groupName: "Customer Care 2026 - Travel", level: "ASSOCIATE", count: 2, withTitle: true });
const cvo1 = seedSection({ key: "cvo1", department: dept.cvo, groupName: "CVO 2026 - 1", level: "ASSOCIATE", count: 2, withTitle: true });
const cvo2 = seedSection({ key: "cvo2", department: dept.cvo, groupName: "CVO 2026 - 2", level: "ASSOCIATE", count: 2, withTitle: true });
const cvo3 = seedSection({ key: "cvo3", department: dept.cvo, groupName: "CVO 2026 - 3", level: "ASSOCIATE", count: 2, withTitle: true });
const cvo4 = seedSection({ key: "cvo4", department: dept.cvo, groupName: "CVO 2026 - 4", level: "ASSOCIATE", count: 2, withTitle: true });
const cvo5 = seedSection({ key: "cvo5", department: dept.cvo, groupName: "CVO 2026 - 5", level: "ASSOCIATE", count: 2, withTitle: true });
const executiveAssistants = seedSection({ key: "executiveAssistants", department: dept.executiveAssistants, groupName: "Executive Assistants 2026", level: "ASSOCIATE", count: 2 });
const hrHcms = seedSection({ key: "hrHcms", department: dept.hrHcms, groupName: "HR/HCMS 2026", level: "ASSOCIATE", count: 2 });
const learningDevelopment = seedSection({ key: "learningDevelopment", department: dept.learningDevelopment, groupName: "Learning & Development 2026", level: "ASSOCIATE", count: 2 });
const licensing = seedSection({ key: "licensing", department: dept.licensing, groupName: "Licensing 2026", level: "ASSOCIATE", count: 2, withTitle: true });
// The source Marketing 2026 sheet also embeds a manager-tier section with
// FEB/AUG Engagement Score+Points instead of the usual Leadership Impact
// Score+Points every other manager group gets - unconfirmed whether that's
// intentional or a copy artifact, and moot for now since no MANAGER-level
// person is seeded in this group.
const marketing = seedSection({ key: "marketing", department: dept.marketing, groupName: "Marketing 2026", level: "ASSOCIATE", count: 2 });
const productManagement = seedSection({ key: "productManagement", department: dept.productManagement, groupName: "Product Management 2026", level: "ASSOCIATE", count: 2 });
const salesOpsAnalysts = seedSection({ key: "salesOpsAnalysts", department: dept.salesOps, groupName: "Sales Ops Analysts, AA & Sr AA", level: "ASSOCIATE", count: 2, withTitle: true });
const salesOpsCoord = seedSection({ key: "salesOpsCoord", department: dept.salesOps, groupName: "Sales Ops Coord & Sr Coord", level: "ASSOCIATE", count: 2, withTitle: true });
const salesOpsOms = seedSection({ key: "salesOpsOms", department: dept.salesOps, groupName: "Sales Ops OMS & WFS Specialists", level: "ASSOCIATE", count: 2, withTitle: true });
const schedulers = seedSection({ key: "schedulers", department: dept.schedulers, groupName: "Schedulers 2026", level: "ASSOCIATE", count: 2, withTitle: true, withDivision: true });
const strategyData = seedSection({ key: "strategyData", department: dept.strategyData, groupName: "Strategy & Data", level: "ASSOCIATE", count: 2 });
const talentAcquisition = seedSection({ key: "talentAcquisition", department: dept.talentAcquisition, groupName: "Talent Acquisition 2026", level: "ASSOCIATE", count: 2 });

const accountingManagers = seedSection({ key: "accountingManagers", department: dept.accounting, groupName: "Accounting Managers 2026", level: "MANAGER", count: 1 });
const arManagers = seedSection({ key: "arManagers", department: dept.accountsReceivable, groupName: "AR Managers 2026", level: "MANAGER", count: 1 });
const customerCareManagers = seedSection({ key: "customerCareManagers", department: dept.customerCare, groupName: "Customer Care Managers 2026", level: "MANAGER", count: 1 });
const cvoLicensingManagers = seedSection({ key: "cvoLicensingManagers", department: dept.cvo, groupName: "CVO/Licensing Managers 2026", level: "MANAGER", count: 1 });
const marketingSalesOpsManagers = seedSection({ key: "marketingSalesOpsManagers", department: dept.marketing, groupName: "Marketing & Sales Ops Managers 2026", level: "MANAGER", count: 1 });
const peopleOpsManagers = seedSection({ key: "peopleOpsManagers", department: dept.peopleOps, groupName: "People Ops Managers 2026", level: "MANAGER", count: 1, withDivision: true });
const technologyProductManagers = seedSection({ key: "technologyProductManagers", department: dept.technology, groupName: "Technology & Product Managers 2026", level: "MANAGER", count: 1 });

// Full-extra-categories groups (Contest Winner / External Shoutout-Pardot
// report / Files) per the PDF - Accounting, Legal & Government, Technology,
// Executive Assistants, HR/HCMS, Learning & Development, Marketing, Product
// Management, Strategy & Data, and Talent Acquisition do NOT have these.
const FULL_EXTRA_CATEGORY_GROUP_IDS = [
  group.customerCare.id,
  ccCrs.group.id,
  ccTeamLeads.group.id,
  ccTravel.group.id,
  cvo1.group.id,
  cvo2.group.id,
  cvo3.group.id,
  cvo4.group.id,
  cvo5.group.id,
  licensing.group.id,
  salesOpsAnalysts.group.id,
  salesOpsCoord.group.id,
  salesOpsOms.group.id,
];
// External Shoutout-Pardot report additionally appears (alone, without
// Contest Winner/Files) on Clinical Operations, Schedulers, and Talent
// Acquisition.
const EXTERNAL_SHOUTOUT_ONLY_GROUP_IDS = [clinicalOps.group.id, schedulers.group.id, talentAcquisition.group.id];

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
  division: dept.technology.name,
  level: "DIRECTOR",
  department_id: dept.technology.id,
  competition_group_id: group.directors.id,
});

// VP/AVP Contest's Division column is actually the contest sub-group number
// (spec: "VP/AVP contest group/division mapping" - Group 1: Data, Legal,
// Strategy, TA, HR/HCMS; Group 2: ...; Group 3: ..."), not a department name
// like the other Division-bearing sheets. Lane Whitfield (Data) is Group 1.
const laneWhitfield = persons.create({
  name: "Lane Whitfield",
  title: "VP, Data",
  division: "1",
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
// Customer Care Coordinators/CRS/Team Leads/Travel, CVO (1-5), Licensing,
// and Sales Ops (Analysts/Coord/OMS&WFS) sheets and the "with extra
// categories" associate template in the source PDF, but NOT on Accounting,
// Legal & Government, Technology, Executive Assistants, HR/HCMS, Learning &
// Development, Marketing, Product Management, or Strategy & Data - scoped
// to exactly the groups that have them, not to every associate.
const contestWinner = awardRules.create({
  name: "Contest Winner",
  applies_to_levels: ["ASSOCIATE"],
  competition_group_ids: FULL_EXTRA_CATEGORY_GROUP_IDS,
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 2,
});
awardRules.create({
  name: "External Shoutout-Pardot report",
  applies_to_levels: ["ASSOCIATE"],
  competition_group_ids: [...FULL_EXTRA_CATEGORY_GROUP_IDS, ...EXTERNAL_SHOUTOUT_ONLY_GROUP_IDS],
  calculation_type: "CAPPED_PER_OCCURRENCE",
  rate: 2,
  max_points: 20,
});
awardRules.create({
  name: "Files",
  applies_to_levels: ["ASSOCIATE"],
  competition_group_ids: FULL_EXTRA_CATEGORY_GROUP_IDS,
  calculation_type: "UNKNOWN",
  formula_confirmed: 0,
  description: "Purpose/points unknown (spec section 8.4) - not scored until clarified.",
});
// CVO/Licensing Managers 2026 is the one manager-level sheet that also
// carries the associate-flavored Contest Winner/Files/Acts as a Buddy
// columns - modeled as separate MANAGER-scoped rows rather than widening
// the associate versions above, same pattern as the two "Recognize Badge
// Points" rows (associate vs manager) already use.
awardRules.create({
  name: "Acts as a Buddy",
  applies_to_levels: ["MANAGER"],
  competition_group_ids: [cvoLicensingManagers.group.id],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 5,
});
awardRules.create({
  name: "Contest Winner",
  applies_to_levels: ["MANAGER"],
  competition_group_ids: [cvoLicensingManagers.group.id],
  calculation_type: "FIXED_PER_OCCURRENCE",
  rate: 2,
});
awardRules.create({
  name: "Files",
  applies_to_levels: ["MANAGER"],
  competition_group_ids: [cvoLicensingManagers.group.id],
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
// AR Managers 2026 and Marketing & Sales Ops Managers 2026 both end with an
// orphan "Aug Engagement Points" column - no matching "Aug Engagement Score"
// raw-input column exists anywhere on either sheet, unlike Directors' clean
// Feb+Aug Score/Points pairs. Modeled faithfully as unresolved rather than
// inventing a raw-input rule that isn't actually in the source.
awardRules.create({
  name: "Aug Engagement Points",
  applies_to_levels: ["MANAGER"],
  competition_group_ids: [arManagers.group.id, marketingSalesOpsManagers.group.id],
  calculation_type: "MAPPED_SCORE_TBD",
  formula_confirmed: 0,
  description: "Orphan column in the source - no matching raw-score input exists on either sheet (spec section 8).",
});

// ---- director + VP/AVP shared engagement rules ----
const febEngagementScore = awardRules.create({
  name: "FEB Engagement Scores",
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
  name: "AUG Engagement Scores",
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

// ---- accounts (spec section 9.A) ----
// Real login (email + password + server-side session), not a demo
// persona switcher - see api/domain/auth.ts. Every seeded account shares one
// prototype-only password so this script can print it; a real onboarding
// flow (dev-seam work) would let each person set their own.
const SEED_PASSWORD = "opexdemo";
const seedPasswordHash = hashPassword(SEED_PASSWORD);

const accounts = [
  {
    name: "Admin User",
    email: "admin@opex-demo.locumtenens.com",
    role: "ADMIN" as const,
    assigned_competition_group_ids: [],
    managed_person_ids: [],
  },
  {
    name: "EA - Accounting",
    email: "ea.accounting@opex-demo.locumtenens.com",
    role: "EA" as const,
    assigned_competition_group_ids: [group.accounting.id],
    managed_person_ids: [],
  },
  {
    name: "EA - Legal & Government",
    email: "ea.legalgov@opex-demo.locumtenens.com",
    role: "EA" as const,
    assigned_competition_group_ids: [group.legalGov.id],
    managed_person_ids: [],
  },
  {
    name: "Manager - Accounting Team A",
    email: "manager.accounting@opex-demo.locumtenens.com",
    role: "MANAGER" as const,
    assigned_competition_group_ids: [],
    managed_person_ids: [jordanBlake.id, morganEllis.id, caseyNguyen.id],
  },
];
for (const account of accounts) {
  demoUsers.create({ ...account, password_hash: seedPasswordHash });
}

console.log("Seed complete:");
console.log(`  departments: ${departments.list().length}`);
console.log(`  competition groups: ${competitionGroups.list().length}`);
console.log(`  persons: ${persons.list().length}`);
console.log(`  award rules: ${awardRules.list().length}`);
console.log(`  score inputs: ${scoreInputs.listForYear(year2026.id).length}`);
console.log(`  demo users: ${demoUsers.list().length}`);
console.log(`  award year: ${year2026.year} (${year2026.status})`);
console.log(`\nLogin at http://localhost:8080 with any of these (password: ${SEED_PASSWORD}):`);
for (const user of demoUsers.list()) {
  console.log(`  ${user.email} - ${user.name} (${user.role})`);
}
