# Apukaveri на Cloudflare
Публичная демоверсия состоит из главной, кабинета и демонстрации заказов. Рабочая ветка — apukaveri-prototype-20261126 в velardream-ctrl/velardream-preview. Отдельное имя Worker — apukaveri-preview.

## Первое подключение через браузер
В Cloudflare Dashboard откройте Workers & Pages, создайте новый Worker с подключением к существующему GitHub-репозиторию. Выберите velardream-ctrl/velardream-preview и ветку apukaveri-prototype-20261126. Укажите корневой каталог apukaveri, имя apukaveri-preview, команду сборки node build-static.mjs и команду публикации npx wrangler@4 deploy. Проверьте имя нового Worker и выбранную ветку перед первой публикацией. После успешного развёртывания откройте адрес workers.dev, который покажет Cloudflare. Последующие изменения в подключённой ветке публикуются через Workers Builds.

Локальная проверка из apukaveri: node build-static.mjs и npx wrangler@4 dev --local. Серверный прототип с D1 использует отдельную конфигурацию wrangler.local.jsonc. Облачный демонстрационный сайт не требует D1, R2, платёжных ключей или домена.

Профиль помощника и язык на демосайте сохраняются в браузере на конкретном адресе. При первом входе на workers.dev ранее выбранную на chatgpt.site услугу потребуется сохранить снова. Синхронизация между устройствами — отдельный серверный этап.

Если первая сборка из `main` завершается с `Failed: root directory not found`, в Settings → Builds → Production branch выберите `apukaveri-prototype-20261126`. После следующего коммита откройте Deployments и сверьте ветку и коммит новой сборки.
