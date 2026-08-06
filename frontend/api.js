// The ONLY way the front-end talks to data. No hardcoded data may remain in
// the front-end after graduation (gate check 1 & 2).
//
// DEVIATION FROM THE SKILL TEMPLATE: the template's generic list/get/create/
// update/remove cover flat CRUD, but this app has real business endpoints
// (permission-checked score-input writes, computed person summaries,
// provisional rankings, year lifecycle actions, real login) that aren't flat
// CRUD. Those are added as named helpers below, still funneled through the
// same request() function, so this file remains the single seam boundary.
const BASE = "/api";

async function request(method, path, body) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include", // send the httpOnly session cookie on every request
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `${method} ${path} failed: ${res.status}`;
    try {
      const problem = await res.json();
      if (problem?.error) message = problem.error;
    } catch {
      // response wasn't JSON - keep the generic message
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return res.status === 204 ? null : res.json();
}

// Generic helpers for flat resources, e.g. api.list("departments").
export const api = {
  list: (resource) => request("GET", `/${resource}`),
  get: (resource, id) => request("GET", `/${resource}/${id}`),
  create: (resource, data) => request("POST", `/${resource}`, data),
  update: (resource, id, data) => request("PUT", `/${resource}/${id}`, data),
  remove: (resource, id) => request("DELETE", `/${resource}/${id}`),

  // Real login (username + password + server-side session cookie) - not SSO,
  // not a demo persona switcher. See api/domain/auth.ts.
  login: (username, password) => request("POST", "/auth/login", { username, password }),
  logout: () => request("POST", "/auth/logout"),
  me: () => request("GET", "/auth/me"),

  // Named helpers for this app's non-flat routes.
  getPersonSummary: (personId, yearId) => request("GET", `/persons/${personId}/summary?yearId=${yearId}`),
  getPersonAuditLog: (personId) => request("GET", `/persons/${personId}/audit-log-entries`),
  putScoreInput: (personId, ruleId, data) =>
    request("PUT", `/persons/${personId}/rules/${ruleId}/score-input`, data),
  getGroupRankings: (groupId, yearId) => request("GET", `/competition-groups/${groupId}/rankings?yearId=${yearId}`),
  lockYear: (yearId) => request("POST", `/award-years/${yearId}/lock`),
  unlockYear: (yearId) => request("POST", `/award-years/${yearId}/unlock`),
  archiveYear: (yearId) => request("POST", `/award-years/${yearId}/archive`),
  rolloverYear: (yearId) => request("POST", `/award-years/${yearId}/rollover`),
};
