import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramRenderer } from './DiagramRenderer';
import type { Point } from '@/types';
import type { Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';

export type ContextMenuIcon =
  | string
  | {
      type: 'text' | 'svg' | 'html';
      value: string;
    };

export interface ContextMenuItem {
  label?: string;
  icon?: ContextMenuIcon;
  action?: (target: ContextMenuTarget) => void;
  items?: ContextMenuItem[];
  enabled?: boolean;
  visible?: boolean;
  separator?: boolean;
}

export type ContextMenuTarget =
  | {
      type: 'node';
      node: Node;
      point: Point;
      screenPoint: Point;
      originalEvent: MouseEvent;
    }
  | {
      type: 'edge';
      edge: Edge;
      point: Point;
      screenPoint: Point;
      originalEvent: MouseEvent;
    }
  | {
      type: 'canvas';
      point: Point;
      screenPoint: Point;
      originalEvent: MouseEvent;
    };

export type ContextMenuProvider = ContextMenuItem[] | ((target: ContextMenuTarget) => ContextMenuItem[]);

export interface ContextMenuConfig {
  node?: ContextMenuProvider;
  edge?: ContextMenuProvider;
  canvas?: ContextMenuProvider;
}

export interface ContextMenuOptions {
  menu: ContextMenuConfig;
  container?: HTMLElement;
  className?: string;
  minWidth?: number;
  closeOnSelect?: boolean;
}

export interface ContextMenuEvents {
  open: [target: ContextMenuTarget];
  close: [];
}

const DEFAULT_OPTIONS: Required<Omit<ContextMenuOptions, 'menu'>> = {
  container: document.body,
  className: '',
  minWidth: 180,
  closeOnSelect: true,
};

export class ContextMenuManager extends EventEmitter<ContextMenuEvents> {
  private renderer: DiagramRenderer;
  private options: ContextMenuOptions;
  private menuElement: HTMLDivElement | null = null;
  private cleanupHandlers: Array<() => void> = [];

  constructor(renderer: DiagramRenderer, options: ContextMenuOptions) {
    super();
    this.renderer = renderer;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.attachListeners();
  }

  setMenu(menu: ContextMenuConfig): void {
    this.options = { ...this.options, menu };
  }

  destroy(): void {
    this.close();
    for (const cleanup of this.cleanupHandlers) {
      cleanup();
    }
    this.cleanupHandlers = [];
    this.removeAllListeners();
  }

  private attachListeners(): void {
    const canvas = this.renderer.getCanvas();
    const handleContextMenu = (event: MouseEvent): void => {
      if (event.button !== 2) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const screenPoint: Point = { x: event.clientX, y: event.clientY };
      const worldPoint = this.renderer.screenToWorld(screenPoint.x, screenPoint.y);
      const hit = this.renderer.getElementAtPoint(worldPoint);

      let target: ContextMenuTarget;
      if (hit && 'typeName' in hit) {
        target = {
          type: 'node',
          node: hit,
          point: worldPoint,
          screenPoint,
          originalEvent: event,
        };
      } else if (hit && 'from' in hit && 'to' in hit) {
        target = {
          type: 'edge',
          edge: hit,
          point: worldPoint,
          screenPoint,
          originalEvent: event,
        };
      } else {
        target = {
          type: 'canvas',
          point: worldPoint,
          screenPoint,
          originalEvent: event,
        };
      }

      const items = this.resolveItems(target);
      if (items.length === 0) {
        this.close();
        return;
      }

      this.open(target, items);
    };

    const handleGlobalClick = (event: MouseEvent): void => {
      if (!this.menuElement) {
        return;
      }
      if (event.target instanceof HTMLElement && this.menuElement.contains(event.target)) {
        return;
      }
      this.close();
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        this.close();
      }
    };

    canvas.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);

    this.cleanupHandlers.push(() => canvas.removeEventListener('contextmenu', handleContextMenu, true));
    this.cleanupHandlers.push(() => document.removeEventListener('mousedown', handleGlobalClick));
    this.cleanupHandlers.push(() => window.removeEventListener('keydown', handleEscape));
  }

  private resolveItems(target: ContextMenuTarget): ContextMenuItem[] {
    const provider =
      target.type === 'node'
        ? this.options.menu.node
        : target.type === 'edge'
          ? this.options.menu.edge
          : this.options.menu.canvas;

    if (!provider) {
      return [];
    }
    return typeof provider === 'function' ? provider(target) : provider;
  }

  private open(target: ContextMenuTarget, items: ContextMenuItem[]): void {
    this.close();
    const menu = this.buildMenu(items, target);
    menu.style.minWidth = `${this.options.minWidth}px`;
    menu.style.left = `${target.screenPoint.x}px`;
    menu.style.top = `${target.screenPoint.y}px`;
    menu.className = `papirus-context-menu ${this.options.className}`.trim();

    this.options.container?.appendChild(menu);
    this.menuElement = menu;

    this.adjustPosition(menu);
    this.emit('open', target);
  }

  private close(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
      this.emit('close');
    }
  }

  private buildMenu(items: ContextMenuItem[], target: ContextMenuTarget): HTMLDivElement {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.zIndex = '10000';
    container.style.background = '#ffffff';
    container.style.border = '1px solid #e5e7eb';
    container.style.borderRadius = '8px';
    container.style.padding = '6px';
    container.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.18)';
    container.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';
    container.style.fontSize = '14px';
    container.style.color = '#0f172a';

    const list = this.buildList(items, target);
    container.appendChild(list);
    return container;
  }

  private buildList(items: ContextMenuItem[], target: ContextMenuTarget): HTMLUListElement {
    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.margin = '0';
    list.style.padding = '0';

    for (const item of items) {
      if (item.visible === false) {
        continue;
      }
      if (item.separator) {
        const separator = document.createElement('li');
        separator.style.listStyle = 'none';
        separator.style.margin = '6px 0';
        separator.style.borderTop = '1px solid #e5e7eb';
        list.appendChild(separator);
        continue;
      }
      const li = document.createElement('li');
      li.style.position = 'relative';
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '8px';
      li.style.padding = '6px 10px';
      li.style.borderRadius = '6px';
      li.style.cursor = item.enabled === false ? 'not-allowed' : 'pointer';
      li.style.opacity = item.enabled === false ? '0.5' : '1';

      const label = document.createElement('span');
      label.textContent = item.label ?? '';

      const iconElement = this.createIconElement(item.icon);
      li.appendChild(iconElement);

      li.appendChild(label);

      if (item.items && item.items.length > 0) {
        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.style.marginLeft = 'auto';
        li.appendChild(arrow);

        const sub = this.buildList(item.items, target);
        sub.style.position = 'absolute';
        sub.style.left = '100%';
        sub.style.top = '0';
        sub.style.marginLeft = '6px';
        sub.style.background = '#ffffff';
        sub.style.border = '1px solid #e5e7eb';
        sub.style.borderRadius = '8px';
        sub.style.padding = '6px';
        sub.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.16)';
        sub.style.display = 'none';
        li.appendChild(sub);

        let hideTimeout: number | null = null;
        const showSubmenu = (): void => {
          if (hideTimeout !== null) {
            window.clearTimeout(hideTimeout);
            hideTimeout = null;
          }
          sub.style.display = 'block';
        };
        const scheduleHide = (): void => {
          if (hideTimeout !== null) {
            window.clearTimeout(hideTimeout);
          }
          hideTimeout = window.setTimeout(() => {
            hideTimeout = null;
            if (li.matches(':hover') || sub.matches(':hover')) {
              return;
            }
            sub.style.display = 'none';
          }, 150);
        };
        const hideSubmenu = (event: MouseEvent): void => {
          const related = event.relatedTarget;
          if (related instanceof HTMLElement && li.contains(related)) {
            return;
          }
          scheduleHide();
        };

        li.addEventListener('mouseenter', showSubmenu);
        li.addEventListener('mouseleave', hideSubmenu);
        sub.addEventListener('mouseenter', showSubmenu);
        sub.addEventListener('mouseleave', hideSubmenu);
      }

      li.addEventListener('mouseenter', () => {
        li.style.background = '#f1f5f9';
      });
      li.addEventListener('mouseleave', () => {
        li.style.background = 'transparent';
      });
      li.addEventListener('click', (event) => {
        event.stopPropagation();
        if (item.enabled === false) {
          return;
        }
        item.action?.(target);
        if (this.options.closeOnSelect) {
          this.close();
        }
      });

      list.appendChild(li);
    }

    return list;
  }

  private createIconElement(icon?: ContextMenuIcon): HTMLSpanElement {
    const iconEl = document.createElement('span');
    iconEl.style.width = '16px';
    iconEl.style.height = '16px';
    iconEl.style.display = 'inline-flex';
    iconEl.style.alignItems = 'center';
    iconEl.style.justifyContent = 'center';
    iconEl.style.textAlign = 'center';

    if (!icon) {
      iconEl.textContent = '';
      return iconEl;
    }

    if (typeof icon === 'string') {
      if (this.isSvgString(icon)) {
        iconEl.innerHTML = icon;
      } else {
        iconEl.textContent = icon;
      }
      return iconEl;
    }

    if (icon.type === 'svg' || icon.type === 'html') {
      iconEl.innerHTML = icon.value;
    } else {
      iconEl.textContent = icon.value;
    }

    return iconEl;
  }

  private isSvgString(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.startsWith('<svg') || trimmed.includes('</svg>');
  }

  private adjustPosition(menu: HTMLDivElement): void {
    const rect = menu.getBoundingClientRect();
    const padding = 8;
    let left = rect.left;
    let top = rect.top;

    if (rect.right > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (rect.bottom > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }
}
