// Confirmed behaviors from CLAUDE_CODE_OpEx_Prototype_Spec.md section 11.
import { describe, it, expect } from "vitest";
import {
  canViewPerson,
  canEditPerson,
  canEditRuleInput,
  canManageYear,
  visiblePersons,
} from "../api/domain/permissions.js";
import type { DemoUser } from "../api/data/demo-users.js";
import type { Person } from "../api/data/persons.js";
import type { AwardYear } from "../api/data/award-years.js";

function makeUser(overrides: Partial<DemoUser>): DemoUser {
  return {
    id: 1,
    name: "Test User",
    username: "test.user",
    password_hash: "unused-in-these-tests",
    role: "EA",
    assigned_competition_group_ids: [],
    managed_person_ids: [],
    ...overrides,
  };
}

function makePerson(overrides: Partial<Person>): Person {
  return {
    id: 1,
    name: "Test Person",
    title: null,
    level: "ASSOCIATE",
    department_id: 1,
    competition_group_id: 1,
    manager_id: null,
    active: 1,
    ...overrides,
  };
}

function makeYear(overrides: Partial<AwardYear>): AwardYear {
  return { id: 1, year: 2026, status: "ACTIVE", ...overrides };
}

describe("canViewPerson", () => {
  it("admin sees everyone", () => {
    const admin = makeUser({ role: "ADMIN" });
    expect(canViewPerson(admin, makePerson({ competition_group_id: 99 }))).toBe(true);
  });

  it("EA sees only assigned competition groups", () => {
    const ea = makeUser({ role: "EA", assigned_competition_group_ids: [1] });
    expect(canViewPerson(ea, makePerson({ competition_group_id: 1 }))).toBe(true);
    expect(canViewPerson(ea, makePerson({ competition_group_id: 2 }))).toBe(false);
  });

  it("manager sees only explicitly managed people", () => {
    const manager = makeUser({ role: "MANAGER", managed_person_ids: [42] });
    expect(canViewPerson(manager, makePerson({ id: 42 }))).toBe(true);
    expect(canViewPerson(manager, makePerson({ id: 43 }))).toBe(false);
  });
});

describe("canEditPerson", () => {
  it("manager can never edit, even for a person they can view", () => {
    const manager = makeUser({ role: "MANAGER", managed_person_ids: [1] });
    expect(canEditPerson(manager, makePerson({ id: 1 }), makeYear({}))).toBe(false);
  });

  it("EA can edit within scope only while the year is ACTIVE", () => {
    const ea = makeUser({ role: "EA", assigned_competition_group_ids: [1] });
    const person = makePerson({ competition_group_id: 1 });
    expect(canEditPerson(ea, person, makeYear({ status: "ACTIVE" }))).toBe(true);
    expect(canEditPerson(ea, person, makeYear({ status: "AUDIT_LOCKED" }))).toBe(false);
    expect(canEditPerson(ea, person, makeYear({ status: "ARCHIVED" }))).toBe(false);
  });

  it("admin can make corrections during AUDIT_LOCKED but not ARCHIVED", () => {
    const admin = makeUser({ role: "ADMIN" });
    const person = makePerson({});
    expect(canEditPerson(admin, person, makeYear({ status: "AUDIT_LOCKED" }))).toBe(true);
    expect(canEditPerson(admin, person, makeYear({ status: "ARCHIVED" }))).toBe(false);
  });

  it("EA cannot edit a person outside their assigned groups even when ACTIVE", () => {
    const ea = makeUser({ role: "EA", assigned_competition_group_ids: [1] });
    const person = makePerson({ competition_group_id: 2 });
    expect(canEditPerson(ea, person, makeYear({ status: "ACTIVE" }))).toBe(false);
  });
});

describe("canEditRuleInput", () => {
  it("mirrors canEditPerson (calculated outputs are never directly editable)", () => {
    const ea = makeUser({ role: "EA", assigned_competition_group_ids: [1] });
    const person = makePerson({ competition_group_id: 1 });
    expect(canEditRuleInput(ea, person, makeYear({ status: "ACTIVE" }))).toBe(true);
  });
});

describe("canManageYear", () => {
  it("only admin can lock/unlock/archive/rollover", () => {
    expect(canManageYear(makeUser({ role: "ADMIN" }))).toBe(true);
    expect(canManageYear(makeUser({ role: "EA" }))).toBe(false);
    expect(canManageYear(makeUser({ role: "MANAGER" }))).toBe(false);
  });
});

describe("visiblePersons", () => {
  it("filters a list down to what the user can view", () => {
    const manager = makeUser({ role: "MANAGER", managed_person_ids: [1, 2] });
    const persons = [makePerson({ id: 1 }), makePerson({ id: 2 }), makePerson({ id: 3 })];
    expect(visiblePersons(manager, persons).map((p) => p.id)).toEqual([1, 2]);
  });
});
