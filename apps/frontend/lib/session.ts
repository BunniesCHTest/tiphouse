export type TipHouseUser = {
  id: string;
  role: string;
  accountStatus?: string;
  creatorSetupCompleted?: boolean;
};

export type SessionScope = "user" | "admin";
export const SESSION_CHANGED_EVENT = "tiphouse:session-changed";

function notifySessionChanged(scope: SessionScope) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT, { detail: { scope } }));
  }
}

function key(scope: SessionScope, name: string) {
  return scope === "admin" ? `tiphouse_admin_${name}` : `tiphouse_${name}`;
}

export function saveSession(user: TipHouseUser, accessToken: string, scope: SessionScope = user.role === "ADMIN" || user.role === "ACCOUNTING" ? "admin" : "user") {
  localStorage.setItem(key(scope, "access_token"), accessToken);
  localStorage.setItem(key(scope, "user_id"), user.id);
  localStorage.setItem(key(scope, "role"), user.role);
  if (user.accountStatus) localStorage.setItem(key(scope, "account_status"), user.accountStatus);
  localStorage.setItem(key(scope, "creator_setup_completed"), user.creatorSetupCompleted ? "true" : "false");
  notifySessionChanged(scope);
}

export function getSession(scope: SessionScope = "user") {
  return {
    accessToken: localStorage.getItem(key(scope, "access_token")) || "",
    userId: localStorage.getItem(key(scope, "user_id")) || "",
    role: localStorage.getItem(key(scope, "role")) || "",
    accountStatus: localStorage.getItem(key(scope, "account_status")) || "",
    creatorSetupCompleted: localStorage.getItem(key(scope, "creator_setup_completed")) === "true",
  };
}

export function setSessionValue(scope: SessionScope, name: "role" | "account_status" | "creator_setup_completed", value: string) {
  localStorage.setItem(key(scope, name), value);
}

export function clearSession(scope: SessionScope = "user") {
  localStorage.removeItem(key(scope, "access_token"));
  localStorage.removeItem(key(scope, "user_id"));
  localStorage.removeItem(key(scope, "role"));
  localStorage.removeItem(key(scope, "account_status"));
  localStorage.removeItem(key(scope, "creator_setup_completed"));
  if (scope === "user") localStorage.removeItem("tiphouse_last_activity");
  notifySessionChanged(scope);
}

export function currentUserId() {
  return localStorage.getItem("tiphouse_user_id") || "anonymous";
}

export function userCacheKey(key: string) {
  return `tiphouse:${currentUserId()}:${key}`;
}
