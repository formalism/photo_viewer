import { Authenticator } from "remix-auth";
import { OAuth2Strategy } from "remix-auth-oauth2";
import type { OAuth2Tokens } from "arctic";
import { sessionStorage, getSession, commitSession } from "./sessions.server";
import { isUserAllowed } from "./db.server";
import { redirect } from "react-router";

export interface AuthUser {
    email: string;
}

// Authenticator in v4 takes no arguments
export const authenticator = new Authenticator<AuthUser>();

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5173/auth/google/callback";

if (clientID && clientSecret) {
    const googleStrategy = new OAuth2Strategy<AuthUser>(
        {
            clientId: clientID,
            clientSecret: clientSecret,
            redirectURI: callbackURL,
            authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
            tokenEndpoint: "https://oauth2.googleapis.com/token",
            scopes: ["openid", "email", "profile"],
        },
        async ({ tokens }: { tokens: OAuth2Tokens }) => {
            const accessToken = tokens.accessToken();
            const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            
            if (!response.ok) {
                throw new Error("Failed to fetch user profile");
            }
            
            const profile = await response.json();
            const email = profile.email;
            
            if (!email) {
                throw new Error("Email not found in Google profile");
            }

            if (!isUserAllowed(email)) {
                 throw new Error("This account is not authorized to access this application.");
            }
            return { email };
        }
    );
    authenticator.use(googleStrategy, "google");
} else {
    console.warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Google Auth will not work.");
}

// Helper to check authentication from session
export async function getAuthenticatedUser(request: Request): Promise<AuthUser | null> {
    const session = await getSession(request.headers.get("Cookie"));
    const user = session.get("user");
    if (!user) return null;
    return user as AuthUser;
}

// Helper to require authentication
export async function requireUser(request: Request) {
    const user = await getAuthenticatedUser(request);
    if (!user) {
        throw redirect("/auth/google");
    }
    return user;
}
