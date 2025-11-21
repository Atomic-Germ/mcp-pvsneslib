import { promises as fs } from 'fs';
import { join, resolve, basename, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolHandler } from '../types/index.js';

const execAsync = promisify(exec);

interface BuildIntegrationRequest {
  installPath?: string;
  projectPath?: string;
  buildSystem?: 'makefile' | 'cmake' | 'custom';
  generateScripts: boolean;
  setupVSCode: boolean;
  setupContinuousIntegration: boolean;
  romOutputPath?: string;
}

interface BuildTarget {
  name: string;
  description: string;
  command: string;
  dependencies: string[];
  outputs: string[];
}

interface BuildIntegrationResult {
  success: boolean;
  installPath: string;
  projectPath: string;
  buildSystem: string;
  buildTargets: BuildTarget[];
  scriptsGenerated: string[];
  vscodeConfigured: boolean;
  ciConfigured: boolean;
  romOutputPath: string;
  nextSteps: string[];
}

async function integrateBuildSystem(
  request: BuildIntegrationRequest
): Promise<BuildIntegrationResult> {
  // Resolve paths
  const installPath = request.installPath
    ? resolve(request.installPath)
    : await findPVSnesLibInstallation();
  const projectPath = request.projectPath
    ? resolve(request.projectPath)
    : process.cwd();

  const romOutputPath = request.romOutputPath
    ? resolve(projectPath, request.romOutputPath)
    : join(projectPath, 'build', basename(projectPath) + '.sfc');

  // Determine build system
  const buildSystem = await determineBuildSystem(
    projectPath,
    request.buildSystem
  );

  // Generate build targets
  const buildTargets = await generateBuildTargets(
    projectPath,
    installPath,
    buildSystem,
    romOutputPath
  );

  // Generate build scripts
  const scriptsGenerated = request.generateScripts
    ? await generateBuildScripts(
        projectPath,
        installPath,
        buildTargets,
        buildSystem
      )
    : [];

  // Setup VS Code integration
  const vscodeConfigured = request.setupVSCode
    ? await setupVSCodeIntegration(projectPath, installPath, buildTargets)
    : false;

  // Setup CI/CD
  const ciConfigured = request.setupContinuousIntegration
    ? await setupContinuousIntegration(projectPath, buildTargets)
    : false;

  const nextSteps = generateNextSteps(
    buildSystem,
    scriptsGenerated.length > 0,
    vscodeConfigured,
    ciConfigured,
    romOutputPath
  );

  return {
    success: true,
    installPath,
    projectPath,
    buildSystem,
    buildTargets,
    scriptsGenerated,
    vscodeConfigured,
    ciConfigured,
    romOutputPath,
    nextSteps,
  };
}

async function findPVSnesLibInstallation(): Promise<string> {
  if (process.env.PVSNESLIB) {
    return process.env.PVSNESLIB;
  }

  try {
    const { stdout } = await execAsync(
      `find . -maxdepth 4 -type d -name "pvsneslib-*" 2>/dev/null || true`
    );
    const matches = stdout.trim().split('\n').filter(Boolean);
    if (matches.length > 0) {
      return resolve(matches[0]);
    }
  } catch {
    // Continue to error
  }

  throw new Error(
    'PVSnesLib installation not found. Please specify installPath.'
  );
}

async function determineBuildSystem(
  projectPath: string,
  preference?: string
): Promise<string> {
  if (preference) {
    return preference;
  }

  // Check for existing build files
  const buildFiles = [
    { file: 'CMakeLists.txt', system: 'cmake' },
    { file: 'Makefile', system: 'makefile' },
    { file: 'build.sh', system: 'custom' },
  ];

  for (const { file, system } of buildFiles) {
    try {
      await fs.access(join(projectPath, file));
      return system;
    } catch {
      // Continue checking
    }
  }

  return 'makefile'; // Default to Makefile
}

