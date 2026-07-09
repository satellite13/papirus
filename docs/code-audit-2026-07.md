# Аудит кода Papirus — июль 2026

Статический анализ структуры и качества кода. Объём: ~20 500 строк production TypeScript в `src/` (67 файлов без `*.test.ts`), 25 тестовых файлов (~5 100 строк). Версия пакета: `0.6.4`.

Связанные отчёты: `docs/code-audit-2026-07.md` в warchi и arepos-server.

## Сильные стороны

- Строгая типизация: `strict: true`, `noUncheckedIndexedAccess: true`, ESLint с `no-explicit-any: error`. В production-коде нет `any`, `@ts-ignore`, `@ts-nocheck`.
- Чёткая модульная структура `core/` → `elements/` → `events/` → `styles/` → `utils/`; зависимости в основном однонаправленные.
- Осознанные паттерны: dirty flag (`Element.ts`), Command (`history/commands.ts`), Strategy (`elements/paths/`), Plugin (`DiagramPlugin` + overlays), type-safe `EventEmitter`.
- Composite-система с хорошим покрытием тестами composite-модулей.
- Нулевые runtime-зависимости, colocated-тесты, единый стиль (Prettier + ESLint).

## Крупнейшие файлы — кандидаты на декомпозицию

~37% production-кода (~7600 строк) сосредоточено в 6 файлах:

| Строк | Файл | Комментарий |
|------:|------|-------------|
| 1803 | `src/core/DiagramRenderer.ts` | God-class: render loop + scrollbars (~640 строк, `:1139–1777`) + edge endpoints + hit-test + plugins |
| 1401 | `src/elements/Edge.ts` | Path + 6 типов markers (`:888–1180`) + label (`:1203–1370`) + hit-test |
| 1340 | `src/core/InteractionManager.ts` | Оркестратор + clipboard (`:1198–1318`) + property batching (`:1030–1115`) + keyboard |
| 1273 | `src/core/ConnectionManager.ts` | Outline attach, reconnect, preview, polyline bends |
| 1161 | `src/elements/Node.ts` | Anchors, ports, icon layout, badges, resize handles |
| 1043 | `src/utils/SvgExporter.ts` | Дублирует icon layout и tint из `Node.ts` / `svgTint.ts` |

## Ключевые проблемы

### Высокий приоритет

1. **Цикл DiagramRenderer ↔ InteractionManager.** Value-import в обе стороны (`DiagramRenderer.ts:8`, `InteractionManager.ts:8`) — tight coupling; менеджеры завязаны на renderer как god object. Признак: inline dynamic imports `import('@/elements/composite/CompositeNode')` в `InteractionManager.ts:729,780`.
2. **Низкое покрытие.** Пороги в `vitest.config.ts:13–18`: lines 48%, functions 48%, branches 39%, statements 48%. Без тестов: scrollbars (~640 строк), `DragManager` (669), `InputHandler` (340), path strategies (в т.ч. `PolylinePathStrategy` — 526), все overlays, `StyleManager` (396). `DiagramRenderer.test.ts` — всего 24 строки.
3. **Дублирование SVG pipeline.** Fetch + tint + LRU-кэш реализован 4 раза: `svgTint.ts`, `NodeImage.ts:169–201`, `CIcon.ts:140–164`, `SvgExporter.ts:972–1010`. Два отдельных LRU-кэша одинакового размера.
4. **`CComponent.onClick`.** Есть у `CIcon` и `CShape`, но не в интерфейсе `CComponent.ts:61–88` → `asAny`-хак в `InteractionManager.ts:736–738`.
5. **Дублирование геометрии.** `getDirectionFromOutlineParam` идентичен в `ConnectionManager.ts:407–413` и `DiagramRenderer.ts:1131–1137`; `getIconBoxSize`/`getIconBounds` продублированы между `Node.ts:1020–1067` и `SvgExporter.ts:797–865` (~80 строк).

### Средний приоритет

6. **Паттерны.** Undo-keymap продублирован между `HistoryManager.ts:123–139` и `InteractionManager.ts:847–868`; paste не покрыт командами (undo?); scrollbars встроены в renderer вместо plugin; MiniMap реализует `DiagramPlugin` напрямую, минуя `BaseOverlay`.
7. **Composite boilerplate.** Каждый компонент повторяет `_onChange`-цепочку, идентичный AABB hitTest (`CText.ts:345–358`, `CIcon.ts:197–210`, `CDivider.ts:91+`), ручной serialize (~100 строк × 5 файлов). `CText.ts` (453 строки) дублирует ~200 строк text measurement из `TextLabel.ts`. Composite использует `_onChange?.()` вместо единого `markDirty()` — параллельная система invalidation.
8. **Публичный API.** `export * from './utils/geometry'` (~20 функций, `index.ts:172`); test-хуки `resetIdCounter`/`resetPortIdCounter` в public API (`index.ts:62,66`); property-change commands, наоборот, не экспортированы из index; `PathStrategy` и `PathStrategyOptions` реэкспортируются из разных мест.

### Низкий приоритет

9. Non-null assertions (~30 шт.) сосредоточены в state machine `ConnectionManager`/`DragManager` — риск средний, но лучше guard-функции.
10. `CContainer.findById` использует касты `(child as CContainer)` (`CContainer.ts:235,240`) вместо discriminated union.

## Рекомендации

### Высокий приоритет

1. Декомпозировать `DiagramRenderer`: вынести `ScrollbarController` (~640 строк) и `EdgeEndpointUpdater`; развязать цикл с `InteractionManager` через интерфейс (`DiagramSurface`).
2. Консолидировать SVG pipeline: единый `utils/svgAssetLoader.ts` (fetch + LRU + tint) для `NodeImage`, `CIcon`, `SvgExporter`.
3. Добавить `onClick?: () => void` в интерфейс `CComponent`, убрать `asAny`-хак.
4. Поднять пороги coverage до 60–65%; тесты для `DragManager`, scrollbars, `InputHandler`, path strategies.
5. Устранить дубли `getDirectionFromOutlineParam` и icon layout между core и `SvgExporter`.

### Средний приоритет

6. Вынести `ClipboardManager` и `PropertyChangeBatcher` из `InteractionManager`; убрать дублирование undo-keymap.
7. Разбить `Edge.ts`: `EdgeMarkerRenderer`, `EdgeLabelRenderer`; переиспользовать `utils/markers.ts` в canvas-рендере.
8. Базовый класс/mixin для composite-компонентов (общие `_onChange`, default hitTest, serialize helpers).
9. Унифицировать overlays: MiniMap extends `BaseOverlay` или shared `OverlayLifecycle`.
10. Сузить public API: явный список вместо `export *` geometry; `resetIdCounter` → `@internal`.

### Низкий приоритет

11. Экспортировать path strategies и property-change commands из index (потенциально нужны wArchi).
12. Общий `TextMeasurer` для `CText` и `TextLabel`.
13. Discriminated union для `CComponent` — type-safe tree walk без кастов.
14. Завести convention для TODO-маркеров известного долга (paste undo, StyleManager tests).

## Итоговая оценка

| Критерий | Оценка |
|----------|--------|
| Структура / слои | 8/10 |
| Размеры файлов | 5/10 |
| DRY | 6/10 |
| Типизация | 9/10 |
| Тесты | 5/10 |
| Зависимости | 9/10 |

Наибольший ROI: вынос `ScrollbarController`, консолидация SVG pipeline, поднятие порогов покрытия с тестами для непокрытых interaction-подсистем.
