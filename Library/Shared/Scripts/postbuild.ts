#!/usr/bin/env bun
/**
 * Post-build script for mikochat desktop application
 * 
 * This script runs after `cargo build --release` and:
 * 1. Downloads WebView2 runtime if not found
 * 2. Copies the built executables to Distribution/Package
 * 3. Copies the WebView2 runtime to Distribution/Package
 * 4. Prepares the distribution package for deployment
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';

const PROJECT_ROOT = join(import.meta.dir, '../../..');
const TARGET_RELEASE_DIR = join(PROJECT_ROOT, 'target/release');
const RUNTIME_DIR = join(PROJECT_ROOT, 'Runtime');
const DISTRIBUTION_PACKAGE_DIR = join(PROJECT_ROOT, 'Distribution/Package');

// WebView2 Runtime version and download configuration
const WEBVIEW2_VERSION = 'Microsoft.WebView2.FixedVersionRuntime.143.0.3650.96.x64';
const WEBVIEW2_DOWNLOAD_URL = `https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/74d60186-8d91-4091-8695-fe4d369b7334/${WEBVIEW2_VERSION}.cab`;
const WEBVIEW2_CAB_FILE = join(RUNTIME_DIR, 'webview2-runtime.cab');

console.log('🚀 Starting post-build process...');
console.log(`Project root: ${PROJECT_ROOT}`);
console.log(`Target release dir: ${TARGET_RELEASE_DIR}`);
console.log(`Runtime dir: ${RUNTIME_DIR}`);
console.log(`Distribution package dir: ${DISTRIBUTION_PACKAGE_DIR}`);

/**
 * Download a file from URL
 */
