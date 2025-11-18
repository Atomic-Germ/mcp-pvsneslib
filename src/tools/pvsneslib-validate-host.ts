import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolHandler } from '../types/index.js';

const execAsync = promisify(exec);

interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  diskSpace?: number;
  hasInternet?: boolean;
  hasGit?: boolean;
  hasMake?: boolean;
  writableDir?: boolean;
}

interface ValidationResult {
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  details?: string;
  suggestion?: string;
}

interface HostValidationReport {
  overall: 'PASS' | 'WARN' | 'FAIL';
  system: ValidationResult;
  prerequisites: ValidationResult[];
  permissions: ValidationResult;
  network: ValidationResult;
  storage: ValidationResult;
  summary: string;
  nextSteps: string[];
}

async function validateHost(): Promise<HostValidationReport> {
  const report: HostValidationReport = {
    overall: 'PASS',
    system: { status: 'PASS', message: '' },
    prerequisites: [],
    permissions: { status: 'PASS', message: '' },
    network: { status: 'PASS', message: '' },
    storage: { status: 'PASS', message: '' },
    summary: '',
    nextSteps: [],
  };

  // Gather system information
  const systemInfo = await getSystemInfo();

  // Validate system compatibility
  report.system = await validateSystem(systemInfo);

  // Validate prerequisites
  report.prerequisites = await validatePrerequisites();

  // Validate permissions
  report.permissions = await validatePermissions();

  // Validate network connectivity
  report.network = await validateNetwork();

  // Validate storage
  report.storage = await validateStorage();

  // Determine overall status
  const allResults = [
    report.system,
    ...report.prerequisites,
    report.permissions,
    report.network,
    report.storage,
  ];

  if (allResults.some((r) => r.status === 'FAIL')) {
    report.overall = 'FAIL';
  } else if (allResults.some((r) => r.status === 'WARN')) {
    report.overall = 'WARN';
  }

  // Generate summary and next steps
  report.summary = generateSummary(report);
  report.nextSteps = generateNextSteps(report);

  return report;
}

async function getSystemInfo(): Promise<SystemInfo> {
  const platform = process.platform;
  const arch = process.arch;
  const nodeVersion = process.version;

  const info: SystemInfo = {
    platform,
    arch,
    nodeVersion,
  };

  try {
    // Check available disk space (in current directory)
    const stats = await fs.statfs('.');
    info.diskSpace = stats.bavail * stats.bsize;
  } catch {
    // Ignore disk space check failure
  }

  return info;
}

async function validateSystem(systemInfo: SystemInfo): Promise<ValidationResult> {
  const { platform, arch, nodeVersion } = systemInfo;

  // Check supported platforms
  const supportedPlatforms = ['darwin', 'linux', 'win32'];
  if (!supportedPlatforms.includes(platform)) {
    return {
      status: 'FAIL',
      message: `Unsupported platform: ${platform}`,
      suggestion: 'PVSnesLib development requires Windows, macOS, or Linux',
    };
  }

  // Check Node.js version
  const majorVersion = parseInt(nodeVersion.substring(1), 10);
  if (majorVersion < 18) {
    return {
      status: 'FAIL',
      message: `Node.js ${nodeVersion} is too old`,
      suggestion: 'Upgrade to Node.js 18 or later',
    };
  }

  // Windows-specific checks
  if (platform === 'win32') {
    try {
      // Check if we're in a POSIX-compatible environment
      await execAsync('uname');
      return {
        status: 'PASS',
        message: `Compatible system: ${platform} (${arch}) with POSIX environment`,
        details: `Node.js ${nodeVersion}`,
      };
    } catch {
      return {
        status: 'WARN',
        message: `Windows detected without POSIX environment`,
        suggestion: 'Install MSYS2, WSL, or Git Bash for better compatibility',
      };
    }
  }

  return {
    status: 'PASS',
    message: `Compatible system: ${platform} (${arch})`,
    details: `Node.js ${nodeVersion}`,
  };
}

