import { existsSync, mkdirSync, readdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const androidDir = join(root, 'android');

if (!existsSync(androidDir)) {
  console.error('Android project folder not found. Run "npx cap add android" first.');
  process.exit(1);
}

const firebaseConfigPath = join(root, 'firebase-applet-config.json');
const firebaseConfig = existsSync(firebaseConfigPath)
  ? JSON.parse(readFileSync(firebaseConfigPath, 'utf8'))
  : {};

// 1. Ensure rgcfaIncludeGoogle = true in android/variables.gradle
const variablesPath = join(androidDir, 'variables.gradle');
if (existsSync(variablesPath)) {
  let variables = readFileSync(variablesPath, 'utf8');
  if (!variables.includes('rgcfaIncludeGoogle')) {
    variables = variables.replace(
      /}\s*$/,
      "    rgcfaIncludeGoogle = true\n}\n"
    );
  } else {
    variables = variables.replace(
      /rgcfaIncludeGoogle\s*=\s*(true|false)/,
      'rgcfaIncludeGoogle = true'
    );
  }
  writeFileSync(variablesPath, variables, 'utf8');
}

// 2. Update android/app/build.gradle with firebase-common and optional release signing
const appBuildGradlePath = join(androidDir, 'app', 'build.gradle');
if (existsSync(appBuildGradlePath)) {
  let gradle = readFileSync(appBuildGradlePath, 'utf8');

  if (!gradle.includes('com.google.firebase:firebase-common')) {
    gradle = gradle.replace(
      "implementation project(':capacitor-android')",
      "implementation project(':capacitor-android')\n    implementation 'com.google.firebase:firebase-common:21.0.0'"
    );
  }

  if (!gradle.includes('signingConfigs')) {
    gradle = gradle.replace(
      '    buildTypes {',
      `    signingConfigs {
        release {
            def ksPath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ksPath != null && !ksPath.isEmpty()) {
                storeFile file(ksPath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {`
    );
  }

  if (!gradle.includes('signingConfig signingConfigs.release')) {
    gradle = gradle.replace(
      /buildTypes\s*\{\s*release\s*\{/,
      `buildTypes {
        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                signingConfig signingConfigs.release
            }`
    );
  }

  writeFileSync(appBuildGradlePath, gradle, 'utf8');
}

// 3. Write hardened AndroidManifest.xml with runtime permissions & Android 11+ <queries>
const manifestPath = join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="http" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SENDTO" />
            <data android:scheme="smsto" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="sms" />
        </intent>
        <intent>
            <action android:name="android.intent.action.DIAL" />
            <data android:scheme="tel" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SEND" />
            <data android:mimeType="application/pdf" />
        </intent>
        <package android:name="com.whatsapp" />
        <package android:name="com.whatsapp.w4b" />
    </queries>

    <application
        android:allowBackup="true"
        android:hardwareAccelerated="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="false">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>
</manifest>
`;
writeFileSync(manifestPath, manifestXml, 'utf8');

// 4. Write MainActivity.java with safe FirebaseApp fallback initialization
const mainActivityPath = join(
  androidDir,
  'app',
  'src',
  'main',
  'java',
  'com',
  'masterlab',
  'diagnostics',
  'MainActivity.java'
);
const mainActivityJava = `package com.masterlab.diagnostics;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (FirebaseApp.getApps(this).isEmpty()) {
            String projectId = getString(R.string.firebase_project_id);
            String appId = getString(R.string.firebase_app_id);
            String apiKey = getString(R.string.firebase_api_key);
            if (!projectId.isEmpty() && !appId.isEmpty() && !apiKey.isEmpty()) {
                FirebaseOptions.Builder builder = new FirebaseOptions.Builder()
                    .setProjectId(projectId)
                    .setApplicationId(appId)
                    .setApiKey(apiKey);
                String senderId = getString(R.string.firebase_sender_id);
                if (!senderId.isEmpty()) {
                    builder.setGcmSenderId(senderId);
                }
                String storageBucket = getString(R.string.firebase_storage_bucket);
                if (!storageBucket.isEmpty()) {
                    builder.setStorageBucket(storageBucket);
                }
                FirebaseApp.initializeApp(this, builder.build());
            }
        }
        super.onCreate(savedInstanceState);
    }
}
`;
writeFileSync(mainActivityPath, mainActivityJava, 'utf8');

// 5. Write Android values resources (strings.xml, colors.xml, ic_launcher_background.xml)
const valuesDir = join(androidDir, 'app', 'src', 'main', 'res', 'values');
mkdirSync(valuesDir, { recursive: true });

const hasGoogleServicesJson = existsSync(join(androidDir, 'app', 'google-services.json'));
const escapeXml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const defaultWebClientEntry =
  !hasGoogleServicesJson && firebaseConfig.oAuthClientId
    ? `    <string name="default_web_client_id" translatable="false">${escapeXml(firebaseConfig.oAuthClientId)}</string>\n`
    : '';

const stringsXml = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">Master Lab</string>
    <string name="title_activity_main">MASTER COMPUTERIZED LABORATORY</string>
    <string name="package_name">com.masterlab.diagnostics</string>
    <string name="custom_url_scheme">com.masterlab.diagnostics</string>
    <string name="firebase_project_id" translatable="false">${escapeXml(firebaseConfig.projectId || '')}</string>
    <string name="firebase_app_id" translatable="false">${escapeXml(firebaseConfig.appId || '')}</string>
    <string name="firebase_api_key" translatable="false">${escapeXml(firebaseConfig.apiKey || '')}</string>
    <string name="firebase_sender_id" translatable="false">${escapeXml(firebaseConfig.messagingSenderId || '')}</string>
    <string name="firebase_storage_bucket" translatable="false">${escapeXml(firebaseConfig.storageBucket || '')}</string>
${defaultWebClientEntry}</resources>
`;
writeFileSync(join(valuesDir, 'strings.xml'), stringsXml, 'utf8');

