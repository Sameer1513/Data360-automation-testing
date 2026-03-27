const { expect } = require('@playwright/test');

class FabricationSetupPage {
  constructor(page) {
    this.page = page;
    this.saveButton = page.getByRole('button', { name: /^Save$/ });
    this.saveSuccessToast = page.getByText('Setup Saved Successfully', { exact: false });
    this.setupSavedMessage = page.getByText('The project setup has been saved successfully.', { exact: false });
    this.loadingSetupData = page.getByText('Loading setup data...', { exact: false });
  }

  sectionRoot(title) {
    const heading = this.page.getByRole('heading', { level: 3, name: title });
    // Each subtype is wrapped in a distinct container in the DOM (e.g. <div class="space-y-8 mb-12">...).
    // Scoping to that container prevents filling inputs from the wrong subtype.
    return heading
      .locator('xpath=ancestor::div[contains(@class,"space-y-8") and contains(@class,"mb-12")][1]')
      .first();
  }

  async fillSubtype(title, data, pipefitter, previousManufacturer) {
    const root = this.sectionRoot(title);
    const normalizedTitle = (title || '').trim().toLowerCase();

    // Ensure the whole subsection is in view before filling anything inside it.
    await root.waitFor({ state: 'visible', timeout: 15000 });
    await root.scrollIntoViewIfNeeded();

    const ensureVisible = async (locator) => {
      // `scrollIntoViewIfNeeded()` can time out with custom scroll containers.
      // Fallback to direct DOM scrollIntoView.
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {});
    };

    const fillField = async (locator, value) => {
      const count = await locator.count();
      if (count === 0) return;
      // Handle duplicate ids (e.g. nominalOd) by filling all matches.
      if (count > 1) {
        for (let i = 0; i < count; i += 1) {
          const el = locator.nth(i);
          await ensureVisible(el);
          await el.waitFor({ state: 'visible', timeout: 5000 });
          await el.click();
          await el.fill(String(value));
        }
        return;
      }

      const el = locator.first();
      await ensureVisible(el);
      await el.waitFor({ state: 'visible', timeout: 5000 });
      await el.click();
      await el.fill(String(value));
    };

    const maybeFill = async (locator, value) => {
      if (value === undefined) return;
      if ((await locator.count()) === 0) return;
      await fillField(locator, value);
    };

    await fillField(root.locator('#numberOfPipeSizes'), data.numberOfPipeSizes);

    const pipeEntries = Object.entries(data)
      .filter(([key]) => /^pipe\d+$/.test(key))
      .sort((a, b) => Number(a[0].replace('pipe', '')) - Number(b[0].replace('pipe', '')));

    await root.locator('#pipeSize-0').first().waitFor({ state: 'visible', timeout: 30000 });

