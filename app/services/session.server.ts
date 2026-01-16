import { createCookieSessionStorage } from "react-router";

const sessionSecret = import.meta.env.VITE_SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required");
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "photo_viewer_session",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export const getSession = (request: Request) =>
  sessionStorage.getSession(request.headers.get("Cookie"));

export const commitSession = sessionStorage.commitSession;
export const destroySession = sessionStorage.destroySession;
