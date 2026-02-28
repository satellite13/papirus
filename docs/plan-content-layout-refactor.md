# План переработки размещения иконки и текста в фигуре

## 1. Цели

- **Иконка**: размещение в фигуре — лево, право, верх, низ, по углам (4), центр; отступ от края фигуры.
- **Текст**: занимает **всё доступное пространство** контентной области фигуры **без учёта иконки** (с отступами по сторонам); выравнивание внутри области — по горизонтали (слева, справа, по центру) и по вертикали (вверх, вниз, по центру). Иконка размещается поверх той же области по своему placement и отступу.

## 2. Текущее состояние (Papirus)

### Иконка (NodeImage)

- **Размещение** уже поддерживается: `center | top | bottom | left | right | top-left | top-right | bottom-left | bottom-right`.
- **Отступ от края**: у иконки сейчас три настройки — `margin`, `padding` и `gap` в `NodeImageOptions`/лейауте. Их нужно **упростить до одной** — единый отступ `inset`; **gap убрать совсем** (везде использовать inset).

### Текст (TextLabel)

- **Отступы**: сейчас две настройки — `margin` и `padding`; при рендере внутренняя область — bounds минус margin, затем ещё padding. Нужно **упростить до одной** — единый отступ от края области текста до самого текста (аналогично иконке).
- **Горизонтальное выравнивание**: есть `style.align` — `left | center | right`.
- **Вертикальное выравнивание**: по факту всегда по центру (`startY = innerBounds.y + (innerBounds.height - totalHeight) / 2 + ...`); отдельного свойства для вертикали нет.

### Узел (Node)

- **Контентная область**: по умолчанию `getLabelContainerBounds(bounds) === bounds` (RectangleNode). У DiamondNode/CircleNode — вписанный прямоугольник.
- **labelPlacement**: положение блока метки относительно узла — `auto | center | top | bottom | left | right` (не выравнивание текста внутри блока).
- Лейаут иконки и текста сосредоточен в `calculateContentLayout` и вспомогательных методах (`getIconBounds`, `getAutoLabelBounds`, `getLabelBounds`).

---

## 3. Целевая модель

### 3.1 Область контента фигуры (content area)

- **Без отступов** контентная область (innerBounds) **равна размеру фигуры** — то есть `getLabelContainerBounds(bounds)` при нулевых отступах возвращает те же bounds (вся фигура).
- **Отступы задаются отдельно по каждой стороне фигуры**: `contentInset?: { top?: number; right?: number; bottom?: number; left?: number }`. Удобный вариант: также допустить `contentInset?: number` — тогда один и тот же отступ со всех сторон (top/right/bottom/left = это число).
- Контентная область = bounds фигуры минус эти отступы: `contentArea = { x: bounds.x + left, y: bounds.y + top, width: bounds.width - left - right, height: bounds.height - top - bottom }`. Иконка и текст размещаются внутри content area; при нулевых top/right/bottom/left content area совпадает с bounds.

### 3.2 Иконка

- **Позиции**: без изменений — лево, право, верх, низ, 4 угла, центр.
- **Отступ от края — одна настройка**:
  - Заменить `margin` и `padding` в `NodeImageOptions` на одно свойство, например **`inset?: number`** (по умолчанию 6 или 8): расстояние от края зоны размещения иконки до рисуемого изображения (один отступ со всех сторон). Размер «ячейки» иконки: размер изображения + 2×inset. В рендере иконки: от bounds отступаем на inset и рисуем изображение в оставшейся области.
  - Свойство **`gap`** в NodeImage **убрать совсем**. При расчёте `iconBounds` в Node использовать тот же `inset` (отступ от края контентной области до иконки = inset).
- Итог: одна настройка отступа у иконки — `inset`.

### 3.3 Текст

- **Область**: текст занимает **всё доступное пространство контентной области без учёта иконки** — то есть `labelBounds` всегда равны контентной области за вычетом только **собственного отступа текста** (одна настройка inset со всех сторон). Иконка не уменьшает область текста; она размещается в той же контентной области по своему placement и отступу (возможна визуальная overlap текста и иконки).
- **Отступы текста: упрощаем до одного значения inset**. Заменить `margin` и `padding` в `TextLabelOptions` на одно свойство **`inset?: number`** (по умолчанию, например 8): расстояние от края области текста (bounds) до рисуемого текста со всех сторон. **innerBounds** = bounds минус inset по всем сторонам — это область, в которой рисуется текст.
- **Выравнивание внутри innerBounds**:
  - Горизонталь: уже есть `align`: `left | center | right` (внутри innerBounds).
  - **Вертикальное выравнивание внутри innerBounds**: добавить свойство **`verticalAlign?: 'top' | 'middle' | 'bottom'`** в `TextStyle` или в `TextLabelOptions`. Позиция текста по вертикали считается **внутри innerBounds** (область после применения inset к bounds):
    - `top` → текст прижат к верху innerBounds: `startY = innerBounds.y + lineHeight/2`
    - `middle` → текст по центру innerBounds по вертикали: `startY = innerBounds.y + (innerBounds.height - totalHeight) / 2 + lineHeight/2`
    - `bottom` → текст прижат к низу innerBounds: `startY = innerBounds.y + innerBounds.height - totalHeight + lineHeight/2`

