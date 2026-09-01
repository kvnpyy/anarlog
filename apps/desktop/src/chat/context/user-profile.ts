export type UserProfile = {
  name: string;
  role: string;
  department: string;
  context: string;
};

export function readUserProfile(values: {
  user_profile_name?: string;
  user_profile_role?: string;
  user_profile_department?: string;
  user_profile_context?: string;
}): UserProfile {
  return {
    name: values.user_profile_name?.trim() ?? "",
    role: values.user_profile_role?.trim() ?? "",
    department: values.user_profile_department?.trim() ?? "",
    context: values.user_profile_context?.trim() ?? "",
  };
}

export function hasUserProfile(profile: UserProfile): boolean {
  return Boolean(
    profile.name || profile.role || profile.department || profile.context,
  );
}

export function userProfileInitials(profile: UserProfile): string {
  const parts = profile.name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function userProfileSubtitle(profile: UserProfile): string {
  return [profile.role, profile.department].filter(Boolean).join(" · ");
}

export function formatUserProfileGuidance(
  prompt: string | undefined,
  profile: UserProfile,
): string | undefined {
  if (prompt === undefined) {
    return undefined;
  }

  const guidance = renderUserProfileGuidance(profile);
  if (!guidance) {
    return prompt;
  }

  if (!prompt.trim()) {
    return guidance;
  }

  return `${prompt.trim()}\n\n${guidance}`;
}

export function formatNoteAuthorLine(profile: UserProfile): string | null {
  if (!hasUserProfile(profile)) {
    return null;
  }

  const who = [profile.name || null, userProfileSubtitle(profile) || null]
    .filter(Boolean)
    .join(", ");
  const extra = profile.context;
  const details = [who, extra].filter(Boolean).join(". ");
  return details ? `Note author: ${details}` : null;
}

export function prependNoteAuthorToMemo(
  memo: string,
  profile: UserProfile,
): string {
  const line = formatNoteAuthorLine(profile);
  if (!line) {
    return memo;
  }

  return memo.trim() ? `${line}\n\n${memo}` : line;
}

export function renderUserProfileGuidance(profile: UserProfile): string | null {
  if (!hasUserProfile(profile)) {
    return null;
  }

  const details = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.role ? `Role: ${profile.role}` : null,
    profile.department ? `Department: ${profile.department}` : null,
    profile.context ? `Context: ${profile.context}` : null,
  ].filter(Boolean);

  return [
    "User profile:",
    "- This is the person using the app, not necessarily a meeting participant.",
    ...details.map((detail) => `- ${detail}`),
    "- Tailor answers, recaps, drafts, and summaries to their role. Sales cares about pipeline, objections, and next steps; execs about decisions, risks, and owners; HR about people, process, and follow-ups.",
    "- Match how they speak and write. Avoid generic AI phrasing, filler, and corporate jargon.",
  ].join("\n");
}

export function formatNoteAudienceGuidance(profile: UserProfile): string {
  if (!hasUserProfile(profile)) {
    return "";
  }

  const details = [
    profile.name ? `- Name: ${profile.name}` : null,
    profile.role ? `- Role: ${profile.role}` : null,
    profile.department ? `- Department: ${profile.department}` : null,
    profile.context ? `- Context: ${profile.context}` : null,
  ].filter(Boolean);

  return `# Note audience

Write this note for the person using the app, not a generic reader.
${details.join("\n")}
Emphasize what their job needs: pipeline, objections, and next steps for sales; decisions, risks, and owners for execs; people, process, and follow-ups for HR. Keep their vocabulary. Do not write a generic recap that ignores their role.`;
}

export function appendNoteAudienceGuidance(
  prompt: string,
  profile: UserProfile | undefined,
): string {
  const guidance = profile ? formatNoteAudienceGuidance(profile) : "";
  return guidance ? `${prompt}\n\n${guidance}` : prompt;
}
