// Front-end shell — everything here calls through api.js (the seam). No
// hardcoded data arrays (gate check 1). Vanilla JS/DOM, no build step, to
// match the skill's static-frontend template philosophy.
import { api } from "./api.js";

const LS_YEAR_KEY = "opex-year-id";
const LS_GROUP_KEY = "opex-group-id";

const state = {
  currentUser: null, // the real logged-in account (api.me()), not a persona pick
  demoUsers: [],
  awardYears: [],
  departments: [],
  competitionGroups: [],
  awardRules: [],
  currentYearId: null,
  currentView: "dashboard",
  currentGroupId: null,
  drawerPersonId: null,
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function currentUser() {
  return state.currentUser;
}
function currentYear() {
  return state.awardYears.find((y) => y.id === state.currentYearId) ?? null;
}
function isAdmin() {
  return currentUser()?.role === "ADMIN";
}
function groupById(id) {
  return state.competitionGroups.find((g) => g.id === id);
}
function ruleById(id) {
  return state.awardRules.find((r) => r.id === id);
}

function showSaved(el) {
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1200);
}

// ---------------------------------------------------------------- bootstrap

async function init() {
  try {
    state.currentUser = await api.me();
  } catch {
    renderLoginScreen();
    return;
  }
  await loadAppData();
  renderAll();
}

async function loadAppData() {
  const [demoUsers, awardYears, departments, competitionGroups, awardRules] = await Promise.all([
    api.list("demo-users"),
    api.list("award-years"),
    api.list("departments"),
    api.list("competition-groups"),
    api.list("award-rules"),
  ]);
  state.demoUsers = demoUsers;
  state.awardYears = awardYears;
  state.departments = departments;
  state.competitionGroups = competitionGroups;
  state.awardRules = awardRules;

  const savedYearId = Number(localStorage.getItem(LS_YEAR_KEY));
  const latestYear = awardYears.slice().sort((a, b) => b.year - a.year)[0];
  state.currentYearId = awardYears.find((y) => y.id === savedYearId)?.id ?? latestYear?.id ?? null;

  const savedGroupId = Number(localStorage.getItem(LS_GROUP_KEY));
  state.currentGroupId = competitionGroups.find((g) => g.id === savedGroupId)?.id ?? competitionGroups[0]?.id ?? null;
}

function renderAll() {
  renderHeader();
  renderNav();
  renderView();
}

// ------------------------------------------------------------------- login

function renderLoginScreen(errorMessage) {
  document.getElementById("topbar-left").innerHTML = "";
  document.getElementById("app-nav").innerHTML = "";
  document.getElementById("topbar-right").innerHTML = "";
  const main = document.getElementById("app-main");
  main.innerHTML = `
    <div class="login-screen">
      <div class="login-blob login-blob-1"></div>
      <div class="login-blob login-blob-2"></div>
      <div class="login-content">
        <div>
          <h1 style="font-size:38px;margin-bottom:8px">Operational Excellence</h1>
          <p class="text-muted" style="margin:0">Sign in to view or score OpEx points.</p>
        </div>
        <form id="login-form" class="login-card">
          <div class="field">
            <label>Email</label>
            <input id="login-email" type="email" class="input" autocomplete="email" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input id="login-password" type="password" class="input" autocomplete="current-password" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block">Log in</button>
        </form>
        <div class="login-demo-panel">
          <span class="login-demo-kicker">Demo accounts &middot; password opexdemo</span>
          <div class="login-demo-row"><span><span class="tag tag-outline">ADMIN</span> Admin User</span><span class="email">admin@opex-demo.locumtenens.com</span></div>
          <div class="login-demo-row"><span><span class="tag tag-outline">EA</span> EA - Accounting</span><span class="email">ea.accounting@opex-demo.locumtenens.com</span></div>
          <div class="login-demo-row"><span><span class="tag tag-outline">EA</span> EA - Legal &amp; Government</span><span class="email">ea.legalgov@opex-demo.locumtenens.com</span></div>
          <div class="login-demo-row"><span><span class="tag tag-outline">MANAGER</span> Manager - Accounting Team A</span><span class="email">manager.accounting@opex-demo.locumtenens.com</span></div>
        </div>
        ${errorMessage ? `<div class="notice"><span class="notice-icon">!</span><span>${escapeHtml(errorMessage)}</span></div>` : ""}
      </div>
    </div>
  `;
  main.querySelector("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = main.querySelector("#login-email").value.trim();
    const password = main.querySelector("#login-password").value;
    try {
      state.currentUser = await api.login(email, password);
      await loadAppData();
      renderAll();
    } catch (err) {
      renderLoginScreen(err.status === 401 ? "Incorrect email or password." : err.message);
    }
  });
}

async function handleLogout() {
  await api.logout().catch(() => {});
  state.currentUser = null;
  renderLoginScreen();
}

// ------------------------------------------------------------------ header

function statusTagClass(status) {
  if (status === "ACTIVE") return "tag-accent-2";
  if (status === "AUDIT_LOCKED") return "tag-accent";
  return "tag-neutral";
}

function renderHeader() {
  const left = document.getElementById("topbar-left");
  const right = document.getElementById("topbar-right");
  const year = currentYear();
  const user = currentUser();
  left.innerHTML = `
    <span class="brand">Operational Excellence</span>
    <select id="year-select" class="input input-inline"></select>
    ${year ? `<span class="tag ${statusTagClass(year.status)}" style="text-transform:uppercase">${year.status.replace("_", " ")}</span>` : ""}
  `;
  right.innerHTML = `
    <span>${escapeHtml(user.name)}</span><span class="tag tag-outline">${user.role}</span>
    <button id="logout-btn" class="btn btn-secondary">Log out</button>
    <span id="saved-indicator" class="saved-indicator">Saved</span>
  `;

  const yearSelect = left.querySelector("#year-select");
  yearSelect.innerHTML = state.awardYears
    .slice()
    .sort((a, b) => b.year - a.year)
    .map((y) => `<option value="${y.id}" ${y.id === state.currentYearId ? "selected" : ""}>${y.year}</option>`)
    .join("");
  yearSelect.addEventListener("change", (e) => {
    state.currentYearId = Number(e.target.value);
    localStorage.setItem(LS_YEAR_KEY, String(state.currentYearId));
    renderAll();
  });

  right.querySelector("#logout-btn").addEventListener("click", handleLogout);
}