    for (const [pipeKey, pipe] of pipeEntries) {
      const pipeIdx = Number(pipeKey.replace('pipe', '')) - 1;

      await fillField(root.locator(`#pipeSize-${pipeIdx}`), pipe.pipeSize);
      await fillField(root.locator(`#wallThickness-${pipeIdx}`), pipe.wallThickness);
      await fillField(root.locator(`#numberOfPipes-${pipeIdx}`), pipe.numberOfPipes);
      await fillField(root.locator(`#pipeLength-${pipeIdx}`), pipe.pipeLength);

      if (normalizedTitle === 'buckle arrestor' && pipe.buckleArrestors !== undefined) {
        await fillField(root.locator(`#buckleArrestors-${pipeIdx}`), pipe.buckleArrestors);
      }

      if (normalizedTitle === 'bulk head') {
        const bulkHeadCountValue = pipe.buckleArrestors ?? pipe.numberOfForges;
        if (bulkHeadCountValue !== undefined) {
          const loc1 = root.locator(`#buckleArrestors-${pipeIdx}`);
          if ((await loc1.count()) > 0) {
            await fillField(loc1, bulkHeadCountValue);
          } else {
            const loc2 = root.locator(`#numberOfBuckleArrestors-${pipeIdx}`);
            if ((await loc2.count()) > 0) await fillField(loc2, bulkHeadCountValue);
          }
        }
      }

      if (normalizedTitle !== 'bulk head') {
        await maybeFill(root.locator(`#numberOfForges-${pipeIdx}`), pipe.numberOfForges);
      }

      await maybeFill(root.locator(`#outputAssemblyLength-${pipeIdx}`), pipe.outputAssemblyLength);
      await maybeFill(root.locator(`#prefixAssemblyName-${pipeIdx}`), pipe.assemblyNamePrefix);

      const wpsNumbers = Array.isArray(pipe.wpsNumbers)
        ? pipe.wpsNumbers
        : (pipe.wpsNumber1 !== undefined ? [pipe.wpsNumber1] : []);
      const normalizedNumberOfWps = pipe.numberOfWps ?? wpsNumbers.length;
      if (normalizedNumberOfWps > 0) {
        await fillField(root.locator(`#numberOfJobs-${pipeIdx}`), String(normalizedNumberOfWps));
      }
      for (let w = 0; w < wpsNumbers.length; w += 1) {
        await fillField(root.locator(`#jobNumber-${pipeIdx}-${w}`), String(wpsNumbers[w]));
      }

      if (pipe.manufacturer) {
        const manufacturerButton = root
          .locator(`label[for="manufacturer-${pipeIdx}"]`)
          .locator('..')
          .locator('button[role="combobox"]');
        await manufacturerButton.scrollIntoViewIfNeeded();
        await manufacturerButton.waitFor({ state: 'visible', timeout: 5000 });
        await manufacturerButton.click();

        const listbox = this.page.locator('[role="listbox"][data-state="open"]').first();
        await listbox.waitFor({ state: 'visible', timeout: 5000 });

        const prevForThisPipe = typeof previousManufacturer === 'object'
          ? previousManufacturer?.[pipeKey]
          : previousManufacturer;
        if (prevForThisPipe && prevForThisPipe !== pipe.manufacturer) {
          const previousOption = listbox.getByText(prevForThisPipe, { exact: true });
          if (await previousOption.count()) {
            await previousOption.first().click();
          }
        }

        await listbox.getByText(pipe.manufacturer, { exact: true }).first().click();

        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.mouse.click(0, 0).catch(() => {});
        await listbox.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      }
    }

