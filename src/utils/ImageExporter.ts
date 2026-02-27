import type { DiagramRenderer } from '@/core/DiagramRenderer';
import { applyStyleManagerToElements } from './style';
import { getContentBounds } from './contentBounds';
import { downloadBlob } from './download';
import { getAllElements } from './elementIterator';

export interface ExportOptions {
  scale?: number;
  backgroundColor?: string;
  padding?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
}

/**
 * Exports diagram to image formats
 */
export class ImageExporter {
  private renderer: DiagramRenderer;

  constructor(renderer: DiagramRenderer) {
    this.renderer = renderer;
  }

  /**
   * Export to PNG blob
   */
  async exportPNG(options: ExportOptions = {}): Promise<Blob> {
    return this.export({ ...options, format: 'png' });
  }

  /**
   * Export to JPEG blob
   */
  async exportJPEG(options: ExportOptions = {}): Promise<Blob> {
    return this.export({ ...options, format: 'jpeg' });
  }

  /**
   * Export to data URL
   */
  async exportDataURL(options: ExportOptions = {}): Promise<string> {
    const blob = await this.export(options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => resolve(reader.result as string);
      reader.onerror = (): void => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Download as file
   */
  async download(filename: string, options: ExportOptions = {}): Promise<void> {
    const blob = await this.export(options);
    downloadBlob(filename, blob);
  }

  private async export(options: ExportOptions = {}): Promise<Blob> {
    const scale = options.scale ?? 2;
    const backgroundColor = options.backgroundColor ?? '#ffffff';
    const padding = options.padding ?? 20;
    const format = options.format ?? 'png';
    const quality = options.quality ?? 0.92;

    // Calculate content bounds
    const bounds = getContentBounds({ nodes: this.renderer.nodes.values() });
    if (bounds === null) {
      // Empty diagram, return small blank image
      return this.createBlankImage(100, 100, backgroundColor, format, quality);
    }

    // Calculate export dimensions
    const width = (bounds.width + padding * 2) * scale;
    const height = (bounds.height + padding * 2) * scale;

    // Create export canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('Failed to get canvas context');
    }

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Apply transforms
    ctx.scale(scale, scale);
    ctx.translate(-bounds.x + padding, -bounds.y + padding);

    // Apply StyleManager if present before rendering
    applyStyleManagerToElements(
      this.renderer.getStyleManager(),
      this.renderer.groups.values(),
      this.renderer.edges.values(),
      this.renderer.nodes.values()
    );

    // Render elements (in correct order: groups -> edges -> nodes)
    for (const element of getAllElements(this.renderer, { visibleOnly: true })) {
      element.render(ctx);
    }

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob !== null) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        `image/${format}`,
        quality
      );
    });
  }

  private createBlankImage(
    width: number,
    height: number,
    backgroundColor: string,
    format: string,
    quality: number
  ): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx !== null) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob !== null) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        `image/${format}`,
        quality
      );
    });
  }

}