async function generateBuildTargets(
  projectPath: string,
  installPath: string,
  buildSystem: string,
  romOutputPath: string
): Promise<BuildTarget[]> {
  const targets: BuildTarget[] = [
    {
      name: 'clean',
      description: 'Clean build artifacts',
      command: 'rm -rf build/ *.o *.sfc *.sym',
      dependencies: [],
      outputs: [],
    },
    {
      name: 'build',
      description: 'Build SNES ROM',
      command: `make -f ${join(installPath, 'lib/build/Makefile.pvsneslib')} PVSNESLIB="${installPath}"`,
      dependencies: ['clean'],
      outputs: [romOutputPath],
    },
    {
      name: 'build-debug',
      description: 'Build SNES ROM with debug symbols',
      command: `make -f ${join(installPath, 'lib/build/Makefile.pvsneslib')} PVSNESLIB="${installPath}" DEBUG=1`,
      dependencies: ['clean'],
      outputs: [romOutputPath.replace('.sfc', '-debug.sfc')],
    },
    {
      name: 'test',
      description: 'Run ROM in emulator for testing',
      command: `snes9x "${romOutputPath}" 2>/dev/null || zsnes "${romOutputPath}" 2>/dev/null || echo "No SNES emulator found"`,
      dependencies: ['build'],
      outputs: [],
    },
    {
      name: 'dist',
      description: 'Package ROM for distribution',
      command: `mkdir -p dist && cp "${romOutputPath}" dist/ && zip -j "dist/${basename(projectPath)}.zip" "${romOutputPath}" README.md 2>/dev/null || true`,
      dependencies: ['build'],
      outputs: [`dist/${basename(projectPath)}.zip`],
    },
    {
      name: 'install-deps',
      description: 'Install development dependencies',
      command:
        'echo "Checking for SNES emulators..." && (which snes9x || which zsnes || echo "Consider installing: sudo apt-get install snes9x")',
      dependencies: [],
      outputs: [],
    },
  ];

  return targets;
}

async function generateBuildScripts(
  projectPath: string,
  installPath: string,
  buildTargets: BuildTarget[],
  buildSystem: string
): Promise<string[]> {
  const scriptsGenerated: string[] = [];

  if (buildSystem === 'makefile') {
    await generateMakefile(projectPath, installPath, buildTargets);
    scriptsGenerated.push('Makefile');
  }

  // Generate convenient shell scripts
  await generateBuildScript(projectPath, installPath, buildTargets);
  scriptsGenerated.push('build.sh');

  await generateTestScript(projectPath, buildTargets);
  scriptsGenerated.push('test.sh');

  await generateCleanScript(projectPath, buildTargets);
  scriptsGenerated.push('clean.sh');

  return scriptsGenerated;
}

async function generateMakefile(
  projectPath: string,
  installPath: string,
  buildTargets: BuildTarget[]
): Promise<void> {
  const makefilePath = join(projectPath, 'Makefile');

  const makefileContent = [
    '# SNES Project Makefile',
    '# Generated by PVSnesLib MCP Tool',
    '',
    `PVSNESLIB := ${installPath}`,
    'PROJECT := $(notdir $(CURDIR))',
    'SRCDIR := src',
    'BUILDDIR := build',
    'ROMNAME := $(PROJECT).sfc',
    '',
    '# Include PVSnesLib build system',
    'include $(PVSNESLIB)/lib/build/Makefile.pvsneslib',
    '',
    '# Source files',
    'SOURCES := $(wildcard $(SRCDIR)/*.c) $(wildcard $(SRCDIR)/*.asm)',
    'OBJECTS := $(SOURCES:.c=.o)',
    'OBJECTS := $(OBJECTS:.asm=.o)',
    '',
    '# Build targets',
    '.PHONY: all clean build test dist install-deps',
    '',
    'all: build',
    '',
  ];

  // Add generated targets
  for (const target of buildTargets) {
    makefileContent.push(`${target.name}:`);
    if (target.dependencies.length > 0) {
      makefileContent[makefileContent.length - 1] +=
        ` ${target.dependencies.join(' ')}`;
    }
    makefileContent.push(`\t${target.command}`);
    makefileContent.push('');
  }

  await fs.writeFile(makefilePath, makefileContent.join('\n'));
}

