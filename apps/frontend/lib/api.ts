import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api",
  withCredentials: true,
  timeout: 2000,
});

export function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("tiphouse_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
