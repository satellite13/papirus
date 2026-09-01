# Contributing to Papirus

Thanks for your interest in contributing to Papirus.

Русская версия: `CONTRIBUTING.ru.md`

## Ways to Contribute

### Report a Bug

- Use [Issues](https://gitverse.ru/ngroznykh/papirus/issues)
- Include clear reproduction steps
- Mention browser and OS versions
- Provide a minimal code sample when possible

### Propose a Feature

- Open an issue with `[Feature Request]` in the title
- Describe the use case and expected behavior

### Submit a Pull Request

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-feature` or `fix/my-fix`
3. Run quality checks:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```
   GitHub Actions runs the same checks on every pull request (Node 18/20/22).
4. Commit with a clear message
5. Open a PR against `master`

## Code Standards

- TypeScript with strict mode
- Explicit return types for public APIs
- Tests for new functionality (`*.test.ts` colocated with source)
- Follow existing code style and architecture patterns

## Project Structure

```text
src/
  core/         # renderer and interaction managers
  elements/     # nodes, edges, groups
  events/       # EventEmitter and input handling
  styles/       # themes and style manager
  utils/        # serializer, export, layout and helper utilities
```

## Local Development

```bash
npm install
npm run dev
npm run test
npm run build
```

## Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/) is recommended:

- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation update
- `test:` test update
- `refactor:` behavior-preserving refactor

## License

By contributing, you agree that contributions are provided under AGPL-3.0-or-later (unless explicitly agreed otherwise in writing).
