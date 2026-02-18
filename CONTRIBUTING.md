# Contributing to Papirus

Спасибо за интерес к проекту! Мы приветствуем вклад в виде bug reports, feature requests, документации и кода.

## Как внести вклад

### Сообщить о проблеме

- Используйте [Issues](https://gitverse.ru/ngroznykh/papirus/issues)
- Опишите шаги для воспроизведения
- Укажите версию браузера и ОС
- Приложите минимальный пример кода, если возможно

### Предложить функциональность

- Создайте issue с префиксом `[Feature Request]`
- Опишите use case и ожидаемое поведение

### Pull Requests

1. Форкните репозиторий
2. Создайте ветку: `git checkout -b feature/my-feature` или `fix/my-fix`
3. Убедитесь, что код проходит проверки:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```
4. Сделайте commit с понятным сообщением
5. Отправьте PR в `main` ветку

## Стандарты кода

- TypeScript с strict mode
- Явные типы возвращаемых значений для публичных API
- Тесты для новой функциональности (colocated: `*.test.ts`)
- Следуйте существующему стилю кода

## Структура проекта

```
src/
  core/         # Рендерер, менеджеры взаимодействий
  elements/     # Узлы, рёбра, группы
  events/       # EventEmitter, InputHandler
  styles/       # Темы и стили
  utils/        # Сериализация, экспорт, утилиты
```

## Локальная разработка

```bash
npm install
npm run dev        # Vite dev server
npm run test       # Запуск тестов
npm run build      # Сборка
```

## Быстрый старт для контрибьютора

1. Форкните репозиторий.
2. Клонируйте свой форк и установите зависимости: `npm install`.
3. Создайте ветку: `git checkout -b feature/my-feature` или `fix/my-fix`.
4. Перед PR запустите: `npm run typecheck && npm run lint && npm run test`.

## Commit messages

Рекомендуется формат [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` новая функциональность
- `fix:` исправление ошибки
- `docs:` изменения документации
- `test:` изменения тестов
- `refactor:` рефакторинг без изменения поведения

## Лицензия

Вклады принимаются под лицензией MIT.
