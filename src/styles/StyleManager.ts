import type { EdgeStyle, ElementState, ElementStyle, NodeStyle, TextStyle } from '@/types';

/**
 * Theme definition
 */
export interface Theme {
  name: string;
  colors: {
    background: string;
    grid: string;
    selection: string;
    connectionPreview: string;
  };
  node: {
    default: NodeStyle;
    hover: NodeStyle;
    selected: NodeStyle;
    dragging: NodeStyle;
  };
  edge: {
    default: EdgeStyle;
    hover: EdgeStyle;
    selected: EdgeStyle;
  };
  text: TextStyle;
  port: {
    default: { color: string; radius: number };
    hover: { color: string; radius: number };
  };
  group: {
    default: ElementStyle;
    selected: ElementStyle;
  };
}

/**
 * Style class definition
 */
export interface StyleClass {
  name: string;
  node?: Partial<NodeStyle>;
  edge?: Partial<EdgeStyle>;
  text?: Partial<TextStyle>;
  port?: Partial<{ color: string; radius: number }>;
  group?: Partial<ElementStyle>;
}

const DEFAULT_THEME: Theme = {
  name: 'default',
  colors: {
    background: '#ffffff',
    grid: '#e5e5e5',
    selection: 'rgba(59, 130, 246, 0.1)',
    connectionPreview: '#3b82f6',
  },
  node: {
    default: {
      fillColor: '#ffffff',
      strokeColor: '#333333',
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 4,
    },
    hover: {
      fillColor: '#f5f5f5',
      strokeColor: '#6366f1',
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 4,
    },
    selected: {
      strokeColor: '#3b82f6',
      strokeWidth: 2,
      opacity: 1,
    },
    dragging: {
      strokeColor: '#333333',
      strokeWidth: 2,
      opacity: 0.8,
    },
  },
  edge: {
    default: {
      strokeColor: '#666666',
      strokeWidth: 2,
      opacity: 1,
    },
    hover: {
      strokeColor: '#6366f1',
      strokeWidth: 2,
      opacity: 1,
    },
    selected: {
      strokeColor: '#3b82f6',
      strokeWidth: 3,
      opacity: 1,
    },
  },
  text: {
    font: '14px sans-serif',
    fontSize: 14,
    fontFamily: 'sans-serif',
    fontWeight: 'normal',
    color: '#333333',
    align: 'center',
    baseline: 'middle',
  },
  port: {
    default: { color: '#666666', radius: 6 },
    hover: { color: '#3b82f6', radius: 7 },
  },
  group: {
    default: {
      fillColor: 'rgba(200, 200, 200, 0.2)',
      strokeColor: '#999999',
      strokeWidth: 1,
      opacity: 1,
    },
    selected: {
      fillColor: 'rgba(59, 130, 246, 0.1)',
      strokeColor: '#3b82f6',
      strokeWidth: 2,
      opacity: 1,
    },
  },
};

const DARK_THEME: Theme = {
  name: 'dark',
  colors: {
    background: '#1a1a1a',
    grid: '#333333',
    selection: 'rgba(99, 102, 241, 0.2)',
    connectionPreview: '#6366f1',
  },
  node: {
    default: {
      fillColor: '#2d2d2d',
      strokeColor: '#555555',
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 4,
    },
    hover: {
      fillColor: '#3d3d3d',
      strokeColor: '#6366f1',
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 4,
    },
    selected: {
      fillColor: '#2d2d2d',
      strokeColor: '#555555',
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 4,
    },
    dragging: {
      fillColor: '#404040',
      strokeColor: '#555555',
      strokeWidth: 2,
      opacity: 0.8,
      cornerRadius: 4,
    },
  },
  edge: {
    default: {
      strokeColor: '#888888',
      strokeWidth: 2,
      opacity: 1,
    },
    hover: {
      strokeColor: '#6366f1',
      strokeWidth: 2,
      opacity: 1,
    },
    selected: {
      strokeColor: '#818cf8',
      strokeWidth: 3,
      opacity: 1,
    },
  },
  text: {
    font: '14px sans-serif',
    fontSize: 14,
    fontFamily: 'sans-serif',
    fontWeight: 'normal',
    color: '#e0e0e0',
    align: 'center',
    baseline: 'middle',
  },
  port: {
    default: { color: '#888888', radius: 6 },
    hover: { color: '#6366f1', radius: 7 },
  },
  group: {
    default: {
      fillColor: 'rgba(100, 100, 100, 0.2)',
      strokeColor: '#666666',
      strokeWidth: 1,
      opacity: 1,
    },
    selected: {
      fillColor: 'rgba(99, 102, 241, 0.2)',
      strokeColor: '#6366f1',
      strokeWidth: 2,
      opacity: 1,
    },
  },
};

