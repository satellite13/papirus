# Remediation аудита Papirus — июль 2026

Реализация рекомендаций из [code-audit-2026-07.md](./code-audit-2026-07.md) на ветке `feat/code-audit-remediation`.

## Сделано

### Высокий приоритет
1. **DiagramRenderer** — вынесены `ScrollbarController`, `EdgeEndpointUpdater`; interaction-слой типизирован через `DiagramSurface` (без value-цикла с `DiagramRenderer`).
2. **SVG pipeline** — единый `utils/svgAssetLoader.ts` + общий `svgTint` для `NodeImage`, `CIcon`, `SvgExporter`.
3. **`CComponent.onClick`** — в интерфейсе; убран `asAny`-хак в InteractionManager.
4. **Coverage** — пороги 60/60/50/60; тесты для ScrollbarController, DragManager, InputHandler, path strategies, iconLayout, direction, svg helpers.
5. **Дубли геометрии** — `getDirectionFromOutlineParam` в `direction.ts`; icon layout в `iconLayout.ts`.

### Средний приоритет
6. **ClipboardManager**, **PropertyChangeBatcher**, общий `utils/keymap.ts`.
7. **Edge** — `EdgeMarkerRenderer`, `EdgeLabelRenderer` (`Edge.ts` ~1401 → ~953 строк).
8. **Composite** — `CompositeComponentBase` (setOnChange, default hitTest).
9. **MiniMap** — `extends BaseOverlay`.
10. **Public API** — явный export geometry; `@internal` на reset-хуках; экспорт path strategies и property-change commands.

### Низкий приоритет
11. Экспорт path strategies и property commands (см. выше).
12. **TextMeasurer** — общий wrap/measure для CText и TextLabel.
13. Type-safe `findById` через `child.type === 'container'`.
14. Convention `TODO(debt):` в docs.

## Сознательно не сломано
- Публичные методы DiagramRenderer (scrollbar/scroll — делегаты).
- Serialize JSON composite / Edge constructor API.
- Scrollbars не переведены в DiagramPlugin.

## Известный долг
- `TODO(debt):` StyleManager tests (низкое покрытие ~15%).
- ContextMenuManager / AnimationManager / Port — слабо покрыты.

## Проверка warchi (2026-07-13)
Локально: `"@ngroznykh/papirus": "file:../papirus"` на ветке `feat/code-audit-remediation`.

| Проверка | Результат |
|----------|-----------|
| papirus `npm run typecheck` / `build` / `test:coverage` | OK (60.7% stmts / 51.6% branches / 68% funcs / 61% lines) |
| warchi `npm test` | 858/858 |
| warchi `npm run build` | OK |
| E2E `notation-editor` + `notation-composite-edge-labels` | 10/10 |