const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0f4c81</color>
    <color name="colorPrimaryDark">#0a365c</color>
    <color name="colorAccent">#0284c7</color>
</resources>
`;
writeFileSync(join(valuesDir, 'colors.xml'), colorsXml, 'utf8');

const icLauncherBgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0f4c81</color>
</resources>
`;
writeFileSync(join(valuesDir, 'ic_launcher_background.xml'), icLauncherBgXml, 'utf8');

// 6. Replace default Capacitor robot launcher icon with Master Lab medical vector adaptive icon
const medicalForegroundVector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <!-- Subtle outer diagnostic ring -->
    <path
        android:fillColor="#00000000"
        android:strokeColor="#38BDF8"
        android:strokeWidth="2.2"
        android:pathData="M54,23 A31,31 0 1,1 53.99,23 Z" />
    <!-- White clinical shield -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M54,28 L75,36 L75,54 C75,67 66,76 54,81 C42,76 33,67 33,54 L33,36 Z" />
    <!-- Medical blue laboratory cross inside shield -->
    <path
        android:fillColor="#0F4C81"
        android:pathData="M50,41 H58 V50 H67 V58 H58 V67 H50 V58 H41 V50 H50 Z" />
    <!-- Cyan diagnostic pulse accent dot -->
    <path
        android:fillColor="#0284C7"
        android:pathData="M54,51 A3,3 0 1,1 53.99,51 Z" />
</vector>
`;

const resDir = join(androidDir, 'app', 'src', 'main', 'res');
for (const folder of ['drawable', 'drawable-v24']) {
  const dir = join(resDir, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ic_launcher_foreground.xml'), medicalForegroundVector, 'utf8');
}

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;
const anydpiDir = join(resDir, 'mipmap-anydpi-v26');
mkdirSync(anydpiDir, { recursive: true });
writeFileSync(join(anydpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
writeFileSync(join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

// Copy generated Master Lab PNGs over default Capacitor splash & legacy mipmap icons
const pwa512 = join(root, 'public', 'pwa-512x512.png');
const pwa192 = join(root, 'public', 'pwa-192x192.png');

for (const entry of readdirSync(resDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dirPath = join(resDir, entry.name);
  if (entry.name.startsWith('drawable') && existsSync(pwa512)) {
    const splashTarget = join(dirPath, 'splash.png');
    if (existsSync(splashTarget)) {
      copyFileSync(pwa512, splashTarget);
    }
  }
  if (entry.name.startsWith('mipmap-') && entry.name !== 'mipmap-anydpi-v26') {
    const srcIcon = entry.name.includes('xxxhdpi') || entry.name.includes('xxhdpi') ? pwa512 : pwa192;
    if (existsSync(srcIcon)) {
      for (const iconName of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
        const target = join(dirPath, iconName);
        if (existsSync(target)) {
          copyFileSync(srcIcon, target);
        }
      }
    }
  }
}

console.log('Android native project configured for MASTER COMPUTERIZED LABORATORY.');
