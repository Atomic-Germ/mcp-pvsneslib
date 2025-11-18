import { promises as fs } from 'fs';
import { join, resolve, basename } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolHandler } from '../types/index.js';

const execAsync = promisify(exec);

interface ConfigurationRequest {
  installPath?: string;
  projectPath?: string;
  compilerFlags?: string[];
  optimizationLevel?: 'none' | 'basic' | 'aggressive';
  debugMode: boolean;
  customConfig?: Record<string, string>;
}

interface ToolConfiguration {
  name: string;
  path: string;
  version?: string;
  flags: string[];
  status: 'configured' | 'missing' | 'error';
  environment: Record<string, string>;
}

interface ConfigurationResult {
  success: boolean;
  installPath: string;
  projectPath: string;
  tools: ToolConfiguration[];
  environmentFile: string;
  makefileUpdated: boolean;
  pathUpdated: boolean;
  shellProfile: string;
  instructions: string[];
  troubleshooting: string[];
}

async function configurePVSnesLibTools(request: ConfigurationRequest): Promise<ConfigurationResult> {
  // Resolve paths
  const installPath = request.installPath 
    ? resolve(request.installPath) 
    : await findPVSnesLibInstallation();
  const projectPath = request.projectPath 
    ? resolve(request.projectPath) 
    : process.cwd();

  // Configure each tool
  const tools = await configureAllTools(installPath, request);
  
  // Update environment configuration
  const environmentFile = await updateEnvironmentConfig(
    installPath, 
    projectPath, 
    tools, 
    request.customConfig
  );

  // Update project Makefile
  const makefileUpdated = await updateProjectMakefile(projectPath, installPath, request);
  
  // Update system PATH
  const { pathUpdated, shellProfile } = await updateSystemPath(installPath);

  // Generate setup instructions
  const instructions = generateSetupInstructions(
    installPath, 
    environmentFile, 
    makefileUpdated, 
    pathUpdated, 
    shellProfile
  );

  const troubleshooting = generateTroubleshootingSteps(tools);

  return {
    success: tools.every(t => t.status === 'configured'),
    installPath,
    projectPath,
    tools,
    environmentFile,
    makefileUpdated,
    pathUpdated,
    shellProfile,
    instructions,
    troubleshooting,
  };
}

async function findPVSnesLibInstallation(): Promise<string> {
  // Check environment variable first
  if (process.env.PVSNESLIB) {
    return process.env.PVSNESLIB;
  }

  // Check common locations
  const searchPaths = [
    './vendor/pvsneslib-*',
    '../vendor/pvsneslib-*',
    '../../vendor/pvsneslib-*',
  ];

  for (const searchPath of searchPaths) {
    try {
      const { stdout } = await execAsync(`find . -maxdepth 4 -type d -name "pvsneslib-*" 2>/dev/null || true`);
      const matches = stdout.trim().split('\n').filter(Boolean);
      if (matches.length > 0) {
        return resolve(matches[0]);
      }
    } catch {
      // Continue searching
    }
  }

  throw new Error('PVSnesLib installation not found. Please specify installPath or install PVSnesLib first.');
}

