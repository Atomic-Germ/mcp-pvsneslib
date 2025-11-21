import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolHandler } from '../types/index.js';

const execAsync = promisify(exec);

interface ValidationRequest {
  installPath?: string;
  verbose: boolean;
  checkExamples: boolean;
  validateTools: boolean;
}

interface ComponentValidation {
  name: string;
  path: string;
  found: boolean;
  size?: number;
  version?: string;
  lastModified?: string;
  executable?: boolean;
}

interface ValidationResult {
  success: boolean;
  installPath: string;
  version: string;
  completeness: number; // Percentage
  components: ComponentValidation[];
  tools: ComponentValidation[];
  examples: ComponentValidation[];
  issues: string[];
  recommendations: string[];
  summary: string;
}

async function validatePVSnesLibInstallation(
  request: ValidationRequest
): Promise<ValidationResult> {
  // Determine installation path
  const installPath = request.installPath
    ? resolve(request.installPath)
    : await findInstallationPath();

  // Get version from config or installation
  const version = await getInstalledVersion(installPath);

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Validate core components
  const components = await validateCoreComponents(installPath, request.verbose);

  // Validate tools (if requested)
  const tools = request.validateTools
    ? await validateDevelopmentTools(installPath, request.verbose)
    : [];

  // Validate examples (if requested)
  const examples = request.checkExamples
    ? await validateExampleProjects(installPath, request.verbose)
    : [];

  // Calculate completeness score
  const totalComponents = components.length + tools.length + examples.length;
  const foundComponents = [
    ...components.filter(c => c.found),
    ...tools.filter(t => t.found),
    ...examples.filter(e => e.found),
  ].length;

  const completeness =
    totalComponents > 0
      ? Math.round((foundComponents / totalComponents) * 100)
      : 0;

  // Generate issues and recommendations
  generateValidationInsights(
    components,
    tools,
    examples,
    issues,
    recommendations
  );

  const success = completeness >= 80 && issues.length === 0;
  const summary = generateValidationSummary(
    success,
    completeness,
    installPath,
    version
  );

  return {
    success,
    installPath,
    version,
    completeness,
    components,
    tools,
    examples,
    issues,
    recommendations,
    summary,
  };
}

async function findInstallationPath(): Promise<string> {
  // Check common installation locations
  const possiblePaths = [
    './vendor/pvsneslib-*',
    '../vendor/pvsneslib-*',
    process.env.PVSNESLIB || '',
  ];

  for (const pathPattern of possiblePaths) {
    if (pathPattern.includes('*')) {
      try {
        const { stdout } = await execAsync(
          `find . -maxdepth 3 -type d -name "${pathPattern.split('/').pop()}" 2>/dev/null || true`
        );
        const dirs = stdout.trim().split('\n').filter(Boolean);
        if (dirs.length > 0) {
          return resolve(dirs[0]);
        }
      } catch {
        // Continue checking other paths
      }
    } else if (pathPattern) {
      try {
        const stat = await fs.stat(pathPattern);
        if (stat.isDirectory()) {
          return resolve(pathPattern);
        }
      } catch {
        // Continue checking other paths
      }
    }
  }

  throw new Error(
    "PVSnesLib installation not found. Please specify installPath or ensure it's installed in ./vendor/"
  );
}

async function getInstalledVersion(installPath: string): Promise<string> {
  // Try to extract version from directory name
  const dirName = installPath.split('/').pop() || '';
  const versionMatch = dirName.match(/pvsneslib-(.+)/);
  if (versionMatch) {
    return versionMatch[1];
  }

  // Try to read version from a version file or header
  const versionFilePaths = [
    join(installPath, 'VERSION'),
    join(installPath, 'version.txt'),
    join(installPath, 'include/snes/snes.h'),
  ];

  for (const versionPath of versionFilePaths) {
    try {
      const content = await fs.readFile(versionPath, 'utf-8');
      const versionMatch = content.match(
        /(?:VERSION|version)[:\s]+([0-9]+\.[0-9]+\.[0-9]+)/i
      );
      if (versionMatch) {
        return versionMatch[1];
      }
    } catch {
      // Continue checking other version sources
    }
  }

  return 'unknown';
}

