const CONVENTIONAL_TITLE_PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: .+/;

const title = process.argv.slice(2).join(' ').trim() || process.env.PR_TITLE?.trim() || '';

if (!title) {
  throw new Error('Missing PR title. Pass it as arguments or set PR_TITLE.');
}

if (title.length > 72) {
  throw new Error(`PR title is too long (${title.length} chars). Keep it within 72 characters.`);
}

if (!CONVENTIONAL_TITLE_PATTERN.test(title)) {
  throw new Error(
    'PR title must follow Conventional Commits, for example: feat(graph): add category edges',
  );
}

console.log(`[governance] PR title accepted: ${title}`);
