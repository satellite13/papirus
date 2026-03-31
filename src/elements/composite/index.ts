// Components
export { CText, type CTextOptions } from './CText';
export { CIcon, type CIconOptions } from './CIcon';
export { CDivider, type CDividerOptions } from './CDivider';
export { CContainer, type CContainerOptions } from './CContainer';
export { CShape, type CShapeOptions } from './CShape';

// Deserialization
export { deserializeCComponent } from './deserialize';

// Layout
export { flexLayout, type FlexConfig, type FlexChild, type LayoutResult } from './FlexLayout';

// Node
export { CompositeNode, type CompositeNodeOptions, type CompositeShapeType } from './CompositeNode';

// Types
export type {
  CComponent,
  CComponentType,
  CComponentStyle,
  SerializedCComponent,
  SidesConfig,
} from './CComponent';
export { normalizeSides } from './CComponent';

// --- Factory functions for declarative API ---

import { CText, type CTextOptions } from './CText';
import { CIcon, type CIconOptions } from './CIcon';
import { CDivider, type CDividerOptions } from './CDivider';
import { CContainer, type CContainerOptions } from './CContainer';
import { CShape, type CShapeOptions } from './CShape';

/** Create a text component */
export function text(options: CTextOptions): CText {
  return new CText(options);
}

/** Create an icon component */
export function icon(options: CIconOptions): CIcon {
  return new CIcon(options);
}

/** Create a divider component */
export function divider(options?: CDividerOptions): CDivider {
  return new CDivider(options);
}

/** Create a flex container component */
export function container(options?: CContainerOptions): CContainer {
  return new CContainer(options);
}

/** Create a shape component (bordered box with optional nested content) */
export function shape(options?: CShapeOptions): CShape {
  return new CShape(options);
}