async function generateBuildScript(
  projectPath: string,
  installPath: string,
  buildTargets: BuildTarget[]
): Promise<void> {
  const buildScript = [
    '#!/bin/bash',
    '# SNES Build Script',
    '# Generated by PVSnesLib MCP Tool',
    '',
    'set -e',
    '',
    `PVSNESLIB="${installPath}"`,
    'PROJECT="$(basename "$(pwd)")"',
    '',
    'echo "🎮 Building SNES ROM: $PROJECT"',
    '',
    '# Source the PVSnesLib environment if available',
    'if [ -f ".pvsneslib.env" ]; then',
    '    echo "Loading PVSnesLib environment..."',
    '    source .pvsneslib.env',
    'fi',
    '',
  ];

  const buildTarget = buildTargets.find(t => t.name === 'build');
  if (buildTarget) {
    buildScript.push('# Build the ROM');
    buildScript.push(buildTarget.command);
    buildScript.push('');
    buildScript.push('if [ $? -eq 0 ]; then');
    buildScript.push(
      '    echo "✅ Build successful! ROM created: $PROJECT.sfc"'
    );
    buildScript.push('else');
    buildScript.push('    echo "❌ Build failed!"');
    buildScript.push('    exit 1');
    buildScript.push('fi');
  }

  const scriptPath = join(projectPath, 'build.sh');
  await fs.writeFile(scriptPath, buildScript.join('\n'));
  await fs.chmod(scriptPath, 0o755); // Make executable
}

async function generateTestScript(
  projectPath: string,
  buildTargets: BuildTarget[]
): Promise<void> {
  const testScript = [
    '#!/bin/bash',
    '# SNES Test Script',
    '# Generated by PVSnesLib MCP Tool',
    '',
    'PROJECT="$(basename "$(pwd)")"',
    'ROM="$PROJECT.sfc"',
    '',
    'echo "🎮 Testing SNES ROM: $ROM"',
    '',
    '# Check if ROM exists',
    'if [ ! -f "$ROM" ]; then',
    '    echo "ROM not found. Building first..."',
    '    ./build.sh',
    'fi',
    '',
    '# Try to run in an emulator',
    'if command -v snes9x &> /dev/null; then',
    '    echo "Running in snes9x..."',
    '    snes9x "$ROM"',
    'elif command -v zsnes &> /dev/null; then',
    '    echo "Running in zsnes..."',
    '    zsnes "$ROM"',
    'else',
    '    echo "❌ No SNES emulator found!"',
    '    echo "Install one with: sudo apt-get install snes9x"',
    '    echo "Or manually test the ROM: $ROM"',
    'fi',
  ];

  const scriptPath = join(projectPath, 'test.sh');
  await fs.writeFile(scriptPath, testScript.join('\n'));
  await fs.chmod(scriptPath, 0o755); // Make executable
}

async function generateCleanScript(
  projectPath: string,
  buildTargets: BuildTarget[]
): Promise<void> {
  const cleanScript = [
    '#!/bin/bash',
    '# SNES Clean Script',
    '# Generated by PVSnesLib MCP Tool',
    '',
    'echo "🧹 Cleaning build artifacts..."',
    '',
  ];

  const cleanTarget = buildTargets.find(t => t.name === 'clean');
  if (cleanTarget) {
    cleanScript.push(cleanTarget.command);
  } else {
    cleanScript.push('rm -rf build/ *.o *.sfc *.sym');
  }

  cleanScript.push('');
  cleanScript.push('echo "✅ Clean complete!"');

  const scriptPath = join(projectPath, 'clean.sh');
  await fs.writeFile(scriptPath, cleanScript.join('\n'));
  await fs.chmod(scriptPath, 0o755); // Make executable
}

async function setupVSCodeIntegration(
  projectPath: string,
  installPath: string,
  buildTargets: BuildTarget[]
): Promise<boolean> {
  try {
    const vscodeDir = join(projectPath, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });

    // Generate tasks.json for VS Code
    const tasksJson = {
      version: '2.0.0',
      tasks: buildTargets.map(target => ({
        label: `SNES: ${target.name}`,
        type: 'shell',
        command: target.command,
        group:
          target.name === 'build'
            ? { kind: 'build', isDefault: true }
            : undefined,
        options: {
          cwd: projectPath,
        },
        problemMatcher: target.name.includes('build') ? ['$gcc'] : [],
      })),
    };

    await fs.writeFile(
      join(vscodeDir, 'tasks.json'),
      JSON.stringify(tasksJson, null, 2)
    );

    // Generate launch.json for debugging/testing
    const launchJson = {
      version: '0.2.0',
      configurations: [
        {
          name: 'Test SNES ROM',
          type: 'node',
          request: 'launch',
          program: '${workspaceFolder}/test.sh',
          console: 'integratedTerminal',
        },
      ],
    };

    await fs.writeFile(
      join(vscodeDir, 'launch.json'),
      JSON.stringify(launchJson, null, 2)
    );

    // Generate c_cpp_properties.json for IntelliSense
    const cppPropertiesJson = {
      version: 4,
      configurations: [
        {
          name: 'SNES Development',
          includePath: ['${workspaceFolder}/**', `${installPath}/include/**`],
          defines: ['_SNES_=1', '__816__=1'],
          compilerPath: join(installPath, 'devkitsnes/bin/816-tcc'),
          cStandard: 'c99',
          intelliSenseMode: 'gcc-x64',
        },
      ],
    };

    await fs.writeFile(
      join(vscodeDir, 'c_cpp_properties.json'),
      JSON.stringify(cppPropertiesJson, null, 2)
    );

    return true;
  } catch (error) {
    console.warn(`Could not setup VS Code integration: ${error}`);
    return false;
  }
}

