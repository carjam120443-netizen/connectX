import { io } from "socket.io-client";

export const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

export async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function connectSocket(token) {
  return io(API_BASE, { auth: { token }, transports: ["websocket", "polling"] });
}