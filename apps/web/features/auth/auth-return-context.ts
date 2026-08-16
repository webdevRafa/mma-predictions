"use client";

const AUTH_CONTEXT_KEY = "fightlobby:auth-context:v1";

interface AuthReturnContext {
  returnTo: string;
  predictionDraft?: unknown;
}

function safeClientPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function saveAuthReturnContext(context: AuthReturnContext) {
  sessionStorage.setItem(
    AUTH_CONTEXT_KEY,
    JSON.stringify({ ...context, returnTo: safeClientPath(context.returnTo) }),
  );
}

export function readAuthReturnContext(): AuthReturnContext | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(AUTH_CONTEXT_KEY) ?? "null",
    );
    if (
      !value ||
      typeof value !== "object" ||
      !("returnTo" in value) ||
      typeof value.returnTo !== "string"
    )
      return null;
    return {
      returnTo: safeClientPath(value.returnTo),
      ...("predictionDraft" in value
        ? { predictionDraft: value.predictionDraft }
        : {}),
    };
  } catch {
    return null;
  }
}
