# @NaverPayDev/changeset-actions

> lang: En | [Ko](./README.ko.md)

- A repository containing various actions based on changesets.
- This repository follows a monorepo structure and includes multiple actions, allowing you to use only the actions you need.
- For usage instructions, please refer to the README of each action listed below.

## Managed Action List

### [detect add](./detect-add/README.md)

An action that detects changes in a pull request and guides users to document the changes in the `.changeset` directory.

### [canary](./canary-publish/README.md)

An action that helps deploy canary versions of packages under the `.changeset` directory to test their stability.

### [publish](./publish/README.md)

An action that publishes the packages under the `.changeset` directory and automatically generates a CHANGELOG.
