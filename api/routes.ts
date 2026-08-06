// REST routes over the data-access seam (operational-excellence).
// Routes import ONLY from ./data and ./domain — never from ./connection.
//
// Real login (username + password + server-side session cookie), not real
// SSO (manifest.yaml auth.needs_sso: true is still declared-not-built for
// an actual SSO provider) and not a demo persona switcher. requireUser()
// resolves the caller from the session cookie; every route enforces access
// through api/domain/permissions.ts same as before.
import type { FastifyInstance, FastifyRequest } from "fastify";
import * as departments from "./data/departments.js";
import * as competitionGroups from "./data/competition-groups.js";
import * as competitionGroupDepartments from "./data/competition-group-departments.js";
import * as persons from "./data/persons.js";
import * as demoUsers from "./data/demo-users.js";
import * as awardYears from "./data/award-years.js";
import * as awardRules from "./data/award-rules.js";
import * as scoreInputs from "./data/score-inputs.js";
import * as auditLogEntries from "./data/audit-log-entries.js";
import { calculatePersonTotal } from "./domain/calculations.js";
import { canViewPerson, canEditRuleInput, canManageYear, visiblePersons } from "./domain/permissions.js";
import { recordScoreInputChange } from "./domain/audit.js";
import { rolloverYear } from "./domain/rollover.js";
import { hashPassword, verifyPassword, createSession, resolveSession, destroySession, toPublicUser } from "./domain/auth.js";
import type { DemoUser } from "./data/demo-users.js";

const SESSION_COOKIE = "session";

const idParam = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
} as const;

function requireUser(req: FastifyRequest): DemoUser | null {
  const session = resolveSession(req.cookies?.[SESSION_COOKIE]);
  if (!session) return null;
  return demoUsers.get(session.userId) ?? null;
}

function rulesForPerson(person: persons.Person, allRules: awardRules.AwardRule[]): awardRules.AwardRule[] {
  return allRules.filter((r) => {
    if (!r.applies_to_levels.includes(person.level)) return false;
    if (r.competition_group_ids && !r.competition_group_ids.includes(person.competition_group_id)) {
      return false;
    }
    return true;
  });
}

