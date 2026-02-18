// Кастомный узел "База данных" - используем CustomShapeNode с расширенным рендером
import { CustomShapeNode } from '../../dist/papirus.js';

export class DatabaseNode extends CustomShapeNode {
  constructor(options) {
    // Создаем path для цилиндра
    const cylinderPath = DatabaseNode.createCylinderPath(
      options.width || 100, 
      options.height || 120
    );
    
    super({
      ...options,
      path: () => cylinderPath,
    });
    
    this._topColor = options.topColor || this.darkenColor(options.style?.fillColor || '#fce7f3', 0.85);
    this._bodyColor = options.style?.fillColor || '#fce7f3';
  }

  darkenColor(color, factor) {
    if (!color || color.startsWith('rgba')) return color;
    let r, g, b;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return color;
    }
    r = Math.floor(r * factor);
    g = Math.floor(g * factor);
    b = Math.floor(b * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  static createCylinderPath(width, height) {
    const path = new Path2D();
    const w = width;
    const h = height;
    const ry = Math.min(h * 0.15, w * 0.15);
    const rx = w / 2;
    const topY = ry;
    const bottomY = h - ry;
    const centerX = w / 2;
    const k = 0.552284749;

    // Тело цилиндра
    path.moveTo(0, bottomY);
    path.lineTo(0, topY);
    path.bezierCurveTo(0, topY - ry * k, centerX - rx * k, 0, centerX, 0);
    path.bezierCurveTo(centerX + rx * k, 0, w, topY - ry * k, w, topY);
    path.lineTo(w, bottomY);
    path.bezierCurveTo(w, bottomY + ry * k, centerX + rx * k, h, centerX, h);
    path.bezierCurveTo(centerX - rx * k, h, 0, bottomY + ry * k, 0, bottomY);
    path.closePath();

    return path;
  }

  // Переопределяем render для двухцветной отрисовки
  render(ctx, options = {}) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    const w = this.width;
    const h = this.height;
    const ry = Math.min(h * 0.15, w * 0.15);
    const rx = w / 2;
    const topY = ry;
    const bottomY = h - ry;
    const centerX = w / 2;
    const k = 0.552284749;
    
    // Сначала рисуем тело цилиндра (основной цвет)
    const bodyPath = new Path2D();
    bodyPath.moveTo(0, bottomY);
    bodyPath.lineTo(0, topY);
    bodyPath.bezierCurveTo(0, topY - ry * k, centerX - rx * k, 0, centerX, 0);
    bodyPath.bezierCurveTo(centerX + rx * k, 0, w, topY - ry * k, w, topY);
    bodyPath.lineTo(w, bottomY);
    bodyPath.bezierCurveTo(w, bottomY + ry * k, centerX + rx * k, h, centerX, h);
    bodyPath.bezierCurveTo(centerX - rx * k, h, 0, bottomY + ry * k, 0, bottomY);
    bodyPath.closePath();
    
    ctx.fillStyle = this._bodyColor;
    ctx.fill(bodyPath);
    
    // Рисуем верхнюю грань (темнее)
    const topPath = new Path2D();
    topPath.moveTo(0, topY);
    topPath.bezierCurveTo(0, topY - ry * k, centerX - rx * k, 0, centerX, 0);
    topPath.bezierCurveTo(centerX + rx * k, 0, w, topY - ry * k, w, topY);
    topPath.bezierCurveTo(w, topY + ry * k, centerX + rx * k, ry * 2, centerX, ry * 2);
    topPath.bezierCurveTo(centerX - rx * k, ry * 2, 0, topY + ry * k, 0, topY);
    topPath.closePath();
    
    ctx.fillStyle = this._topColor;
    ctx.fill(topPath);
    
    // Рисуем обводку
    ctx.strokeStyle = this.style?.strokeColor || '#db2777';
    ctx.lineWidth = this.style?.strokeWidth || 2;
    ctx.stroke(bodyPath);
    ctx.stroke(topPath);
    
    // Горизонтальная линия убрана - она перекрывала верхнюю плоскость
    
    // Рисуем лейбл вручную
    const labelText = typeof this.label === 'string' ? this.label : this.label?.text;
    if (labelText) {
      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, w / 2, h / 2);
    }
    
    ctx.restore();
  }
}