async function validateCoreComponents(
  installPath: string,
  verbose: boolean
): Promise<ComponentValidation[]> {
  const coreComponents = [
    { name: 'SNES Main Header', path: 'include/snes/snes.h' },
    { name: 'Console Functions', path: 'include/snes/console.h' },
    { name: 'Graphics Functions', path: 'include/snes/graphics.h' },
    { name: 'Sound Functions', path: 'include/snes/sound.h' },
    { name: 'Input Functions', path: 'include/snes/input.h' },
    { name: 'Sprite Functions', path: 'include/snes/sprite.h' },
    { name: 'DMA Functions', path: 'include/snes/dma.h' },
    { name: 'Build System', path: 'lib/build/Makefile.pvsneslib' },
    { name: 'Runtime Library', path: 'lib/crt0_snes.asm' },
    { name: 'SNES Library', path: 'lib/libsnes.a' },
  ];

  return await validateComponents(installPath, coreComponents, verbose);
}

async function validateDevelopmentTools(
  installPath: string,
  verbose: boolean
): Promise<ComponentValidation[]> {
  const tools = [
    { name: 'C Compiler (TCC)', path: 'devkitsnes/bin/816-tcc' },
    { name: 'Assembler (TAS)', path: 'devkitsnes/bin/816-tas' },
    { name: 'Linker (TLD)', path: 'devkitsnes/bin/816-tld' },
    { name: 'Audio Converter (BRR)', path: 'devkitsnes/bin/snesbrr' },
    { name: 'Graphics Converter', path: 'devkitsnes/bin/pcx2snes' },
    { name: 'Map Converter', path: 'devkitsnes/bin/tmx2snes' },
    { name: 'Font Converter', path: 'devkitsnes/bin/gfx2snes' },
    { name: 'Object Tool', path: 'devkitsnes/bin/816-obj' },
  ];

  const validations = await validateComponents(installPath, tools, verbose);

  // Check if tools are executable (Unix-like systems)
  for (const validation of validations) {
    if (validation.found) {
      try {
        const stats = await fs.stat(join(installPath, validation.path));
        // Check if file has execute permissions (Unix-like systems)
        validation.executable = (stats.mode & parseInt('111', 8)) !== 0;
      } catch {
        validation.executable = false;
      }
    }
  }

  return validations;
}

async function validateExampleProjects(
  installPath: string,
  verbose: boolean
): Promise<ComponentValidation[]> {
  const examples = [
    { name: 'Basic Hello World', path: 'snes-examples/hello' },
    { name: 'Graphics Demo', path: 'snes-examples/graphics' },
    { name: 'Sprite Demo', path: 'snes-examples/sprites' },
    { name: 'Sound Demo', path: 'snes-examples/audio' },
    { name: 'Input Demo', path: 'snes-examples/input' },
    { name: 'Advanced Examples', path: 'snes-examples/advanced' },
  ];

  return await validateComponents(installPath, examples, verbose);
}

async function validateComponents(
  installPath: string,
  components: { name: string; path: string }[],
  verbose: boolean
): Promise<ComponentValidation[]> {
  const results: ComponentValidation[] = [];

  for (const component of components) {
    const fullPath = join(installPath, component.path);
    const validation: ComponentValidation = {
      name: component.name,
      path: component.path,
      found: false,
    };

    try {
      const stats = await fs.stat(fullPath);
      validation.found = true;

      if (verbose) {
        validation.size = stats.size;
        validation.lastModified = stats.mtime.toISOString();
      }
    } catch {
      validation.found = false;
    }

    results.push(validation);
  }

  return results;
}

function generateValidationInsights(
  components: ComponentValidation[],
  tools: ComponentValidation[],
  examples: ComponentValidation[],
  issues: string[],
  recommendations: string[]
): void {
  // Check for critical missing components
  const missingCritical = components.filter(
    c =>
      !c.found && (c.name.includes('Header') || c.name.includes('Build System'))
  );

  if (missingCritical.length > 0) {
    issues.push(
      `Missing critical components: ${missingCritical.map(c => c.name).join(', ')}`
    );
  }

  // Check for missing tools
  const missingTools = tools.filter(t => !t.found);
  if (missingTools.length > 0) {
    issues.push(
      `Missing development tools: ${missingTools.map(t => t.name).join(', ')}`
    );
  }

  // Check for non-executable tools
  const nonExecutableTools = tools.filter(
    t => t.found && t.executable === false
  );
  if (nonExecutableTools.length > 0) {
    issues.push(
      `Non-executable tools detected: ${nonExecutableTools.map(t => t.name).join(', ')}`
    );
    recommendations.push(
      'Run: chmod +x devkitsnes/bin/* to make tools executable'
    );
  }

  // Recommendations based on missing examples
  const missingExamples = examples.filter(e => !e.found);
  if (missingExamples.length > 0) {
    recommendations.push(
      'Consider installing example projects for learning and reference'
    );
  }

  // General recommendations
  if (components.some(c => !c.found) || tools.some(t => !t.found)) {
    recommendations.push(
      'Run: pvsneslib_install_sdk --force-reinstall to repair installation'
    );
  }
}