async function validatePrerequisites(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check for git
  const gitResult = await checkCommand('git', 'git --version');
  results.push({
    status: gitResult.found ? 'PASS' : 'WARN',
    message: gitResult.found ? 'Git is available' : 'Git not found',
    details: gitResult.version,
    suggestion: gitResult.found ? undefined : 'Install Git for version control and SDK downloads',
  });

  // Check for make
  const makeResult = await checkCommand('make', 'make --version');
  results.push({
    status: makeResult.found ? 'PASS' : 'FAIL',
    message: makeResult.found ? 'Make is available' : 'Make not found',
    details: makeResult.version,
    suggestion: makeResult.found ? undefined : 'Install make (build-essential on Ubuntu, Xcode tools on macOS)',
  });

  // Check for curl or wget (for downloads)
  const curlResult = await checkCommand('curl', 'curl --version');
  const wgetResult = await checkCommand('wget', 'wget --version');
  
  if (curlResult.found || wgetResult.found) {
    results.push({
      status: 'PASS',
      message: 'Download tool available',
      details: curlResult.found ? curlResult.version : wgetResult.version,
    });
  } else {
    results.push({
      status: 'WARN',
      message: 'No download tool found',
      suggestion: 'Install curl or wget for automatic downloads',
    });
  }

  // Check for unzip/tar (for extraction)
  const unzipResult = await checkCommand('unzip', 'unzip -h');
  const tarResult = await checkCommand('tar', 'tar --version');
  
  if (unzipResult.found || tarResult.found) {
    results.push({
      status: 'PASS',
      message: 'Archive extraction tool available',
      details: unzipResult.found ? 'unzip' : 'tar',
    });
  } else {
    results.push({
      status: 'FAIL',
      message: 'No archive extraction tool found',
      suggestion: 'Install unzip or ensure tar is available',
    });
  }

  return results;
}

async function checkCommand(command: string, testCommand: string): Promise<{ found: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(testCommand);
    return {
      found: true,
      version: stdout.split('\n')[0].trim(),
    };
  } catch {
    return { found: false };
  }
}

async function validatePermissions(): Promise<ValidationResult> {
  try {
    // Test if we can create and write files in current directory
    const testFile = '.pvsneslib_permission_test';
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);

    // Test if we can create directories
    const testDir = '.pvsneslib_dir_test';
    await fs.mkdir(testDir);
    await fs.rmdir(testDir);

    return {
      status: 'PASS',
      message: 'Write permissions available in current directory',
    };
  } catch (error) {
    return {
      status: 'FAIL',
      message: 'Cannot write to current directory',
      details: error instanceof Error ? error.message : String(error),
      suggestion: 'Check directory permissions or choose a different location',
    };
  }
}

async function validateNetwork(): Promise<ValidationResult> {
  try {
    // Try to reach GitHub (where PVSnesLib is hosted)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.github.com/repos/alekmaul/pvsneslib', {
      signal: controller.signal,
      method: 'HEAD',
    });
    
    clearTimeout(timeout);

    if (response.ok) {
      return {
        status: 'PASS',
        message: 'Internet connectivity confirmed',
        details: 'GitHub API accessible',
      };
    } else {
      return {
        status: 'WARN',
        message: 'Limited internet connectivity',
        details: `GitHub returned status ${response.status}`,
        suggestion: 'Check firewall settings or use offline installation',
      };
    }
  } catch (error) {
    return {
      status: 'WARN',
      message: 'Cannot verify internet connectivity',
      details: error instanceof Error ? error.message : String(error),
      suggestion: 'Check internet connection or use offline installation methods',
    };
  }
}

async function validateStorage(): Promise<ValidationResult> {
  try {
    const stats = await fs.statfs('.');
    const availableBytes = stats.bavail * stats.bsize;
    const availableMB = Math.floor(availableBytes / (1024 * 1024));

    // PVSnesLib + toolchain needs roughly 100-200MB
    const requiredMB = 200;

    if (availableMB >= requiredMB) {
      return {
        status: 'PASS',
        message: 'Sufficient disk space available',
        details: `${availableMB}MB available`,
      };
    } else {
      return {
        status: 'WARN',
        message: 'Low disk space',
        details: `Only ${availableMB}MB available, need ~${requiredMB}MB`,
        suggestion: 'Free up disk space before installing PVSnesLib',
      };
    }
  } catch {
    return {
      status: 'WARN',
      message: 'Cannot check disk space',
      suggestion: 'Ensure you have at least 200MB available',
    };
  }
}

