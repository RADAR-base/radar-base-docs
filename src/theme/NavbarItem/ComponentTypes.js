import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import ActiveDocsVersionDropdown from '@site/src/components/ActiveDocsVersionDropdown';

/**
 * Registers the `custom-activeDocsVersionDropdown` navbar item used in
 * docusaurus.config.js.
 */
export default {
  ...ComponentTypes,
  'custom-activeDocsVersionDropdown': ActiveDocsVersionDropdown,
};
