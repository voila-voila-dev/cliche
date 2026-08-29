import { fileURLToPath } from "node:url";

export const SKILL_TARGET = ".claude/skills/pr-screenshots/SKILL.md";

/**
 * Install the packaged PR-screenshots skill into the current repository.
 * The skill ships with the package (`skill/SKILL.md`), so this works offline
 * and always matches the installed cliche version.
 */
export async function installSkill(): Promise<string> {
  const source = fileURLToPath(new URL("../skill/SKILL.md", import.meta.url));
  await Bun.write(SKILL_TARGET, Bun.file(source));
  return SKILL_TARGET;
}