function generateSummary(report: HostValidationReport): string {
  const { overall } = report;
  
  if (overall === 'PASS') {
    return '✅ Host validation PASSED - System is ready for PVSnesLib development';
  } else if (overall === 'WARN') {
    return '⚠️  Host validation completed with WARNINGS - Development possible with limitations';
  } else {
    return '❌ Host validation FAILED - Critical issues must be resolved before continuing';
  }
}

function generateNextSteps(report: HostValidationReport): string[] {
  const steps: string[] = [];

  if (report.overall === 'PASS') {
    steps.push('Run: pvsneslib_install_sdk to download and install PVSnesLib');
    steps.push('Run: pvsneslib_configure_tools to set up the toolchain');
  } else {
    // Collect all suggestions from failed/warning results
    const allResults = [
      report.system,
      ...report.prerequisites,
      report.permissions,
      report.network,
      report.storage,
    ];

    for (const result of allResults) {
      if (result.status !== 'PASS' && result.suggestion) {
        steps.push(result.suggestion);
      }
    }

    if (report.overall === 'WARN') {
      steps.push('After addressing warnings, run: pvsneslib_install_sdk');
    } else {
      steps.push('Resolve critical issues before proceeding with PVSnesLib installation');
    }
  }

  return steps;
}

function formatValidationReport(report: HostValidationReport): string {
  const lines: string[] = [];
  
  lines.push('🔍 PVSnesLib Host Validation Report');
  lines.push('=' .repeat(50));
  lines.push('');

  // Overall status
  lines.push(`📋 Overall Status: ${getStatusEmoji(report.overall)} ${report.overall}`);
  lines.push('');

  // System info
  lines.push(`🖥️  System: ${getStatusEmoji(report.system.status)} ${report.system.message}`);
  if (report.system.details) {
    lines.push(`   ${report.system.details}`);
  }
  lines.push('');

  // Prerequisites
  lines.push('🔧 Prerequisites:');
  for (const prereq of report.prerequisites) {
    lines.push(`   ${getStatusEmoji(prereq.status)} ${prereq.message}`);
    if (prereq.details) {
      lines.push(`     ${prereq.details}`);
    }
  }
  lines.push('');

  // Permissions
  lines.push(`📁 Permissions: ${getStatusEmoji(report.permissions.status)} ${report.permissions.message}`);
  lines.push('');

  // Network
  lines.push(`🌐 Network: ${getStatusEmoji(report.network.status)} ${report.network.message}`);
  if (report.network.details) {
    lines.push(`   ${report.network.details}`);
  }
  lines.push('');

  // Storage
  lines.push(`💾 Storage: ${getStatusEmoji(report.storage.status)} ${report.storage.message}`);
  if (report.storage.details) {
    lines.push(`   ${report.storage.details}`);
  }
  lines.push('');

  // Summary
  lines.push('📝 Summary:');
  lines.push(`   ${report.summary}`);
  lines.push('');

  // Next steps
  if (report.nextSteps.length > 0) {
    lines.push('🚀 Next Steps:');
    for (let i = 0; i < report.nextSteps.length; i++) {
      lines.push(`   ${i + 1}. ${report.nextSteps[i]}`);
    }
  }

  return lines.join('\n');
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'PASS': return '✅';
    case 'WARN': return '⚠️ ';
    case 'FAIL': return '❌';
    default: return '❓';
  }
}

export const pvsnesLibValidateHostTool: ToolHandler = {
  name: 'pvsneslib_validate_host',
  description: 'Validate host system requirements for PVSnesLib development before installation',
  parameters: [
    {
      name: 'action',
      type: 'string', 
      description: 'The action to perform (must be "validate_host")',
      required: true,
    },
    {
      name: 'verbose',
      type: 'boolean',
      description: 'Show detailed validation information',
      required: false,
    },
  ],
  execute: async (params: any) => {
    try {
      if (params.action !== 'validate_host') {
        throw new Error('Invalid action. Must be "validate_host"');
      }

      const report = await validateHost();
      const formattedReport = formatValidationReport(report);

      return {
        success: true,
        content: formattedReport,
        metadata: {
          overall: report.overall,
          systemCompatible: report.system.status,
          prerequisitesSatisfied: report.prerequisites.every(p => p.status === 'PASS'),
          canProceed: report.overall !== 'FAIL',
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