    if (pipefitter) {
      // Ensure the pipefitter section is revealed before filling pipefitter inputs.
      await root.getByText('Pipefitter configuration', { exact: false }).scrollIntoViewIfNeeded().catch(() => {});
      await ensureVisible(root.locator('#toeSeamSeparationMinMm-0').first());

      const selectFromCombobox = async (comboboxLocator, optionText) => {
        await ensureVisible(comboboxLocator);
        await comboboxLocator.click();
        const listbox = this.page.locator('[role="listbox"][data-state="open"]').first();
        await listbox.waitFor({ state: 'visible', timeout: 5000 });
        await listbox.getByText(optionText, { exact: true }).click();
        await this.page.keyboard.press('Escape').catch(() => {});
        await listbox.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      };

      for (const [pipeKey] of pipeEntries) {
        const pipeIdx = Number(pipeKey.replace('pipe', '')) - 1;
        // Pipefitter configuration is rendered in UI order:
        // dropdown -> Inner diameter -> Outer diameter -> Seam/angular -> HiLo -> Pipe type/sequence -> Length/targets -> Dimensions/material

        // Pipe data highlighting dropdown
        const highlightType = pipefitter.highlightType || 'Tolerance (min / max)';
        await selectFromCombobox(root.locator(`#highlightType-${pipeIdx}`).first(), highlightType);

        // Inner Diameter
        await maybeFill(root.locator(`#nominalId-${pipeIdx}`), pipefitter.nominalId);
        await maybeFill(root.locator(`#nominalIdMin-${pipeIdx}`), pipefitter.nominalIdMin);
        await maybeFill(root.locator(`#nominalIdMax-${pipeIdx}`), pipefitter.nominalIdMax);
        await maybeFill(root.locator(`#ooRIDTolrence-${pipeIdx}`), pipefitter.idTolerance);

        // Outer Diameter
        await fillField(root.locator(`#nominalOd-${pipeIdx}`), pipefitter.nominalOd);
        await maybeFill(root.locator(`#nominalOdMin-${pipeIdx}`), pipefitter.nominalOdMin);
        await maybeFill(root.locator(`#nominalOdMax-${pipeIdx}`), pipefitter.nominalOdMax);
        await maybeFill(root.locator(`#ooRODTolrence-${pipeIdx}`), pipefitter.odTolerance);

        // Seam & angular limits
        await fillField(root.locator(`#toeSeamSeparationMinMm-${pipeIdx}`), pipefitter.toeSeamSeparationMinMm);
        await fillField(root.locator(`#seamCapWidthMaxMm-${pipeIdx}`), pipefitter.seamCapWidthMaxMm);
        await fillField(root.locator(`#sixOclockExclusionDeg-${pipeIdx}`), pipefitter.sixOclockExclusionDeg);
        await fillField(root.locator(`#weldSeamExclusionDeg-${pipeIdx}`), pipefitter.weldSeamExclusionDeg);

        // HiLo limits
        await fillField(root.locator(`#hiloWpsLimitMm-${pipeIdx}`), pipefitter.hiloWpsLimitMm);
        await fillField(root.locator(`#excessiveHiloLengthLimitDeg-${pipeIdx}`), pipefitter.excessiveHiloLengthLimitDeg);
        await fillField(root.locator(`#hiloPreferredLimitTopMm-${pipeIdx}`), pipefitter.hiloPreferredLimitTopMm);
        await fillField(root.locator(`#hiloPreferredLimitMiddleMm-${pipeIdx}`), pipefitter.hiloPreferredLimitMiddleMm);
        await fillField(root.locator(`#hiloPreferredLimitLowerMm-${pipeIdx}`), pipefitter.hiloPreferredLimitLowerMm);

        // Pipe type & sequence
        if (pipefitter.pipeType !== undefined) await selectFromCombobox(root.locator(`#pipeType-${pipeIdx}`).first(), pipefitter.pipeType);
        if (pipefitter.pipeMode !== undefined) await selectFromCombobox(root.locator(`#pipeMode-${pipeIdx}`).first(), pipefitter.pipeMode);
        if (pipefitter.pipeSequence !== undefined) await selectFromCombobox(root.locator(`#pipeSequence-${pipeIdx}`).first(), pipefitter.pipeSequence);

        // Length & targets
        await fillField(root.locator(`#nominalPipeLength-${pipeIdx}`), pipefitter.nominalPipeLength);
        await fillField(root.locator(`#targetNumberOfPipes-${pipeIdx}`), pipefitter.targetNumberOfPipes);
        await fillField(root.locator(`#targetPipelineLength-${pipeIdx}`), pipefitter.targetPipelineLength);

        // Dimensions & material
        await fillField(root.locator(`#pipeMaterial-${pipeIdx}`), pipefitter.pipeMaterial);
        if (pipefitter.pipeRotation !== undefined) await selectFromCombobox(root.locator(`#pipeRotation-${pipeIdx}`).first(), pipefitter.pipeRotation);
      }
    }
  }

  async clickSaveAndWait() {
    await this.saveButton.scrollIntoViewIfNeeded();
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.saveSuccessToast.waitFor({ state: 'visible', timeout: 30000 });
    await this.setupSavedMessage.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await this.loadingSetupData.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  async clickSaveForValidation() {
    await this.saveButton.scrollIntoViewIfNeeded();
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
  }

  async clearMandatoryFieldsForValidation(title, previousManufacturer) {
    const root = this.sectionRoot(title);
    const normalizedTitle = (title || '').trim().toLowerCase();

    await root.waitFor({ state: 'visible', timeout: 15000 });
    await root.scrollIntoViewIfNeeded();

    const clearField = async (locator) => {
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click();
      await locator.fill('');
    };

    await clearField(root.locator('#pipeSize-0'));
    await clearField(root.locator('#wallThickness-0'));
    await clearField(root.locator('#numberOfPipes-0'));
    await clearField(root.locator('#pipeLength-0'));

    const manufacturerButton = root
      .locator('label[for="manufacturer-0"]')
      .locator('..')
      .locator('button[role="combobox"]')
      .first();
    await manufacturerButton.scrollIntoViewIfNeeded();
    await manufacturerButton.click();

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

    // Keep these fields intact due to known missing validations:
    // Buckle Arrestor: buckle arrestors, assembly name prefix, WPS count
    // Pipe In Pipe: number of forges, output assembly length, assembly name prefix, WPS count
    // Bulk Head: buckle arrestors, assembly name prefix, WPS count
    if (normalizedTitle === 'buckle arrestor' || normalizedTitle === 'bulk head') {
      await clearField(root.locator('#outputAssemblyLength-0'));
    }
  }

  async clearBuckleArrestorKnownMissingValidationFields() {
    const root = this.sectionRoot('Buckle Arrestor');
    await root.waitFor({ state: 'visible', timeout: 15000 });
    await root.scrollIntoViewIfNeeded();

    const clearEnsuredEmpty = async (locator, retries = 4) => {
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await locator.waitFor({ state: 'visible', timeout: 5000 });

      for (let attempt = 0; attempt < retries; attempt += 1) {
        await locator.click();
        await locator.fill('');
        await locator.press('Control+A');
        await locator.press('Backspace');
        await locator.press('Delete');
        await this.page.waitForTimeout(100);
        const value = await locator.inputValue();
        if (value === '') break;
      }
      await expect(locator).toHaveValue('', { timeout: 3000 });
    };

    await clearEnsuredEmpty(root.locator('#buckleArrestors-0'));
    await clearEnsuredEmpty(root.locator('#prefixAssemblyName-0'));
    await clearEnsuredEmpty(root.locator('#numberOfJobs-0'));
  }

  async clearPipeInPipeKnownMissingValidationFields() {
    const root = this.sectionRoot('Pipe in Pipe');
    await root.waitFor({ state: 'visible', timeout: 15000 });
    await root.scrollIntoViewIfNeeded();

    const clearEnsuredEmpty = async (locator, retries = 4) => {
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await locator.waitFor({ state: 'visible', timeout: 5000 });

      for (let attempt = 0; attempt < retries; attempt += 1) {
        await locator.click();
        await locator.fill('');
        await locator.press('Control+A');
        await locator.press('Backspace');
        await locator.press('Delete');
        await this.page.waitForTimeout(100);
        const value = await locator.inputValue();
        if (value === '') break;
      }
      await expect(locator).toHaveValue('', { timeout: 3000 });
    };

    await clearEnsuredEmpty(root.locator('#numberOfForges-0'));
    await clearEnsuredEmpty(root.locator('#outputAssemblyLength-0'));
    await clearEnsuredEmpty(root.locator('#prefixAssemblyName-0'));
    await clearEnsuredEmpty(root.locator('#numberOfJobs-0'));
  }

  async clearBulkHeadKnownMissingValidationFields() {
    const root = this.sectionRoot('Bulk Head');
    await root.waitFor({ state: 'visible', timeout: 15000 });
    await root.scrollIntoViewIfNeeded();

    const clearEnsuredEmpty = async (locator, retries = 4) => {
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await locator.waitFor({ state: 'visible', timeout: 5000 });

      for (let attempt = 0; attempt < retries; attempt += 1) {
        await locator.click();
        await locator.fill('');
        await locator.press('Control+A');
        await locator.press('Backspace');
        await locator.press('Delete');
        await this.page.waitForTimeout(100);
        const value = await locator.inputValue();
        if (value === '') break;
      }
      await expect(locator).toHaveValue('', { timeout: 3000 });
    };

    await clearEnsuredEmpty(root.locator('#prefixAssemblyName-0'));
    await clearEnsuredEmpty(root.locator('#numberOfJobs-0'));
  }
}

module.exports = { FabricationSetupPage };

