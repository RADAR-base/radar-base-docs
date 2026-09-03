/**
 * The guide sections that are written here rather than fetched from a component repository.
 *
 * Everything under **Components** comes from the repository that owns it (see repos.yml).
 * These two sections do not belong to any one component: they describe the platform from the
 * point of view of the people running a study and the people taking part in one. Their pages
 * were copied from radar-base.org into content/client and content/participant, and each page
 * links back to the page it came from.
 *
 * The navbar (docusaurus.config.js) and the home page (src/pages/index.js) are both built
 * from this file, so a page added to a section appears in both.
 *
 * @typedef {object} Guide
 * @property {string} label        Link text.
 * @property {string} to           Route on this site.
 * @property {string} description  One line, summarising the page.
 *
 * @typedef {object} GuideSection
 * @property {string} id       Home-page anchor, e.g. "client-documentation".
 * @property {string} title    Section heading on the home page.
 * @property {string} navLabel Navbar label.
 * @property {string} route    Section landing page.
 * @property {string} blurb    Who the section is for.
 * @property {Guide[]} pages
 */

/** @type {GuideSection} */
const clientGuides = {
  id: 'client-documentation',
  title: 'Client documentation',
  navLabel: 'Client',
  route: '/client/',
  blurb:
    'The apps and devices a study runs on: what they collect, which hardware is supported, ' +
    'and how participants are connected to third-party wearable accounts.',
  pages: [
    {
      label: 'RADAR-Rest-Source-Auth',
      to: '/client/rest-source-auth',
      description:
        'Authorising RADAR-base to collect from third-party wearable APIs — Oura, Fitbit and Garmin — through the REST authorizer.',
    },
    {
      label: 'Questionnaire app (aRMT)',
      to: '/client/questionnaire-app',
      description:
        'The configurable questionnaire app for active tasks: scheduling, notifications and questionnaire definitions, on Android and iOS.',
    },
    {
      label: 'Passive app (pRMT)',
      to: '/client/passive-app',
      description:
        'The passive app that collects background sensor data from the phone and from paired wearables through plugins.',
    },
    {
      label: 'Phone data sensors',
      to: '/client/phone-data-sensors',
      description:
        'What each phone sensor the passive app supports actually records, and where its schema is defined.',
    },
    {
      label: 'Supported devices',
      to: '/client/supported-devices',
      description:
        'The wearables and devices integrated into the platform, and the data types each one contributes.',
    },
  ],
};

/** @type {GuideSection} */
const participantGuides = {
  id: 'participant-documentation',
  title: 'Participant documentation',
  navLabel: 'Participant',
  route: '/participant/',
  blurb:
    'Material written for the people taking part in a study, to hand out or adapt for your own.',
  pages: [
    {
      label: 'User guide documents',
      to: '/participant/',
      description:
        'Graphical user guides for participants: getting started with the wearable, and with the active (questionnaire) app.',
    },
  ],
};

/** Platform-level background, shown in the Platform section rather than one of its own. */
const platformGuides = [
  {
    label: 'Concepts and components of RADAR-base',
    to: '/platform/concepts-and-components',
    description:
      'How the platform fits together: the plugin-based architecture, the Kafka streaming core, and the role each component plays in it.',
  },
];

/** The sections that get their own home-page block and navbar entry, in order. */
const guideSections = [clientGuides, participantGuides];

module.exports = {clientGuides, participantGuides, platformGuides, guideSections};
