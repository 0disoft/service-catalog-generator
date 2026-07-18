export type CommandInvocation = {
  file: string;
  prefixArgs: string[];
};

export function resolveNpmCommand(): CommandInvocation;

export function resolveInstalledCliInvocation(
  binPath: string,
  platform?: NodeJS.Platform
): CommandInvocation;

export function runInstalledCli(binPath: string, cwd: string, args: string[]): string;
