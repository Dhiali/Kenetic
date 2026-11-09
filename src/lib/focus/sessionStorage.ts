export function scopedSessionKey(key: string, uid: string, exercise?: string) {
  if (!uid) throw new Error("Cannot access a session without an account.");
  return `${key}/${encodeURIComponent(uid)}${exercise ? `/${encodeURIComponent(exercise)}` : ""}`;
}
