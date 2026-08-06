// Front-end shell — everything here calls through api.js (the seam). No
// hardcoded data arrays (gate check 1). Vanilla JS/DOM, no build step, to
// match the skill's static-frontend template philosophy.
import { api, setCurrentDemoUserId } from "./api.js";

const LS_USER_KEY = "opex-demo-user-id";
const LS_YEAR_KEY = "opex-year-id";
const LS_GROUP_KEY = "opex-group-id";

const state = {
  demoUsers: [],
  awardYears: [],
  departments: [],
  competitionGroups: [],
  awardRules: [],
  currentUserId: null,
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
  return state.demoUsers.find((u) => u.id === state.currentUserId) ?? null;
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

  const savedUserId = Number(localStorage.getItem(LS_USER_KEY));
  state.currentUserId = demoUsers.find((u) => u.id === savedUserId)?.id ?? demoUsers[0]?.id ?? null;
  setCurrentDemoUserId(state.currentUserId);

  const savedYearId = Number(localStorage.getItem(LS_YEAR_KEY));
  const latestYear = awardYears.slice().sort((a, b) => b.year - a.year)[0];
  state.currentYearId = awardYears.find((y) => y.id === savedYearId)?.id ?? latestYear?.id ?? null;

  const savedGroupId = Number(localStorage.getItem(LS_GROUP_KEY));
  state.currentGroupId = competitionGroups.find((g) => g.id === savedGroupId)?.id ?? competitionGroups[0]?.id ?? null;

  renderAll();
}

function renderAll() {
  renderHeader();
  renderNav();
  renderView();
}

// ------------------------------------------------------------------ header

