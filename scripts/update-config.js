const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.warn('.env file not found');
}

const appId = process.env.VITE_WX_APPID;

if (!appId) {
    console.warn('VITE_WX_APPID not found in .env, skipping config update.');
    process.exit(0);
}

// Update project.config.json
const projectConfigPath = path.resolve(__dirname, '../project.config.json');
if (fs.existsSync(projectConfigPath)) {
    try {
        const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
        if (projectConfig.appid !== appId) {
            projectConfig.appid = appId;
            fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 4));
            console.log(`Updated project.config.json with appid: ${appId}`);
        }
    } catch (e) {
        console.error('Failed to update project.config.json', e);
    }
}

// Update src/manifest.json
const manifestPath = path.resolve(__dirname, '../src/manifest.json');
if (fs.existsSync(manifestPath)) {
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (!manifest['mp-weixin']) manifest['mp-weixin'] = {};

        if (manifest['mp-weixin'].appid !== appId) {
            manifest['mp-weixin'].appid = appId;
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));
            console.log(`Updated src/manifest.json with appid: ${appId}`);
        }
    } catch (e) {
        console.error('Failed to update src/manifest.json', e);
    }
}
