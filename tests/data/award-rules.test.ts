import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import * as awardRules from "../../api/data/award-rules.js";

freshDb();

describe("award-rules data access", () => {
  it("round-trips applies_to_levels and competition_group_ids through JSON storage", () => {
    const created = awardRules.create({
      name: "Spot Bonus",
      applies_to_levels: ["ASSOCIATE", "MANAGER"],
      competition_group_ids: [1, 2],
      calculation_type: "CAPPED_PER_OCCURRENCE",
      rate: 5,
      max_points: 25,
    });
    expect(created.applies_to_levels).toEqual(["ASSOCIATE", "MANAGER"]);
    expect(created.competition_group_ids).toEqual([1, 2]);
    expect(created.formula_confirmed).toBe(1);

    expect(awardRules.get(created.id)?.applies_to_levels).toEqual(["ASSOCIATE", "MANAGER"]);
    expect(awardRules.list()).toHaveLength(1);

    const updated = awardRules.update(created.id, { competition_group_ids: null, max_points: 30 });
    expect(updated?.competition_group_ids).toBeNull();
    expect(updated?.max_points).toBe(30);

    expect(awardRules.remove(created.id)).toBe(true);
  });

  it("marks unconfirmed formulas explicitly", () => {
    const created = awardRules.create({
      name: "Leadership Impact Points",
      applies_to_levels: ["MANAGER", "DIRECTOR"],
      calculation_type: "MAPPED_SCORE_TBD",
      formula_confirmed: 0,
    });
    expect(created.formula_confirmed).toBe(0);
    expect(created.competition_group_ids).toBeNull();
  });
});
