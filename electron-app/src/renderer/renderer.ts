import { TitleBar } from './components/TitleBar';
import { WindowList } from './components/WindowList';
import { ResizePanel } from './components/ResizePanel';

class App {
  private windowList: WindowList;

  constructor() {
    const resizePanel = new ResizePanel();
    this.windowList = new WindowList(resizePanel);
    new TitleBar(() => this.windowList.refresh());
  }

  destroy(): void {
    this.windowList.destroy();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
