import { createCookieSessionStorage } from "react-router";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session", 
    sameSite: "lax", 
    path: "/", 
    httpOnly: true, 
    secrets: [process.env.SESSION_SECRET || "s3cr3t"], 
    secure: process.env.NODE_ENV === "production", 
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;