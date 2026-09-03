/**
 * Documentation that lives on radar-base.org rather than in a component repository.
 *
 * Everything under **Components** is fetched from the repository that owns it (see
 * repos.yml). The pages below are not in any repository: they describe the platform from
 * the point of view of the people running a study and the people taking part in one, and
 * they are maintained on the RADAR-base website. Linking to them keeps them in the
 * navigation without this site holding a stale copy.
 *
 * Both the navbar (docusaurus.config.js) and the home page (src/pages/index.js) are built
 * from this file, so a page added here appears in both.
 *
 * @typedef {object} ExternalDoc
 * @property {string} label        Link text, matching the page's own title.
 * @property {string} href         Absolute URL on radar-base.org.
 * @property {string} description  One line, summarising the page as it currently reads.
 *
 * @typedef {object} ExternalDocSection
 * @property {string} id       Used for the home-page anchor, e.g. "client-documentation".
 * @property {string} title    Section heading, and the navbar label.
 * @property {string} blurb    Who the section is for, shown under the heading.
 * @property {ExternalDoc[]} docs
 */

/** Where the linked pages are published; shown on each card so the link is not a surprise. */
const EXTERNAL_HOST = 'radar-base.org';

/** @type {ExternalDocSection} */
const clientDocs = {
  id: 'client-documentation',
  title: 'Client documentation',
  blurb:
    'The apps and devices a study runs on: what they collect, which hardware is supported, ' +
    'and how participants are connected to third-party wearable accounts.',
  docs: [
    {
      label: 'RADAR-Rest-Source-Auth',
      href: 'https://radar-base.org/docs/radar-rest-source-auth/',
      description:
        'Authorising RADAR-base to collect from third-party wearable APIs — Oura, Fitbit and Garmin — through the REST authorizer.',
    },
    {
      label: 'Questionnaire app (aRMT)',
      href: 'https://radar-base.org/docs/questionnaire-app/',
      description:
        'The configurable questionnaire app for active tasks: scheduling, notifications and questionnaire definitions, on Android and iOS.',
    },
    {
      label: 'Passive app (pRMT)',
      href: 'https://radar-base.org/docs/prmt-app/',
      description:
        'The passive app that collects background sensor data from the phone and from paired wearables through plugins.',
    },
    {
      label: 'Phone data sensors',
      href: 'https://radar-base.org/docs/4048-2/',
      description:
        'What each phone sensor the passive app supports actually records, and where its schema is defined.',
    },
    {
      label: 'Supported devices',
      href: 'https://radar-base.org/docs/supported-devices/',
      description:
        'The wearables and devices integrated into the platform, and the data types each one contributes.',
    },
  ],
};

/** @type {ExternalDocSection} */
const participantDocs = {
  id: 'participant-documentation',
  title: 'Participant documentation',
  blurb:
    'Material written for the people taking part in a study, to hand out or adapt for your own.',
  docs: [
    {
      label: 'User guide documents',
      href: 'https://radar-base.org/docs/user-guide-documents/',
      description:
        'Graphical user guides for participants: getting started with the wearable, and with the active (questionnaire) app.',
    },
  ],
};

/**
 * Platform-level background that is not specific to any one component. Shown in the
 * Platform section rather than as a section of its own.
 *
 * @type {ExternalDoc[]}
 */
const platformDocs = [
  {
    label: 'Concepts and components of RADAR-base',
    href: 'https://radar-base.org/docs/concepts-and-components-of-radar-base/',
    description:
      'How the platform fits together: the plugin-based architecture, the Kafka streaming core, and the role each component plays in it.',
  },
];

/** The sections rendered as their own home-page block and navbar entry, in order. */
const externalDocSections = [clientDocs, participantDocs];

module.exports = {EXTERNAL_HOST, clientDocs, participantDocs, platformDocs, externalDocSections};
