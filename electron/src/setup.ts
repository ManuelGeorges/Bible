import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import {
  CapacitorSplashScreen,
  setupCapacitorElectronPlugins,
} from '@capacitor-community/electron';
import chokidar from 'chokidar';
import type { MenuItemConstructorOptions } from 'electron';
import { app, BrowserWindow, Menu, MenuItem, nativeImage, Tray, session, shell } from 'electron';
import electronIsDev from 'electron-is-dev';
import electronServe from 'electron-serve';
import windowStateKeeper from 'electron-window-state';
import { join } from 'path';

const reloadWatcher = {
  debouncer: null,
  ready: false,
  watcher: null,
};

export function setupReloadWatcher(electronCapacitorApp: ElectronCapacitorApp): void {
  reloadWatcher.watcher = chokidar
    .watch(join(app.getAppPath(), 'app'), {
      ignored: /[/\\]\./,
      persistent: true,
    })
    .on('ready', () => {
      reloadWatcher.ready = true;
    })
    .on('all', (_event, _path) => {
      if (reloadWatcher.ready) {
        clearTimeout(reloadWatcher.debouncer);
        reloadWatcher.debouncer = setTimeout(async () => {
          if (reloadWatcher.watcher) {
            await reloadWatcher.watcher.close();
          }
          electronCapacitorApp.getMainWindow().webContents.reload();
          reloadWatcher.ready = false;
          clearTimeout(reloadWatcher.debouncer);
          reloadWatcher.debouncer = null;
          reloadWatcher.watcher = null;
          setupReloadWatcher(electronCapacitorApp);
        }, 1500);
      }
    });
}

export class ElectronCapacitorApp {
  private MainWindow: BrowserWindow | null = null;
  private SplashScreen: CapacitorSplashScreen | null = null;
  private TrayIcon: Tray | null = null;
  private CapacitorFileConfig: CapacitorElectronConfig;
  private TrayMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
    new MenuItem({ label: 'Quit App', role: 'quit' }),
  ];
  private AppMenuBarMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
    { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
    { role: 'viewMenu' },
  ];
  private mainWindowState: any;
  private loadWebApp: any;
  private customScheme: string;

  constructor(
    capacitorFileConfig: CapacitorElectronConfig,
    trayMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[],
    appMenuBarMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[]
  ) {
    this.CapacitorFileConfig = capacitorFileConfig;
    this.customScheme = this.CapacitorFileConfig.electron?.customUrlScheme ?? 'capacitor-electron';

    if (trayMenuTemplate) {
      this.TrayMenuTemplate = trayMenuTemplate;
    }

    if (appMenuBarMenuTemplate) {
      this.AppMenuBarMenuTemplate = appMenuBarMenuTemplate;
    }

    this.loadWebApp = electronServe({
      directory: join(app.getAppPath(), 'app'),
      scheme: this.customScheme,
    });
  }

  private async loadMainWindow(thisRef: any) {
    await thisRef.loadWebApp(thisRef.MainWindow);
  }

  getMainWindow(): BrowserWindow {
    return this.MainWindow!;
  }

  getCustomURLScheme(): string {
    return this.customScheme;
  }

  async init(): Promise<void> {
    const icon = nativeImage.createFromPath(
      join(app.getAppPath(), 'assets', process.platform === 'win32' ? 'appIcon.ico' : 'appIcon.png')
    );
    this.mainWindowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 900,
    });

    let preloadPath = join(app.getAppPath(), 'build', 'src', 'preload.js');
    if (electronIsDev) {
      preloadPath = join(app.getAppPath(), 'src', 'preload.js');
    }

    this.MainWindow = new BrowserWindow({
      icon,
      title: "Agios Bible",
      show: false,
      x: this.mainWindowState.x,
      y: this.mainWindowState.y,
      width: this.mainWindowState.width,
      height: this.mainWindowState.height,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
        webSecurity: false,
        sandbox: false,
      },
    });

    session.defaultSession.webRequest.onBeforeRequest({ urls: [`${this.customScheme}://*/*`] }, (details, callback) => {
      try {
        const url = new URL(details.url);
        if (url.pathname.endsWith('.txt') || url.searchParams.has('_rsc')) {
          callback({ cancel: false });
          return;
        }
      } catch (e) {}
      callback({});
    });

    this.MainWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    this.mainWindowState.manage(this.MainWindow);

    this.MainWindow.webContents.setWindowOpenHandler((details) => {
      if (details.url.includes('accounts.google.com') || details.url.includes('google.com')) {
        shell.openExternal(details.url);
        return { action: 'deny' };
      }

      if (details.url.includes('firebaseapp.com') || details.url.includes('googleapis.com')) {
        return { action: 'allow' };
      }

      if (details.url.startsWith('http')) {
        shell.openExternal(details.url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    setupCapacitorElectronPlugins();

    if (this.CapacitorFileConfig.electron?.splashScreenEnabled) {
      this.SplashScreen = new CapacitorSplashScreen({
        imageFilePath: join(app.getAppPath(), 'assets', this.CapacitorFileConfig.electron?.splashScreenImageName ?? 'splash.png'),
        windowWidth: 500,
        windowHeight: 500,
      });
      this.SplashScreen.init(this.loadMainWindow, this);
    } else {
      this.loadMainWindow(this);
    }

    this.MainWindow.webContents.on('dom-ready', () => {
      this.SplashScreen?.getSplashWindow()?.hide();
      this.MainWindow?.show();
      if (electronIsDev) this.MainWindow?.webContents.openDevTools();
    });
  }
}

export function setupContentSecurityPolicy(customScheme: string): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    const setHeaderUnique = (name: string, value: string) => {
      const lowerName = name.toLowerCase();
      Object.keys(responseHeaders).forEach(key => {
        if (key.toLowerCase() === lowerName) {
          delete responseHeaders[key];
        }
      });
      responseHeaders[name] = [value];
    };

    const appOrigin = `${customScheme}://-`;
    const devToolsSource = electronIsDev ? " devtools://*" : "";

    setHeaderUnique('Access-Control-Allow-Origin', appOrigin);
    setHeaderUnique('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    setHeaderUnique('Access-Control-Allow-Headers', '*');
    setHeaderUnique('Access-Control-Allow-Credentials', 'true');

    const csp = `default-src * 'unsafe-inline' 'unsafe-eval' data: blob: ${customScheme}: ${customScheme}://* ${devToolsSource}; img-src * data: blob: ${customScheme}: ${customScheme}://*; frame-src *; connect-src * wss:;`;
    setHeaderUnique('Content-Security-Policy', csp);

    callback({ responseHeaders });
  });

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Origin'] = 'https://localhost';
    details.requestHeaders['Referer'] = 'https://localhost/';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
}