function renderHeader() {
  const header = document.getElementById("app-header");
  const year = currentYear();
  header.innerHTML = `
    <h1>Operational Excellence</h1>
    <label>Year
      <select id="year-select" class="select-inline"></select>
    </label>
    ${year ? `<span class="status-badge status-${year.status}">${year.status.replace("_", " ")}</span>` : ""}
    <label>Viewing as
      <select id="user-select" class="select-inline"></select>
    </label>
    <span id="saved-indicator" class="saved-indicator">Saved</span>
  `;

  const yearSelect = header.querySelector("#year-select");
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

  const userSelect = header.querySelector("#user-select");
  userSelect.innerHTML = state.demoUsers
    .map((u) => `<option value="${u.id}" ${u.id === state.currentUserId ? "selected" : ""}>${escapeHtml(u.name)}</option>`)
    .join("");
  userSelect.addEventListener("change", (e) => {
    state.currentUserId = Number(e.target.value);
    setCurrentDemoUserId(state.currentUserId);
    localStorage.setItem(LS_USER_KEY, String(state.currentUserId));
    if (state.currentView === "rules" || state.currentView === "access" || state.currentView === "audit") {
      state.currentView = "dashboard";
    }
    renderAll();
  });
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

function renderView() {
  const main = document.getElementById("app-main");
  if (!currentUser()) {
    main.innerHTML = `<div class="empty-state">No demo users configured. Run "npm run seed" first.</div>`;
    return;
  }
  switch (state.currentView) {
    case "dashboard": return renderDashboard(main);
    case "grid": return renderScoringGrid(main);
    case "rules": return renderAdminRules(main);
    case "access": return renderAdminAccess(main);
    case "audit": return renderAuditRollover(main);
    default: main.innerHTML = "";
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
        <div class="notice">${escapeHtml(rankings.notice)}</div>
        <table>
          <thead><tr><th>Person</th><th>Total</th></tr></thead>
          <tbody>
            ${rankings.rankings.slice(0, 5).map((r) => `
              <tr>
                <td>${escapeHtml(r.person.name)}${r.hasUnresolved ? '<span class="badge-tbd">TBD PENDING</span>' : ""}</td>
                <td>${r.total}</td>
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
    <div class="stat-row">
      <div class="stat-card"><div class="label">Year</div><div class="value">${year ? year.year : "—"}</div></div>
      <div class="stat-card"><div class="label">Groups you can access</div><div class="value">${groups.length}</div></div>
      <div class="stat-card"><div class="label">People</div><div class="value">${persons.length}</div></div>
      <div class="stat-card"><div class="label">Point entries</div><div class="value">${entryCount}</div></div>
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

// Short point-value annotation shown under each rule's header, mirroring how
// the source Smartsheet embeds "(15pts)" etc. directly in the column header.
function formatRuleMeta(rule) {
  switch (rule.calculation_type) {
    case "FIXED_PER_OCCURRENCE": return `${rule.rate} pts`;
    case "CAPPED_PER_OCCURRENCE": return `${rule.rate} pts, max ${rule.max_points}`;
    case "QUARTERLY_SUM_TIMES_RATE": return `${rule.rate} pts/badge`;
    case "BADGES_PER_POINT": return `1 pt / ${rule.rate} badges`;
    case "SCORE_INPUT": return "raw input";
    case "MAPPED_SCORE_TBD":
    case "UNKNOWN":
    default: return "formula TBD";
  }
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

  const summaries = await Promise.all(
    groupPersons.map((p) => api.getPersonSummary(p.id, state.currentYearId)),
  );

  const groupLabel = groups.find((g) => g.id === state.currentGroupId)?.name ?? "";
  main.innerHTML = `
    <div class="panel grid-toolbar">
      <label>Competition group
        <select id="group-select" class="select-inline"></select>
      </label>
      <input id="grid-search" class="search-input" placeholder="Search by name…" />
      <span class="grid-toolbar-hint">${escapeHtml(groupLabel)} · ${groupPersons.length} people</span>
    </div>
    <div class="grid-wrap">
      <table>
        <thead>
          <tr>
            <th class="sticky sticky-name">Associate Name</th>
            <th class="sticky sticky-title">Title</th>
            <th class="sticky sticky-manager">Manager</th>
            <th class="sticky sticky-total icon-lock">Total</th>
            ${rules.map((r) => `
              <th title="${escapeHtml(r.description ?? "")}">
                <div class="rule-name">${escapeHtml(r.name)}${r.formula_confirmed ? "" : '<span class="badge-tbd">TBD</span>'}</div>
                <div class="rule-meta">${escapeHtml(formatRuleMeta(r))}</div>
              </th>
            `).join("")}
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
      const cells = rules.map((rule) => {
        const applies = rule.applies_to_levels.includes(person.level);
        if (!applies) return `<td class="cell-unresolved">—</td>`;
        const breakdown = summary.breakdown.find((b) => b.ruleId === rule.id);
        const canEdit = summary.canEdit && rule.calculation_type !== "MAPPED_SCORE_TBD" && rule.calculation_type !== "UNKNOWN";
        if (rule.calculation_type === "MAPPED_SCORE_TBD" || rule.calculation_type === "UNKNOWN") {
          return `<td class="cell-unresolved" title="TBD - not included in total">TBD</td>`;
        }
        if (canEdit) {
          return `<td class="cell-editable">
            <input class="cell-input" type="number" min="0" data-person="${person.id}" data-rule="${rule.id}"
              value="${breakdown ? breakdown.rawValue : 0}" />
          </td>`;
        }
        return `<td class="cell-readonly icon-calc" title="${rule.roundingAssumption ? "Prototype assumption - rounding TBD" : ""}">${breakdown ? breakdown.points : 0}</td>`;
      }).join("");

      return `
        <tr class="person-row" data-person-id="${person.id}">
          <td class="sticky sticky-name">${escapeHtml(person.name)}${summary.hasUnresolved ? '<span class="badge-tbd">TBD</span>' : ""}</td>
          <td class="sticky sticky-title">${escapeHtml(person.title ?? "—")}</td>
          <td class="sticky sticky-manager">${managerPerson ? escapeHtml(managerPerson.name) : "—"}</td>
          <td class="sticky sticky-total icon-lock">${summary.total}</td>
          ${cells}
        </tr>
      `;
    }).join("") || `<tr><td colspan="${rules.length + 4}" class="empty-state">No people match.</td></tr>`;

    tbody.querySelectorAll(".cell-input").forEach((input) => {
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("change", async (e) => {
        e.stopPropagation();
        const personId = Number(input.dataset.person);
        const ruleId = Number(input.dataset.rule);
        const rawValue = Math.max(0, Number(input.value) || 0);
        try {
          await api.putScoreInput(personId, ruleId, { yearId: state.currentYearId, rawValue });
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
      row.addEventListener("click", () => openPersonDrawer(Number(row.dataset.personId)));
    });
  }
  renderRows("");
  main.querySelector("#grid-search").addEventListener("input", (e) => renderRows(e.target.value));
}

// ------------------------------------------------------------ person drawer

async function openPersonDrawer(personId) {
  const root = document.getElementById("drawer-root");
  root.innerHTML = `<div class="drawer-overlay"><div class="drawer"><div class="empty-state">Loading…</div></div></div>`;
  root.querySelector(".drawer-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("drawer-overlay")) root.innerHTML = "";
  });

  const [person, summary, auditLog] = await Promise.all([
    api.get("persons", personId),
    api.getPersonSummary(personId, state.currentYearId),
    api.getPersonAuditLog(personId),
  ]);
  const department = state.departments.find((d) => d.id === person.department_id);
  const group = groupById(person.competition_group_id);

  root.innerHTML = `
    <div class="drawer-overlay">
      <div class="drawer">
        <button class="drawer-close" data-close>&times;</button>
        <h2>${escapeHtml(person.name)}</h2>
        <p>${escapeHtml(person.title ?? person.level)} · ${escapeHtml(department?.name ?? "")} · ${escapeHtml(group?.name ?? "")}</p>
        <div class="stat-card" style="margin-bottom:16px"><div class="label">Year Total</div><div class="value">${summary.total}</div></div>
        ${summary.hasUnresolved ? `<div class="notice">One or more categories are TBD and excluded from the total.</div>` : ""}
        <h3>Categories</h3>
        <table>
          <thead><tr><th>Rule</th><th>Raw</th><th>Points</th></tr></thead>
          <tbody>
            ${summary.breakdown.map((b) => `
              <tr>
                <td>${escapeHtml(b.ruleName)}${b.unresolved ? '<span class="badge-tbd">TBD</span>' : ""}</td>
                <td>${b.rawValue}</td>
                <td>${b.unresolved ? "—" : b.points}${b.note && !b.unresolved ? `<div style="font-size:11px;color:var(--muted)">${escapeHtml(b.note)}</div>` : ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <h3>Recent audit entries</h3>
        ${auditLog.length === 0 ? `<div class="empty-state">No edits yet.</div>` : `
          <table>
            <thead><tr><th>When</th><th>Rule</th><th>Old → New</th></tr></thead>
            <tbody>
              ${auditLog.slice(0, 10).map((a) => `
                <tr>
                  <td>${new Date(a.timestamp).toLocaleString()}</td>
                  <td>${escapeHtml(ruleById(a.rule_id)?.name ?? `#${a.rule_id}`)}</td>
                  <td>${a.old_calculated_points ?? 0} → ${a.new_calculated_points}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
  root.querySelector("[data-close]").addEventListener("click", () => (root.innerHTML = ""));
}

// ------------------------------------------------------------- admin rules

function renderAdminRules(main) {
  main.innerHTML = `
    <div class="panel">
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
              <td>${r.formula_confirmed ? "Yes" : '<span class="badge-tbd">TBD - not included in total</span>'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ------------------------------------------------------------ admin access

function renderAdminAccess(main) {
  main.innerHTML = `
    <div class="panel">
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Assigned groups</th><th>Managed people (ids)</th></tr></thead>
        <tbody>
          ${state.demoUsers.map((u) => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${u.role}</td>
              <td>${u.assigned_competition_group_ids.map((id) => escapeHtml(groupById(id)?.name ?? id)).join(", ") || "—"}</td>
              <td>${u.managed_person_ids.join(", ") || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p style="font-size:12px;color:var(--muted)">Prototype-only access configuration, not production IAM.</p>
    </div>
  `;
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
      <h3>Year ${year?.year} — <span class="status-badge status-${year?.status}">${year?.status.replace("_", " ")}</span></h3>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn" data-action="unlock" ${year?.status === "ACTIVE" ? "disabled" : ""}>Unlock</button>
        <button class="btn" data-action="lock" ${year?.status !== "ACTIVE" ? "disabled" : ""}>Lock for Audit</button>
        <button class="btn btn-danger" data-action="archive" ${year?.status === "ARCHIVED" ? "disabled" : ""}>Archive</button>
        <button class="btn btn-primary" data-action="rollover">Create ${year ? year.year + 1 : ""} from ${year?.year ?? ""}</button>
      </div>
    </div>

    <div class="panel">
      <h3>Provisional rankings by competition group</h3>
      <div class="notice">Provisional only - final winner rules/ties not configured</div>
      ${rankingsByGroup.filter(Boolean).map((r) => `
        <h4>${escapeHtml(r.group.name)}</h4>
        <table>
          <thead><tr><th>Person</th><th>Total</th></tr></thead>
          <tbody>
            ${r.rankings.map((row) => `<tr><td>${escapeHtml(row.person.name)}${row.hasUnresolved ? '<span class="badge-tbd">TBD</span>' : ""}</td><td>${row.total}</td></tr>`).join("") || `<tr><td colspan="2" class="empty-state">No people</td></tr>`}
          </tbody>
        </table>
      `).join("")}
    </div>

    <div class="panel">
      <h3>Audit log</h3>
      <table>
        <thead><tr><th>When</th><th>Person</th><th>Rule</th><th>Old → New</th></tr></thead>
        <tbody>
          ${auditLog.slice(0, 30).map((a) => `
            <tr>
              <td>${new Date(a.timestamp).toLocaleString()}</td>
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
          <button class="btn" data-cancel>Cancel</button>
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
