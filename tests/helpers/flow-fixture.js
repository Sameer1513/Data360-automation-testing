const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LoginAndProjectPage = require('../../pages/loginAndProject.page');
const CreateProjectPage = require('../../pages/createproject.page');
const SpecificationPage = require('../../pages/Specification.page');
const SetupPage = require('../../pages/setup.page');
const StatusConfigPage = require('../../pages/statusConfig.page');
const StatusConfigPass = require('../../pages/StatusConfigPass.page.js');
const DeviceAssigningPage = require('../../pages/DeviceAssigning.page');
const ProductionTabWeldData = require('../../pages/ProductionTabWeldData.page');
const BoltDBTxtFileTOExcel = require('../../pages/BoltDBTxtFileTOExcel.page');
const ComparePage = require('../../pages/compare.page');
const { WeldParametersCsvToExcel, WeldParametersXmlToExcel } = require('../../pages/WeldParameterFIleToExcel.page.js');
const CommonHelper = require('../../Helper/CommonHelper');
const LoginAssertion = require('../../Assertions/LoginAssertion');
const ProductionTabAssertion = require('../../Assertions/ProductionTabAssertion');

const configPath = path.join(__dirname, '../../config/Combinations.json');

function isObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  if (!isObject(base) || !isObject(override)) return override;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    const b = base[k];
    const o = override[k];
    if (isObject(b) && isObject(o)) out[k] = deepMerge(b, o);
    else out[k] = o;
  }
  return out;
}

function loadFlowConfig(overrideConfigPath = null) {
  const base = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!overrideConfigPath) return base;

  const resolved = path.isAbsolute(overrideConfigPath)
    ? overrideConfigPath
    : path.join(process.cwd(), overrideConfigPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Override config not found: ${resolved}`);
  }
  const override = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  return deepMerge(base, override);
}

function getCore(flowConfig = loadFlowConfig()) {
  const project = flowConfig.singleProject;
  const fc = flowConfig.flowControl || {};
  const helperNoPage = new CommonHelper(null);
  const targetWeldId = helperNoPage.resolveTargetWelds(project.weldIds);
  return { project, fc, targetWeldId };
}

function buildSlopeVariants(project) {
  const base = Array.isArray(project.slopeCombinations) ? [...project.slopeCombinations] : [];
  const addIfMissing = (inVal, outVal, label) => {
    if (!base.some(s => Number(s.slopeIn) === inVal && Number(s.slopeOut) === outVal)) {
      base.push({ slopeIn: inVal, slopeOut: outVal, label });
    }
  };

  // without slope
  addIfMissing(0, 0, 'without-slope');

  // with value changes (safe common variants)
  addIfMissing(1, 1, 'value-change-1');
  addIfMissing(2, 3, 'value-change-2');

  return base.map((s, idx) => ({
    slopeIn: Number(s.slopeIn || 0),
    slopeOut: Number(s.slopeOut || 0),
    label: s.label || `combo-${idx + 1}`
  }));
}

async function prepareDataFromConfig(flowConfig = loadFlowConfig()) {
  const { project, fc } = getCore(flowConfig);

  if (fc.cleanExports) {
    const exportsDir = path.join(process.cwd(), 'exports');
    ['ActualData', 'ProductionData', 'ComparedData'].forEach((dir) => {
      const fullPath = path.join(exportsDir, dir);
      if (fs.existsSync(fullPath)) fs.rmSync(fullPath, { recursive: true, force: true });
    });
  }

  if (fc.checkSourceFile) {
    const sourceFilePath = path.join(process.cwd(), 'Input', project.sourceFile);
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error(`Source file not found: ${project.sourceFile}`);
    }
  }

  if (fc.weldParameterExtraction) {
    const inputFile = project.weldParamsInputFile;
    if (inputFile) {
      if (inputFile.toLowerCase().endsWith('.csv')) {
        await new WeldParametersCsvToExcel(inputFile).run();
      } else if (inputFile.toLowerCase().endsWith('.xml')) {
        await new WeldParametersXmlToExcel(inputFile).run();
      }
    }
  }

  let derivedSetup = null;
  if (fc.runExtraction) {
    const extractor = new BoltDBTxtFileTOExcel();
    const statusConfigPath = project.statusConfigPath ? path.join(process.cwd(), project.statusConfigPath) : null;
    const weldParamsPath = project.weldParamsPath ? path.join(process.cwd(), project.weldParamsPath) : null;

    const out = await extractor.run(
      0,
      0,
      project.projectName,
      project.sourceFile,
      false,
      statusConfigPath,
      weldParamsPath,
      project.unitConfig || null
    );
    derivedSetup = out && out.setupData ? out.setupData : null;
  }

  return { derivedSetup };
}

function createRuntime(page, flowConfig = loadFlowConfig()) {
  const helper = new CommonHelper(page);
  return {
    page,
    flowConfig,
    helper,
    login: new LoginAndProjectPage(page),
    createPage: new CreateProjectPage(page),
    specPage: new SpecificationPage(page),
    setupPage: new SetupPage(page),
    status: new StatusConfigPage(page),
    statusConfigPass: new StatusConfigPass(page),
    deviceAssign: new DeviceAssigningPage(page),
    analysis: new ProductionTabWeldData(page, flowConfig.scanConfig),
    compare: new ComparePage()
  };
}

async function runPrereqToProduction(runtime, opts = {}) {
  const { flowConfig, login, createPage, setupPage, specPage, helper } = runtime;
  const { project, fc } = getCore(flowConfig);

  if (opts.login !== false && fc.login) {
    await new LoginAssertion(login).run();
  }

  if (opts.create && fc.createProject) {
    await createPage.createProject({ ...flowConfig.createProjectData, projectName: project.projectName });
  }

  if (opts.setup && fc.setup) {
    await setupPage.performSetup(project.projectName);
  }

  if (opts.specification && fc.specification && project.specificationData) {
    await specPage.navigateToSpecifications(project.projectName);
    if (project.specificationData.excelTemplate) {
      await specPage.uploadSpecifications(project.specificationData);
    }
  }

  if (opts.openProduction !== false) {
    await new ProductionTabAssertion(runtime.page, helper).run(project.projectName);
  }
}

async function runDeviceRegisterStep(step) {
  const scriptPath = path.join(__dirname, '../../terminal_execution_files/device_register.js');
  await new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, `--step=${step}`], { stdio: 'inherit', shell: true });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`device_register step ${step} failed: ${code}`))));
    child.on('error', reject);
  });
}

function updateDerivedSetupInConfig(derivedSetup, flowConfig = loadFlowConfig()) {
  if (!derivedSetup) return;
  const cfg = loadFlowConfig();
  if (cfg.singleProject?.setupConfig?.pipes?.[0]) {
    const p = cfg.singleProject.setupConfig.pipes[0];
    if (derivedSetup.pipeSize) p.pipeSize = String(derivedSetup.pipeSize);
    if (derivedSetup.wallThickness) p.wallThickness = String(derivedSetup.wallThickness);
    if (derivedSetup.wps) p.wps = [String(derivedSetup.wps)];
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  }
}

module.exports = {
  configPath,
  loadFlowConfig,
  getCore,
  buildSlopeVariants,
  prepareDataFromConfig,
  createRuntime,
  runPrereqToProduction,
  runDeviceRegisterStep,
  updateDerivedSetupInConfig
};
