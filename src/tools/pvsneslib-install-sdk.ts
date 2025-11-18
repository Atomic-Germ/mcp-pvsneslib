import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolHandler } from '../types/index.js';

const execAsync = promisify(exec);

interface InstallationOptions {
  version: string;
  installPath: string;
  offline: boolean;
  archiveUrl?: string;
  forceReinstall: boolean;
}

interface InstallationResult {
  success: boolean;
  version: string;
  installPath: string;
  components: string[];
  size: number;
  configPath: string;
  nextSteps: string[];
}

async function installPVSnesLibSDK(options: InstallationOptions): Promise<InstallationResult> {
  const { version, installPath, offline, archiveUrl, forceReinstall } = options;
  
  const fullInstallPath = resolve(installPath, `pvsneslib-${version}`);
  const vendorPath = resolve(installPath, '..');
  
  // Create vendor directory if it doesn't exist
  await fs.mkdir(vendorPath, { recursive: true });

  // Check if already installed
  if (!forceReinstall && await checkExistingInstallation(fullInstallPath)) {
    const existingResult = await validateExistingInstallation(fullInstallPath, version);
    if (existingResult.success) {
      return existingResult;
    }
  }

  let downloadPath: string;
  
  if (offline && archiveUrl) {
    // Use provided local archive
    downloadPath = archiveUrl;
  } else {
    // Download from GitHub
    downloadPath = await downloadPVSnesLib(version, vendorPath);
  }

  // Extract the archive
  await extractPVSnesLib(downloadPath, fullInstallPath);

  // Validate installation
  const components = await validateInstallation(fullInstallPath);
  
  // Update project configuration
  const configPath = await updateProjectConfig(fullInstallPath, version);
  
  // Calculate installation size
  const size = await calculateInstallationSize(fullInstallPath);

  return {
    success: true,
    version,
    installPath: fullInstallPath,
    components,
    size,
    configPath,
    nextSteps: [
      'Run: pvsneslib_validate_install to verify the installation',
      'Run: pvsneslib_configure_tools to set up the toolchain',
      'Run: pvsneslib_build_config to generate build system integration',
    ],
  };
}

