# 🤖 Vercel Agent Browser - SmartHub

Vercel Labs-ийн Agent Browser нь AI agent-уудад зориулсан browser автоматизацийн CLI хэрэгсэл юм.

## Суулгах

```bash
# Глобал суулгах
npm install -g agent-browser

# Chromium татах
agent-browser install

# Эсвэл npx ашиглах (суулгахгүйгээр)
npx agent-browser install
```

## Үндсэн командууд

### Навигаци
```bash
# Хуудас нээх
npx agent-browser open http://localhost:3001

# Буцах, урагшлах
npx agent-browser back
npx agent-browser forward
npx agent-browser reload
```

### Элементтэй харьцах
```bash
# Snapshot авах (AI-д зориулсан)
npx agent-browser snapshot -i

# Товч дарах (@ref ашиглан)
npx agent-browser click @e2

# Текст оруулах
npx agent-browser fill @e3 "test@example.com"

# CSS selector ашиглах
npx agent-browser click "#submit-button"
npx agent-browser type "#search" "iPhone 15"
```

### Мэдээлэл авах
```bash
# URL авах
npx agent-browser get url

# Title авах
npx agent-browser get title

# Текст авах
npx agent-browser get text @e1
```

### Скриншот
```bash
# Скриншот авах
npx agent-browser screenshot screenshot.png

# Бүтэн хуудас
npx agent-browser screenshot full-page.png --full
```

## SmartHub Тест ажиллуулах

```bash
# Тест скрипт ажиллуулах
chmod +x scripts/agent-browser-test.sh
./scripts/agent-browser-test.sh

# Custom URL-д тест хийх
BASE_URL=https://smarthub.vercel.app ./scripts/agent-browser-test.sh
```

## Session удирдах

```bash
# Session нэртэйгээр ажиллуулах
npx agent-browser open example.com --session mytest

# Идэвхтэй session-үүд харах
npx agent-browser session list

# Browser хаах
npx agent-browser close --session mytest
```

## AI Integration жишээ

```bash
# 1. Хуудас нээх
npx agent-browser open http://localhost:3001/dashboard --session ai-test

# 2. Interactive элементүүд авах (AI-д өгөх)
npx agent-browser snapshot -i --session ai-test

# 3. AI-ийн хариултаар @ref дээр дарах
npx agent-browser click @e5 --session ai-test

# 4. Илүү мэдээлэл авах
npx agent-browser get text "main" --session ai-test
```

## Environment Variables

| Variable | Тайлбар |
|----------|---------|
| `AGENT_BROWSER_SESSION` | Session нэр (default: "default") |
| `AGENT_BROWSER_PROFILE` | Browser profile замт |
| `AGENT_BROWSER_EXECUTABLE_PATH` | Custom browser замт |

## Playwright-тай харьцуулалт

| Feature | Agent Browser | Playwright |
|---------|---------------|------------|
| Token хэмжээ | 93% бага | Их |
| AI-д зориулсан | ✅ | ❌ |
| Snapshot refs | ✅ @e1, @e2 | ❌ |
| Learning curve | Хялбар | Complex |
| CI/CD | bash script | Test runner |

## Холбоос

- [GitHub: vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)
- [NPM: agent-browser](https://www.npmjs.com/package/agent-browser)