export async function registerRoutes(app: FastifyInstance) {
  // ---- auth: real login, real server-side sessions ----
  app.post(
    "/auth/login",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const { username, password } = req.body as { username: string; password: string };
      const user = demoUsers.findByUsername(username);
      if (!user || !verifyPassword(password, user.password_hash)) {
        return reply.code(401).send({ error: "invalid username or password" });
      }
      const { token, expiresAt } = createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(expiresAt),
      });
      return toPublicUser(user);
    },
  );

  app.post("/auth/logout", async (req, reply) => {
    destroySession(req.cookies?.[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    const user = requireUser(req);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    return toPublicUser(user);
  });

  // ---- departments (read-mostly reference data) ----
  app.get("/departments", async () => departments.list());
  app.get("/departments/:id", { schema: { params: idParam } }, async (req, reply) => {
    const row = departments.get((req.params as { id: number }).id);
    if (!row) return reply.code(404).send({ error: "department not found" });
    return row;
  });
  app.post("/departments", { schema: { body: departments.createSchema } }, async (req) =>
    departments.create(req.body as Omit<departments.Department, "id">),
  );

  // ---- competition groups ----
  app.get("/competition-groups", async () => competitionGroups.list());
  app.get("/competition-groups/:id", { schema: { params: idParam } }, async (req, reply) => {
    const row = competitionGroups.get((req.params as { id: number }).id);
    if (!row) return reply.code(404).send({ error: "competition group not found" });
    return row;
  });
  app.post(
    "/competition-groups",
    { schema: { body: competitionGroups.createSchema } },
    async (req) => competitionGroups.create(req.body as Omit<competitionGroups.CompetitionGroup, "id">),
  );

  // ---- competition group <-> department mapping ----
  app.get("/competition-group-departments", async () => competitionGroupDepartments.list());
  app.post(
    "/competition-group-departments",
    { schema: { body: competitionGroupDepartments.createSchema } },
    async (req) =>
      competitionGroupDepartments.create(
        req.body as Omit<competitionGroupDepartments.CompetitionGroupDepartment, "id">,
      ),
  );

  // ---- persons (visibility filtered by the calling demo user) ----
  app.get("/persons", async (req, reply) => {
    const user = requireUser(req);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    return visiblePersons(user, persons.list());
  });

  app.get("/persons/:id", { schema: { params: idParam } }, async (req, reply) => {
    const user = requireUser(req);
    if (!user) return reply.code(401).send({ error: "not authenticated" });
    const row = persons.get((req.params as { id: number }).id);
    if (!row) return reply.code(404).send({ error: "person not found" });
    if (!canViewPerson(user, row)) return reply.code(403).send({ error: "not authorized to view this person" });
    return row;
  });

  app.post("/persons", { schema: { body: persons.createSchema } }, async (req) =>
    persons.create(req.body as persons.CreatePersonInput),
  );

  // Assembled read model: rules applicable to this person + their score_inputs
  // for the given year, run through the calculation engine. Total is never
  // stored — it's computed here on every read (spec section 5).
  app.get(
    "/persons/:id/summary",
    {
      schema: {
        params: idParam,
        querystring: {
          type: "object",
          required: ["yearId"],
          properties: { yearId: { type: "integer" } },
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      if (!user) return reply.code(401).send({ error: "not authenticated" });
      const person = persons.get((req.params as { id: number }).id);
      if (!person) return reply.code(404).send({ error: "person not found" });
      if (!canViewPerson(user, person)) return reply.code(403).send({ error: "not authorized to view this person" });

      const yearId = (req.query as { yearId: number }).yearId;
      const year = awardYears.get(yearId);
      if (!year) return reply.code(404).send({ error: "award year not found" });

      const applicable = rulesForPerson(person, awardRules.list());
      const inputs = scoreInputs.listForYear(yearId);
      const summary = calculatePersonTotal(person.id, yearId, applicable, inputs);
      return { person, year, rules: applicable, canEdit: canEditRuleInput(user, person, year), ...summary };
    },
  );

  // Provisional rankings within a competition group (spec section 9.G) —
  // never declares a winner, tie-break rules aren't confirmed (section 16).
  app.get(
    "/competition-groups/:id/rankings",
    {
      schema: {
        params: idParam,
        querystring: {
          type: "object",
          required: ["yearId"],
          properties: { yearId: { type: "integer" } },
        },
      },
    },
    async (req, reply) => {
      const groupId = (req.params as { id: number }).id;
      const yearId = (req.query as { yearId: number }).yearId;
      const group = competitionGroups.get(groupId);
      if (!group) return reply.code(404).send({ error: "competition group not found" });

      const allRules = awardRules.list();
      const inputs = scoreInputs.listForYear(yearId);
      const groupPersons = persons.list().filter((p) => p.competition_group_id === groupId && p.active);
      const rankings = groupPersons
        .map((person) => {
          const applicable = rulesForPerson(person, allRules);
          const { total, hasUnresolved } = calculatePersonTotal(person.id, yearId, applicable, inputs);
          return { person, total, hasUnresolved };
        })
        .sort((a, b) => b.total - a.total);

      return { group, yearId, rankings, notice: "Provisional only - final winner rules/ties not configured" };
    },
  );

  // ---- score inputs: the only editable raw data, gated + audited ----
  app.put(
    "/persons/:personId/rules/:ruleId/score-input",
    {
      schema: {
        params: {
          type: "object",
          required: ["personId", "ruleId"],
          properties: { personId: { type: "integer", minimum: 1 }, ruleId: { type: "integer", minimum: 1 } },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["yearId", "rawValue"],
          properties: {
            yearId: { type: "integer", minimum: 1 },
            quarter: { type: ["integer", "null"], enum: [1, 2, 3, 4, null] },
            rawValue: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (req, reply) => {
      const user = requireUser(req);
      if (!user) return reply.code(401).send({ error: "not authenticated" });

      const { personId, ruleId } = req.params as { personId: number; ruleId: number };
      const { yearId, quarter, rawValue } = req.body as {
        yearId: number;
        quarter: 1 | 2 | 3 | 4 | null;
        rawValue: number;
      };

      const person = persons.get(personId);
      const rule = awardRules.get(ruleId);
      const year = awardYears.get(yearId);
      if (!person) return reply.code(404).send({ error: "person not found" });
      if (!rule) return reply.code(404).send({ error: "rule not found" });
      if (!year) return reply.code(404).send({ error: "award year not found" });

      if (!canEditRuleInput(user, person, year)) {
        return reply.code(403).send({ error: "not authorized to edit this score input" });
      }

      const existing = scoreInputs.findOne(yearId, personId, ruleId, quarter ?? null);
      const oldInputsForRule = scoreInputs
        .listForYear(yearId)
        .filter((i) => i.person_id === personId && i.rule_id === ruleId);

      const saved = existing
        ? scoreInputs.update(existing.id, { raw_value: rawValue })!
        : scoreInputs.create({
            year_id: yearId,
            person_id: personId,
            rule_id: ruleId,
            quarter: quarter ?? null,
            raw_value: rawValue,
          });

      const newInputsForRule = oldInputsForRule.filter((i) => i.id !== saved.id).concat(saved);

      recordScoreInputChange({
        demoUserId: user.id,
        personId,
        rule,
        oldInputsForRule,
        newInputsForRule,
        oldRawValue: existing ? existing.raw_value : null,
        newRawValue: rawValue,
      });

      return saved;
    },
  );

  // ---- demo users / access config (admin-facing, spec section 9.F) ----
  // password_hash never leaves this process - every response here is run
  // through toPublicUser().
  app.get("/demo-users", async () => demoUsers.list().map(toPublicUser));
  app.get("/demo-users/:id", { schema: { params: idParam } }, async (req, reply) => {
    const row = demoUsers.get((req.params as { id: number }).id);
    if (!row) return reply.code(404).send({ error: "demo user not found" });
    return toPublicUser(row);
  });
  app.post(
    "/demo-users",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["name", "username", "password", "role"],
          properties: {
            name: { type: "string", minLength: 1 },
            username: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 8 },
            role: { type: "string", enum: ["ADMIN", "EA", "MANAGER"] },
            assigned_competition_group_ids: { type: "array", items: { type: "integer" } },
            managed_person_ids: { type: "array", items: { type: "integer" } },
          },
        },
      },
    },
    async (req) => {
      const { password, ...rest } = req.body as { password: string } & Omit<
        demoUsers.CreateDemoUserInput,
        "password_hash"
      >;
      const created = demoUsers.create({ ...rest, password_hash: hashPassword(password) });
      return toPublicUser(created);
    },
  );

  // ---- award rules (admin-facing, spec section 9.E) ----
  app.get("/award-rules", async () => awardRules.list());
  app.post("/award-rules", { schema: { body: awardRules.createSchema } }, async (req) =>
    awardRules.create(req.body as awardRules.CreateAwardRuleInput),
  );

  // ---- award years + lifecycle transitions + rollover (spec section 4/9.G) ----
  app.get("/award-years", async () => awardYears.list());
  app.get("/award-years/:id", { schema: { params: idParam } }, async (req, reply) => {
    const row = awardYears.get((req.params as { id: number }).id);
    if (!row) return reply.code(404).send({ error: "award year not found" });
    return row;
  });
  app.post("/award-years", { schema: { body: awardYears.createSchema } }, async (req) =>
    awardYears.create(req.body as awardYears.CreateAwardYearInput),
  );

  function transitionRoute(path: string, nextStatus: "ACTIVE" | "AUDIT_LOCKED" | "ARCHIVED") {
    app.post(path, { schema: { params: idParam } }, async (req, reply) => {
      const user = requireUser(req);
      if (!user || !canManageYear(user)) {
        return reply.code(403).send({ error: "only an admin can change year status" });
      }
      const year = awardYears.get((req.params as { id: number }).id);
      if (!year) return reply.code(404).send({ error: "award year not found" });
      return awardYears.update(year.id, { status: nextStatus });
    });
  }
  transitionRoute("/award-years/:id/lock", "AUDIT_LOCKED");
  transitionRoute("/award-years/:id/unlock", "ACTIVE");
  transitionRoute("/award-years/:id/archive", "ARCHIVED");

  app.post("/award-years/:id/rollover", { schema: { params: idParam } }, async (req, reply) => {
    const user = requireUser(req);
    if (!user || !canManageYear(user)) {
      return reply.code(403).send({ error: "only an admin can roll over a year" });
    }
    try {
      return rolloverYear((req.params as { id: number }).id);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // ---- audit log (read-only; entries are created only via score-input edits) ----
  app.get("/audit-log-entries", async () => auditLogEntries.list());
  app.get("/persons/:id/audit-log-entries", { schema: { params: idParam } }, async (req) =>
    auditLogEntries.listForPerson((req.params as { id: number }).id),
  );
}
