export type TipHouseUser = {
  id: string;
  role: string;
};

export function saveSession(user: TipHouseUser, accessToken: string) {
  localStorage.setItem("tiphouse_access_token", accessToken);
  localStorage.setItem("tiphouse_user_id", user.id);
  localStorage.setItem("tiphouse_role", user.role);
}

export function clearSession() {
  localStorage.removeItem("tiphouse_access_token");
  localStorage.removeItem("tiphouse_user_id");
  localStorage.removeItem("tiphouse_role");
}

export function currentUserId() {
  return localStorage.getItem("tiphouse_user_id") || "anonymous";
}

export function userCacheKey(key: string) {
  return `tiphouse:${currentUserId()}:${key}`;
}
