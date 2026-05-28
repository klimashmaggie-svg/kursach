# A.Klimasy Cosmetic

Учебный full-stack проект интернет-магазина уходовой косметики на Next.js App Router.

## Stack

- Next.js 16.2.6, React 19.2.4, TypeScript
- Tailwind CSS v4
- Lucide React
- Next.js Route Handlers и Server Actions
- NextAuth/Auth.js v4: Credentials, регистрация, magic-link email
- RBAC роли: `participant`, `admin`, `organizer`, `jury`, `sponsor`
- PostgreSQL, Prisma 7.8.0, `@prisma/adapter-pg`

## Setup

1. Скопировать переменные окружения:

```bash
cp .env.example .env
```

2. Указать `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` и SMTP-переменные для magic-link.

3. Установить зависимости:

```bash
npm install
```

4. Создать таблицы и seed-данные:

```bash
npm run prisma:migrate
npm run prisma:seed
```

5. Запустить проект:

```bash
npm run dev
```

После запуска сайт будет доступен на `http://localhost:3000`.

## Seed users

Все seed-пользователи используют пароль `12345`.

- `participant@aklimasy.test`
- `admin@aklimasy.test`
- `organizer@aklimasy.test`
- `jury@aklimasy.test`
- `sponsor@aklimasy.test`

## Legacy files

Файлы `index.html`, `styles.css`, `app.js`, `server.js`, `data.json` оставлены как предыдущая статичная/Node-версия. Новая рабочая версия находится в `src/app`, `src/components`, `src/lib` и `prisma`.
