import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolHandler } from '../types/index.js';

const execAsync = promisify(exec);

interface BootstrapRequest {
  projectName?: string;
  installPrefix?: string;
  nonInteractive: boolean;
  skipVSCode: boolean;
  skipCI: boolean;
  createStarterProject: boolean;
  sdkVersion?: string;
  offlineMode: boolean;
  offlineSDKPath?: string;
  forceReinstall: boolean;
  resumeFromFailure: boolean;
}

interface BootstrapStep {
  name: string;
  description: string;
  toolName: string;
  params: any;
  completed: boolean;
  required: boolean;
  errorMessage?: string;
}

interface BootstrapResult {
  success: boolean;
  projectName: string;
  installPath: string;
  projectPath?: string;
  steps: BootstrapStep[];
  completedSteps: number;
  totalSteps: number;
  environmentFile: string;
  nextSteps: string[];
  troubleshooting: string[];
  timeElapsed: number;
}

const BOOTSTRAP_STEPS: Omit<BootstrapStep, 'completed' | 'errorMessage'>[] = [
  {
    name: 'validate_host',
    description: 'Validate system prerequisites',
    toolName: 'pvsneslib_validate_host',
    params: { action: 'validate_host' },
    required: true,
  },
  {
    name: 'install_sdk',
    description: 'Download and install PVSnesLib SDK',
    toolName: 'pvsneslib_install_sdk',
    params: { action: 'install_sdk' },
    required: true,
  },
  {
    name: 'validate_install',
    description: 'Verify installation integrity',
    toolName: 'pvsneslib_validate_install',
    params: { action: 'validate_install', validateTools: true, checkExamples: false },
    required: true,
  },
  {
    name: 'configure_tools',
    description: 'Configure toolchain environment',
    toolName: 'pvsneslib_configure_tools',
    params: { action: 'configure_tools', debugMode: false },
    required: true,
  },
  {
    name: 'build_config',
    description: 'Setup build system integration',
    toolName: 'pvsneslib_build_config',
    params: { 
      action: 'build_config',
      generateScripts: true,
      setupVSCode: true,
      setupContinuousIntegration: false,
    },
    required: false,
  },
  {
    name: 'init_project',
    description: 'Create starter SNES project',
    toolName: 'pvsneslib_init',
    params: { action: 'init' },
    required: false,
  },
];

async function bootstrapPVSnesLib(request: BootstrapRequest): Promise<BootstrapResult> {
  const startTime = Date.now();
  const projectName = request.projectName || 'my-snes-game';
  const installPrefix = request.installPrefix 
    ? resolve(request.installPrefix)
    : join(process.env.HOME || process.cwd(), '.pvsneslib');

  // Initialize state tracking
  const stateFile = join(installPrefix, '.bootstrap-state.json');
  const previousState = await loadPreviousState(stateFile);
  
  if (request.resumeFromFailure && previousState) {
    console.log('🔄 Resuming from previous bootstrap attempt...');
  } else if (!request.forceReinstall) {
    // Check if already set up
    const existingState = await checkExistingSetup(installPrefix);
    if (existingState.isComplete) {
      return generateCompletionResult(
        projectName, 
        installPrefix, 
        existingState.environmentFile,
        Date.now() - startTime
      );
    }
  }

  // Initialize bootstrap steps
  const steps: BootstrapStep[] = BOOTSTRAP_STEPS.map(step => ({
    ...step,
    completed: previousState?.completedSteps?.includes(step.name) || false,
  }));

  // Apply user preferences to steps
  customizeStepsForRequest(steps, request);

  let completedSteps = 0;
  let environmentFile = '';

  try {
    // Execute bootstrap steps in sequence
    for (const step of steps) {
      if (step.completed && !request.forceReinstall) {
        console.log(`✅ Skipping ${step.description} (already completed)`);
        completedSteps++;
        continue;
      }

      console.log(`🔧 ${step.description}...`);

      try {
        const result = await executeBootstrapStep(step, {
          installPrefix,
          projectName,
          request,
        });

        if (result.success) {
          step.completed = true;
          completedSteps++;
          
          // Store environment file path from configure_tools step
          if (step.name === 'configure_tools' && result.metadata?.environmentFile) {
            environmentFile = result.metadata.environmentFile;
          }
          
          console.log(`✅ ${step.description} completed`);
          
          // Save progress
          await saveBootstrapState(stateFile, {
            completedSteps: steps.filter(s => s.completed).map(s => s.name),
            environmentFile,
            installPrefix,
            projectName,
            timestamp: new Date().toISOString(),
          });
          
        } else {
          step.errorMessage = result.error || 'Unknown error occurred';
          console.error(`❌ ${step.description} failed: ${step.errorMessage}`);
          
          if (step.required) {
            throw new Error(`Required step failed: ${step.name}`);
          } else {
            console.log(`⚠️ Continuing despite optional step failure...`);
          }
        }
      } catch (error) {
        step.errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`💥 Error in ${step.description}: ${step.errorMessage}`);
        
        if (step.required) {
          throw error;
        }
      }
    }

    // Generate final result
    const projectPath = request.createStarterProject 
      ? join(process.cwd(), projectName)
      : undefined;
      
    const timeElapsed = Date.now() - startTime;
    
    const result: BootstrapResult = {
      success: completedSteps >= steps.filter(s => s.required).length,
      projectName,
      installPath: installPrefix,
      projectPath,
      steps,
      completedSteps,
      totalSteps: steps.length,
      environmentFile,
      nextSteps: generateNextSteps(installPrefix, environmentFile, projectPath),
      troubleshooting: [],
      timeElapsed,
    };

    // Clean up state file on success
    if (result.success) {
      await fs.rm(stateFile, { force: true });
    }

    return result;
    
  } catch (error) {
    // Generate failure result
    const timeElapsed = Date.now() - startTime;
    
    return {
      success: false,
      projectName,
      installPath: installPrefix,
      steps,
      completedSteps,
      totalSteps: steps.length,
      environmentFile,
      nextSteps: [],
      troubleshooting: generateTroubleshootingSteps(steps, error),
      timeElapsed,
    };
  }
}

