import { promises as fs } from 'fs';
import { join, resolve, basename } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Type } from '@sinclair/typebox';
import { createTypedTool } from './typed-tool-system.js';

const execAsync = promisify(exec);

interface ConfigurationRequest {
  installPath?: string;
  projectPath?: string;
  compilerFlags?: string[];
  optimizationLevel?: 'none' | 'basic' | 'aggressive';
  debugMode: boolean;
  customConfig?: Record<string, string>;
}

interface ToolDefinition {
  name: string;
  binary: string;
  baseFlags: string[];
  location: 'bin' | 'tools';
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
  if (process.env.PVSNESLIB_HOME) {
    return process.env.PVSNESLIB_HOME;
  }
  if (process.env.PVSNESLIB) {
    return process.env.PVSNESLIB;
  }

  // Check common locations
  const searchPaths = [
    join(process.env.HOME || '~', '.pvsneslib', 'pvsneslib-*'),
    './vendor/pvsneslib-*',
    '../vendor/pvsneslib-*',
    '../../vendor/pvsneslib-*',
  ];

  for (const searchPattern of searchPaths) {
    try {
      const { stdout } = await execAsync(`ls -d ${searchPattern} 2>/dev/null | head -1 || true`);
      const match = stdout.trim();
      if (match && await fs.access(match).then(() => true).catch(() => false)) {
        return resolve(match);
      }
    } catch {
      // Continue searching
    }
  }

  // If not found, throw an error with helpful installation suggestion
  const suggestedPath = join(process.env.HOME || '~', '.pvsneslib', 'pvsneslib-4.3.0');
  
  throw new Error(`PVSnesLib installation not found. Please either:
1. Install PVSnesLib using: mcp run pvsneslib_install_sdk --action install_sdk --version 4.3.0
2. Download manually from GitHub releases and extract to: ${suggestedPath}
3. Specify installPath parameter pointing to your PVSnesLib installation
4. Set PVSNESLIB_HOME environment variable

For automatic installation, you can run:
  mcp run pvsneslib_bootstrap --action bootstrap --sdk-version 4.3.0`);
}