// --------------------------------------------------------------------- nav

function renderNav() {
  const nav = document.getElementById("app-nav");
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "grid", label: "Group Scoring" },
  ];
  if (isAdmin()) {
    tabs.push(
      { id: "people", label: "People" },
      { id: "rules", label: "Rules" },
      { id: "access", label: "Access" },
      { id: "audit", label: "Audit & Rollover" },
    );
  }
  nav.innerHTML = tabs
    .map((t) => `<button data-view="${t.id}" class="${state.currentView === t.id ? "active" : ""}">${t.label}</button>`)
    .join("");
  nav.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentView = btn.dataset.view;
      renderNav();
      renderView();
    });
  });
}

async function renderView() {
  const main = document.getElementById("app-main");
  if (!currentUser()) {
    renderLoginScreen();
    return;
  }
  try {
    switch (state.currentView) {
      case "dashboard": return await renderDashboard(main);
      case "grid": return await renderScoringGrid(main);
      case "people": return await renderAdminPeople(main);
      case "rules": return renderAdminRules(main);
      case "access": return await renderAdminAccess(main);
      case "audit": return await renderAuditRollover(main);
      default: main.innerHTML = "";
    }
  } catch (err) {
    // The session cookie expired (7-day TTL) or was revoked elsewhere.
    if (err.status === 401) {
      state.currentUser = null;
      renderLoginScreen("Your session expired - please log in again.");
      return;
    }
    throw err;
  }
}

// ----------------------------------------------------------------- helpers

// GET /persons already returns exactly the visible set for the caller's role
// (server-side, via api/domain/permissions.ts) — group visibility is derived
// from that same set rather than re-implementing the role rules client-side.
function groupsForVisiblePersons(persons) {
  const user = currentUser();
  if (!user) return [];
  if (user.role === "ADMIN") return state.competitionGroups;
  const idsWithVisiblePeople = new Set(persons.map((p) => p.competition_group_id));
  if (user.role === "EA") user.assigned_competition_group_ids.forEach((id) => idsWithVisiblePeople.add(id));
  return state.competitionGroups.filter((g) => idsWithVisiblePeople.has(g.id));
}

// -------------------------------------------------------------- dashboard

