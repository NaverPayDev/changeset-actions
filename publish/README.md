# changesets-publish

## Description

This action identifies changes in a pull request and deploys modified packages under the `.changeset` directory when using a changeset-based package deployment flow. If there are markdown files recording changes under `.changeset`, it creates a `changeset-release/main` branch. If no markdown files are present, it performs the publish operation.

## Usage

Create a `.yaml` file in the `.github/workflows` directory at the root of your project as shown below:

```yaml
# Adjust according to your needs
name: changeset-publish

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
    detectAdd:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
              with:
                  ref: ${{ github.head_ref }}
            - uses: NaverPayDev/changeset-actions/actions/publish@main
              with:
                  github_token: ${{ secrets.GITHUB_TOKEN }} # Add user PAT if necessary
                  npm_token: ${{ secrets.NPM_TOKEN }} # Token required for npm publishing
                  publish_script: pnpm run deploy # Script to execute the deployment
                  git_username: npay-fe-bot # GitHub username for version bump PR creation
                  git_email: npay.fe.bot@navercorp.com # GitHub email for version bump PR creation
                  pr_title: 🚀 version changed packages # PR title for version bump
                  commit_message: 📦 bump changed packages version # Commit message for version bump
                  create_github_release_tag: true # Whether to create a release tag
                  formatting_script: pnpm run markdownlint:fix # Add if formatting the generated markdown files is required
```

## Execution Results

![example](./src/assets/pr.png)
![example](./src/assets/example.png)
![example](./src/assets/example2.png)
![example](./src/assets/example3.png)
![example](./src/assets/example4.png)