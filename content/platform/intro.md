---
title: Platform overview
slug: /
sidebar_position: 1
---

RADAR-base is an open source platform for remote data collection in clinical studies:
mobile apps and wearables collect data from participants, a streaming backend ingests and
processes it, and analysis tools turn it into research output.

![RADAR-base logo](../../static/img/logo_large.png)

This site brings together the documentation for the individual RADAR-base components. Each
component's pages are published directly from its own repository, so what you read here is
what its maintainers wrote alongside the code, at the version you select.

:::note Alpha
This documentation site is a work in progress. Components are still being added, and some
sections are thinner than they will be. If something is missing or wrong, see the
[FAQ and common issues](./faq.md) page for where to raise it.
:::

## How this documentation is organised

- **Platform** — cross-component material maintained in the
  [radar-base-docs](https://github.com/RADAR-base/radar-base-docs) repository. This section.
- **Components** — one section per repository, each with its own version picker. Pages under a
  released version match that release; the version labelled *Next* tracks the component's
  default branch.
- **[FAQ and common issues](./faq.md)** — where to ask questions, and the problems that come
  up most often.

## Where to start

If you are new to RADAR-base, the [RADAR-base website](https://radar-base.org) covers what the
platform does and who uses it. If you are looking to analyse data that has already been
collected, start with the RADAR Pipeline documentation from the **Components** menu. For
anything you cannot find, the [FAQ](./faq.md) lists where RADAR-base questions get answered.

## Contributing documentation

Documentation lives with the code it describes. To publish a repository's documentation here,
add a `docs/` folder to that repository — see
[Adding a repository](https://github.com/RADAR-base/radar-base-docs#adding-a-repository).
Corrections to individual pages are best made in the repository that owns them; every page has
an "Edit this page" link that takes you to the right file.