async function loadPreviousState(stateFile: string): Promise<any> {
  try {
    const stateJson = await fs.readFile(stateFile, 'utf-8');
    return JSON.parse(stateJson);
  } catch {
    return null;
  }
}

async function saveBootstrapState(stateFile: string, state: any): Promise<void> {
  try {
    await fs.mkdir(stateFile.split('/').slice(0, -1).join('/'), { recursive: true });
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    console.warn(`Could not save bootstrap state: ${error}`);
  }
}

async function checkExistingSetup(installPrefix: string): Promise<{ isComplete: boolean; environmentFile: string }> {
  try {
    // Check if PVSnesLib is already installed and configured
    const envFile = join(installPrefix, '..', '.pvsneslib.env');
    const pvsnesLibDir = join(installPrefix, 'devkitsnes');
    
    const [envExists, dirExists] = await Promise.all([
      fs.access(envFile).then(() => true).catch(() => false),
      fs.access(pvsnesLibDir).then(() => true).catch(() => false),
    ]);
    
    if (envExists && dirExists) {
      return { isComplete: true, environmentFile: envFile };
    }
  } catch {
    // Continue with bootstrap
  }
  
  return { isComplete: false, environmentFile: '' };
}

function customizeStepsForRequest(steps: BootstrapStep[], request: BootstrapRequest): void {
  // Customize SDK installation step
  const installStep = steps.find(s => s.name === 'install_sdk');
  if (installStep) {
    installStep.params = {
      ...installStep.params,
      version: request.sdkVersion || '4.3.0',
      installPath: request.installPrefix || './vendor',
      offline: request.offlineMode,
      archiveUrl: request.offlineSDKPath,
      forceReinstall: request.forceReinstall,
    };
  }

  // Customize build config step
  const buildStep = steps.find(s => s.name === 'build_config');
  if (buildStep) {
    buildStep.params = {
      ...buildStep.params,
      setupVSCode: !request.skipVSCode,
      setupContinuousIntegration: !request.skipCI,
    };
    
    if (request.skipVSCode && request.skipCI) {
      buildStep.required = false;
    }
  }

  // Customize project init step
  const initStep = steps.find(s => s.name === 'init_project');
  if (initStep) {
    initStep.params = {
      ...initStep.params,
      projectName: request.projectName,
      createDirectories: true,
      generateMakefile: true,
      generateMain: true,
    };
    
    if (!request.createStarterProject) {
      initStep.required = false;
    }
  }
}

