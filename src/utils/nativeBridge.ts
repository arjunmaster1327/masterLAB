import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Camera } from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function initNativeAndroidShell(onBackPress: () => boolean): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#0f4c81' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // Ignore on platforms where status bar customization is unsupported
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Ignore if splash screen already hidden
  }

  const listener = await CapApp.addListener('backButton', ({ canGoBack }) => {
    const handled = onBackPress();
    if (handled) return;
    if (canGoBack) {
      window.history.back();
    } else {
      CapApp.minimizeApp().catch(() => {});
    }
  });

  return () => {
    listener.remove().catch(() => {});
  };
}

export async function openExternalActionUrl(url: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  if (url.startsWith('sms:') || url.startsWith('tel:') || url.startsWith('mailto:')) {
    window.location.href = url;
    return;
  }

  if (url.startsWith('https://wa.me/') || url.startsWith('whatsapp://')) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch {
      window.location.href = url;
      return;
    }
  }

  try {
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to encode file data'));
        return;
      }
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read blob data'));
    reader.readAsDataURL(blob);
  });
}

export async function saveOrShareBlob(options: {
  fileName: string;
  blob: Blob;
  title?: string;
  text?: string;
}): Promise<void> {
  const safeName = options.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(options.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const base64Data = await blobToBase64(options.blob);
  const path = `exports/${safeName}`;

  await Filesystem.writeFile({
    path,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });

  const uriResult = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });

  await Share.share({
    title: options.title || safeName,
    text: options.text || 'Exported from MASTER COMPUTERIZED LABORATORY',
    url: uriResult.uri,
    dialogTitle: options.title || 'Open, Print, or Share File',
  });
}

export async function requestNativeCameraPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  try {
    const current = await Camera.checkPermissions();
    if (current.camera === 'granted') return true;
    const requested = await Camera.requestPermissions({ permissions: ['camera'] });
    return requested.camera === 'granted' || requested.camera === 'limited';
  } catch {
    // Allow WebView getUserMedia fallback to prompt via BridgeWebChromeClient
    return true;
  }
}
