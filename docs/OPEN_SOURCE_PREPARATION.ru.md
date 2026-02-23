# Чеклист подготовки к Open Source

Этот документ помогает подготовить `papirus` к публичному open-source релизу.

## 1. Легал и метаданные

- [ ] Проверить наличие и корректность `LICENSE`
- [ ] Проверить совместимость лицензий зависимостей
- [ ] Поддерживать актуальность `repository`, `bugs`, `homepage` в `package.json`
- [ ] Проверить npm-метаданные (`description`, `keywords`, `files`)

## 2. Security readiness

- [ ] Поддерживать `SECURITY.md` и `SECURITY.ru.md`
- [ ] Проверить, что в репозитории нет токенов/секретов
- [ ] Убедиться, что примеры и документация не содержат чувствительных данных

## 3. Базовый набор документации

- [x] `README.md` + `README.ru.md`
- [x] `CONTRIBUTING.md` + `CONTRIBUTING.ru.md`
- [x] `SECURITY.md` + `SECURITY.ru.md`
- [x] `CODE_OF_CONDUCT.md` + `CODE_OF_CONDUCT.ru.md`
- [x] API-документация в `docs/`
- [ ] Добавить migration notes для крупных API-изменений (при необходимости)

## 4. Build и quality gate

- [ ] CI для lint/typecheck/test/build
- [ ] Опционально: контроль размера бандла
- [ ] Проверка `npm pack --dry-run` в CI

Рекомендуемые проверки:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm pack --dry-run
```

## 5. Release process

- [ ] Поддерживать `CHANGELOG.md` в актуальном состоянии
- [ ] Помечать релизы тегами `vX.Y.Z`
- [ ] Публиковать npm-релизы с неизменяемыми тегами
- [ ] Проверять сгенерированные `dist` артефакты и type definitions

## 6. Гигиена репозитория

- [ ] Актуализировать issue templates
- [ ] Актуализировать PR template
- [ ] Включить branch protection для основной ветки
- [ ] Проверить, что процесс контрибьюта описан и актуален
