const { expect } = require('@playwright/test');

class PipelineSetupPage {
  constructor(page) {
    this.page = page;

    // Top-level pipeline setup control
    this.numberOfPipeSizes = page.locator('#numberOfPipeSizes');
    this.pipe1ValidationBox = page.locator('div').filter({ hasText: 'Validation Errors:' }).first();

    // Save button (top of setup page)
    this.saveButton = page.getByRole('button', { name: /^Save$/ });
    this.saveSuccessToast = page.getByText('Setup Saved Successfully', { exact: false });
    this.setupSavedMessage = page.getByText('The project setup has been saved successfully.', { exact: false });
    this.loadingSetupData = page.getByText('Loading setup data...', { exact: false });
    this.deletePipeDialog = page.getByRole('dialog');

    // Manufacturer custom multiselect (button has no stable id, so anchor from label)
    this.manufacturerCombobox = page
      .locator('label[for="manufacturer-0"]')
      .locator('..')
      .locator('button[role="combobox"]')
      .first();

  }

  async setNumberOfPipeSizes(count) {
    await this.numberOfPipeSizes.fill(String(count));
  }

  async incrementNumberOfPipeSizesByArrowUp(steps = 1) {
    await this.numberOfPipeSizes.click();
    for (let i = 0; i < steps; i += 1) {
      await this.numberOfPipeSizes.press('ArrowUp');
    }
  }

  async fillPipe1Details({
    pipeSize,
    wallThickness,
    numberOfPipes,
    pipeLength,
    numberOfWps,
    wpsNumber1,
  }) {
    await this.fillPipeDetailsByIndex(0, {
      pipeSize,
      wallThickness,
      numberOfPipes,
      pipeLength,
      numberOfWps,
      wpsNumbers: [wpsNumber1],
    });
  }

  async fillPipeFitterConfiguration({
    toeSeamSeparationMinMm,
    seamCapWidthMaxMm,
    sixOclockExclusionDeg,
    highlightType,
    hiloWpsLimitMm,
    excessiveHiloLengthLimitDeg,
    hiloPreferredLimitTopMm,
    hiloPreferredLimitMiddleMm,
    hiloPreferredLimitLowerMm,
    nominalPipeLength,
    targetNumberOfPipes,
    targetPipelineLength,
    weldSeamExclusionDeg,
    nominalOd,
    nominalId,
    idTolerance,
    odTolerance,
    pipeMaterial,
    nominalOdMin,
    nominalOdMax,
    nominalIdMin,
    nominalIdMax,
    pipeType,
    pipeMode,
    pipeSequence,
    pipeRotation,
  }) {
    await this.fillPipeFitterConfigurationByIndex(0, {
      toeSeamSeparationMinMm,
      seamCapWidthMaxMm,
      sixOclockExclusionDeg,
      highlightType,
      hiloWpsLimitMm,
      excessiveHiloLengthLimitDeg,
      hiloPreferredLimitTopMm,
      hiloPreferredLimitMiddleMm,
      hiloPreferredLimitLowerMm,
      nominalPipeLength,
      targetNumberOfPipes,
      targetPipelineLength,
      weldSeamExclusionDeg,
      nominalOd,
      nominalId,
      idTolerance,
      odTolerance,
      pipeMaterial,
      nominalOdMin,
      nominalOdMax,
      nominalIdMin,
      nominalIdMax,
      pipeType,
      pipeMode,
      pipeSequence,
      pipeRotation,
    });
  }

  async clickSave() {
    await this.saveButton.scrollIntoViewIfNeeded();
    await expect(this.saveButton).toBeEnabled({ timeout: 15000 });
    await this.saveButton.click();

    // Wait for save confirmation and the setup panel to settle
    await this.saveSuccessToast.waitFor({ state: 'visible', timeout: 30000 });
    await this.setupSavedMessage.waitFor({ state: 'visible', timeout: 30000 });
    await this.loadingSetupData.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  async clickSaveForValidation() {
    await this.saveButton.scrollIntoViewIfNeeded();
    await expect(this.saveButton).toBeEnabled({ timeout: 15000 });
    await this.saveButton.click();
  }

  async clearPipe1MandatoryFields(existingManufacturers = []) {
    await this.clearPipeMandatoryFieldsByIndex(0, existingManufacturers);
  }

  async clearPipe1NumberOfJobsFieldEnsuredEmpty() {
    const numberOfJobsInput = this.page.locator('#numberOfJobs-0');
    await numberOfJobsInput.scrollIntoViewIfNeeded();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await numberOfJobsInput.click();
      await numberOfJobsInput.fill('');
      await numberOfJobsInput.press('Control+A');
      await numberOfJobsInput.press('Backspace');
      await numberOfJobsInput.press('Delete');
      await this.page.waitForTimeout(100);

      const currentValue = await numberOfJobsInput.inputValue();
      if (currentValue === '') break;
    }
    await expect(numberOfJobsInput).toHaveValue('', { timeout: 3000 });
  }

