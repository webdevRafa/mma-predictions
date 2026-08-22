export const CHAT_MESSAGE_MAX_LENGTH = 240;
export const DISCUSSION_POST_MAX_LENGTH = 1_000;
export const CHAT_DUPLICATE_WINDOW_MS = 60_000;

export type ChatModerationResult =
  | {
      accepted: true;
      body: string;
      normalizedBody: string;
      decision: "approved" | "soft_flagged";
      signals: string[];
    }
  | {
      accepted: false;
      code: "empty" | "too_long" | "url" | "spam" | "prohibited";
      message: string;
      normalizedBody: string;
      signals: string[];
    };

export type DiscussionModerationResult = ChatModerationResult;

const urlPattern =
  /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|gg|tv|co|me|ly)\b)/i;
const repeatedCharacterPattern = /(.)\1{17,}/iu;
const repeatedWordPattern = /\b([\p{L}\p{N}_]{2,})\b(?:\s+\1\b){5,}/iu;
const prohibitedPatterns = [
  /\bkill\s+yourself\b/iu,
  /\bi(?:'|’)ll\s+(?:find|hurt|kill)\s+you\b/iu,
  /\b(?:home\s+address|phone\s+number)\s+is\b/iu,
];
const mildProfanityPattern = /\b(?:damn|shit|fuck(?:ing|ed)?)\b/giu;

export function normalizeChatBody(value: string) {
  const withoutControls = [...value]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return !(
        (code >= 0 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127 ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069) ||
        code === 0xfeff
      );
    })
    .join("");
  return withoutControls.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function moderateBody(
  value: string,
  maxLength: number,
  contentLabel: "Messages" | "Posts",
): ChatModerationResult {
  const normalizedBody = normalizeChatBody(value);
  if (!normalizedBody) {
    return {
      accepted: false,
      code: "empty",
      message: `Write a ${contentLabel === "Posts" ? "post" : "message"} before sending`,
      normalizedBody,
      signals: ["empty"],
    };
  }
  if ([...normalizedBody].length > maxLength) {
    return {
      accepted: false,
      code: "too_long",
      message: `${contentLabel} are limited to ${maxLength.toLocaleString("en-US")} characters`,
      normalizedBody,
      signals: ["length"],
    };
  }
  if (urlPattern.test(normalizedBody)) {
    return {
      accepted: false,
      code: "url",
      message: `Links are not supported in ${contentLabel === "Posts" ? "matchup posts" : "fight chat"}`,
      normalizedBody,
      signals: ["url"],
    };
  }
  if (
    repeatedCharacterPattern.test(normalizedBody) ||
    repeatedWordPattern.test(normalizedBody)
  ) {
    return {
      accepted: false,
      code: "spam",
      message: `That ${contentLabel === "Posts" ? "post" : "message"} looks like repeated spam`,
      normalizedBody,
      signals: ["repetition"],
    };
  }
  if (prohibitedPatterns.some((pattern) => pattern.test(normalizedBody))) {
    return {
      accepted: false,
      code: "prohibited",
      message: `That ${contentLabel === "Posts" ? "post" : "message"} violates the community rules`,
      normalizedBody,
      signals: ["high_risk_language"],
    };
  }
  const mildProfanity = mildProfanityPattern.test(normalizedBody);
  mildProfanityPattern.lastIndex = 0;
  const body = mildProfanity
    ? normalizedBody.replace(
        mildProfanityPattern,
        (word) => `${word[0]}${"•".repeat(Math.max([...word].length - 1, 1))}`,
      )
    : normalizedBody;
  return {
    accepted: true,
    body,
    normalizedBody: normalizedBody.toLocaleLowerCase("en-US"),
    decision: mildProfanity ? "soft_flagged" : "approved",
    signals: mildProfanity ? ["mild_profanity_masked"] : [],
  };
}

export function moderateChatBody(value: string): ChatModerationResult {
  return moderateBody(value, CHAT_MESSAGE_MAX_LENGTH, "Messages");
}

export function moderateDiscussionBody(
  value: string,
): DiscussionModerationResult {
  return moderateBody(value, DISCUSSION_POST_MAX_LENGTH, "Posts");
}