async function setupContinuousIntegration(
  projectPath: string,
  buildTargets: BuildTarget[]
): Promise<boolean> {
  try {
    const githubDir = join(projectPath, '.github', 'workflows');
    await fs.mkdir(githubDir, { recursive: true });

    const workflow = {
      name: 'SNES Build',
      on: ['push', 'pull_request'],
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [
            {
              uses: 'actions/checkout@v3',
            },
            {
              name: 'Install PVSnesLib dependencies',
              run: 'sudo apt-get update && sudo apt-get install -y build-essential',
            },
            {
              name: 'Setup PVSnesLib',
              run: [
                'wget https://github.com/alekmaul/pvsneslib/archive/refs/tags/4.3.0.tar.gz',
                'tar -xzf 4.3.0.tar.gz',
                'export PVSNESLIB="$(pwd)/pvsneslib-4.3.0"',
              ].join('\n'),
            },
            {
              name: 'Build SNES ROM',
              run: 'make build',
            },
            {
              name: 'Upload ROM artifact',
              uses: 'actions/upload-artifact@v3',
              with: {
                name: 'snes-rom',
                path: '*.sfc',
              },
            },
          ],
        },
      },
    };

    const yamlContent = [
      '# SNES Build Workflow',
      '# Generated by PVSnesLib MCP Tool',
      '',
      'name: SNES Build',
      'on: [push, pull_request]',
      '',
      'jobs:',
      '  build:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v3',
      '      - name: Install dependencies',
      '        run: sudo apt-get update && sudo apt-get install -y build-essential wget',
      '      - name: Download PVSnesLib',
      '        run: |',
      '          wget https://github.com/alekmaul/pvsneslib/archive/refs/tags/4.3.0.tar.gz',
      '          tar -xzf 4.3.0.tar.gz',
      '      - name: Build SNES ROM',
      '        run: |',
      '          export PVSNESLIB="$(pwd)/pvsneslib-4.3.0"',
      '          ./build.sh',
      '      - name: Upload ROM',
      '        uses: actions/upload-artifact@v3',
      '        with:',
      '          name: snes-rom',
      '          path: "*.sfc"',
    ].join('\n');

    await fs.writeFile(join(githubDir, 'build.yml'), yamlContent);
    return true;
  } catch (error) {
    console.warn(`Could not setup CI/CD: ${error}`);
    return false;
  }
}

function generateNextSteps(
  buildSystem: string,
  scriptsGenerated: boolean,
  vscodeConfigured: boolean,
  ciConfigured: boolean,
  romOutputPath: string
): string[] {
  const steps: string[] = [
    '🚀 Build system integration complete!',
    '',
    'Next steps:',
    '',
  ];

  steps.push('1. Try building your SNES ROM:');
  if (scriptsGenerated) {
    steps.push('   ./build.sh');
  } else if (buildSystem === 'makefile') {
    steps.push('   make build');
  } else {
    steps.push('   Follow your custom build process');
  }
  steps.push('');

  steps.push('2. Test your ROM:');
  if (scriptsGenerated) {
    steps.push('   ./test.sh');
  } else {
    steps.push('   Run in SNES emulator (snes9x, zsnes, etc.)');
  }
  steps.push('');

  if (vscodeConfigured) {
    steps.push(
      '3. VS Code integration ready:',
      '   - Use Ctrl+Shift+P → "Tasks: Run Task" → "SNES: build"',
      '   - IntelliSense configured for SNES headers',
      ''
    );
  }

  if (ciConfigured) {
    steps.push(
      '4. Continuous Integration setup:',
      '   - Commit .github/workflows/build.yml',
      '   - Push to GitHub for automatic building',
      ''
    );
  }

  steps.push(
    '5. Start developing:',
    '   - Edit src/*.c files for your game logic',
    '   - Use PVSnesLib functions from snes/snes.h',
    '   - Build and test regularly',
    '',
    '6. ROM will be output to:',
    `   ${romOutputPath}`,
    '',
    'Happy SNES game development! 🎮✨'
  );

  return steps;
}

