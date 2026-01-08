import { Authenticator } from "remix-auth";
import { OAuth2Strategy } from "remix-auth-oauth2";
import { redirect } from "react-router";
import { destroySession, getSession, sessionStorage } from "./session.server";
import { countUsers, getUserByEmail } from "~/db/queries.server";

export type AuthUser = {
  email: string;
};

type GoogleProfile = {
  email?: string;
  verified_email?: boolean;
};

class GoogleOAuthStrategy extends OAuth2Strategy<AuthUser, GoogleProfile> {
  protected async userProfile(accessToken: string): Promise<GoogleProfile> {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch Google user profile");
    }
    return (await response.json()) as GoogleProfile;
  }
}

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL = process.env.GOOGLE_CALLBACK_URL;

if (!clientID || !clientSecret || !callbackURL) {
  throw new Error(
    "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL are required"
  );
}

export const authenticator = new Authenticator<AuthUser>(sessionStorage);

const googleStrategy = new GoogleOAuthStrategy(
  {
    authorizationURL: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenURL: "https://oauth2.googleapis.com/token",
    clientID,
    clientSecret,
    callbackURL,
    scope: "openid email profile",
  },
  async ({ profile }) => {
    const email = profile.email?.toLowerCase();
    if (!email) {
      throw new Error("Google profile did not include an email");
    }
    return { email };
  }
);

authenticator.use(googleStrategy, "google");

export async function requireUser(request: Request) {
  return authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
}

export async function requireAuthorizedUser(request: Request) {
  const user = await requireUser(request);
  const userCount = await countUsers();
  if (userCount === 0) {
    return user;
  }
  const dbUser = await getUserByEmail(user.email);
  if (!dbUser) {
    const session = await getSession(request);
    throw redirect("/login?error=unauthorized", {
      headers: {
        "Set-Cookie": await destroySession(session),
      },
    });
  }
  return user;
}