async function renderDashboard(main) {
  main.innerHTML = `<div class="empty-state">Loading…</div>`;
  const year = currentYear();
  const persons = await api.list("persons");
  const groups = groupsForVisiblePersons(persons);

  // One panel per accessible group, not just the first - people only compete
  // within their own group, so a single combined leaderboard would mix
  // different rule sets together and mean nothing.
  const rankingsByGroup = await Promise.all(
    groups.map((g) => api.getGroupRankings(g.id, state.currentYearId).catch(() => null)),
  );
  const topRankingsHtml = rankingsByGroup
    .filter(Boolean)
    .map((rankings) => `
      <div class="panel">
        <h3>Top provisional totals — ${escapeHtml(rankings.group.name)}</h3>
        <div class="notice"><span class="notice-icon">!</span><span>${escapeHtml(rankings.notice)}</span></div>
        <table>
          <thead><tr><th>Person</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>
            ${rankings.rankings.slice(0, 5).map((r) => `
              <tr>
                <td>${escapeHtml(r.person.name)}${r.hasUnresolved ? '<span class="tag tag-accent tag-sm">TBD PENDING</span>' : ""}</td>
                <td style="text-align:right;font-family:var(--font-heading)">${r.total}</td>
              </tr>
            `).join("") || `<tr><td colspan="2" class="empty-state">No people</td></tr>`}
          </tbody>
        </table>
      </div>
    `)
    .join("");

  const totalEntries = await Promise.all(
    persons.slice(0, 50).map((p) => api.getPersonSummary(p.id, state.currentYearId).catch(() => null)),
  );
  const entryCount = totalEntries.filter(Boolean).reduce((sum, s) => sum + s.breakdown.filter((b) => b.rawValue > 0).length, 0);

  main.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><span class="label">Year</span><span class="value">${year ? year.year : "—"}</span></div>
      <div class="stat-card"><span class="label">Groups you can access</span><span class="value">${groups.length}</span></div>
      <div class="stat-card"><span class="label">People</span><span class="value">${persons.length}</span></div>
      <div class="stat-card"><span class="label">Point entries</span><span class="value">${entryCount}</span></div>
    </div>
    ${topRankingsHtml}
  `;
}

// ---------------------------------------------------------- scoring grid

function rulesForLevelsAndGroup(levels, groupId) {
  return state.awardRules.filter((r) => {
    if (!levels.some((l) => r.applies_to_levels.includes(l))) return false;
    if (r.competition_group_ids && !r.competition_group_ids.includes(groupId)) return false;
    return true;
  });
}

// Point-value annotation shown under each rule's header - the exact wording
// the source Smartsheet uses in its own column headers (e.g. "(15pts)",
// "(1pt/10bdgs)"), not a paraphrase.
function formatRuleMeta(rule) {
  switch (rule.calculation_type) {
    case "FIXED_PER_OCCURRENCE": return `${rule.rate}pts`;
    case "CAPPED_PER_OCCURRENCE": return `${rule.rate}pts; Max ${rule.max_points}pts`;
    case "QUARTERLY_SUM_TIMES_RATE": return `${rule.rate}pts/badge`;
    case "BADGES_PER_POINT": return `1pt/${rule.rate}bdgs`;
    case "SCORE_INPUT": return "raw input";
    case "MAPPED_SCORE_TBD":
    case "UNKNOWN":
    default: return "formula TBD";
  }
}

// Q1-Q4 helper-column name/caption, verbatim from the source sheet - these
// differ by rule family ("Q1 Recognize Badges (used for points calc)" for
// associates, "...Given (used for pts calc)" for managers, "Q1 Retention
// Score (used for calc)" for VP/AVP), not a generic "raw input" label.
function quarterlyColumnWording(rule) {
  if (rule.name === "Recognize Badge Points" && rule.calculation_type === "QUARTERLY_SUM_TIMES_RATE") {
    return { namePart: "Recognize Badges", meta: "used for points calc" };
  }
  if (rule.name === "Recognize Badge Points" && rule.calculation_type === "BADGES_PER_POINT") {
    return { namePart: "Recognize Badges Given", meta: "used for pts calc" };
  }
  return { namePart: rule.name, meta: "used for calc" };
}

// Division only appears on a handful of legacy sheets (Directors, People Ops
// Managers, Clinical Operations, Schedulers, ...) - shown only when the
// current group actually uses it, with sticky offsets computed here rather
// than fixed in CSS since the column set varies per group.
const BASE_STICKY_COLS = [
  { key: "name", label: "Associate Name", width: 160 },
  { key: "title", label: "Title", width: 130 },
  { key: "division", label: "Division", width: 110 },
  { key: "manager", label: "Manager", width: 130 },
  { key: "total", label: "Total", width: 90 },
];

// Expands a rule into the grid column(s) it needs. Quarterly rules (spec:
// source sheets have 4 raw "Q1..Q4" helper columns feeding one computed
// points column, e.g. "Q1 Recognize Badges" .. "Q4 Recognize Badges" ->
// "Recognize Badge Points") get 4 editable Q1-Q4 cells; a pure raw-capture
// quarterly rule (SCORE_INPUT) has no separate computed cell; a quarterly
// rule with no confirmed formula (MAPPED_SCORE_TBD/UNKNOWN) has nothing
// distinguishable to show per quarter, so it stays a single TBD cell.
function ruleColumns(rule) {
  if (!rule.quarters || rule.calculation_type === "MAPPED_SCORE_TBD" || rule.calculation_type === "UNKNOWN") {
    return [{ kind: "single", rule }];
  }
  const quarterCols = [1, 2, 3, 4].map((quarter) => ({ kind: "quarter", rule, quarter }));
  return rule.calculation_type === "SCORE_INPUT" ? quarterCols : [...quarterCols, { kind: "computed", rule }];
}

function ruleColumnHeader(col) {
  const { rule, kind } = col;
  if (kind === "quarter") {
    const { namePart, meta } = quarterlyColumnWording(rule);
    return { label: `Q${col.quarter} ${namePart}`, meta, tbd: false };
  }
  return { label: rule.name, meta: formatRuleMeta(rule), tbd: !rule.formula_confirmed };
}

function stickyColumnLayout(hasDivision) {
  const cols = hasDivision ? BASE_STICKY_COLS : BASE_STICKY_COLS.filter((c) => c.key !== "division");
  let left = 0;
  return cols.map((c) => {
    const withLeft = { ...c, left };
    left += c.width;
    return withLeft;
  });
}

async function renderScoringGrid(main) {
  main.innerHTML = `<div class="empty-state">Loading…</div>`;
  const allPersons = await api.list("persons");
  const groups = groupsForVisiblePersons(allPersons);
  if (groups.length === 0) {
    main.innerHTML = `<div class="empty-state">No competition groups in your scope.</div>`;
    return;
  }
  if (!groups.find((g) => g.id === state.currentGroupId)) state.currentGroupId = groups[0].id;

  const groupPersons = allPersons.filter((p) => p.competition_group_id === state.currentGroupId && p.active);
  const levelsInGroup = [...new Set(groupPersons.map((p) => p.level))];
  const rules = rulesForLevelsAndGroup(levelsInGroup, state.currentGroupId);
  const ruleCols = rules.flatMap(ruleColumns);
  const hasDivision = groupPersons.some((p) => p.division);
  const stickyCols = stickyColumnLayout(hasDivision);
  const lastStickyRight = stickyCols[stickyCols.length - 1].left + stickyCols[stickyCols.length - 1].width;

  const summaries = await Promise.all(
    groupPersons.map((p) => api.getPersonSummary(p.id, state.currentYearId)),
  );

  const groupLabel = groups.find((g) => g.id === state.currentGroupId)?.name ?? "";
  main.innerHTML = `
    <div class="grid-toolbar">
      <select id="group-select" class="input" style="width:auto;min-width:240px"></select>
      <input id="grid-search" class="input input-search" placeholder="Search by name…" />
      <span class="grid-toolbar-hint">${escapeHtml(groupLabel)} · ${groupPersons.length} people</span>
    </div>
    <div class="grid-wrap">
      <table>
        <thead>
          <tr>
            ${stickyCols.map((c) => `
              <th class="sticky${c.key === "total" ? " icon-lock sticky-total" : ""}"
                  style="left:${c.left}px;min-width:${c.width}px">${escapeHtml(c.label)}</th>
            `).join("")}
            ${ruleCols.map((col) => {
              const { label, meta, tbd } = ruleColumnHeader(col);
              return `
                <th title="${escapeHtml(col.rule.description ?? "")}">
                  <div class="rule-name">${escapeHtml(label)}${tbd ? '<span class="tag tag-accent tag-sm">TBD</span>' : ""}</div>
                  <div class="rule-meta">${escapeHtml(meta)}</div>
                </th>
              `;
            }).join("")}
          </tr>
        </thead>
        <tbody id="grid-body"></tbody>
      </table>
    </div>
  `;

  const groupSelect = main.querySelector("#group-select");
  groupSelect.innerHTML = groups.map((g) => `<option value="${g.id}" ${g.id === state.currentGroupId ? "selected" : ""}>${escapeHtml(g.name)}</option>`).join("");
  groupSelect.addEventListener("change", (e) => {
    state.currentGroupId = Number(e.target.value);
    localStorage.setItem(LS_GROUP_KEY, String(state.currentGroupId));
    renderScoringGrid(main);
  });

  const tbody = main.querySelector("#grid-body");
  function renderRows(filterText) {
    const filtered = groupPersons.filter((p) => p.name.toLowerCase().includes((filterText ?? "").toLowerCase()));
    tbody.innerHTML = filtered.map((person) => {
      const summary = summaries.find((s) => s.person.id === person.id);
      const managerPerson = groupPersons.find((p) => p.id === person.manager_id) ?? allPersons.find((p) => p.id === person.manager_id);
      const cells = ruleCols.map((col) => {
        const { rule, kind } = col;
        const applies = rule.applies_to_levels.includes(person.level);
        if (!applies) return `<td class="cell-na">—</td>`;
        const breakdown = summary.breakdown.find((b) => b.ruleId === rule.id);

        if (kind === "quarter") {
          const value = breakdown?.quarterlyRaw ? breakdown.quarterlyRaw[col.quarter - 1] : 0;
          if (!summary.canEdit) return `<td class="cell-readonly cell-quarter-helper">${value}</td>`;
          return `<td class="cell-editable cell-quarter-helper">
            <input class="cell-input" type="number" min="0" data-person="${person.id}" data-rule="${rule.id}" data-quarter="${col.quarter}"
              value="${value}" />
          </td>`;
        }
        if (kind === "computed") {
          return `<td class="cell-readonly icon-calc" title="${breakdown?.roundingAssumption ? "Prototype assumption - rounding TBD" : ""}">${breakdown ? breakdown.points : 0}</td>`;
        }

        const canEdit = summary.canEdit && rule.calculation_type !== "MAPPED_SCORE_TBD" && rule.calculation_type !== "UNKNOWN";
        if (rule.calculation_type === "MAPPED_SCORE_TBD" || rule.calculation_type === "UNKNOWN") {
          return `<td class="cell-placeholder" title="Placeholder - formula not confirmed yet, not included in total">Placeholder</td>`;
        }
        if (canEdit) {
          return `<td class="cell-editable">
            <input class="cell-input" type="number" min="0" data-person="${person.id}" data-rule="${rule.id}"
              value="${breakdown ? breakdown.rawValue : 0}" />
          </td>`;
        }
        return `<td class="cell-readonly icon-calc" title="${breakdown?.roundingAssumption ? "Prototype assumption - rounding TBD" : ""}">${breakdown ? breakdown.points : 0}</td>`;
      }).join("");

      const stickyCells = stickyCols.map((c) => {
        const style = `left:${c.left}px;min-width:${c.width}px`;
        if (c.key === "name") {
          return `<td class="sticky" style="${style}">${escapeHtml(person.name)}${summary.hasUnresolved ? '<span class="tag tag-accent tag-sm">TBD</span>' : ""}</td>`;
        }
        if (c.key === "title") return `<td class="sticky" style="${style}">${escapeHtml(person.title ?? "—")}</td>`;
        if (c.key === "division") return `<td class="sticky" style="${style}">${escapeHtml(person.division ?? "—")}</td>`;
        if (c.key === "manager") {
          return `<td class="sticky" style="${style}">${managerPerson ? escapeHtml(managerPerson.name) : "—"}</td>`;
        }
        return `<td class="sticky icon-lock sticky-total" style="${style}">${summary.total}</td>`;
      }).join("");

      return `
        <tr class="person-row" data-person-id="${person.id}">
          ${stickyCells}
          ${cells}
        </tr>
      `;
    }).join("") || `<tr><td colspan="${ruleCols.length + stickyCols.length}" class="empty-state">No people match.</td></tr>`;

    tbody.querySelectorAll(".cell-input").forEach((input) => {
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("change", async (e) => {
        e.stopPropagation();
        const personId = Number(input.dataset.person);
        const ruleId = Number(input.dataset.rule);
        const rawValue = Math.max(0, Number(input.value) || 0);
        const quarter = input.dataset.quarter ? Number(input.dataset.quarter) : undefined;
        try {
          await api.putScoreInput(personId, ruleId, { yearId: state.currentYearId, quarter, rawValue });
          const updated = await api.getPersonSummary(personId, state.currentYearId);
          const idx = summaries.findIndex((s) => s.person.id === personId);
          summaries[idx] = updated;
          showSaved(document.getElementById("saved-indicator"));
          renderRows(document.getElementById("grid-search").value);
        } catch (err) {
          alert(`Could not save: ${err.message}`);
        }
      });
    });

    tbody.querySelectorAll(".person-row").forEach((row) => {
      row.addEventListener("click", () => openPersonDrawer(Number(row.dataset.personId), (updatedSummary) => {
        const idx = summaries.findIndex((s) => s.person.id === updatedSummary.person.id);
        if (idx >= 0) summaries[idx] = updatedSummary;
        renderRows(document.getElementById("grid-search").value);
      }));
    });
  }
  renderRows("");
  main.querySelector("#grid-search").addEventListener("input", (e) => renderRows(e.target.value));
}

// ------------------------------------------------------------ person drawer

async function openPersonDrawer(personId, onUpdate) {
  const root = document.getElementById("drawer-root");
  root.innerHTML = `<div class="drawer-overlay"><div class="drawer"><div class="empty-state">Loading…</div></div></div>`;

  const [person, initialSummary, initialAuditLog] = await Promise.all([
    api.get("persons", personId),
    api.getPersonSummary(personId, state.currentYearId),
    api.getPersonAuditLog(personId),
  ]);
  const department = state.departments.find((d) => d.id === person.department_id);
  const group = groupById(person.competition_group_id);

  let summary = initialSummary;
  let auditLog = initialAuditLog;

  function renderDrawerBody() {
    const drawer = root.querySelector(".drawer");
    drawer.innerHTML = `
      <div style="display:flex;align-items:start;justify-content:space-between;gap:10px">
        <div>
          <h3 style="margin:0 0 4px">${escapeHtml(person.name)}</h3>
          <p class="text-muted" style="margin:0;font-size:12.5px">${escapeHtml(person.title ?? person.level)}${person.division ? ` · ${escapeHtml(person.division)}` : ""} · ${escapeHtml(department?.name ?? "")} · ${escapeHtml(group?.name ?? "")}</p>
        </div>
        <button class="btn btn-icon btn-secondary" data-close aria-label="Close">&times;</button>
      </div>
      <div class="drawer-total">
        <span class="label">Year total</span>
        <span class="value">${summary.total}</span>
        <span id="drawer-saved" class="saved-indicator">Saved</span>
      </div>
      ${summary.hasUnresolved ? `<div class="notice"><span class="notice-icon">!</span><span>One or more categories are TBD and excluded from the total.</span></div>` : ""}
      ${summary.canEdit ? "" : `<div class="notice"><span class="notice-icon">!</span><span>You don't have edit access for this person right now.</span></div>`}
      <div>
        <h4>Categories</h4>
        <table>
          <thead><tr><th>Rule</th><th>Raw</th><th style="text-align:right">Points</th></tr></thead>
          <tbody>
            ${summary.breakdown.map((b) => {
              const rule = summary.rules.find((r) => r.id === b.ruleId);
              // Quarterly rules are edited per-quarter in the Group Scoring grid, not
              // as one combined cell here - editing a single value would collide with
              // the underlying per-quarter rows and silently corrupt the total.
              const canEditThis = summary.canEdit && rule && !rule.quarters && rule.calculation_type !== "MAPPED_SCORE_TBD" && rule.calculation_type !== "UNKNOWN";
              const rawDisplay = b.quarterlyRaw
                ? `<span class="text-muted" style="font-size:11.5px">${b.quarterlyRaw.map((v, i) => `Q${i + 1}: ${v}`).join(" · ")}</span>`
                : canEditThis
                  ? `<input class="cell-input" type="number" min="0" data-rule="${b.ruleId}" value="${b.rawValue}" />`
                  : escapeHtml(String(b.rawValue));
              return `
                <tr>
                  <td>${escapeHtml(b.ruleName)}${b.unresolved ? '<span class="tag tag-accent tag-sm">TBD</span>' : ""}</td>
                  <td>${rawDisplay}</td>
                  <td style="text-align:right">${b.unresolved ? '<span class="cell-placeholder" style="display:inline-block;padding:2px 8px;border-radius:6px">Placeholder</span>' : b.points}${b.note && !b.unresolved ? `<div style="font-size:11px" class="text-muted">${escapeHtml(b.note)}</div>` : ""}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
      <div>
        <h4>Recent audit entries</h4>
        ${auditLog.length === 0 ? `<div class="empty-state">No edits yet.</div>` : `
          <table>
            <thead><tr><th>When</th><th>Rule</th><th>Old → New</th></tr></thead>
            <tbody>
              ${auditLog.slice(0, 10).map((a) => `
                <tr>
                  <td style="white-space:nowrap">${new Date(a.timestamp).toLocaleString()}</td>
                  <td>${escapeHtml(ruleById(a.rule_id)?.name ?? `#${a.rule_id}`)}</td>
                  <td>${a.old_calculated_points ?? 0} → ${a.new_calculated_points}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `}
      </div>
    `;

    drawer.querySelector("[data-close]").addEventListener("click", () => (root.innerHTML = ""));

    drawer.querySelectorAll(".cell-input").forEach((input) => {
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("change", async () => {
        const ruleId = Number(input.dataset.rule);
        const rawValue = Math.max(0, Number(input.value) || 0);
        try {
          await api.putScoreInput(personId, ruleId, { yearId: state.currentYearId, rawValue });
          [summary, auditLog] = await Promise.all([
            api.getPersonSummary(personId, state.currentYearId),
            api.getPersonAuditLog(personId),
          ]);
          renderDrawerBody();
          showSaved(document.getElementById("drawer-saved"));
          onUpdate?.(summary);
        } catch (err) {
          alert(`Could not save: ${err.message}`);
        }
      });
    });
  }

  renderDrawerBody();
}

// ------------------------------------------------------------ admin people

const PERSON_LEVELS = ["ASSOCIATE", "MANAGER", "DIRECTOR", "VP_AVP"];
const PEOPLE_CSV_COLUMNS = ["name", "title", "division", "level", "department", "competition_group", "manager"];

// Minimal RFC4180-ish CSV parser - no dependency, handles quoted fields
// (including embedded commas/newlines) and both \n and \r\n line endings.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Resolves department/competition-group/manager by exact (case-insensitive)
// name against what's already loaded client-side, rather than inventing new
// departments/groups on the fly - rows that don't match are skipped and
// reported, not guessed at.
async function importPeopleCsv(text, existingPersons) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { created: [], errors: ["The file is empty."] };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const col = Object.fromEntries(PEOPLE_CSV_COLUMNS.map((name) => [name, header.indexOf(name)]));
  if (col.name === -1 || col.level === -1 || col.department === -1 || col.competition_group === -1) {
    return { created: [], errors: [`Header row must include at least: ${PEOPLE_CSV_COLUMNS.slice(0, 4).join(", ")}.`] };
  }

  const created = [];
  const errors = [];
  const byName = new Map(existingPersons.map((p) => [p.name.toLowerCase(), p]));

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[col.name] ?? "").trim();
    if (!name) continue;
    const level = (r[col.level] ?? "").trim().toUpperCase();
    const deptName = (r[col.department] ?? "").trim();
    const groupName = (r[col.competition_group] ?? "").trim();
    const managerName = col.manager >= 0 ? (r[col.manager] ?? "").trim() : "";

    if (!PERSON_LEVELS.includes(level)) {
      errors.push(`Row ${i + 1} (${name}): level must be one of ${PERSON_LEVELS.join(", ")}, got "${level}".`);
      continue;
    }
    const department = state.departments.find((d) => d.name.toLowerCase() === deptName.toLowerCase());
    if (!department) {
      errors.push(`Row ${i + 1} (${name}): no department named "${deptName}".`);
      continue;
    }
    const group = state.competitionGroups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
    if (!group) {
      errors.push(`Row ${i + 1} (${name}): no competition group named "${groupName}".`);
      continue;
    }
    let managerId = null;
    if (managerName) {
      const manager = byName.get(managerName.toLowerCase());
      if (!manager) errors.push(`Row ${i + 1} (${name}): manager "${managerName}" not found - added without a manager.`);
      else managerId = manager.id;
    }

    try {
      const person = await api.create("persons", {
        name,
        title: col.title >= 0 ? (r[col.title] ?? "").trim() || null : null,
        division: col.division >= 0 ? (r[col.division] ?? "").trim() || null : null,
        level,
        department_id: department.id,
        competition_group_id: group.id,
        manager_id: managerId,
      });
      created.push(person);
      byName.set(person.name.toLowerCase(), person);
    } catch (err) {
      errors.push(`Row ${i + 1} (${name}): ${err.message}`);
    }
  }
  return { created, errors };
}

async function renderAdminPeople(main, csvResultHtml) {
  main.innerHTML = `<div class="empty-state">Loading…</div>`;
  const allPersons = await api.list("persons");

  main.innerHTML = `
    <div class="panel">
      <h3>Add a person</h3>
      <form id="add-person-form" style="display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:16px;align-items:end">
        <div class="field"><label>Name</label><input class="input" name="name" required /></div>
        <div class="field"><label>Title</label><input class="input" name="title" /></div>
        <div class="field"><label>Division</label><input class="input" name="division" /></div>
        <div class="field"><label>Level</label>
          <select class="input" name="level" required>${PERSON_LEVELS.map((l) => `<option value="${l}">${l}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Department</label>
          <select class="input" name="department_id" required>${state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Competition group</label>
          <select class="input" name="competition_group_id" required>${state.competitionGroups.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Manager (optional)</label>
          <select class="input" name="manager_id"><option value="">—</option>${allPersons.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}</select>
        </div>
        <button type="submit" class="btn btn-primary">Add person</button>
      </form>
      <div id="add-person-error"></div>
    </div>

    <div class="panel">
      <h3>Bulk upload from CSV</h3>
      <p class="text-muted" style="font-size:12.5px">
        Header row: <code>${PEOPLE_CSV_COLUMNS.join(", ")}</code> (title/division/manager optional).
        Department, competition group, and manager must already exist and match by exact name.
      </p>
      <input type="file" id="people-csv-input" class="btn btn-secondary" accept=".csv,text/csv" />
      <div id="csv-result" style="margin-top:10px">${csvResultHtml ?? ""}</div>
    </div>

    <div class="panel panel-table">
      <h3 style="padding:20px 24px 0">All people (${allPersons.length})</h3>
      <table>
        <thead><tr><th>Name</th><th>Title</th><th>Division</th><th>Level</th><th>Department</th><th>Competition group</th><th>Manager</th></tr></thead>
        <tbody>
          ${allPersons.map((p) => `
            <tr>
              <td>${escapeHtml(p.name)}</td>
              <td class="text-muted">${escapeHtml(p.title ?? "—")}</td>
              <td class="text-muted">${escapeHtml(p.division ?? "—")}</td>
              <td>${p.level}</td>
              <td class="text-muted">${escapeHtml(state.departments.find((d) => d.id === p.department_id)?.name ?? "—")}</td>
              <td class="text-muted">${escapeHtml(groupById(p.competition_group_id)?.name ?? "—")}</td>
              <td class="text-muted">${escapeHtml(allPersons.find((m) => m.id === p.manager_id)?.name ?? "—")}</td>
            </tr>
          `).join("") || `<tr><td colspan="7" class="empty-state">No people yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  main.querySelector("#add-person-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const errorEl = main.querySelector("#add-person-error");
    errorEl.innerHTML = "";
    try {
      await api.create("persons", {
        name: data.get("name").trim(),
        title: data.get("title").trim() || null,
        division: data.get("division").trim() || null,
        level: data.get("level"),
        department_id: Number(data.get("department_id")),
        competition_group_id: Number(data.get("competition_group_id")),
        manager_id: data.get("manager_id") ? Number(data.get("manager_id")) : null,
      });
      renderAdminPeople(main);
    } catch (err) {
      errorEl.innerHTML = `<div class="notice"><span class="notice-icon">!</span><span>${escapeHtml(err.message)}</span></div>`;
    }
  });

  main.querySelector("#people-csv-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const resultEl = main.querySelector("#csv-result");
    resultEl.innerHTML = `<div class="empty-state">Importing…</div>`;
    const text = await file.text();
    const { created, errors } = await importPeopleCsv(text, allPersons);
    const summaryHtml = `
      <div class="notice"><span class="notice-icon">!</span><span>${created.length} person${created.length === 1 ? "" : "s"} created${errors.length ? `, ${errors.length} row${errors.length === 1 ? "" : "s"} skipped or flagged` : ""}.</span></div>
      ${errors.length ? `<ul style="font-size:12.5px;margin:0;padding-left:20px">${errors.map((msg) => `<li>${escapeHtml(msg)}</li>`).join("")}</ul>` : ""}
    `;
    e.target.value = "";
    // Re-render to refresh the roster table below (new people, updated manager
    // dropdown) - the summary has to be re-injected explicitly, since a fresh
    // render's #csv-result starts empty and would otherwise wipe this message.
    if (created.length) renderAdminPeople(main, summaryHtml);
    else resultEl.innerHTML = summaryHtml;
  });
}

// ------------------------------------------------------------- admin rules

function renderAdminRules(main) {
  main.innerHTML = `
    <div class="panel panel-table">
      <table>
        <thead>
          <tr><th>Name</th><th>Levels</th><th>Groups</th><th>Type</th><th>Rate</th><th>Max</th><th>Confirmed?</th></tr>
        </thead>
        <tbody>
          ${state.awardRules.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td>${r.applies_to_levels.join(", ")}</td>
              <td>${r.competition_group_ids ? r.competition_group_ids.map((id) => escapeHtml(groupById(id)?.name ?? id)).join(", ") : "All"}</td>
              <td>${r.calculation_type}</td>
              <td>${r.rate ?? "—"}</td>
              <td>${r.max_points ?? "—"}</td>
              <td>${r.formula_confirmed ? '<span class="tag tag-accent-2">Yes</span>' : '<span class="tag tag-accent">TBD - not included in total</span>'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ------------------------------------------------------------ admin access

// ------------------------------------------------------------ admin access

function accessRoleFieldsVisibility(form) {
  const role = form.querySelector('[name="role"]').value;
  form.querySelector('[data-role-fields="EA"]').style.display = role === "EA" ? "" : "none";
  form.querySelector('[data-role-fields="MANAGER"]').style.display = role === "MANAGER" ? "" : "none";
}

function personOptionLabel(person) {
  const dept = state.departments.find((d) => d.id === person.department_id);
  return `${person.name}${dept ? ` (${dept.name})` : ""}`;
}

async function renderAdminAccess(main) {
  main.innerHTML = `<div class="empty-state">Loading…</div>`;
  const [demoUsers, allPersons] = await Promise.all([api.list("demo-users"), api.list("persons")]);
  state.demoUsers = demoUsers;

  function accountFormFields(idPrefix, user) {
    return `
      <div class="field"><label>Name</label><input class="input" name="name" required value="${user ? escapeHtml(user.name) : ""}" /></div>
      <div class="field"><label>Email</label><input class="input" type="email" name="email" required value="${user ? escapeHtml(user.email) : ""}" /></div>
      ${user ? "" : `<div class="field"><label>Password</label><input class="input" type="password" name="password" minlength="8" required /></div>`}
      <div class="field"><label>Role</label>
        <select class="input" name="role" required>
          ${["ADMIN", "EA", "MANAGER"].map((r) => `<option value="${r}" ${user?.role === r ? "selected" : ""}>${r}</option>`).join("")}
        </select>
      </div>
      <div class="field" data-role-fields="EA" style="grid-column:span 2">
        <label>Assigned competition groups (EA)</label>
        <select class="input" name="assigned_competition_group_ids" multiple size="4">
          ${state.competitionGroups.map((g) => `<option value="${g.id}" ${user?.assigned_competition_group_ids?.includes(g.id) ? "selected" : ""}>${escapeHtml(g.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field" data-role-fields="MANAGER" style="grid-column:span 2">
        <label>Managed people (Manager)</label>
        <select class="input" name="managed_person_ids" multiple size="4">
          ${allPersons.map((p) => `<option value="${p.id}" ${user?.managed_person_ids?.includes(p.id) ? "selected" : ""}>${escapeHtml(personOptionLabel(p))}</option>`).join("")}
        </select>
      </div>
    `;
  }

  function readAccountForm(form) {
    const data = new FormData(form);
    const selected = (name) => Array.from(form.querySelector(`[name="${name}"]`).selectedOptions).map((o) => Number(o.value));
    return {
      name: data.get("name").trim(),
      email: data.get("email").trim(),
      role: data.get("role"),
      assigned_competition_group_ids: selected("assigned_competition_group_ids"),
      managed_person_ids: selected("managed_person_ids"),
    };
  }

  main.innerHTML = `
    <div class="panel">
      <h3>Add an account</h3>
      <form id="add-account-form" style="display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:16px;align-items:end">
        ${accountFormFields()}
        <button type="submit" class="btn btn-primary" style="grid-column:1/-1">Add account</button>
      </form>
      <div id="add-account-error"></div>
    </div>

    <div class="panel panel-table">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Assigned groups</th><th>Managed people</th><th></th></tr></thead>
        <tbody id="access-tbody">
          ${demoUsers.map((u) => `
            <tr data-user-id="${u.id}">
              <td>${escapeHtml(u.name)}</td>
              <td class="text-muted" style="font-family:ui-monospace,monospace;font-size:12px">${escapeHtml(u.email)}</td>
              <td><span class="tag tag-outline">${u.role}</span></td>
              <td class="text-muted">${u.assigned_competition_group_ids.map((id) => escapeHtml(groupById(id)?.name ?? id)).join(", ") || "—"}</td>
              <td class="text-muted">${u.managed_person_ids.map((id) => escapeHtml(allPersons.find((p) => p.id === id)?.name ?? `#${id}`)).join(", ") || "—"}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-secondary" data-edit="${u.id}">Edit</button>
                <button class="btn btn-secondary" data-remove="${u.id}" ${u.id === currentUser().id ? "disabled title=\"Can't remove your own account\"" : ""}>Remove</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p class="text-muted" style="font-size:12px;padding:0 24px 16px">Real login accounts, gated to admins - see Audit &amp; Rollover for who did what.</p>
    </div>
  `;

  const addForm = main.querySelector("#add-account-form");
  accessRoleFieldsVisibility(addForm);
  addForm.querySelector('[name="role"]').addEventListener("change", () => accessRoleFieldsVisibility(addForm));
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = main.querySelector("#add-account-error");
    errorEl.innerHTML = "";
    try {
      await api.create("demo-users", { ...readAccountForm(addForm), password: new FormData(addForm).get("password") });
      renderAdminAccess(main);
    } catch (err) {
      errorEl.innerHTML = `<div class="notice"><span class="notice-icon">!</span><span>${escapeHtml(err.message)}</span></div>`;
    }
  });

  main.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = Number(btn.dataset.edit);
      const user = demoUsers.find((u) => u.id === userId);
      const row = main.querySelector(`tr[data-user-id="${userId}"]`);
      row.innerHTML = `
        <td colspan="6">
          <form class="edit-account-form" style="display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:16px;align-items:end;padding:10px 0">
            ${accountFormFields(userId, user)}
            <div style="display:flex;gap:8px;grid-column:1/-1">
              <button type="submit" class="btn btn-primary">Save</button>
              <button type="button" class="btn btn-secondary" data-cancel-edit>Cancel</button>
            </div>
          </form>
          <div class="edit-account-error"></div>
        </td>
      `;
      const form = row.querySelector(".edit-account-form");
      accessRoleFieldsVisibility(form);
      form.querySelector('[name="role"]').addEventListener("change", () => accessRoleFieldsVisibility(form));
      form.querySelector("[data-cancel-edit]").addEventListener("click", () => renderAdminAccess(main));
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await api.update("demo-users", userId, readAccountForm(form));
          renderAdminAccess(main);
        } catch (err) {
          row.querySelector(".edit-account-error").innerHTML = `<div class="notice"><span class="notice-icon">!</span><span>${escapeHtml(err.message)}</span></div>`;
        }
      });
    });
  });

  main.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = Number(btn.dataset.remove);
      const user = demoUsers.find((u) => u.id === userId);
      showConfirmDialog(`Remove ${user.name}'s access? They won't be able to log in anymore.`, async () => {
        try {
          await api.remove("demo-users", userId);
          renderAdminAccess(main);
        } catch (err) {
          alert(`Could not remove: ${err.message}`);
        }
      });
    });
  });
}

// --------------------------------------------------------- audit & rollover

async function renderAuditRollover(main) {
  main.innerHTML = `<div class="empty-state">Loading…</div>`;
  const year = currentYear();
  const auditLog = await api.list("audit-log-entries");
  const rankingsByGroup = await Promise.all(
    state.competitionGroups.map((g) => api.getGroupRankings(g.id, state.currentYearId).catch(() => null)),
  );

  main.innerHTML = `
    <div class="panel">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <h3 style="margin:0">Year ${year?.year}</h3>
        <span class="tag ${statusTagClass(year?.status)}" style="text-transform:uppercase">${year?.status.replace("_", " ")}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        <button class="btn btn-secondary" data-action="unlock" ${year?.status === "ACTIVE" ? "disabled" : ""}>Unlock</button>
        <button class="btn btn-secondary" data-action="lock" ${year?.status !== "ACTIVE" ? "disabled" : ""}>Lock for Audit</button>
        <button class="btn btn-danger" data-action="archive" ${year?.status === "ARCHIVED" ? "disabled" : ""}>Archive</button>
        <button class="btn btn-primary" style="margin-left:auto" data-action="rollover">Create ${year ? year.year + 1 : ""} from ${year?.year ?? ""}</button>
      </div>
    </div>

    <div class="panel">
      <h3>Provisional rankings by competition group</h3>
      <div class="notice"><span class="notice-icon">!</span><span>Provisional only - final winner rules/ties not configured</span></div>
      ${rankingsByGroup.filter(Boolean).map((r) => `
        <h4>${escapeHtml(r.group.name)}</h4>
        <table>
          <thead><tr><th>Person</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>
            ${r.rankings.map((row) => `<tr><td>${escapeHtml(row.person.name)}${row.hasUnresolved ? '<span class="tag tag-accent tag-sm">TBD</span>' : ""}</td><td style="text-align:right;font-family:var(--font-heading)">${row.total}</td></tr>`).join("") || `<tr><td colspan="2" class="empty-state">No people</td></tr>`}
          </tbody>
        </table>
      `).join("")}
    </div>

    <div class="panel panel-table">
      <h3 style="padding:20px 24px 0">Audit log</h3>
      <table>
        <thead><tr><th>When</th><th>Person</th><th>Rule</th><th>Old → New</th></tr></thead>
        <tbody>
          ${auditLog.slice(0, 30).map((a) => `
            <tr>
              <td style="white-space:nowrap">${new Date(a.timestamp).toLocaleString()}</td>
              <td>#${a.person_id}</td>
              <td>${escapeHtml(ruleById(a.rule_id)?.name ?? `#${a.rule_id}`)}</td>
              <td>${a.old_calculated_points ?? 0} → ${a.new_calculated_points}</td>
            </tr>
          `).join("") || `<tr><td colspan="4" class="empty-state">No edits yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  main.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleYearAction(btn.dataset.action));
  });
}

function handleYearAction(action) {
  const year = currentYear();
  const labels = {
    lock: `Lock ${year.year} for audit? EAs and managers will lose edit access.`,
    unlock: `Unlock ${year.year} and return it to ACTIVE?`,
    archive: `Archive ${year.year}? This makes it permanently read-only.`,
    rollover: `Create ${year.year + 1} from ${year.year}? Departments, groups, people, and rules carry over; all scoring starts blank.`,
  };
  showConfirmDialog(labels[action], async () => {
    try {
      if (action === "lock") await api.lockYear(year.id);
      if (action === "unlock") await api.unlockYear(year.id);
      if (action === "archive") await api.archiveYear(year.id);
      if (action === "rollover") {
        const result = await api.rolloverYear(year.id);
        state.awardYears.push(result.createdYear);
        state.currentYearId = result.createdYear.id;
        localStorage.setItem(LS_YEAR_KEY, String(state.currentYearId));
      } else {
        const idx = state.awardYears.findIndex((y) => y.id === year.id);
        state.awardYears[idx] = await api.get("award-years", year.id);
      }
      renderAll();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  });
}

function showConfirmDialog(message, onConfirm) {
  const root = document.getElementById("dialog-root");
  root.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog">
        <h3>Confirm</h3>
        <p>${escapeHtml(message)}</p>
        <div class="dialog-actions">
          <button class="btn btn-secondary" data-cancel>Cancel</button>
          <button class="btn btn-primary" data-confirm>Confirm</button>
        </div>
      </div>
    </div>
  `;
  root.querySelector("[data-cancel]").addEventListener("click", () => (root.innerHTML = ""));
  root.querySelector("[data-confirm]").addEventListener("click", async () => {
    root.innerHTML = "";
    await onConfirm();
  });
}

init();
