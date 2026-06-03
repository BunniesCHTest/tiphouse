import axios from "axios";
import { getSession, SessionScope } from "./session";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api",
  withCredentials: true,
  timeout: 30000,
});

export function authHeaders(scope: SessionScope = "user") {
  if (typeof window === "undefined") return {};
  const token = getSession(scope).accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
