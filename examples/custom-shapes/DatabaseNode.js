// Database shape built on top of CustomShapeNode.
import { CustomShapeNode } from '../../dist/papirus.js';

export class DatabaseNode extends CustomShapeNode {
  constructor(options) {
    super({
      ...options,
      path: DatabaseNode.createCylinderPath,
      svgPath: DatabaseNode.createCylinderSvgPath,
    });
  }

  static createCylinderSvgPath(w, h) {
    const ry = Math.min(h * 0.15, w * 0.15);
    const rx = w / 2;
    const topY = ry;
    const bottomY = h - ry;
    const cx = w / 2;
    const k = 0.552284749;
    return `M 0 ${bottomY} L 0 ${topY} C 0 ${topY - ry * k} ${cx - rx * k} 0 ${cx} 0 C ${cx + rx * k} 0 ${w} ${topY - ry * k} ${w} ${topY} L ${w} ${bottomY} C ${w} ${bottomY + ry * k} ${cx + rx * k} ${h} ${cx} ${h} C ${cx - rx * k} ${h} 0 ${bottomY + ry * k} 0 ${bottomY} Z`;
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
}
