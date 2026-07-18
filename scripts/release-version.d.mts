export function normalizeReleaseVersion(value: unknown): string;

export function isPrereleaseVersion(value: unknown): boolean;

export function npmDistTagForVersion(value: unknown): "next" | "latest";