async function checkExistingInstallation(installPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(installPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function validateExistingInstallation(
  installPath: string,
  expectedVersion: string
): Promise<InstallationResult> {
  try {
    // Check for key PVSnesLib files
    const requiredFiles = [
      'include/snes/snes.h',
      'lib/build/Makefile.pvsneslib',
      'devkitsnes/bin/816-tcc',
    ];

    const components: string[] = [];
    
    for (const file of requiredFiles) {
      const filePath = join(installPath, file);
      try {
        await fs.access(filePath);
        components.push(file);
      } catch {
        // File missing, installation is incomplete
        throw new Error(`Missing required file: ${file}`);
      }
    }

    const size = await calculateInstallationSize(installPath);
    const configPath = join(process.cwd(), 'project.env');

    return {
      success: true,
      version: expectedVersion,
      installPath,
      components,
      size,
      configPath,
      nextSteps: ['PVSnesLib is already installed and validated'],
    };
  } catch (error) {
    throw new Error(`Existing installation is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function downloadPVSnesLib(version: string, downloadDir: string): Promise<string> {
  // Determine platform-specific release URL
  const platform = process.platform;
  let releaseFile: string;
  
  switch (platform) {
    case 'linux':
      releaseFile = `pvsneslib_430_64b_linux_release.zip`;
      break;
    case 'win32':
      releaseFile = `pvsneslib_430_64b_windows_release.zip`;
      break;
    case 'darwin':
      releaseFile = `pvsneslib_430_64b_darwin_release.zip`;
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}. Supported platforms: linux, windows, darwin`);
  }
  
  const downloadUrl = `https://github.com/alekmaul/pvsneslib/releases/download/${version}/${releaseFile}`;
  const downloadPath = join(downloadDir, releaseFile);

  try {
    // Check if curl or wget is available
    const hasCurl = await checkCommandExists('curl');
    const hasWget = await checkCommandExists('wget');

    if (!hasCurl && !hasWget) {
      throw new Error('Neither curl nor wget is available for downloading');
    }

    if (hasCurl) {
      await execAsync(`curl -L -o "${downloadPath}" "${downloadUrl}"`);
    } else if (hasWget) {
      await execAsync(`wget -O "${downloadPath}" "${downloadUrl}"`);
    }

    // Verify download
    const stat = await fs.stat(downloadPath);
    if (stat.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    return downloadPath;
  } catch (error) {
    throw new Error(`Failed to download PVSnesLib: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function extractPVSnesLib(archivePath: string, extractPath: string): Promise<void> {
  try {
    // Create extraction directory
    await fs.mkdir(extractPath, { recursive: true });

    // Determine extraction method based on file extension
    const isZip = archivePath.endsWith('.zip');
    
    if (isZip) {
      // Check if unzip is available
      const hasUnzip = await checkCommandExists('unzip');
      
      if (!hasUnzip) {
        throw new Error('unzip command not found - required for ZIP extraction');
      }

      // Extract ZIP file to a temporary location first
      const tempDir = join(extractPath, '..', 'temp_extract');
      await fs.mkdir(tempDir, { recursive: true });
      
      await execAsync(`unzip -q "${archivePath}" -d "${tempDir}"`);
      
      // Check if the ZIP contains a pvsneslib subdirectory and move contents up
      const tempContents = await fs.readdir(tempDir);
      
      if (tempContents.length === 1 && tempContents[0] === 'pvsneslib') {
        // Move contents from pvsneslib subdirectory to target directory
        await execAsync(`mv "${tempDir}/pvsneslib/"* "${extractPath}/"`);
        await execAsync(`mv "${tempDir}/pvsneslib/".[!.]* "${extractPath}/" 2>/dev/null || true`);
      } else {
        // Move all contents directly
        await execAsync(`mv "${tempDir}/"* "${extractPath}/"`);
        await execAsync(`mv "${tempDir}/".[!.]* "${extractPath}/" 2>/dev/null || true`);
      }
      
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    } else {
      // Handle tar.gz (fallback for source archives)
      const hasTar = await checkCommandExists('tar');
      
      if (!hasTar) {
        throw new Error('tar command not found - required for tar.gz extraction');
      }

      // Extract using tar
      const tempDir = join(extractPath, '..', 'temp_extract');
      await fs.mkdir(tempDir, { recursive: true });

      await execAsync(`tar -xzf "${archivePath}" -C "${tempDir}" --strip-components=1`);

      // Move contents from temp directory to final location
      await execAsync(`cp -r "${tempDir}/"* "${extractPath}/"`);
      
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    
    // Clean up downloaded archive
    await fs.rm(archivePath, { force: true });

  } catch (error) {
    throw new Error(`Failed to extract PVSnesLib: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validateInstallation(installPath: string): Promise<string[]> {
  const components: string[] = [];
  
  // Check for essential PVSnesLib components
  const requiredComponents = [
    { path: 'include/snes/snes.h', name: 'SNES Headers' },
    { path: 'lib/build/Makefile.pvsneslib', name: 'Build System' },
    { path: 'devkitsnes/bin/816-tcc', name: 'Compiler' },
    { path: 'devkitsnes/bin/snesbrr', name: 'Audio Tools' },
    { path: 'devkitsnes/bin/pcx2snes', name: 'Graphics Tools' },
    { path: 'lib/crt0_snes.asm', name: 'Runtime Library' },
  ];

  for (const component of requiredComponents) {
    const componentPath = join(installPath, component.path);
    try {
      await fs.access(componentPath);
      components.push(component.name);
    } catch {
      // Component missing - this might be okay for some optional components
      console.warn(`Warning: ${component.name} not found at ${component.path}`);
    }
  }

  if (components.length === 0) {
    throw new Error('No valid PVSnesLib components found in installation');
  }

  return components;
}

async function updateProjectConfig(installPath: string, version: string): Promise<string> {
  const configPath = join(process.cwd(), 'project.env');
  
  try {
    // Read existing config if it exists
    let config = '';
    try {
      config = await fs.readFile(configPath, 'utf-8');
    } catch {
      // File doesn't exist, start fresh
    }

    // Update or add PVSnesLib configuration lines
    const configLines = config.split('\n');
    const newLines: string[] = [];
    
    let pvsnesLibPathSet = false;
    let pvsnesLibVersionSet = false;

    for (const line of configLines) {
      if (line.startsWith('PVSNESLIB=')) {
        newLines.push(`PVSNESLIB=${installPath}`);
        pvsnesLibPathSet = true;
      } else if (line.startsWith('PVSNESLIB_VERSION=')) {
        newLines.push(`PVSNESLIB_VERSION=${version}`);
        pvsnesLibVersionSet = true;
      } else {
        newLines.push(line);
      }
    }

    // Add missing configuration lines
    if (!pvsnesLibPathSet) {
      newLines.push(`PVSNESLIB=${installPath}`);
    }
    if (!pvsnesLibVersionSet) {
      newLines.push(`PVSNESLIB_VERSION=${version}`);
    }

    // Add SDK installation marker
    newLines.push(`# PVSnesLib SDK installed on ${new Date().toISOString()}`);

    await fs.writeFile(configPath, newLines.join('\n'));
    return configPath;
  } catch (error) {
    throw new Error(`Failed to update project configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function calculateInstallationSize(installPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`du -sb "${installPath}"`);
    const sizeMatch = stdout.match(/^(\d+)/);
    return sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
  } catch {
    // Fallback: try to estimate size by counting files
    try {
      const { stdout } = await execAsync(`find "${installPath}" -type f | wc -l`);
      const fileCount = parseInt(stdout.trim(), 10);
      return fileCount * 10000; // Rough estimate: 10KB per file
    } catch {
      return 0;
    }
  }
}

async function checkCommandExists(command: string): Promise<boolean> {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

function formatInstallationResult(result: InstallationResult): string {
  const lines: string[] = [];
  
  lines.push('🎮 PVSnesLib SDK Installation Complete!');
  lines.push('=' .repeat(50));
  lines.push('');
  
  lines.push(`✅ Version: ${result.version}`);
  lines.push(`📁 Install Path: ${result.installPath}`);
  lines.push(`💾 Size: ${(result.size / (1024 * 1024)).toFixed(1)} MB`);
  lines.push(`⚙️  Config Updated: ${result.configPath}`);
  lines.push('');
  
  lines.push('📦 Installed Components:');
  for (const component of result.components) {
    lines.push(`   • ${component}`);
  }
  lines.push('');
  
  lines.push('🚀 Next Steps:');
  for (let i = 0; i < result.nextSteps.length; i++) {
    lines.push(`   ${i + 1}. ${result.nextSteps[i]}`);
  }
  lines.push('');
  
  lines.push('Ready to develop SNES games with PVSnesLib! 🎮✨');
  
  return lines.join('\n');
}

export const pvsnesLibInstallSDKTool: ToolHandler = {
  name: 'pvsneslib_install_sdk',
  description: 'Download and install PVSnesLib SDK for SNES development',
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'The action to perform (must be "install_sdk")',
      required: true,
    },
    {
      name: 'version',
      type: 'string',
      description: 'PVSnesLib version to install (e.g., "4.3.0")',
      required: false,
    },
    {
      name: 'installPath',
      type: 'string',
      description: 'Installation directory (default: "./vendor")',
      required: false,
    },
    {
      name: 'offline',
      type: 'boolean',
      description: 'Use offline installation (requires archiveUrl)',
      required: false,
    },
    {
      name: 'archiveUrl',
      type: 'string',
      description: 'Path to local PVSnesLib archive (for offline installation)',
      required: false,
    },
    {
      name: 'forceReinstall',
      type: 'boolean',
      description: 'Force reinstallation even if already installed',
      required: false,
    },
  ],
  execute: async (params: any) => {
    try {
      if (params.action !== 'install_sdk') {
        throw new Error('Invalid action. Must be "install_sdk"');
      }

      const options: InstallationOptions = {
        version: params.version || '4.3.0',
        installPath: params.installPath || './vendor',
        offline: params.offline || false,
        archiveUrl: params.archiveUrl,
        forceReinstall: params.forceReinstall || false,
      };

      // Validate offline installation
      if (options.offline && !options.archiveUrl) {
        throw new Error('archiveUrl is required for offline installation');
      }

      const result = await installPVSnesLibSDK(options);
      const formattedResult = formatInstallationResult(result);

      return {
        success: true,
        content: formattedResult,
        metadata: {
          version: result.version,
          installPath: result.installPath,
          components: result.components,
          sizeMB: Math.round(result.size / (1024 * 1024)),
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