function generateValidationSummary(
  success: boolean,
  completeness: number,
  installPath: string,
  version: string
): string {
  const status = success ? '✅ VALID' : '❌ INVALID';
  const emoji = completeness >= 90 ? '🎮' : completeness >= 70 ? '⚠️' : '💥';

  return `${emoji} PVSnesLib Installation ${status} - ${completeness}% Complete (v${version}) at ${installPath}`;
}

function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('🔍 PVSnesLib Installation Validation Report');
  lines.push('='.repeat(55));
  lines.push('');

  lines.push(`${result.summary}`);
  lines.push('');

  lines.push(`📁 Installation Path: ${result.installPath}`);
  lines.push(`📊 Completeness: ${result.completeness}%`);
  lines.push(`🔢 Version: ${result.version}`);
  lines.push('');

  // Core Components Section
  if (result.components.length > 0) {
    lines.push('📦 Core Components:');
    for (const component of result.components) {
      const status = component.found ? '✅' : '❌';
      lines.push(`   ${status} ${component.name}`);
    }
    lines.push('');
  }

  // Tools Section
  if (result.tools.length > 0) {
    lines.push('🔧 Development Tools:');
    for (const tool of result.tools) {
      let status = tool.found ? '✅' : '❌';
      if (tool.found && tool.executable === false) {
        status = '⚠️'; // Found but not executable
      }
      lines.push(`   ${status} ${tool.name}`);
    }
    lines.push('');
  }

  // Examples Section
  if (result.examples.length > 0) {
    lines.push('📚 Example Projects:');
    for (const example of result.examples) {
      const status = example.found ? '✅' : '❌';
      lines.push(`   ${status} ${example.name}`);
    }
    lines.push('');
  }

  // Issues Section
  if (result.issues.length > 0) {
    lines.push('⚠️ Issues Found:');
    for (const issue of result.issues) {
      lines.push(`   • ${issue}`);
    }
    lines.push('');
  }

  // Recommendations Section
  if (result.recommendations.length > 0) {
    lines.push('💡 Recommendations:');
    for (const rec of result.recommendations) {
      lines.push(`   • ${rec}`);
    }
    lines.push('');
  }

  if (result.success) {
    lines.push('🚀 Installation is ready for SNES development! 🎮✨');
  } else {
    lines.push(
      '🔧 Please address the issues above before proceeding with development.'
    );
  }

  return lines.join('\n');
}

export const pvsnesLibValidateInstallTool: ToolHandler = {
  name: 'pvsneslib_validate_install',
  description: 'Validate PVSnesLib SDK installation completeness and integrity',
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'The action to perform (must be "validate_install")',
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
      name: 'verbose',
      type: 'boolean',
      description: 'Include detailed file information',
      required: false,
    },
    {
      name: 'checkExamples',
      type: 'boolean',
      description: 'Validate example projects',
      required: false,
    },
    {
      name: 'validateTools',
      type: 'boolean',
      description: 'Validate development tools',
      required: false,
    },
  ],
  execute: async (params: any) => {
    try {
      if (params.action !== 'validate_install') {
        throw new Error('Invalid action. Must be "validate_install"');
      }

      const request: ValidationRequest = {
        installPath: params.installPath,
        verbose: params.verbose || false,
        checkExamples: params.checkExamples !== false, // Default to true
        validateTools: params.validateTools !== false, // Default to true
      };

      const result = await validatePVSnesLibInstallation(request);
      const formattedResult = formatValidationResult(result);

      return {
        success: result.success,
        content: formattedResult,
        metadata: {
          installPath: result.installPath,
          version: result.version,
          completeness: result.completeness,
          componentsFound: result.components.filter(c => c.found).length,
          componentsTotal: result.components.length,
          toolsFound: result.tools.filter(t => t.found).length,
          toolsTotal: result.tools.length,
          issuesCount: result.issues.length,
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