  async selectAtLeastNManufacturers(n = 3) {
    await this.manufacturerCombobox.click();

    const listbox = this.page.locator('[role="listbox"][data-state="open"]').first();
    await listbox.waitFor({ state: 'visible', timeout: 15000 });

    const preferred = ['American', 'API-5L', 'Arcelor Mittal'];
    let selected = 0;

    for (const name of preferred) {
      const option = listbox.getByText(name, { exact: true });
      if (await option.count()) {
        await option.first().click();
        selected += 1;
      }
      if (selected >= n) break;
    }

    // If fewer than N were found, fail fast rather than clicking random rows (which can select everything).
    await expect(selected, 'Not enough manufacturer options found to select').toBeGreaterThanOrEqual(n);

    // Close dropdown and ensure overlay is gone before continuing
    const searchBox = listbox.getByRole('textbox', { name: 'Search...' });
    if (await searchBox.count()) {
      await searchBox.first().press('Escape');
    } else {
      await listbox.press('Escape');
    }

    // If Escape doesn't close (some Radix configs), toggle the trigger and click outside.
    if (await listbox.isVisible()) {
      await this.manufacturerCombobox.click();
    }
    if (await listbox.isVisible()) {
      await this.page.mouse.click(0, 0);
    }

    await listbox.waitFor({ state: 'hidden', timeout: 15000 });
  }

  async selectManufacturersExactly(manufacturers = [], existingManufacturers = []) {
    await this.selectManufacturersForPipe(0, manufacturers, existingManufacturers);
  }

  async fillPipeDetailsByIndex(index, {
    pipeSize,
    wallThickness,
    numberOfPipes,
    pipeLength,
    numberOfWps,
    wpsNumbers,
  }) {
    const pipeSizeInput = this.page.locator(`#pipeSize-${index}`);
    const wallThicknessInput = this.page.locator(`#wallThickness-${index}`);
    const numberOfPipesInput = this.page.locator(`#numberOfPipes-${index}`);
    const pipeLengthInput = this.page.locator(`#pipeLength-${index}`);
    const numberOfWpsInput = this.page.locator(`#numberOfJobs-${index}`);

    await pipeSizeInput.fill(String(pipeSize));
    await wallThicknessInput.fill(String(wallThickness));
    await numberOfPipesInput.fill(String(numberOfPipes));
    await pipeLengthInput.fill(String(pipeLength));
    await numberOfWpsInput.fill(String(numberOfWps));

    if (Array.isArray(wpsNumbers)) {
      for (let i = 0; i < wpsNumbers.length; i += 1) {
        await this.page.locator(`#jobNumber-${index}-${i}`).fill(String(wpsNumbers[i]));
      }
    }
  }

  async selectManufacturersForPipe(index, manufacturers = [], existingManufacturers = []) {
    const manufacturerCombobox = this.page
      .locator(`label[for="manufacturer-${index}"]`)
      .locator('..')
      .locator('button[role="combobox"]')
      .first();

    await manufacturerCombobox.click();
    const listbox = this.page.locator('[role="listbox"][data-state="open"]').first();
    await listbox.waitFor({ state: 'visible', timeout: 15000 });

    for (const name of existingManufacturers) {
      const option = listbox.getByText(String(name), { exact: true });
      if (await option.count()) {
        await option.first().click();
      }
    }

    for (const name of manufacturers) {
      const option = listbox.getByText(String(name), { exact: true });
      await expect(option, `Manufacturer option not found: ${name}`).toHaveCount(1);
      await option.first().click();
    }

    const searchBox = listbox.getByRole('textbox', { name: 'Search...' });
    if (await searchBox.count()) {
      await searchBox.first().press('Escape');
    } else {
      await listbox.press('Escape');
    }
    if (await listbox.isVisible()) {
      await this.page.mouse.click(0, 0);
    }
    await listbox.waitFor({ state: 'hidden', timeout: 15000 });
  }

