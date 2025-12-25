#!/usr/bin/env bun
/**
 * Installer build script for Miko Workspace
 * 
 * This script builds the Windows installer using Inno Setup.
 * Prerequisites: Inno Setup must be installed on the system.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const PROJECT_ROOT = join(import.meta.dir, '../../..');
const ISS_SCRIPT_PATH = join(PROJECT_ROOT, 'Library/Resources/build.iss');
const DISTRIBUTION_DIR = join(PROJECT_ROOT, 'Distribution');

console.log('🔧 Building Windows Installer...');
console.log(`Project root: ${PROJECT_ROOT}`);
console.log(`Inno Setup script: ${ISS_SCRIPT_PATH}`);

/**
 * Check if Inno Setup is installed and available
 */
function checkInnoSetup(): Promise<boolean> {
    return new Promise((resolve) => {
        const iscc = spawn('iscc', ['/?'], { shell: true });
        
        iscc.on('close', (code) => {
            resolve(code === 0);
        });
        
        iscc.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * Build the installer using Inno Setup
 */
function buildInstaller(): Promise<boolean> {
    return new Promise((resolve, reject) => {
        console.log('🚀 Running Inno Setup compiler...');
        
        const iscc = spawn('iscc', [ISS_SCRIPT_PATH], { 
            shell: true,
            stdio: 'inherit'
        });
        
        iscc.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Installer built successfully!');
                resolve(true);
            } else {
                console.error(`❌ Inno Setup compiler failed with exit code: ${code}`);
                resolve(false);
            }
        });
        
        iscc.on('error', (error) => {
            console.error(`❌ Failed to run Inno Setup compiler: ${error.message}`);
            reject(error);
        });
    });
}

/**
 * Main build process
 */
async function main(): Promise<void> {
    try {
        // Check if the ISS script exists
        if (!existsSync(ISS_SCRIPT_PATH)) {
            console.error(`❌ Inno Setup script not found: ${ISS_SCRIPT_PATH}`);
            process.exit(1);
        }

        // Check if Distribution/Package exists
        const packageDir = join(PROJECT_ROOT, 'Distribution/Package');
        if (!existsSync(packageDir)) {
            console.error(`❌ Distribution package not found: ${packageDir}`);
            console.error('💡 Run "bun run build" first to create the distribution package');
            process.exit(1);
        }

        // Check if Inno Setup is installed
        console.log('🔍 Checking for Inno Setup...');
        const innoSetupAvailable = await checkInnoSetup();
        
        if (!innoSetupAvailable) {
            console.error('❌ Inno Setup not found or not installed');
            console.error('💡 Please install Inno Setup from: https://jrsoftware.org/isinfo.php');
            console.error('💡 Make sure "iscc.exe" is in your PATH');
            process.exit(1);
        }

        console.log('✅ Inno Setup found');

        // Build the installer
        const success = await buildInstaller();
        
        if (success) {
            console.log('\n🎉 Installer build completed successfully!');
            console.log(`📁 Output directory: ${DISTRIBUTION_DIR}`);
            console.log('📦 Installer file: MikoWorkspaceSetup.exe');
            
            // List the output files
            try {
                const { readdirSync } = await import('fs');
                const files = readdirSync(DISTRIBUTION_DIR);
                const installerFiles = files.filter(f => f.endsWith('.exe'));
                
                if (installerFiles.length > 0) {
                    console.log('\n📋 Generated installer files:');
                    installerFiles.forEach(file => {
                        console.log(`   📦 ${file}`);
                    });
                }
            } catch (error) {
                console.warn('⚠️  Could not list output files:', error);
            }
        } else {
            console.error('\n❌ Installer build failed');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Build process failed:', error);
        process.exit(1);
    }
}

// Run the main function
main();