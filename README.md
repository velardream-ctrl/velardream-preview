# Velar Dream Preview

Отдельная тестовая площадка проекта [Velar Dream Records](https://velardream.com/).

**Статус:** репозиторий создан; тестовая публикация GitHub Pages пока не подтверждена.

## Правила безопасности
- Production: `velardream-ctrl/velar-music-manager` → `main` → `https://velardream.com/`. Не изменять Pages, CNAME и DNS production.
- Здесь проверяются новые функции до одобрения владельца. Никаких автоматических публикаций в production.
- Не копировать токены, секреты, приватные данные или учётные данные Firebase.
- Тестовая версия не должна иметь права записи в рабочую Firebase. До проверки изоляции не включать рабочую авторизацию или админ-действия.
- Перед выпуском: тесты, мобильная проверка iPhone Safari и старого iPad, запись SHA и результатов, резервная копия и инструкция отката.

## Первая задача
- Исходный draft PR: [#194](https://github.com/velardream-ctrl/velar-music-manager/pull/194), ветка `feature/compact-featured-flexible-sources-20261119`.
- Четвёртый режим главной песни: «Случайная из списка песен»; источники → группы; «Авторские подборки» — внутри «Жанров».
- Проверить реальный каталог, пустые группы, ежедневную ротацию, сохранение, предыдущие три режима и адаптивность.
- **Не сливать PR #194** до успешного тестирования и явного согласия владельца.

## Публикация
Планируемый адрес GitHub Pages: `https://velardream-ctrl.github.io/velardream-preview/`. Адрес нельзя считать работающим, пока Pages не настроен и страница не проверена.

## Журнал
См. [STAGING_LOG_RU.md](STAGING_LOG_RU.md).

## RUN-213: проверка MP3-конвертера из тестовой ветки

Исходная страница находится в `test/mp3-converter-20261122` → `mp3-converter/index.html`; код уже есть в GitHub, но без включённого GitHub Pages публичный URL даёт ошибку 404.

**Однократное включение GitHub Pages владельцем репозитория:**
1. Открыть `https://github.com/velardream-ctrl/velardream-preview/settings/pages`.
2. В `Build and deployment → Source` выбрать **Deploy from a branch**.
3. В `Branch` выбрать **test/mp3-converter-20261122**, каталог **/(root)** и нажать **Save**.
4. Проверить публикацию во вкладке Actions / Pages и затем открыть `https://velardream-ctrl.github.io/velardream-preview/mp3-converter/`.

Этот способ не использует workflow GitHub Actions, поскольку при публикации непосредственно из ветки GitHub Pages сам запускает стандартную сборку. Рабочий репозиторий `velar-music-manager`, домен `velardream.com`, Firebase и доступ к Studio не изменяются. Важно: открытие URL не равно проверке конвертации — отдельно проверить WAV/M4A → MP3 на iPhone Safari и старом iPad.
