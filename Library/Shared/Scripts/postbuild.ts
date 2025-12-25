#!/usr/bin/env bun
/**
 * Post-build script for mikochat desktop application
 * 
 * This script runs after `cargo build --release` and:
 * 1. Copies the built executables to Distribution/Package
 * 2. Copies the WebView2 runtime to Distribution/Package
 * 3. Prepares the distribution package for deployment
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

const PROJECT_ROOT = join(import.meta.dir, '../../..');
const TARGET_RELEASE_DIR = join(PROJECT_ROOT, 'target/release');
const RUNTIME_DIR = join(PROJECT_ROOT, 'Runtime/Microsoft.WebView2.143.0.3650.96.x64');
const DISTRIBUTION_PACKAGE_DIR = join(PROJECT_ROOT, 'Distribution/Package');

console.log('🚀 Starting post-build process...');
console.log(`Project root: ${PROJECT_ROOT}`);
console.log(`Target release dir: ${TARGET_RELEASE_DIR}`);
console.log(`Runtime dir: ${RUNTIME_DIR}`);
console.log(`Distribution package dir: ${DISTRIBUTION_PACKAGE_DIR}`);

/**
 * Recursively copy a directory
 */
function copyDirectory(src: string, dest: string): void {
    if (!existsSync(src)) {
        console.warn(`⚠️  Source directory does not exist: ${src}`);
        return;
    }

    if (!existsSync(dest)) {
        mkdirSync(dest, { recursive: true });
    }

    const entries = readdirSync(src);
    
    for (const entry of entries) {
        const srcPath = join(src, entry);
        const destPath = join(dest, entry);
        const stat = statSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Copy a single file with error handling
 */
function copyFile(src: string, dest: string, description: string): boolean {
    try {
        if (!existsSync(src)) {
            console.error(`❌ ${description} not found: ${src}`);
            return false;
        }

        // Ensure destination directory exists
        const destDir = dirname(dest);
        if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
        }

        copyFileSync(src, dest);
        console.log(`✅ Copied ${description}: ${src} -> ${dest}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to copy ${description}: ${error}`);
        return false;
    }
}

/**
 * Main post-build process
 */
function main(): void {
    console.log('\n📦 Preparing Distribution/Package directory...');
    
    // Ensure Distribution/Package directory exists
    if (!existsSync(DISTRIBUTION_PACKAGE_DIR)) {
        mkdirSync(DISTRIBUTION_PACKAGE_DIR, { recursive: true });
        console.log(`✅ Created directory: ${DISTRIBUTION_PACKAGE_DIR}`);
    }

    console.log('\n📋 Copying executables...');
    
    // Copy mikochat.exe
    const mikochatSrc = join(TARGET_RELEASE_DIR, 'mikochat.exe');
    const mikochatDest = join(DISTRIBUTION_PACKAGE_DIR, 'mikochat.exe');
    const mikochatCopied = copyFile(mikochatSrc, mikochatDest, 'mikochat.exe');

    // Copy mikoproxy.exe
    const mikoproxySrc = join(TARGET_RELEASE_DIR, 'mikoproxy.exe');
    const mikoproxyDest = join(DISTRIBUTION_PACKAGE_DIR, 'mikoproxy.exe');
    const mikoproxyCopied = copyFile(mikoproxySrc, mikoproxyDest, 'mikoproxy.exe');

    console.log('\n🌐 Copying WebView2 runtime...');
    
    // Copy WebView2 runtime
    if (existsSync(RUNTIME_DIR)) {
        try {
            copyDirectory(RUNTIME_DIR, DISTRIBUTION_PACKAGE_DIR);
            console.log(`✅ Copied WebView2 runtime: ${RUNTIME_DIR} -> ${DISTRIBUTION_PACKAGE_DIR}`);
        } catch (error) {
            console.error(`❌ Failed to copy WebView2 runtime: ${error}`);
        }
    } else {
        console.error(`❌ WebView2 runtime directory not found: ${RUNTIME_DIR}`);
    }

    console.log('\n📊 Post-build summary:');
    console.log(`   mikochat.exe: ${mikochatCopied ? '✅' : '❌'}`);
    console.log(`   mikoproxy.exe: ${mikoproxyCopied ? '✅' : '❌'}`);
    console.log(`   WebView2 runtime: ${existsSync(RUNTIME_DIR) ? '✅' : '❌'}`);

    // List contents of Distribution/Package
    if (existsSync(DISTRIBUTION_PACKAGE_DIR)) {
        console.log('\n📁 Distribution/Package contents:');
        try {
            const contents = readdirSync(DISTRIBUTION_PACKAGE_DIR);
            contents.forEach(item => {
                const itemPath = join(DISTRIBUTION_PACKAGE_DIR, item);
                const stat = statSync(itemPath);
                const type = stat.isDirectory() ? '📁' : '📄';
                console.log(`   ${type} ${item}`);
            });
        } catch (error) {
            console.error(`❌ Failed to list directory contents: ${error}`);
        }
    }

    console.log('\n🎉 Post-build process completed!');
    
    // Optional: Build installer if Inno Setup is available
    console.log('\n📦 Checking for Inno Setup...');
    try {
        const issPath = join(PROJECT_ROOT, 'Library/Resources/build.iss');
        if (existsSync(issPath)) {
            console.log('✅ Inno Setup script found at:', issPath);
            console.log('💡 To build installer, run: iscc "Library/Resources/build.iss"');
        } else {
            console.log('⚠️  Inno Setup script not found');
        }
    } catch (error) {
        console.log('⚠️  Could not check for Inno Setup script:', error);
    }
}

// Run the main function
main();