Итог: узел передаёт тексту `labelBounds` = контентная область (без вычитания места под иконку); иконка рисуется в своих `iconBounds` внутри той же контентной области. Внутри своих bounds текст выравнивается по `align` и новому `verticalAlign`.

---

## 4. Изменения по компонентам

### 4.1 Papirus — типы (`types.ts`)

- В опциях узла: **contentInset** с отступами **по каждой стороне фигуры**:
  - `contentInset?: number` — один отступ со всех сторон (top = right = bottom = left = это число), либо
  - `contentInset?: { top?: number; right?: number; bottom?: number; left?: number }` — отдельно для каждой стороны. По умолчанию все 0 → контентная область = bounds фигуры.
- В `TextStyle`: добавить `verticalAlign?: 'top' | 'middle' | 'bottom'`.

### 4.2 Papirus — Node (опции и базовая логика)

- В `NodeOptions` добавить `contentInset?: number | { top?, right?, bottom?, left? }`. Нормализовать в объект `{ top, right, bottom, left }` (число → все четыре поля равны этому числу; не заданные стороны = 0).
- В `Node`: в `getLabelContainerBounds(bounds)` возвращать прямоугольник **bounds минус отступы по каждой стороне**: `x = bounds.x + left`, `y = bounds.y + top`, `width = bounds.width - left - right`, `height = bounds.height - top - bottom`. При всех отступах 0 контентная область равна bounds (размер фигуры). Diamond/Circle могут применять эти же inset к своей вписанной области.
- **Лейаут текста и иконки**: в `calculateContentLayout` задавать **labelBounds** всегда равными контентной области. Иконку размещать в той же контентной области по `getIconBounds(contentBounds, ...)`; при расчёте размера ячейки иконки использовать одну настройку **inset** (в Node: `getIconBoxSize()` = размер изображения + 2×inset). Убрать логику «вычитания» области иконки из области текста; минимальный размер узла по-прежнему учитывает и иконку, и текст.

### 4.3 Papirus — NodeImage

- **Одна настройка отступа**: заменить `margin` и `padding` на одно свойство **`inset?: number`** (значение по умолчанию, например 6 или 8). Семантика: расстояние от края зоны иконки до изображения со всех сторон. В `render()`: внутренняя область = bounds минус inset по всем сторонам; изображение рисуется в этой области с учётом align/verticalAlign. Размер ячейки иконки в Node: размер изображения + 2×inset.
- **gap**: убрать совсем. В Node в `getIconBounds` и везде, где использовался gap, применять `inset`. Оставить у иконки только `placement` и `inset`.
- Обратная совместимость при десериализации: если в данных есть старые `margin`/`padding`, при чтении можно задать `inset = margin ?? padding ?? 6`.

### 4.4 Papirus — TextLabel

- **Отступы текста: упрощаем до одного значения inset**. Заменить `margin` и `padding` на одно свойство **`inset?: number`** (по умолчанию, например 8). Семантика: расстояние от края bounds до текста со всех сторон. В `render()`: **innerBounds** = bounds минус inset по всем сторонам; текст рисуется и выравнивается **внутри innerBounds** (align по горизонтали, verticalAlign по вертикали). При измерении (measure) учитывать один inset вместо margin+padding. Обратная совместимость при чтении: `inset = data.inset ?? data.margin ?? data.padding ?? 8`.
- Добавить в опции/стиль поддержку **verticalAlign** (`top` | `middle` | `bottom`) — **вертикальное выравнивание текста внутри innerBounds**.
- В `render(ctx, bounds, alignOverride?)`: вычислять innerBounds = bounds минус inset; при расчёте `startY` учитывать `verticalAlign` относительно innerBounds (top/middle/bottom). При отсутствии значения считать `middle`.

### 4.5 Papirus — Serializer / types (SerializedNode, SerializedTextLabel, SerializedNodeIcon)

- Добавить сериализацию: `contentInset`, для текста — `verticalAlign` и одно поле `inset` (margin и padding не сохранять), для иконки — одно поле `inset` (margin, padding и gap не сохранять). При чтении: иконка `inset = data.inset ?? data.margin ?? data.padding ?? data.gap ?? 6`; текст `inset = data.inset ?? data.margin ?? data.padding ?? 8`. Обратная совместимость: старые схемы без этих полей работают с дефолтами.

### 4.6 Papirus — SvgExporter

- Уже использует `getLabelBoundsForExport` и логику узла для позиции текста; после внедрения verticalAlign и content area экспорт должен продолжать использовать общие методы расчёта bounds и строк, чтобы SVG совпадал с canvas. При добавлении verticalAlign — учесть его при выводе `<text>` (например, через `dominant-baseline` и смещение по y).

### 4.7 Warchi

- **Модель/нотация**: если в attrs/стиле компонента хранятся placement иконки и labelPlacement — добавить поля для:
  - content inset (если нужен в UI),
  - verticalAlign текста.
