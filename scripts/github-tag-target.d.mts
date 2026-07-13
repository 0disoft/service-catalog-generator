export type GitHubTagObject = {
  type: string;
  sha: string;
};

export type GitHubAnnotatedTag = {
  object?: GitHubTagObject;
};

export function resolveGitHubTagCommit(
  object: GitHubTagObject,
  loadTag: (sha: string) => Promise<GitHubAnnotatedTag>,
  depth?: number
): Promise<string>;