async function configureAllTools(
  installPath: string, 
  request: ConfigurationRequest
): Promise<ToolConfiguration[]> {
  const toolDefinitions = [
    {
      name: 'C Compiler (TCC)',
      binary: '816-tcc',
      baseFlags: ['-ml', '-ms'],
    },
    {
      name: 'Assembler (TAS)',
      binary: '816-tas', 
      baseFlags: ['-b', '-l'],
    },
    {
      name: 'Linker (TLD)',
      binary: '816-tld',
      baseFlags: ['-b'],
    },
    {
      name: 'Audio Converter (BRR)',
      binary: 'snesbrr',
      baseFlags: ['-v'],
    },
    {
      name: 'Graphics Converter',
      binary: 'pcx2snes',
      baseFlags: ['-m'],
    },
    {
      name: 'Map Converter',
      binary: 'tmx2snes',
      baseFlags: ['-m'],
    },
    {
      name: 'Font Converter',
      binary: 'gfx2snes',
      baseFlags: ['-f'],
    },
  ];

  const tools: ToolConfiguration[] = [];
  
  for (const toolDef of toolDefinitions) {
    const toolPath = join(installPath, 'devkitsnes', 'bin', toolDef.binary);
    const tool: ToolConfiguration = {
      name: toolDef.name,
      path: toolPath,
      flags: [...toolDef.baseFlags],
      status: 'missing',
      environment: {},
    };

    try {
      // Check if tool exists
      await fs.access(toolPath);
      
      // Try to get version
      try {
        const { stdout } = await execAsync(`"${toolPath}" --version 2>/dev/null || "${toolPath}" -h 2>&1 | head -1`);
        const versionMatch = stdout.match(/\b\d+\.\d+/);
        tool.version = versionMatch ? versionMatch[0] : 'unknown';
      } catch {
        tool.version = 'unknown';
      }

      // Add optimization flags
      if (toolDef.binary.includes('tcc')) {
        tool.flags.push(...getCompilerFlags(request));
      }

      // Add debug flags
      if (request.debugMode && toolDef.binary.includes('tcc')) {
        tool.flags.push('-g', '-DDEBUG');
      }

      // Set environment variables
      tool.environment = {
        [`PVSNESLIB_${toolDef.binary.toUpperCase().replace('-', '_')}`]: toolPath,
      };

      tool.status = 'configured';
    } catch {
      tool.status = 'missing';
    }

    tools.push(tool);
  }

  return tools;
}

function getCompilerFlags(request: ConfigurationRequest): string[] {
  const flags: string[] = [];
  
  // Add custom compiler flags
  if (request.compilerFlags) {
    flags.push(...request.compilerFlags);
  }

  // Add optimization flags
  switch (request.optimizationLevel) {
    case 'none':
      flags.push('-O0');
      break;
    case 'basic':
      flags.push('-O1');
      break;
    case 'aggressive':
      flags.push('-O2', '-finline-functions');
      break;
    default:
      flags.push('-O1'); // Default optimization
  }

  return flags;
}

async function updateEnvironmentConfig(
  installPath: string,
  projectPath: string,
  tools: ToolConfiguration[],
  customConfig?: Record<string, string>
): Promise<string> {
  const envFile = join(projectPath, '.pvsneslib.env');
  const binPath = join(installPath, 'devkitsnes', 'bin');
  const libPath = join(installPath, 'lib');
  const includePath = join(installPath, 'include');

  const envLines: string[] = [
    '# PVSnesLib Development Environment Configuration',
    `# Generated on ${new Date().toISOString()}`,
    '',
    '# Core PVSnesLib paths',
    `PVSNESLIB="${installPath}"`,
    `PVSNESLIB_BIN="${binPath}"`,
    `PVSNESLIB_LIB="${libPath}"`, 
    `PVSNESLIB_INCLUDE="${includePath}"`,
    '',
    '# Compiler and tool paths',
  ];

  // Add tool-specific environment variables
  for (const tool of tools.filter(t => t.status === 'configured')) {
    for (const [key, value] of Object.entries(tool.environment)) {
      envLines.push(`${key}="${value}"`);
    }
  }

  envLines.push('');
  envLines.push('# PATH extension');
  envLines.push(`export PATH="$PVSNESLIB_BIN:$PATH"`);

  // Add custom configuration
  if (customConfig) {
    envLines.push('');
    envLines.push('# Custom configuration');
    for (const [key, value] of Object.entries(customConfig)) {
      envLines.push(`${key}="${value}"`);
    }
  }

  envLines.push('');
  envLines.push('# Usage: source .pvsneslib.env');
  envLines.push('echo "PVSnesLib environment loaded 🎮"');

  await fs.writeFile(envFile, envLines.join('\n'));
  return envFile;
}