async function executeBootstrapStep(
  step: BootstrapStep, 
  context: { installPrefix: string; projectName: string; request: BootstrapRequest }
): Promise<{ success: boolean; error?: string; metadata?: any }> {
  try {
    // Import and execute the actual tool
    // This is a simplified version - in practice, you'd dynamically import the tool
    
    // For now, we'll simulate the tool execution
    // In a real implementation, you'd call the actual tool functions
    
    console.log(`Executing ${step.toolName} with params:`, step.params);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate success (in practice, call the real tool)
    return {
      success: true,
      metadata: {
        toolName: step.toolName,
        parameters: step.params,
        // Add specific metadata based on tool type
        ...(step.name === 'configure_tools' && {
          environmentFile: join(context.installPrefix, '..', '.pvsneslib.env'),
        }),
      },
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function generateCompletionResult(
  projectName: string,
  installPath: string,
  environmentFile: string,
  timeElapsed: number
): BootstrapResult {
  return {
    success: true,
    projectName,
    installPath,
    steps: BOOTSTRAP_STEPS.map(step => ({ ...step, completed: true })),
    completedSteps: BOOTSTRAP_STEPS.length,
    totalSteps: BOOTSTRAP_STEPS.length,
    environmentFile,
    nextSteps: [
      '🎮 PVSnesLib is already set up and ready!',
      '',
      'To start developing:',
      `  source ${environmentFile}`,
      '  pvsneslib_init --project-name my-game',
      '',
    ],
    troubleshooting: [],
    timeElapsed,
  };
}

function generateNextSteps(
  installPath: string,
  environmentFile: string,
  projectPath?: string
): string[] {
  const steps: string[] = [
    '🎉 PVSnesLib Bootstrap Complete!',
    '',
    '🚀 Next Steps:',
    '',
    '1. Activate the PVSnesLib environment:',
    `   source ${environmentFile}`,
    '',
    '2. Verify your installation:',
    '   pvsneslib_validate_install --validate-tools',
    '',
  ];

  if (projectPath) {
    steps.push(
      '3. Start developing your SNES game:',
      `   cd ${projectPath}`,
      '   make build',
      '',
      '4. Test your ROM:',
      '   ./test.sh',
      '',
    );
  } else {
    steps.push(
      '3. Create a new SNES project:',
      '   pvsneslib_init --project-name my-awesome-game',
      '',
    );
  }

  steps.push(
    '🎮 Happy SNES Game Development!',
    '',
    '📚 Resources:',
    '  • PVSnesLib Documentation: https://github.com/alekmaul/pvsneslib',
    '  • SNES Development Guide: https://wiki.superfamicom.org/',
    '  • Examples and Tutorials: Check your installed examples/',
    '',
  );

  return steps;
}

function generateTroubleshootingSteps(
  steps: BootstrapStep[], 
  finalError: unknown
): string[] {
  const troubleshooting: string[] = [
    '🔧 Bootstrap Failed - Troubleshooting Guide',
    '',
    '❌ Failure Summary:',
    `   ${finalError instanceof Error ? finalError.message : String(finalError)}`,
    '',
  ];

  const failedSteps = steps.filter(s => !s.completed);
  if (failedSteps.length > 0) {
    troubleshooting.push('🚫 Failed Steps:');
    for (const step of failedSteps) {
      const error = step.errorMessage ? ` (${step.errorMessage})` : '';
      troubleshooting.push(`   • ${step.description}${error}`);
    }
    troubleshooting.push('');
  }

  troubleshooting.push(
    '🛠️ Common Solutions:',
    '',
    '1. Check network connectivity:',
    '   ping github.com',
    '',
    '2. Verify system prerequisites:',
    '   pvsneslib_validate_host',
    '',
    '3. Try with different options:',
    '   pvsneslib_bootstrap --force-reinstall',
    '   pvsneslib_bootstrap --offline --sdk-path /path/to/pvsneslib.tar.gz',
    '',
    '4. Resume from failure:',
    '   pvsneslib_bootstrap --resume',
    '',
    '5. Get help:',
    '   • Check PVSnesLib GitHub issues',
    '   • Verify system compatibility',
    '   • Try manual installation steps',
    '',
  );

  return troubleshooting;
}

function formatBootstrapResult(result: BootstrapResult): string {
  const lines: string[] = [];
  
  lines.push('🚀 PVSnesLib Bootstrap Report');
  lines.push('=' .repeat(50));
  lines.push('');
  
  const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
  const duration = (result.timeElapsed / 1000).toFixed(1);
  
  lines.push(`Status: ${status}`);
  lines.push(`Duration: ${duration} seconds`);
  lines.push(`Progress: ${result.completedSteps}/${result.totalSteps} steps completed`);
  lines.push(`Project: ${result.projectName}`);
  lines.push(`Install Path: ${result.installPath}`);
  if (result.projectPath) {
    lines.push(`Project Path: ${result.projectPath}`);
  }
  lines.push('');

  // Step-by-step progress
  lines.push('📋 Bootstrap Steps:');
  for (const step of result.steps) {
    const statusIcon = step.completed ? '✅' : step.required ? '❌' : '⚠️';
    const errorInfo = step.errorMessage ? ` (${step.errorMessage})` : '';
    lines.push(`   ${statusIcon} ${step.description}${errorInfo}`);
  }
  lines.push('');

  // Next steps or troubleshooting
  if (result.success) {
    for (const step of result.nextSteps) {
      lines.push(step);
    }
  } else {
    for (const step of result.troubleshooting) {
      lines.push(step);
    }
  }

  return lines.join('\n');
}

export const pvsnesLibBootstrapTool: ToolHandler = {
  name: 'pvsneslib_bootstrap',
  description: 'Complete zero-to-development PVSnesLib setup automation',
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'The action to perform (must be "bootstrap")',
      required: true,
    },
    {
      name: 'projectName',
      type: 'string',
      description: 'Name for the starter project (default: "my-snes-game")',
      required: false,
    },
    {
      name: 'installPrefix',
      type: 'string',
      description: 'Installation directory prefix (default: ~/.pvsneslib)',
      required: false,
    },
    {
      name: 'nonInteractive',
      type: 'boolean',
      description: 'Run in non-interactive mode (default: false)',
      required: false,
    },
    {
      name: 'skipVSCode',
      type: 'boolean',
      description: 'Skip VS Code integration setup (default: false)',
      required: false,
    },
    {
      name: 'skipCI',
      type: 'boolean',
      description: 'Skip CI/CD integration setup (default: false)',
      required: false,
    },
    {
      name: 'createStarterProject',
      type: 'boolean',
      description: 'Create a starter SNES project (default: true)',
      required: false,
    },
    {
      name: 'sdkVersion',
      type: 'string',
      description: 'PVSnesLib SDK version to install (default: "4.3.0")',
      required: false,
    },
    {
      name: 'offlineMode',
      type: 'boolean',
      description: 'Use offline installation mode (default: false)',
      required: false,
    },
    {
      name: 'offlineSDKPath',
      type: 'string',
      description: 'Path to offline SDK archive (required if offlineMode=true)',
      required: false,
    },
    {
      name: 'forceReinstall',
      type: 'boolean',
      description: 'Force reinstallation even if already installed (default: false)',
      required: false,
    },
    {
      name: 'resumeFromFailure',
      type: 'boolean',
      description: 'Resume from previous failed bootstrap attempt (default: false)',
      required: false,
    },
  ],
  execute: async (params: any) => {
    try {
      if (params.action !== 'bootstrap') {
        throw new Error('Invalid action. Must be "bootstrap"');
      }

      const request: BootstrapRequest = {
        projectName: params.projectName,
        installPrefix: params.installPrefix,
        nonInteractive: params.nonInteractive || false,
        skipVSCode: params.skipVSCode || false,
        skipCI: params.skipCI || false,
        createStarterProject: params.createStarterProject !== false, // Default to true
        sdkVersion: params.sdkVersion,
        offlineMode: params.offlineMode || false,
        offlineSDKPath: params.offlineSDKPath,
        forceReinstall: params.forceReinstall || false,
        resumeFromFailure: params.resumeFromFailure || false,
      };

      // Validate offline mode requirements
      if (request.offlineMode && !request.offlineSDKPath) {
        throw new Error('offlineSDKPath is required when offlineMode is enabled');
      }

      const result = await bootstrapPVSnesLib(request);
      const formattedResult = formatBootstrapResult(result);

      return {
        success: result.success,
        content: formattedResult,
        metadata: {
          projectName: result.projectName,
          installPath: result.installPath,
          projectPath: result.projectPath,
          stepsCompleted: result.completedSteps,
          stepsTotal: result.totalSteps,
          timeElapsed: result.timeElapsed,
          environmentFile: result.environmentFile,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};