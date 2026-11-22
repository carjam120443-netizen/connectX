import { io } from "socket.io-client";

const DEFAULT_API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

export function getApiBase() {
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  return (localStorage.getItem("connectx_api_url") || DEFAULT_API_BASE).replace(/\/$/, "");
}

export async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${getApiBase()}${path}`, {
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
  return io(getApiBase(), { auth: { token }, transports: ["websocket", "polling"] });
}