/**
 * Manages styles and themes
 */
export class StyleManager {
  private _theme: Theme;
  private _classes = new Map<string, StyleClass>();
  private _builtInThemes = new Map<string, Theme>([
    ['default', DEFAULT_THEME],
    ['dark', DARK_THEME],
  ]);

  constructor(theme?: Theme | string) {
    if (theme === undefined) {
      this._theme = DEFAULT_THEME;
    } else if (typeof theme === 'string') {
      this._theme = this._builtInThemes.get(theme) ?? DEFAULT_THEME;
    } else {
      this._theme = theme;
    }
  }

  /**
   * Current theme
   */
  get theme(): Theme {
    return this._theme;
  }

  /**
   * Set the current theme
   */
  setTheme(theme: Theme | string): void {
    if (typeof theme === 'string') {
      const builtIn = this._builtInThemes.get(theme);
      if (builtIn !== undefined) {
        this._theme = builtIn;
      }
    } else {
      this._theme = theme;
    }
  }

  /**
   * Register a custom theme
   */
  registerTheme(theme: Theme): void {
    this._builtInThemes.set(theme.name, theme);
  }

  /**
   * Get all available theme names
   */
  getThemeNames(): string[] {
    return Array.from(this._builtInThemes.keys());
  }

  /**
   * Register a style class
   */
  registerClass(styleClass: StyleClass): void {
    this._classes.set(styleClass.name, styleClass);
  }

  /**
   * Get a style class
   */
  getClass(name: string): StyleClass | undefined {
    return this._classes.get(name);
  }

  /**
   * Get all registered classes
   */
  getClasses(): StyleClass[] {
    return Array.from(this._classes.values());
  }

  /**
   * Get node style for a state
   */
  getNodeStyle(state: ElementState, className?: string): NodeStyle {
    const baseStyle = this.getBaseNodeStyle(state);

    if (className !== undefined) {
      const styleClass = this._classes.get(className);
      if (styleClass?.node !== undefined) {
        return { ...baseStyle, ...styleClass.node };
      }
    }

    return baseStyle;
  }

  /**
   * Get edge style for a state
   */
  getEdgeStyle(state: ElementState, className?: string): EdgeStyle {
    const baseStyle = this.getBaseEdgeStyle(state);

    if (className !== undefined) {
      const styleClass = this._classes.get(className);
      if (styleClass?.edge !== undefined) {
        return { ...baseStyle, ...styleClass.edge };
      }
    }

    return baseStyle;
  }

  /**
   * Get text style
   */
  getTextStyle(className?: string): TextStyle {
    const baseStyle = this._theme.text;

    if (className !== undefined) {
      const styleClass = this._classes.get(className);
      if (styleClass?.text !== undefined) {
        return { ...baseStyle, ...styleClass.text };
      }
    }

    return baseStyle;
  }

  /**
   * Get group style for a state
   */
  getGroupStyle(selected: boolean, className?: string): ElementStyle {
    const baseStyle = selected ? this._theme.group.selected : this._theme.group.default;

    if (className !== undefined) {
      const styleClass = this._classes.get(className);
      if (styleClass?.group !== undefined) {
        return { ...baseStyle, ...styleClass.group };
      }
    }

    return baseStyle;
  }

  /**
   * Get port style
   */
  getPortStyle(hovered: boolean, className?: string): { color: string; radius: number } {
    const baseStyle = hovered ? this._theme.port.hover : this._theme.port.default;

    if (className !== undefined) {
      const styleClass = this._classes.get(className);
      if (styleClass?.port !== undefined) {
        return { ...baseStyle, ...styleClass.port };
      }
    }

    return baseStyle;
  }

  private getBaseNodeStyle(state: ElementState): NodeStyle {
    const d = this._theme.node.default;
    switch (state) {
      case 'hover':
        return { ...d, ...this._theme.node.hover };
      case 'selected':
        return { ...d, ...this._theme.node.selected };
      case 'dragging':
        return { ...d, ...this._theme.node.dragging };
      default:
        return d;
    }
  }

  private getBaseEdgeStyle(state: ElementState): EdgeStyle {
    switch (state) {
      case 'hover':
        return this._theme.edge.hover;
      case 'selected':
        return this._theme.edge.selected;
      default:
        return this._theme.edge.default;
    }
  }
}

// Export default themes
export { DEFAULT_THEME, DARK_THEME };
