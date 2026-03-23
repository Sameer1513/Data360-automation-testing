const { expect } = require('@playwright/test');

/**
 * Best-effort cleanup of a created project.
 * Only deletes if the FIRST tile's name matches the given projectName.
 */
async function cleanupProjectByFirstTile(projectsPageAfterSubmit, projectName) {
  try {
    await projectsPageAfterSubmit.scrollToTop();

    const firstTileProjectName = await projectsPageAfterSubmit.getFirstProjectName();

    if (firstTileProjectName === projectName) {
      // Clear any prior selection to avoid deleting multiple projects
      if (await projectsPageAfterSubmit.isClearSelectionButtonDisplayed()) {
        await projectsPageAfterSubmit.clickClearSelectionButton();
      }

      await projectsPageAfterSubmit.clickFirstProjectCheckbox();
      await projectsPageAfterSubmit.clickDeleteSelectedButton();

      // Extra safety: ensure dialog shows the same project name
      const dialogName = await projectsPageAfterSubmit.getDeleteDialogProjectName();
      if (dialogName !== projectName) {
        throw new Error(
          `Cleanup safety check failed: dialog project name "${dialogName}" did not match "${projectName}"`
        );
      }

      await projectsPageAfterSubmit.toggleHardDeleteSwitch();
      await projectsPageAfterSubmit.clickHardDeleteButton();

      await projectsPageAfterSubmit.scrollToTop();
      const firstTileProjectNameAfterDelete =
        await projectsPageAfterSubmit.getFirstProjectName();
      expect(firstTileProjectNameAfterDelete).not.toBe(projectName);
    }
  } catch {
    // Best-effort cleanup; swallow errors
  }
}

module.exports = { cleanupProjectByFirstTile };