- **NodeStylePanel / форма стиля**: добавить элементы управления:
  - выравнивание текста по вертикали (top / center / bottom);
  - при необходимости — отступ контента от края фигуры (одно число или по сторонам).
- **Сохранение/загрузка**: прокинуть новые поля в Papirus (label.style.verticalAlign, node.contentInset, и т.д.) и в бэкенд/attrs при сохранении диаграммы.

### 4.8 Arepos-server

- Если стили/attrs диаграмм хранятся в JSON (attrs, style), достаточно расширить схему/документацию полями `contentInset`, `verticalAlign` и т.д. Отдельные миграции БД не требуются, если это просто JSON.

---

## 5. Этапы реализации

1. **Типы и контракты (Papirus)**  
   - Добавить `contentInset` в опции/стиль узла, `verticalAlign` в TextStyle/TextLabelOptions.  
   - Обновить SerializedNode/SerializedTextLabel/SerializedNodeIcon при необходимости.

2. **Content area (отступы по сторонам) и лейаут «текст без учёта иконки» (Papirus)**  
   - Реализовать нормализацию `contentInset` в Node (число → top/right/bottom/left; объект с полями по сторонам; по умолчанию все 0).  
   - В `getLabelContainerBounds(bounds)` возвращать bounds минус отступы по каждой стороне (x += left, y += top, width -= left+right, height -= top+bottom). При нулевых отступах контентная область = bounds фигуры.  
   - В `calculateContentLayout`: **всегда** задавать `labelBounds` = контентная область; `iconBounds` считать в той же контентной области. Убрать ветки, которые уменьшают `labelBounds` при наличии иконки. Порядок отрисовки: сначала иконка, потом текст.  
   - Diamond/Circle при необходимости применяют те же inset по сторонам к своей вписанной области.

3. **TextLabel: одна настройка отступа + verticalAlign (Papirus)**  
   - Заменить `margin` и `padding` на **`inset`** в TextLabelOptions; в `measure()` и `render()` использовать только inset.  
   - Добавить свойство и использование в `TextLabel.render()` для расчёта `startY` по **verticalAlign**.  
   - Обновить экспорт в SvgExporter (текст в узлах), чтобы вертикальное положение и отступы совпадали с canvas.

4. **Иконка: одна настройка отступа (Papirus)**  
   - В `NodeImageOptions` заменить `margin` и `padding` на **`inset`**; свойство **`gap` убрать совсем** — в `NodeImage.render()` и в Node (`getIconBoxSize()`, `getIconBounds()`, весь лейаут) использовать только `inset`.  
   - Убедиться, что все расчёты иконки идут от `getLabelContainerBounds(bounds)` (content area).

5. **Тесты и регрессии (Papirus)**  
   - Юнит-тесты для Node (layout с contentInset), TextLabel (verticalAlign), при необходимости — интеграция с NodeImage.  
   - Проверить Serializer и SvgExporter.

6. **Warchi**  
   - Добавить в UI выбор verticalAlign и contentInset; привязать к node/label опциям и сохранению в стиле/attrs.

7. **Документация**  
   - Обновить описание API (размещение иконки, отступ от края, отступы и выравнивание текста) в docs и при необходимости в AGENTS.md.

---

## 6. Риски и упрощения

- **Обратная совместимость**: все новые поля опциональны; старые диаграммы без `contentInset` и `verticalAlign` ведут себя как сейчас.
- **Сложность contentInset**: если не хотим усложнять базовый RectangleNode, первый шаг можно ограничить только **verticalAlign** текста и явной документацией по margin/inset иконки; contentInset ввести во второй итерации.
- **Отступы текста**: упрощаем до одного значения `inset` (как у иконки). Разные отступы по сторонам при необходимости можно добавить позже (insetTop/Right/Bottom/Left или объект).

---

## 7. Краткая сводка по API (после рефакторинга)

| Что | Где | Текущее | Целевое |
|-----|-----|--------|--------|
| Отступы контента от края фигуры (по сторонам) | Node | нет | `contentInset?: number \| { top?, right?, bottom?, left? }` — по умолчанию 0, контентная область = размер фигуры |
| Позиция иконки | NodeImage | 9 позиций | без изменений |
| Отступ иконки от края (зоны размещения) | NodeImage | `margin`, `padding`, `gap` | одна настройка **`inset?: number`** (margin и padding заменить на inset; **gap убрать совсем**) |
| Отступ текста от краёв области | TextLabel | `margin`, `padding` | одна настройка **`inset?: number`** (margin и padding заменить на inset) |
| Горизонтальное выравнивание текста | TextLabel.style | `align` | без изменений |
| Вертикальное выравнивание текста внутри innerBounds | TextLabel | нет (всегда центр) | `verticalAlign?: 'top' \| 'middle' \| 'bottom'` |

После этого иконка и текст имеют по одной настройке отступа (**inset**); иконка размещается по краям, углам и центру, текст занимает **всю** контентную область (без учёта иконки) с отступом inset и выравнивается по горизонтали и вертикали.
