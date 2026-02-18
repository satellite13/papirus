# Changelog

Все значимые изменения в проекте будут документироваться в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [0.2.0] - 2026-02-18

### Added
- Inline-редактирование меток по двойному клику для узлов и рёбер (`InteractionManager`)
- Новые справочные страницы документации: `renderer.md`, `input.md`, `search.md`
- Настройки `Label Pad/Margin` и `Icon Pad/Margin/Gap` в панели `Node Style` примера `basic`

### Changed
- Улучшен layout текста в узлах:
  - перенос по словам учитывает доступную область текста при наличии иконки
  - для круга и ромба используется область вписанного прямоугольника
  - расширение узла происходит только если перенос не решает переполнение
- Обновлены примеры (`basic`, `ports`, `custom-shapes`):
  - улучшены тулбары и иконки
  - добавлены подсказки по inline-редактированию
  - упрощено поведение темы
  - улучшено управление размером canvas после отрисовки страницы
- Расширена документация по интерактивности, оверлеям и элементам

## [0.1.0] - 2026-02-18

### Added
- Первый публичный релиз
- `DiagramRenderer` — центральный рендерер с системой координат, масштабированием и панорамированием
- Элементы: `RectangleNode`, `CircleNode`, `DiamondNode`, `CustomShapeNode`, `Edge`, `Group`
- `InteractionManager` с поддержкой drag/select/connect/undo/redo/copy/paste
- `StyleManager` с темами (default, dark) и пользовательскими классами стилей
- `Serializer` для сохранения/загрузки диаграмм в JSON
- `ImageExporter` и `SvgExporter` для экспорта диаграмм
- Оверлеи: `GridOverlay`, `MiniMap`, `RulersOverlay`, `GuidesOverlay`
- Утилиты: `AutoLayout`, `AutoRouting`, `alignNodes`, `distributeNodes`
- Поддержка портов (`Port`) и иконок в узлах (`NodeImage`)
- Анимации для рёбер (flow effect)
- Контекстное меню и поиск/фильтрация

[Unreleased]: https://gitverse.ru/ngroznykh/papirus/compare/v0.2.0...HEAD
[0.2.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.2.0
[0.1.0]: https://gitverse.ru/ngroznykh/papirus/releases/tag/v0.1.0