async function downloadFile(url: string, outputPath: string): Promise<boolean> {
    try {
        console.log(`📥 Downloading: ${url}`);
        console.log(`📁 Output: ${outputPath}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const fileStream = createWriteStream(outputPath);
        const reader = response.body?.getReader();
        
        if (!reader) {
            throw new Error('Failed to get response reader');
        }
        
        let downloadedBytes = 0;
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            fileStream.write(Buffer.from(value));
            downloadedBytes += value.length;
            
            if (contentLength > 0) {
                const progress = ((downloadedBytes / contentLength) * 100).toFixed(1);
                process.stdout.write(`\r📊 Progress: ${progress}% (${downloadedBytes}/${contentLength} bytes)`);
            }
        }
        
        fileStream.end();
        console.log(`\n✅ Download completed: ${outputPath}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Download failed: ${error}`);
        return false;
    }
}

/**
 * Extract CAB file using Windows expand command
 */
function extractCabFile(cabPath: string, extractDir: string): Promise<boolean> {
    return new Promise((resolve) => {
        console.log(`📦 Extracting CAB file: ${cabPath}`);
        console.log(`📁 Extract to: ${extractDir}`);
        
        // Ensure extract directory exists
        if (!existsSync(extractDir)) {
            mkdirSync(extractDir, { recursive: true });
        }
        
        // Use Windows expand command to extract CAB file
        const expandProcess = spawn('expand', [cabPath, '-F:*', extractDir], {
            shell: true,
            stdio: 'inherit'
        });
        
        expandProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ CAB file extracted successfully');
                resolve(true);
            } else {
                console.error(`❌ CAB extraction failed with exit code: ${code}`);
                resolve(false);
            }
        });
        
        expandProcess.on('error', (error) => {
            console.error(`❌ CAB extraction error: ${error}`);
            resolve(false);
        });
    });
}

/**
 * Download and extract WebView2 runtime if not found
 */
async function ensureWebView2Runtime(): Promise<boolean> {
    // Check if runtime directory already exists and has WebView2 files
    if (existsSync(RUNTIME_DIR)) {
        // Look for WebView2 files in the runtime directory or its subdirectories
        const runtimeContents = readdirSync(RUNTIME_DIR);
        
        // Check if msedgewebview2.exe exists directly in Runtime
        let msedgeWebView2Exe = join(RUNTIME_DIR, 'msedgewebview2.exe');
        if (existsSync(msedgeWebView2Exe)) {
            console.log('✅ WebView2 runtime already exists');
            return true;
        }
        
        // Check if it exists in the expected version subdirectory
        const versionDir = join(RUNTIME_DIR, WEBVIEW2_VERSION);
        msedgeWebView2Exe = join(versionDir, 'msedgewebview2.exe');
        if (existsSync(msedgeWebView2Exe)) {
            console.log('✅ WebView2 runtime already exists in version subdirectory');
            return true;
        }
        
        // Check if it exists in any subdirectory
        for (const item of runtimeContents) {
            const itemPath = join(RUNTIME_DIR, item);
            if (statSync(itemPath).isDirectory()) {
                msedgeWebView2Exe = join(itemPath, 'msedgewebview2.exe');
                if (existsSync(msedgeWebView2Exe)) {
                    console.log(`✅ WebView2 runtime already exists in subdirectory: ${item}`);
                    return true;
                }
            }
        }
    }
    
    console.log('⚠️  WebView2 runtime not found, downloading...');
    
    // Ensure Runtime directory exists
    if (!existsSync(RUNTIME_DIR)) {
        mkdirSync(RUNTIME_DIR, { recursive: true });
    }
    
    // Download the CAB file
    const downloadSuccess = await downloadFile(WEBVIEW2_DOWNLOAD_URL, WEBVIEW2_CAB_FILE);
    if (!downloadSuccess) {
        console.error('❌ Failed to download WebView2 runtime');
        return false;
    }
    
    // Extract the CAB file directly to Runtime folder
    const extractSuccess = await extractCabFile(WEBVIEW2_CAB_FILE, RUNTIME_DIR);
    if (!extractSuccess) {
        console.error('❌ Failed to extract WebView2 runtime');
        return false;
    }
    
    // Clean up the CAB file
    try {
        if (existsSync(WEBVIEW2_CAB_FILE)) {
            const fs = await import('fs/promises');
            await fs.unlink(WEBVIEW2_CAB_FILE);
            console.log('🧹 Cleaned up CAB file');
        }
    } catch (error) {
        console.warn('⚠️  Failed to clean up CAB file:', error);
    }
    
    // Verify extraction was successful - check both direct and subdirectory locations
    let msedgeWebView2Exe = join(RUNTIME_DIR, 'msedgewebview2.exe');
    if (existsSync(msedgeWebView2Exe)) {
        console.log('✅ WebView2 runtime downloaded and extracted successfully');
        return true;
    }
    
    // Check the expected version subdirectory
    const versionDir = join(RUNTIME_DIR, WEBVIEW2_VERSION);
    msedgeWebView2Exe = join(versionDir, 'msedgewebview2.exe');
    if (existsSync(msedgeWebView2Exe)) {
        console.log('✅ WebView2 runtime downloaded and extracted successfully (in version subdirectory)');
        return true;
    }
    
    // Check all subdirectories for the executable
    try {
        const runtimeContents = readdirSync(RUNTIME_DIR);
        for (const item of runtimeContents) {
            const itemPath = join(RUNTIME_DIR, item);
            if (statSync(itemPath).isDirectory()) {
                msedgeWebView2Exe = join(itemPath, 'msedgewebview2.exe');
                if (existsSync(msedgeWebView2Exe)) {
                    console.log(`✅ WebView2 runtime downloaded and extracted successfully (in subdirectory: ${item})`);
                    return true;
                }
            }
        }
    } catch (error) {
        console.error('❌ Error checking extracted files:', error);
    }
    
    console.error('❌ WebView2 runtime extraction verification failed');
    return false;
}

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
async function main(): Promise<void> {
    console.log('\n🌐 Ensuring WebView2 runtime is available...');
    
    // Download WebView2 runtime if not found
    const webview2Available = await ensureWebView2Runtime();
    if (!webview2Available) {
        console.error('❌ Failed to ensure WebView2 runtime availability');
        process.exit(1);
    }
    
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



    console.log('\n🌐 Copying WebView2 runtime...');
    
    // Copy WebView2 runtime - look for the actual extracted folder
    if (existsSync(RUNTIME_DIR)) {
        try {
            // Find the WebView2 runtime folder (it might be nested)
            const runtimeContents = readdirSync(RUNTIME_DIR);
            let webview2SourceDir = RUNTIME_DIR;
            
            // Look for the Microsoft.WebView2.FixedVersionRuntime folder
            const webview2Folder = runtimeContents.find(item => 
                item === WEBVIEW2_VERSION && 
                statSync(join(RUNTIME_DIR, item)).isDirectory()
            );
            
            if (webview2Folder) {
                webview2SourceDir = join(RUNTIME_DIR, webview2Folder);
                console.log(`📁 Found WebView2 runtime folder: ${webview2Folder}`);
            } else {
                // Fallback: look for any Microsoft.WebView2.FixedVersionRuntime folder
                const fallbackFolder = runtimeContents.find(item => 
                    item.startsWith('Microsoft.WebView2.FixedVersionRuntime') && 
                    statSync(join(RUNTIME_DIR, item)).isDirectory()
                );
                if (fallbackFolder) {
                    webview2SourceDir = join(RUNTIME_DIR, fallbackFolder);
                    console.log(`📁 Found WebView2 runtime folder (fallback): ${fallbackFolder}`);
                }
            }
            
            // Verify the source has the required files
            const msedgeWebView2Exe = join(webview2SourceDir, 'msedgewebview2.exe');
            if (existsSync(msedgeWebView2Exe)) {
                copyDirectory(webview2SourceDir, DISTRIBUTION_PACKAGE_DIR);
                console.log(`✅ Copied WebView2 runtime: ${webview2SourceDir} -> ${DISTRIBUTION_PACKAGE_DIR}`);
            } else {
                console.error(`❌ msedgewebview2.exe not found in: ${webview2SourceDir}`);
            }
        } catch (error) {
            console.error(`❌ Failed to copy WebView2 runtime: ${error}`);
        }
    } else {
        console.error(`❌ WebView2 runtime directory not found: ${RUNTIME_DIR}`);
    }

    console.log('\n📊 Post-build summary:');
    console.log(`   mikochat.exe: ${mikochatCopied ? '✅' : '❌'}`);
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
main().catch(error => {
    console.error('❌ Post-build process failed:', error);
    process.exit(1);
});