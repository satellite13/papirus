# Вклад в Papirus

Спасибо за интерес к проекту Papirus.

English version: `CONTRIBUTING.md`

## Как можно помочь

### Сообщить об ошибке

- Используйте [Issues](https://gitverse.ru/ngroznykh/papirus/issues)
- Опишите шаги воспроизведения
- Укажите версию браузера и ОС
- По возможности приложите минимальный пример кода

### Предложить функциональность

- Создайте issue с префиксом `[Feature Request]`
- Опишите use case и ожидаемое поведение

### Отправить Pull Request

1. Форкните репозиторий
2. Создайте ветку: `git checkout -b feature/my-feature` или `fix/my-fix`
3. Запустите проверки:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```
4. Сделайте понятный commit
5. Откройте PR в ветку `main`

## Стандарты кода

- TypeScript со strict mode
- Явные return-типы для публичных API
- Тесты для новой функциональности (`*.test.ts` рядом с исходником)
- Следуйте текущему стилю и архитектурным паттернам

## Структура проекта

```text
src/
  core/         # рендерер и менеджеры взаимодействия
  elements/     # узлы, рёбра, группы
  events/       # EventEmitter и обработка ввода
  styles/       # темы и style manager
  utils/        # сериализация, экспорт, layout и утилиты
```

## Локальная разработка

```bash
npm install
npm run dev
npm run test
npm run build
```

## Сообщения коммитов

Рекомендуется [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` новая функциональность
- `fix:` исправление ошибки
- `docs:` изменение документации
- `test:` изменение тестов
- `refactor:` рефакторинг без изменения поведения

## Лицензия

Отправляя вклад, вы соглашаетесь, что он распространяется под лицензией AGPL-3.0-or-later (если иное явно не согласовано письменно).
