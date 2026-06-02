export type TipHouseUser = {
  id: string;
  role: string;
  accountStatus?: string;
  creatorSetupCompleted?: boolean;
};

export function saveSession(user: TipHouseUser, accessToken: string) {
  localStorage.setItem("tiphouse_access_token", accessToken);
  localStorage.setItem("tiphouse_user_id", user.id);
  localStorage.setItem("tiphouse_role", user.role);
  if (user.accountStatus) localStorage.setItem("tiphouse_account_status", user.accountStatus);
  localStorage.setItem("tiphouse_creator_setup_completed", user.creatorSetupCompleted ? "true" : "false");
}

export function clearSession() {
  localStorage.removeItem("tiphouse_access_token");
  localStorage.removeItem("tiphouse_user_id");
  localStorage.removeItem("tiphouse_role");
  localStorage.removeItem("tiphouse_account_status");
  localStorage.removeItem("tiphouse_creator_setup_completed");
}

export function currentUserId() {
  return localStorage.getItem("tiphouse_user_id") || "anonymous";
}

export function userCacheKey(key: string) {
  return `tiphouse:${currentUserId()}:${key}`;
}
