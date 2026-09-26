# Branch Protection

## Protected Branches

### dev

- protect `dev`
- require pull requests before merging
- require at least 1 approval
- dismiss stale approvals
- require conversation resolution
- require status checks:
  - `governance`
  - `quality`
- block force pushes
- block branch deletion

### main

- protect `main`
- require pull requests before merging
- require at least 1 approval
- require conversation resolution
- require status checks:
  - `governance`
  - `quality`
- require branch to be up to date before merging
- block force pushes
- block branch deletion
- restrict direct pushes to release owners only

## Merge Policy

- normal work merges into `dev`
- release PRs merge from `dev` into `main`
- production hotfix PRs merge from `hotfix/<slug>` into `main`
- every hotfix merged into `main` must be merged or cherry-picked back into `dev`
