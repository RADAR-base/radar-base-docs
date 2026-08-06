import React from 'react';
import {useActivePlugin} from '@docusaurus/plugin-content-docs/client';
import DocsVersionDropdownNavbarItem from '@theme/NavbarItem/DocsVersionDropdownNavbarItem';

/**
 * A single version picker that follows the reader.
 *
 * Docusaurus' built-in version dropdown is bound to one docs plugin instance, so a
 * site with one instance per repository would need one dropdown per repository in the
 * navbar. This renders the dropdown for whichever project the reader is currently in,
 * and nothing at all elsewhere.
 */
export default function ActiveDocsVersionDropdown(props) {
  const activePlugin = useActivePlugin();

  if (!activePlugin) return null;

  // Projects with no tagged releases only ever have one version; a picker would be noise.
  const versions = activePlugin.pluginData?.versions ?? [];
  if (versions.length < 2) return null;

  return (
    <DocsVersionDropdownNavbarItem
      {...props}
      docsPluginId={activePlugin.pluginId}
      dropdownItemsBefore={[]}
      dropdownItemsAfter={[]}
    />
  );
}
