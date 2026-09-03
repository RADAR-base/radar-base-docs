---
title: FAQ and common issues
sidebar_position: 3
---

# FAQ and common issues

RADAR-base support happens in the open, on GitHub. This page is the map: where to ask a
question, where the answers to previous questions already live, and which problems come up
often enough that it is worth checking them first.

:::info This page is a stub
The site is in alpha and so is this page. For now it mostly points at the places where
questions are already being answered; the answers themselves move here as recurring
questions become clear. Spotted a question that belongs here? See
[Adding to this page](#adding-to-this-page).
:::

## Where to ask a question

**Start with [GitHub Discussions across RADAR-base](https://github.com/orgs/RADAR-base/discussions).**
That view covers every component that has discussions enabled, so searching it first is
usually faster than asking again. Most of the accumulated question-and-answer history is
about deployment:

| If your question is about | Ask here |
| --- | --- |
| Deploying the platform, Helm, configuration | [RADAR-Kubernetes discussions](https://github.com/RADAR-base/RADAR-Kubernetes/discussions) |
| Cloud infrastructure (AWS, Azure) | [RADAR-K8s-Infrastructure discussions](https://github.com/RADAR-base/RADAR-K8s-Infrastructure/discussions) |
| Docker Compose deployments | [RADAR-Docker discussions](https://github.com/RADAR-base/RADAR-Docker/discussions) |
| Studies, participants, roles, tokens | [ManagementPortal discussions](https://github.com/RADAR-base/ManagementPortal/discussions) |
| Active data collection, aRMT questionnaires | [RADAR-Questionnaire discussions](https://github.com/RADAR-base/RADAR-Questionnaire/discussions) |
| The passive remote monitoring app | [radar-prmt-android discussions](https://github.com/RADAR-base/radar-prmt-android/discussions) |
| Data schemas and specifications | [RADAR-Schemas discussions](https://github.com/RADAR-base/RADAR-Schemas/discussions) |

Components without discussions enabled use their issue tracker instead — every component's
repository is linked from its documentation section under **Components**, and from the
[RADAR-base organisation](https://github.com/RADAR-base) on GitHub.

## Where to report a problem

- **Something is broken in a component** — open an issue on that component's repository. Its
  maintainers watch that tracker; they do not necessarily watch the others.
- **A documentation page is wrong** — every page has an *Edit this page* link at the bottom
  that opens the file in the repository that owns it. Corrections belong there, next to the
  code they describe, not in this site.
- **This site itself is broken** — a page is missing, a version is wrong, navigation is
  confusing: open an issue on
  [radar-base-docs](https://github.com/RADAR-base/radar-base-docs/issues).

## Common issues

These are the questions that recur most often. Each links to where the discussion is; as
answers settle, they will be written up here in full.

### Which deployment should I use?

RADAR-base is deployed either on Kubernetes ([RADAR-Kubernetes](/kubernetes/), the
recommended route for new installations) or with Docker Compose (RADAR-Docker, older). If you
are choosing between them, or migrating, the
[RADAR-Kubernetes discussions](https://github.com/RADAR-base/RADAR-Kubernetes/discussions)
have prior threads on both.

### Why does a component's documentation stop at its README?

Because that is all its repository publishes so far. This site shows exactly what each
component's own repository contains: a component with no `docs/` folder is published as a
single page built from its README, and gains more pages as its maintainers write them.

### The version I need is not in the version picker

The picker lists a component's most recent tagged releases plus *Next*, which tracks its
default branch. Releases older than those are not published. If a version you need is
missing, open an issue on
[radar-base-docs](https://github.com/RADAR-base/radar-base-docs/issues).

### A link in a component's documentation goes to GitHub instead of this site

Component documentation is written for GitHub, and links to files that this site does not
publish — build files, source code, workflows — still point at the repository. That is
expected. A link that is genuinely broken is worth reporting in the repository that owns the
page.

## Adding to this page

This page lives in
[`content/platform/faq.md`](https://github.com/RADAR-base/radar-base-docs/blob/main/content/platform/faq.md)
and is maintained in this repository, so a pull request here is all it takes. Questions that
were answered in a discussion thread and are likely to be asked again are exactly what
belongs here — link the thread alongside the answer.
