import { _electron as electron, ElectronApplication, Page } from 'playwright';
import * as path from 'path';

export interface ElectronAppContext {
  electronApp: ElectronApplication;
  window: Page;
}

export async function launchElectronApp(): Promise<ElectronAppContext> {
  // Get the path to the electron executable from node_modules
  const electronPath = require('electron') as string;

  // Path to the compiled app entry point
  const mainPath = path.join(__dirname, '../../dist/main/main.js');

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Wait for the main window to open
  const window = await electronApp.firstWindow();

  // Wait for the app to be ready
  await window.waitForLoadState('domcontentloaded');

  return { electronApp, window };
}

export async function closeElectronApp(context: ElectronAppContext): Promise<void> {
  try {
    // Force exit the app immediately
    await context.electronApp.evaluate(async ({ app }) => {
      // Set isQuitting flag and exit immediately
      app.exit(0);
    });
  } catch {
    // App may already be closed or crashed
  }
}

// Helper to wait for element to be visible
export async function waitForElement(page: Page, selector: string, timeout = 5000): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

// Helper to get element text
export async function getElementText(page: Page, selector: string): Promise<string> {
  const element = await page.$(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return (await element.textContent()) || '';
}

// Helper to check if element exists
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  const element = await page.$(selector);
  return element !== null;
}