function formatBuildIntegrationResult(result: BuildIntegrationResult): string {
  const lines: string[] = [];

  lines.push('🔨 PVSnesLib Build System Integration Report');
  lines.push('='.repeat(55));
  lines.push('');

  lines.push(`✅ Integration Status: SUCCESS`);
  lines.push(`🏗️ Build System: ${result.buildSystem}`);
  lines.push(`📁 Project: ${result.projectPath}`);
  lines.push(`🎮 ROM Output: ${result.romOutputPath}`);
  lines.push('');

  // Build targets
  lines.push('🎯 Available Build Targets:');
  for (const target of result.buildTargets) {
    lines.push(`   • ${target.name}: ${target.description}`);
  }
  lines.push('');

  // Generated files
  if (result.scriptsGenerated.length > 0) {
    lines.push('📜 Generated Scripts:');
    for (const script of result.scriptsGenerated) {
      lines.push(`   ✅ ${script}`);
    }
    lines.push('');
  }

  // Integrations
  lines.push('🔧 IDE/CI Integration:');
  lines.push(
    `   ${result.vscodeConfigured ? '✅' : '⚠️'} VS Code tasks and IntelliSense`
  );
  lines.push(`   ${result.ciConfigured ? '✅' : '⚠️'} GitHub Actions CI/CD`);
  lines.push('');

  // Next steps
  for (const step of result.nextSteps) {
    lines.push(step);
  }

  return lines.join('\n');
}

export const pvsnesLibBuildConfigTool: ToolHandler = {
  name: 'pvsneslib_build_config',
  description: 'Setup build system integration for SNES development workflow',
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'The action to perform (must be "build_config")',
      required: true,
    },
    {
      name: 'installPath',
      type: 'string',
      description:
        'Path to PVSnesLib installation (auto-detected if not provided)',
      required: false,
    },
    {
      name: 'projectPath',
      type: 'string',
      description: 'Project directory path (default: current directory)',
      required: false,
    },
    {
      name: 'buildSystem',
      type: 'string',
      description: 'Build system preference: makefile, cmake, or custom',
      required: false,
    },
    {
      name: 'generateScripts',
      type: 'boolean',
      description: 'Generate convenient build/test/clean scripts',
      required: false,
    },
    {
      name: 'setupVSCode',
      type: 'boolean',
      description: 'Setup VS Code tasks and IntelliSense integration',
      required: false,
    },
    {
      name: 'setupContinuousIntegration',
      type: 'boolean',
      description: 'Setup GitHub Actions CI/CD workflow',
      required: false,
    },
    {
      name: 'romOutputPath',
      type: 'string',
      description: 'Custom ROM output path (default: build/{project}.sfc)',
      required: false,
    },
  ],
  execute: async (params: any) => {
    try {
      if (params.action !== 'build_config') {
        throw new Error('Invalid action. Must be "build_config"');
      }

      const request: BuildIntegrationRequest = {
        installPath: params.installPath,
        projectPath: params.projectPath,
        buildSystem: params.buildSystem,
        generateScripts: params.generateScripts !== false, // Default to true
        setupVSCode: params.setupVSCode !== false, // Default to true
        setupContinuousIntegration: params.setupContinuousIntegration || false,
        romOutputPath: params.romOutputPath,
      };

      const result = await integrateBuildSystem(request);
      const formattedResult = formatBuildIntegrationResult(result);

      return {
        success: result.success,
        content: formattedResult,
        metadata: {
          installPath: result.installPath,
          projectPath: result.projectPath,
          buildSystem: result.buildSystem,
          buildTargets: result.buildTargets.length,
          scriptsGenerated: result.scriptsGenerated.length,
          vscodeConfigured: result.vscodeConfigured,
          ciConfigured: result.ciConfigured,
          romOutputPath: result.romOutputPath,
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