async function configureAllTools(
  installPath: string, 
  request: ConfigurationRequest
): Promise<ToolConfiguration[]> {
  const toolDefinitions: ToolDefinition[] = [
    {
      name: 'C Compiler (TCC)',
      binary: '816-tcc',
      baseFlags: ['-ml', '-ms'],
      location: 'bin',
    },
    {
      name: 'WLA-65816 Assembler',
      binary: 'wla-65816', 
      baseFlags: ['-s', '-x'],
      location: 'bin',
    },
    {
      name: 'WLA Linker',
      binary: 'wlalink',
      baseFlags: ['-d', '-s', '-v'],
      location: 'bin',
    },
    {
      name: 'SPC700 Assembler',
      binary: 'wla-spc700',
      baseFlags: ['-s'],
      location: 'bin',
    },
    {
      name: 'Graphics Converter (GFX2SNES)',
      binary: 'gfx2snes',
      baseFlags: ['-p'],
      location: 'tools',
    },
    {
      name: 'Audio Converter (SNESBRR)',
      binary: 'snesbrr',
      baseFlags: ['-v'],
      location: 'tools',
    },
    {
      name: 'Map Converter (TMX2SNES)',
      binary: 'tmx2snes',
      baseFlags: ['-v'],
      location: 'tools',
    },
    {
      name: 'Font Converter (PVSNESLIBFONT)',
      binary: 'pvsneslibfont',
      baseFlags: ['-c'],
      location: 'tools',
    },
  ];

  const tools: ToolConfiguration[] = [];
  
  for (const toolDef of toolDefinitions) {
    const toolPath = join(installPath, 'devkitsnes', toolDef.location, toolDef.binary);
    const tool: ToolConfiguration = {
      name: toolDef.name,
      path: toolPath,
      flags: [...toolDef.baseFlags],
      status: 'missing',
      environment: {},
    };

    try {
      // Check if tool exists
      await fs.access(toolPath, fs.constants.F_OK);
      
      // Try to get version (many tools don't support --version, so we'll be flexible)
      try {
        let versionOutput = '';
        
        // Try different version commands
        const versionCommands = [
          `"${toolPath}" --version`,
          `"${toolPath}" -v`,
          `"${toolPath}" -h | head -1`,
          `"${toolPath}" 2>&1 | head -1`,
        ];
        
        for (const cmd of versionCommands) {
          try {
            const { stdout, stderr } = await execAsync(`${cmd} 2>/dev/null || true`);
            versionOutput = (stdout || stderr).trim();
            if (versionOutput && !versionOutput.includes('error') && !versionOutput.includes('not found')) {
              break;
            }
          } catch {
            // Try next command
          }
        }
        
        // Extract version number if found
        const versionMatch = versionOutput.match(/\b\d+\.\d+(\.\d+)?/);
        tool.version = versionMatch ? versionMatch[0] : 'detected';
      } catch {
        tool.version = 'detected';
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
  const toolsPath = join(installPath, 'devkitsnes', 'tools');
  const libPath = join(installPath, 'lib');
  const includePath = join(installPath, 'include');

  const envLines: string[] = [
    '# PVSnesLib Development Environment Configuration',
    `# Generated on ${new Date().toISOString()}`,
    '',
    '# Core PVSnesLib paths',
    `export PVSNESLIB_HOME="${installPath}"`,
    `PVSNESLIB="${installPath}"`,
    `PVSNESLIB_BIN="${binPath}"`,
    `PVSNESLIB_TOOLS="${toolsPath}"`,
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
  envLines.push(`export PATH="$PVSNESLIB_BIN:$PVSNESLIB_TOOLS:$PATH"`);

  // Add custom configuration
  if (customConfig) {
    envLines.push('');
    envLines.push('# Custom configuration');
    for (const [key, value] of Object.entries(customConfig)) {
      envLines.push(`export ${key}="${value}"`);
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
    // Create a proper PVSnesLib Makefile based on working examples
    const projectName = basename(projectPath).toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const makefileContent = [
      `# ${basename(projectPath)} SNES Project`,
      '# Generated by MCP-PVSnesLib configure_tools',
      '',
      '# Check for PVSnesLib installation',
      'ifeq ($(strip $(PVSNESLIB_HOME)),)',
      '$(error "Please create an environment variable PVSNESLIB_HOME by following this guide: https://github.com/alekmaul/pvsneslib/wiki/Installation")',
      'endif',
      '',
      'include ${PVSNESLIB_HOME}/devkitsnes/snes_rules',
      '',
      '.PHONY: all clean',
      '',
      '#---------------------------------------------------------------------------------',
      '# ROMNAME is used in snes_rules file',
      `export ROMNAME := ${projectName}`,
      '',
      '# Additional compiler flags',
      ...(request.debugMode ? ['export PVSNESLIB_DEBUG := 1'] : []),
      ...(request.compilerFlags && request.compilerFlags.length > 0 ? 
          [`# Custom flags: ${request.compilerFlags.join(' ')}`] : []),
      '',
      'all: $(ROMNAME).sfc',
      '',
      'clean: cleanBuildRes cleanRom cleanGfx',
      '',
      '# Add your custom targets here',
      '# Example:',
      '# graphics: sprite.pic background.pic',
      '# \\t@echo "Graphics converted"',
      '',
      '# sprite.pic: graphics/sprite.png',
      '# \\t$(GFXCONV) -s 8 -o 16 -u 16 -p -e 0 -i $<',
      '',
    ].join('\n');

    await fs.writeFile(makefilePath, makefileContent);
    return true;
  } catch (error) {
    console.warn('Failed to update Makefile:', error);
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

export const pvsnesLibConfigureToolsTool = createTypedTool({
  name: 'configure_tools',
  description: 'Configure PVSnesLib toolchain and development environment',
  inputSchema: Type.Object({
    action: Type.Literal('configure_tools', {
      description: 'The action to perform (must be "configure_tools")',
    }),
    installPath: Type.Optional(Type.String({
      description: 'Path to PVSnesLib installation (auto-detected if not provided)',
    })),
    projectPath: Type.Optional(Type.String({
      description: 'Project directory path (default: current directory)',
    })),
    compilerFlags: Type.Optional(Type.Array(Type.String(), {
      description: 'Additional compiler flags',
    })),
    optimizationLevel: Type.Optional(Type.Union([
      Type.Literal('none'),
      Type.Literal('basic'),
      Type.Literal('aggressive')
    ], {
      description: 'Optimization level: none, basic, or aggressive (default: basic)',
    })),
    debugMode: Type.Optional(Type.Boolean({
      description: 'Enable debug mode with debug symbols and flags',
    })),
    customConfig: Type.Optional(Type.Record(Type.String(), Type.String(), {
      description: 'Custom environment variables to add',
    })),
  }),
  outputSchema: Type.Object({
    success: Type.Boolean(),
    content: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Object({
      installPath: Type.String(),
      projectPath: Type.String(),
      toolsConfigured: Type.Number(),
      toolsTotal: Type.Number(),
      environmentFile: Type.String(),
      makefileUpdated: Type.Boolean(),
      pathUpdated: Type.Boolean(),
      timestamp: Type.String(),
    })),
  }),
  handler: async (params) => {
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
});