async function updateProjectMakefile(
  projectPath: string,
  installPath: string,
  request: ConfigurationRequest
): Promise<boolean> {
  const makefilePath = join(projectPath, 'Makefile');
  
  try {
    // Check if Makefile exists
    let makefileContent = '';
    try {
      makefileContent = await fs.readFile(makefilePath, 'utf-8');
    } catch {
      // Create a basic Makefile
      makefileContent = '# SNES Project Makefile\n';
    }

    // Add PVSnesLib configuration section
    const pvsnesLibSection = [
      '',
      '# ============================================',
      '# PVSnesLib Configuration',
      '# ============================================',
      `PVSNESLIB := ${installPath}`,
      'include $(PVSNESLIB)/lib/build/Makefile.pvsneslib',
      '',
      '# Compiler flags',
      `CFLAGS += ${request.debugMode ? '-g -DDEBUG' : ''}`,
      `CFLAGS += ${getCompilerFlags(request).join(' ')}`,
      '',
      '# Include paths',
      'CFLAGS += -I$(PVSNESLIB)/include',
      '',
      '# Library paths',
      'LDFLAGS += -L$(PVSNESLIB)/lib',
      '',
    ].join('\n');

    // Check if PVSnesLib section already exists
    if (!makefileContent.includes('PVSnesLib Configuration')) {
      makefileContent += pvsnesLibSection;
      await fs.writeFile(makefilePath, makefileContent);
      return true;
    }

    return false; // Already configured
  } catch (error) {
    console.warn(`Could not update Makefile: ${error}`);
    return false;
  }
}

async function updateSystemPath(installPath: string): Promise<{ pathUpdated: boolean; shellProfile: string }> {
  const binPath = join(installPath, 'devkitsnes', 'bin');
  const homeDir = process.env.HOME || '';
  
  // Determine shell profile file
  const shellProfiles = [
    join(homeDir, '.zshrc'),
    join(homeDir, '.bashrc'),
    join(homeDir, '.bash_profile'),
    join(homeDir, '.profile'),
  ];

  let shellProfile = '';
  for (const profile of shellProfiles) {
    try {
      await fs.access(profile);
      shellProfile = profile;
      break;
    } catch {
      // Continue checking
    }
  }

  if (!shellProfile) {
    return { pathUpdated: false, shellProfile: 'none found' };
  }

  try {
    const content = await fs.readFile(shellProfile, 'utf-8');
    
    // Check if PVSnesLib PATH is already added
    if (content.includes('devkitsnes/bin') || content.includes('PVSNESLIB')) {
      return { pathUpdated: false, shellProfile: basename(shellProfile) };
    }

    // Add PVSnesLib to PATH
    const pathAddition = [
      '',
      '# PVSnesLib Development Environment',
      `export PVSNESLIB="${installPath}"`,
      'export PATH="$PVSNESLIB/devkitsnes/bin:$PATH"',
      '',
    ].join('\n');

    await fs.appendFile(shellProfile, pathAddition);
    return { pathUpdated: true, shellProfile: basename(shellProfile) };
  } catch (error) {
    console.warn(`Could not update shell profile: ${error}`);
    return { pathUpdated: false, shellProfile: basename(shellProfile) };
  }
}

function generateSetupInstructions(
  installPath: string,
  environmentFile: string,
  makefileUpdated: boolean,
  pathUpdated: boolean,
  shellProfile: string
): string[] {
  const instructions: string[] = [
    '🎮 PVSnesLib toolchain configuration complete!',
    '',
    'Next steps to start developing:',
    '',
    '1. Activate the environment:',
    `   source ${environmentFile}`,
    '',
    '2. Verify tools are working:',
    '   pvsneslib_validate_install --validate-tools',
    '',
  ];

  if (makefileUpdated) {
    instructions.push(
      '3. Your Makefile has been updated with PVSnesLib settings.',
      '',
    );
  } else {
    instructions.push(
      '3. Add PVSnesLib settings to your Makefile (see generated example).',
      '',
    );
  }

  if (pathUpdated) {
    instructions.push(
      `4. Restart your shell or run: source ~/${shellProfile}`,
      '',
    );
  } else {
    instructions.push(
      '4. Add PVSnesLib to your PATH manually if needed.',
      '',
    );
  }

  instructions.push(
    '5. Start building your SNES game:',
    '   make',
    '',
    'Happy SNES development! 🚀',
  );

  return instructions;
}