  async fillPipeFitterConfigurationByIndex(index, config) {
    const fillField = async (selector, value) => {
      if (value === undefined) return;
      const locator = this.page.locator(selector);
      // Some fields are rendered dynamically after dropdown selection; wait for at least one match.
      await locator.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      const count = await locator.count();
      if (count === 0) return; // field truly not present

      // Some fields (e.g. Nominal OD) can appear twice in the new UI with the same id.
      // Fill all matching inputs with the same value.
      for (let i = 0; i < count; i += 1) {
        const el = locator.nth(i);
        await el.scrollIntoViewIfNeeded();
        await el.click();
        await el.fill(String(value));
      }
    };

    const selectFromCombobox = async (selector, optionText) => {
      if (optionText === undefined) return;
      const combobox = this.page.locator(selector).first();
      if ((await combobox.count()) === 0) return;
      await combobox.scrollIntoViewIfNeeded();
      await combobox.click();
      const listbox = this.page.locator('[role="listbox"][data-state="open"]').first();
      await listbox.waitFor({ state: 'visible', timeout: 15000 });
      await listbox.getByText(optionText, { exact: true }).click();
      await this.page.keyboard.press('Escape').catch(() => {});
      await listbox.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    };

    const highlightType = config.highlightType || 'Tolerance (min / max)';
    // Pipe data highlighting (dropdown) - selection does not affect below fields.
    await selectFromCombobox(`#highlightType-${index}`, highlightType);

    // Inner Diameter (matches UI order)
    await fillField(`#nominalId-${index}`, config.nominalId);
    await fillField(`#nominalIdMin-${index}`, config.nominalIdMin);
    await fillField(`#nominalIdMax-${index}`, config.nominalIdMax);
    await fillField(`#ooRIDTolrence-${index}`, config.idTolerance);

    // Outer Diameter (matches UI order)
    await fillField(`#nominalOd-${index}`, config.nominalOd);
    await fillField(`#nominalOdMin-${index}`, config.nominalOdMin);
    await fillField(`#nominalOdMax-${index}`, config.nominalOdMax);
    await fillField(`#ooRODTolrence-${index}`, config.odTolerance);

    // Seam & angular limits (matches UI order)
    await fillField(`#toeSeamSeparationMinMm-${index}`, config.toeSeamSeparationMinMm);
    await fillField(`#seamCapWidthMaxMm-${index}`, config.seamCapWidthMaxMm);
    await fillField(`#sixOclockExclusionDeg-${index}`, config.sixOclockExclusionDeg);
    await fillField(`#weldSeamExclusionDeg-${index}`, config.weldSeamExclusionDeg);

    // HiLo limits (matches UI order)
    await fillField(`#hiloWpsLimitMm-${index}`, config.hiloWpsLimitMm);
    await fillField(`#excessiveHiloLengthLimitDeg-${index}`, config.excessiveHiloLengthLimitDeg);
    await fillField(`#hiloPreferredLimitTopMm-${index}`, config.hiloPreferredLimitTopMm);
    await fillField(`#hiloPreferredLimitMiddleMm-${index}`, config.hiloPreferredLimitMiddleMm);
    await fillField(`#hiloPreferredLimitLowerMm-${index}`, config.hiloPreferredLimitLowerMm);

    // Pipe type & sequence (matches UI order)
    await selectFromCombobox(`#pipeType-${index}`, config.pipeType);
    await selectFromCombobox(`#pipeMode-${index}`, config.pipeMode);
    await selectFromCombobox(`#pipeSequence-${index}`, config.pipeSequence);

    // Length & targets (matches UI order)
    await fillField(`#nominalPipeLength-${index}`, config.nominalPipeLength);
    await fillField(`#targetNumberOfPipes-${index}`, config.targetNumberOfPipes);
    await fillField(`#targetPipelineLength-${index}`, config.targetPipelineLength);

    // Dimensions & material (matches UI order)
    await fillField(`#pipeMaterial-${index}`, config.pipeMaterial);
    await selectFromCombobox(`#pipeRotation-${index}`, config.pipeRotation);

  }

  async clearPipeMandatoryFieldsByIndex(index, existingManufacturers = []) {
    await this.page.locator(`#pipeSize-${index}`).fill('');
    await this.page.locator(`#wallThickness-${index}`).fill('');
    await this.page.locator(`#numberOfPipes-${index}`).fill('');
    await this.page.locator(`#pipeLength-${index}`).fill('');
    await this.page.locator(`#jobNumber-${index}-0`).fill('');
    await this.selectManufacturersForPipe(index, [], existingManufacturers);
  }

  getDeletePipeButtonByIndex(index) {
    return this.page.locator('button[title="Delete Pipe"]').nth(index);
  }

  async openDeletePipeDialogByIndex(index) {
    const deleteButton = this.getDeletePipeButtonByIndex(index);
    await deleteButton.scrollIntoViewIfNeeded();
    await deleteButton.click();
    await expect(this.deletePipeDialog).toBeVisible({ timeout: 5000 });
  }

  async assertDeleteDialogDetails(pipeLabel, { wallThickness, numberOfPipes, pipeLength }) {
    const dialog = this.deletePipeDialog;
    // "Pipe X" appears multiple times (question text + pipe details title + bullet items),
    // so scope to the pipe-details title to avoid strict-mode violations.
    const pipeDetails = dialog.locator('div.max-h-32').first();
    const pipeTitle = pipeDetails
      .locator('div.font-medium.mb-1')
      .filter({ hasText: `Pipe ${pipeLabel}` })
      .first();
    await expect(pipeTitle).toBeVisible({ timeout: 3000 });

    const pipeInfoGrid = pipeDetails.locator('div.grid.grid-cols-2').first();
    await expect(pipeInfoGrid.getByText(`Wall Thickness: ${wallThickness}`)).toBeVisible({ timeout: 3000 });
    await expect(pipeInfoGrid.getByText(`Number of Pipes: ${numberOfPipes}`)).toBeVisible({ timeout: 3000 });
    await expect(pipeInfoGrid.getByText(`Length: ${pipeLength}`)).toBeVisible({ timeout: 3000 });
  }

  async confirmDeletePipeInDialog() {
    const dialog = this.deletePipeDialog;
    const confirmDeleteButton = dialog.getByRole('button', { name: /^Delete$/ }).last();
    await confirmDeleteButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  }
}

module.exports = { PipelineSetupPage };

