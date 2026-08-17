// Centralized permission helpers (spec section 11) — every route enforces
// access through these, never scattered role checks. The manager visibility
// hierarchy and exact EA group-access scope are open questions (spec section
// 16); this module uses the explicit assignments on DemoUser rather than
// inventing a hierarchy, so it's easy to change later without touching routes.
import type { DemoUser } from "../data/demo-users.js";
import type { Person } from "../data/persons.js";
import type { AwardYear } from "../data/award-years.js";

export function canViewPerson(user: DemoUser, person: Person): boolean {
  switch (user.role) {
    case "ADMIN":
      return true;
    case "EA":
      return user.assigned_competition_group_ids.includes(person.competition_group_id);
    case "MANAGER":
      return user.managed_person_ids.includes(person.id);
    default:
      return false;
  }
}

export function canEditPerson(user: DemoUser, person: Person, awardYear: AwardYear): boolean {
  if (!canViewPerson(user, person)) return false;

  switch (awardYear.status) {
    case "ARCHIVED":
      return false; // immutable, no exceptions (spec section 4)
    case "AUDIT_LOCKED":
      return user.role === "ADMIN"; // admin corrections only (spec section 11)
    case "ACTIVE":
      return user.role === "ADMIN" || user.role === "EA";
    default:
      return false;
  }
}

// Calculated point outputs are never stored, so there is no route that could
// let anyone "edit" them — this only gates the raw ScoreInput a rule reads.
export function canEditRuleInput(user: DemoUser, person: Person, awardYear: AwardYear): boolean {
  return canEditPerson(user, person, awardYear);
}

export function canManageYear(user: DemoUser): boolean {
  return user.role === "ADMIN";
}

export function canManagePersons(user: DemoUser): boolean {
  return user.role === "ADMIN";
}

export function canManageUsers(user: DemoUser): boolean {
  return user.role === "ADMIN";
}

export function visiblePersons(user: DemoUser, persons: Person[]): Person[] {
  return persons.filter((p) => canViewPerson(user, p));
}