function generateTroubleshootingSteps(tools: ToolConfiguration[]): string[] {
  const troubleshooting: string[] = [];
  const missingTools = tools.filter(t => t.status === 'missing');
  
  if (missingTools.length > 0) {
    troubleshooting.push(
      '⚠️ Some tools are missing or misconfigured:',
      '',
      'Missing tools:',
      ...missingTools.map(t => `  • ${t.name}`),
      '',
      'Try these solutions:',
      '1. Reinstall PVSnesLib: pvsneslib_install_sdk --force-reinstall',
      '2. Make tools executable: chmod +x $PVSNESLIB/devkitsnes/bin/*',
      '3. Verify installation: pvsneslib_validate_install',
      '',
    );
  }

  if (troubleshooting.length === 0) {
    troubleshooting.push('✅ All tools configured successfully!');
  }

  return troubleshooting;
}

function formatConfigurationResult(result: ConfigurationResult): string {
  const lines: string[] = [];
  
  lines.push('🔧 PVSnesLib Toolchain Configuration Report');
  lines.push('=' .repeat(55));
  lines.push('');
  
  const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
  lines.push(`Status: ${status}`);
  lines.push(`Installation: ${result.installPath}`);
  lines.push(`Project: ${result.projectPath}`);
  lines.push('');

  // Tools configuration status
  lines.push('🛠️ Tool Configuration:');
  for (const tool of result.tools) {
    const statusIcon = tool.status === 'configured' ? '✅' : tool.status === 'missing' ? '❌' : '⚠️';
    const version = tool.version ? ` (v${tool.version})` : '';
    lines.push(`   ${statusIcon} ${tool.name}${version}`);
  }
  lines.push('');

  // Configuration files
  lines.push('📁 Configuration Files:');
  lines.push(`   📄 Environment: ${result.environmentFile}`);
  lines.push(`   📄 Makefile: ${result.makefileUpdated ? '✅ Updated' : '⚠️ Manual update needed'}`);
  lines.push(`   📄 Shell Profile: ${result.pathUpdated ? `✅ Updated (${result.shellProfile})` : '⚠️ Manual update needed'}`);
  lines.push('');

  // Instructions
  lines.push('📋 Setup Instructions:');
  for (const instruction of result.instructions) {
    lines.push(instruction);
  }
  lines.push('');

  // Troubleshooting (if needed)
  if (result.troubleshooting.some(line => line.includes('Missing'))) {
    lines.push('🔍 Troubleshooting:');
    for (const step of result.troubleshooting) {
      lines.push(step);
    }
  }

  return lines.join('\n');
}

export const pvsnesLibConfigureToolsTool: ToolHandler = {
  name: 'pvsneslib_configure_tools',
  description: 'Configure PVSnesLib toolchain and development environment',
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'The action to perform (must be "configure_tools")',
      required: true,
    },
    {
      name: 'installPath',
      type: 'string',
      description: 'Path to PVSnesLib installation (auto-detected if not provided)',
      required: false,
    },
    {
      name: 'projectPath',
      type: 'string',
      description: 'Project directory path (default: current directory)',
      required: false,
    },
    {
      name: 'compilerFlags',
      type: 'array',
      description: 'Additional compiler flags',
      required: false,
    },
    {
      name: 'optimizationLevel',
      type: 'string',
      description: 'Optimization level: none, basic, or aggressive (default: basic)',
      required: false,
    },
    {
      name: 'debugMode',
      type: 'boolean',
      description: 'Enable debug mode with debug symbols and flags',
      required: false,
    },
    {
      name: 'customConfig',
      type: 'object',
      description: 'Custom environment variables to add',
      required: false,
    },
  ],
  execute: async (params: any) => {
    try {
      if (params.action !== 'configure_tools') {
        throw new Error('Invalid action. Must be "configure_tools"');
      }

      const request: ConfigurationRequest = {
        installPath: params.installPath,
        projectPath: params.projectPath,
        compilerFlags: params.compilerFlags,
        optimizationLevel: params.optimizationLevel || 'basic',
        debugMode: params.debugMode || false,
        customConfig: params.customConfig,
      };

      const result = await configurePVSnesLibTools(request);
      const formattedResult = formatConfigurationResult(result);

      return {
        success: result.success,
        content: formattedResult,
        metadata: {
          installPath: result.installPath,
          projectPath: result.projectPath,
          toolsConfigured: result.tools.filter(t => t.status === 'configured').length,
          toolsTotal: result.tools.length,
          environmentFile: result.environmentFile,
          makefileUpdated: result.makefileUpdated,
          pathUpdated: result.pathUpdated,
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