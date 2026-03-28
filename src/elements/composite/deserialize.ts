import type { CComponent, SerializedCComponent } from './CComponent';
import { CText } from './CText';
import { CIcon } from './CIcon';
import { CDivider } from './CDivider';
import { CContainer } from './CContainer';
import { CShape } from './CShape';

/**
 * Recursively deserialize a component tree from JSON.
 */
export function deserializeCComponent(data: SerializedCComponent): CComponent {
  switch (data.type) {
    case 'text':
      return new CText({
        id: data.id,
        text: data.text ?? '',
        fontFamily: data.fontFamily,
        fontWeight: data.fontWeight,
        fontStyle: data.fontStyle,
        fontSize: data.fontSize,
        color: data.color,
        align: data.align,
        verticalAlign: data.verticalAlign,
        maxLines: data.maxLines,
        lineHeight: data.lineHeight,
        role: data.role,
        rotation: data.rotation,
        style: data.style,
      });

    case 'icon':
      return new CIcon({
        id: data.id,
        source: data.source ?? '',
        width: data.width,
        height: data.height,
        backgroundColor: data.backgroundColor,
        fillColor: data.fillColor,
        style: data.style,
      });

    case 'divider':
      return new CDivider({
        id: data.id,
        color: data.color,
        thickness: data.thickness,
        style: data.style,
      });

    case 'container':
      return new CContainer({
        id: data.id,
        direction: data.direction,
        justifyContent: data.justifyContent,
        alignItems: data.alignItems,
        gap: data.gap,
        padding: data.padding,
        children: data.children?.map(deserializeCComponent),
        style: data.style,
      });

    case 'shape':
      return new CShape({
        id: data.id,
        borderColor: data.borderColor,
        borderWidth: data.borderWidth,
        backgroundColor: data.backgroundColor,
        cornerRadius: data.cornerRadius,
        padding: data.padding,
        content: data.content
          ? (deserializeCComponent(data.content) as CContainer)
          : undefined,
        style: data.style,
      });

    default:
      throw new Error(`Unknown component type: ${String(data.type)}`);
  }
}
