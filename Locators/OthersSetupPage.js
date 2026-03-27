const { expect } = require('@playwright/test');

class OthersSetupPage {
  constructor(page) {
    this.page = page;

    this.saveButton = page.getByRole('button', { name: /^Save$/ });
    this.saveSuccessToast = page.getByText('Setup Saved Successfully', { exact: false });
    this.setupSavedMessage = page.getByText('The project setup has been saved successfully.', { exact: false });
    this.loadingSetupData = page.getByText('Loading setup data...', { exact: false });

    // Others subsection is wrapped in a container like: <div class="space-y-8 mb-12">...</div>
    this.othersRoot = page
      .getByRole('heading', { level: 3, name: 'Others' })
      .locator('xpath=ancestor::div[contains(@class,"space-y-8") and contains(@class,"mb-12")][1]')
      .first();
  }

  async ensureVisible(locator) {
    await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    await locator
      .evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }))
      .catch(() => {});
  }

  async fillNumberOfPipeSizes(count) {
    await this.othersRoot.waitFor({ state: 'visible', timeout: 15000 });
    const input = this.othersRoot.locator('#numberOfPipeSizes').first();
    await this.ensureVisible(input);
    await input.fill(String(count));
  }

  async selectFromCombobox(comboboxLocator, optionText) {
    await this.ensureVisible(comboboxLocator);
    await comboboxLocator.click();

    const listbox = this.page.locator('[role="listbox"][data-state="open"]').first();
    await listbox.waitFor({ state: 'visible', timeout: 5000 });
    await listbox.getByText(optionText, { exact: true }).click();

    // Force-close to avoid blocking subsequent scroll/fills.
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(0, 0).catch(() => {});
    await listbox.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  }

  async fillPipeDetailsByIndex(index, {
    pipeSize,
    wallThickness,
    numberOfPipes,
    pipeLength,
    manufacturer,
    numberOfWps,
    wpsNumbers,
    wpsNumber1,
  }, previousManufacturer) {
    await this.othersRoot.locator(`#pipeSize-${index}`).first().waitFor({ state: 'visible', timeout: 30000 });

    const fillField = async (locator, value) => {
      await this.ensureVisible(locator);
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click();
      await locator.fill(String(value));
    };

    await fillField(this.othersRoot.locator(`#pipeSize-${index}`), pipeSize);
    await fillField(this.othersRoot.locator(`#wallThickness-${index}`), wallThickness);
    await fillField(this.othersRoot.locator(`#numberOfPipes-${index}`), numberOfPipes);
    await fillField(this.othersRoot.locator(`#pipeLength-${index}`), pipeLength);

    if (manufacturer) {
      const manufacturerCombobox = this.othersRoot
        .locator(`label[for="manufacturer-${index}"]`)
        .locator('..')
        .locator('button[role="combobox"]')
        .first();

      await this.ensureVisible(manufacturerCombobox);
      await manufacturerCombobox.click();

      const listbox = this.page.locator('[role="listbox"][data-state="open"]').first();
      await listbox.waitFor({ state: 'visible', timeout: 5000 });

      if (previousManufacturer && previousManufacturer !== manufacturer) {
        const previousOption = listbox.getByText(previousManufacturer, { exact: true });
        if (await previousOption.count()) {
          await previousOption.first().click();
        }
      }
      await listbox.getByText(manufacturer, { exact: true }).first().click();

      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.mouse.click(0, 0).catch(() => {});
      await listbox.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    }

    const normalizedWpsNumbers = Array.isArray(wpsNumbers)
      ? wpsNumbers
      : (wpsNumber1 !== undefined ? [wpsNumber1] : []);
    const normalizedNumberOfWps = numberOfWps ?? normalizedWpsNumbers.length;

    if (normalizedNumberOfWps !== undefined && normalizedNumberOfWps > 0) {
      await fillField(this.othersRoot.locator(`#numberOfJobs-${index}`), normalizedNumberOfWps);
    }
    if (normalizedWpsNumbers.length > 0) {
      for (let i = 0; i < normalizedWpsNumbers.length; i += 1) {
        await fillField(this.othersRoot.locator(`#jobNumber-${index}-${i}`), normalizedWpsNumbers[i]);
      }
    }
  }

  async fillPipeFitterConfigurationByIndex(index, pipefitter) {
    const fillField = async (locator, value) => {
      if (value === undefined) return;
      const count = await locator.count();
      if (count === 0) return;
      // Handle duplicate ids (e.g. nominalOd) by filling all matches.
      if (count > 1) {
        for (let i = 0; i < count; i += 1) {
          const el = locator.nth(i);
          await this.ensureVisible(el);
          await el.waitFor({ state: 'visible', timeout: 5000 });
          await el.click();
          await el.fill(String(value));
        }
        return;
      }

      const el = locator.first();
      await this.ensureVisible(el);
      await el.waitFor({ state: 'visible', timeout: 5000 });
      await el.click();
      await el.fill(String(value));
    };

    // Pipefitter configuration is below the pipe details; reveal/scroll to it first.
    await this.othersRoot
      .getByText('Pipefitter configuration', { exact: false })
      .scrollIntoViewIfNeeded()
      .catch(() => {});

    await this.othersRoot.locator(`#toeSeamSeparationMinMm-${index}`).first().waitFor({ state: 'visible', timeout: 15000 });

    // Pipe data highlighting - dropdown with two options.
    const highlightType = pipefitter.highlightType || 'Tolerance (min / max)';
    await this.selectFromCombobox(this.othersRoot.locator(`#highlightType-${index}`).first(), highlightType);

    // Inner Diameter (UI order)
    await fillField(this.othersRoot.locator(`#nominalId-${index}`), pipefitter.nominalId);
    await fillField(this.othersRoot.locator(`#nominalIdMin-${index}`), pipefitter.nominalIdMin);
    await fillField(this.othersRoot.locator(`#nominalIdMax-${index}`), pipefitter.nominalIdMax);
    await fillField(this.othersRoot.locator(`#ooRIDTolrence-${index}`), pipefitter.idTolerance);

    // Outer Diameter (UI order)
    await fillField(this.othersRoot.locator(`#nominalOd-${index}`), pipefitter.nominalOd);
    await fillField(this.othersRoot.locator(`#nominalOdMin-${index}`), pipefitter.nominalOdMin);
    await fillField(this.othersRoot.locator(`#nominalOdMax-${index}`), pipefitter.nominalOdMax);
    await fillField(this.othersRoot.locator(`#ooRODTolrence-${index}`), pipefitter.odTolerance);

    // Seam & angular limits (UI order)
    await fillField(this.othersRoot.locator(`#toeSeamSeparationMinMm-${index}`), pipefitter.toeSeamSeparationMinMm);
    await fillField(this.othersRoot.locator(`#seamCapWidthMaxMm-${index}`), pipefitter.seamCapWidthMaxMm);
    await fillField(this.othersRoot.locator(`#sixOclockExclusionDeg-${index}`), pipefitter.sixOclockExclusionDeg);
    await fillField(this.othersRoot.locator(`#weldSeamExclusionDeg-${index}`), pipefitter.weldSeamExclusionDeg);

    // HiLo limits (UI order)
    await fillField(this.othersRoot.locator(`#hiloWpsLimitMm-${index}`), pipefitter.hiloWpsLimitMm);
    await fillField(this.othersRoot.locator(`#excessiveHiloLengthLimitDeg-${index}`), pipefitter.excessiveHiloLengthLimitDeg);
    await fillField(this.othersRoot.locator(`#hiloPreferredLimitTopMm-${index}`), pipefitter.hiloPreferredLimitTopMm);
    await fillField(this.othersRoot.locator(`#hiloPreferredLimitMiddleMm-${index}`), pipefitter.hiloPreferredLimitMiddleMm);
    await fillField(this.othersRoot.locator(`#hiloPreferredLimitLowerMm-${index}`), pipefitter.hiloPreferredLimitLowerMm);

    // Pipe type & sequence (UI order)
    await this.selectFromCombobox(this.othersRoot.locator(`#pipeType-${index}`).first(), pipefitter.pipeType);
    await this.selectFromCombobox(this.othersRoot.locator(`#pipeMode-${index}`).first(), pipefitter.pipeMode);
    await this.selectFromCombobox(this.othersRoot.locator(`#pipeSequence-${index}`).first(), pipefitter.pipeSequence);

    // Length & targets (UI order)
    await fillField(this.othersRoot.locator(`#nominalPipeLength-${index}`), pipefitter.nominalPipeLength);
    await fillField(this.othersRoot.locator(`#targetNumberOfPipes-${index}`), pipefitter.targetNumberOfPipes);
    await fillField(this.othersRoot.locator(`#targetPipelineLength-${index}`), pipefitter.targetPipelineLength);

    // Dimensions & material (UI order)
    await fillField(this.othersRoot.locator(`#pipeMaterial-${index}`), pipefitter.pipeMaterial);
    await this.selectFromCombobox(this.othersRoot.locator(`#pipeRotation-${index}`).first(), pipefitter.pipeRotation);
  }

  async clickSaveAndWait() {
    await this.saveButton.scrollIntoViewIfNeeded();
    await expect(this.saveButton).toBeEnabled({ timeout: 15000 });
    await this.saveButton.click();

    await this.saveSuccessToast.waitFor({ state: 'visible', timeout: 30000 });
    await this.setupSavedMessage.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await this.loadingSetupData.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  async clickSaveForValidation() {
    await this.saveButton.scrollIntoViewIfNeeded();
    await expect(this.saveButton).toBeEnabled({ timeout: 15000 });
    await this.saveButton.click();
  }

  async clearMandatoryFieldsForValidation(previousManufacturer) {
    await this.othersRoot.waitFor({ state: 'visible', timeout: 15000 });

    const clearField = async (locator) => {
      await this.ensureVisible(locator);
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click();
      await locator.fill('');
    };

    await clearField(this.othersRoot.locator('#pipeSize-0'));
    await clearField(this.othersRoot.locator('#wallThickness-0'));
    await clearField(this.othersRoot.locator('#numberOfPipes-0'));
    await clearField(this.othersRoot.locator('#pipeLength-0'));
    await clearField(this.othersRoot.locator('#jobNumber-0-0'));

    const manufacturerCombobox = this.othersRoot
      .locator('label[for="manufacturer-0"]')
      .locator('..')
      .locator('button[role="combobox"]')
      .first();
    await this.ensureVisible(manufacturerCombobox);
    await manufacturerCombobox.click();

    const listbox = this.page.locator('[role="listbox"][data-state="open"]').first();
    await listbox.waitFor({ state: 'visible', timeout: 5000 });
    if (previousManufacturer) {
      const selectedOption = listbox.getByText(previousManufacturer, { exact: true });
      if (await selectedOption.count()) {
        await selectedOption.first().click();
      }
    }
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.mouse.click(0, 0).catch(() => {});
    await listbox.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  }

  async clearPipe1NumberOfJobsFieldEnsuredEmpty() {
    const numberOfJobsInput = this.othersRoot.locator('#numberOfJobs-0').first();
    await this.ensureVisible(numberOfJobsInput);
    await numberOfJobsInput.waitFor({ state: 'visible', timeout: 5000 });

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
}

module.exports = { OthersSetupPage };

