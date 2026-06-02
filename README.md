# AIStoryTeller Cloud Video Studio

AIStoryTeller, kullanicidan aldigi fikir ve stil ayarlariyla cok dilli sosyal medya videolari ureten bir Vue + Express uygulamasidir. Sistem local AI modeli calistirmaz; Groq/Gemini metin zekasi, cloud/free-tier gorsel ve ses servisleri, stok medya destekleri ve Remotion fallback sahneleriyle demo guvenilirligini korur.

## Teknoloji Stack'i

- Vue 3 + Vite + TypeScript
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- BullMQ + Redis
- Remotion
- Groq/Gemini + fallback story, prompt, ceviri ve sosyal export metni
- Cloudflare Workers AI / Pollinations / Hugging Face image generation
- Pexels/Pixabay stok medya destekleri
- Azure Speech / Edge TTS / ElevenLabs text-to-speech
- Cok dilli varyant uretimi: TR, EN, DE, ES

## Kurulum

```bash
pnpm install
cp .env.example .env
```

Varsayilan metin modu `AI_PROVIDER=fallback` ile calisir. Groq kullanmak icin `.env` icinde `AI_PROVIDER=groq` veya `AI_PROVIDER=auto` ve `GROQ_API_KEY` girin. Groq, gorsel veya ses uretmez; hikaye, prompt, ceviri, caption ve hashtag icin kullanilir.

Ses icin varsayilan `VOICE_PROVIDER=auto` ayarlidir. Siralama: Azure Speech, Edge TTS, ElevenLabs, sessiz fallback. Azure icin `AZURE_SPEECH_KEY` ve `AZURE_SPEECH_REGION`; ElevenLabs icin `ELEVENLABS_API_KEY` girilebilir.

Gorsel icin varsayilan `IMAGE_PROVIDER=auto` ayarlidir. Siralama: Cloudflare Workers AI, Pollinations, Hugging Face, Pexels/Pixabay, premium SVG fallback. Local ComfyUI, Stable Diffusion veya Piper calistirilmaz; cihaz yorulmaz.

## Docker Compose ile Calistirma

Tum sistemi Docker Compose ile tek komutta baslatabilirsiniz:

```bash
pnpm stack:up
```

Bu komut su servisleri ayaga kaldirir:

- `web`: Vue arayuzu + Nginx reverse proxy (`http://localhost:5173`)
- `api`: Express API (`http://localhost:4000`)
- `worker`: BullMQ video pipeline worker
- `mongodb`: MongoDB (`localhost:27017`)
- `redis`: Redis (`localhost:6380`)

Docker icinde servisler birbirleriyle container adlari uzerinden haberlesir. API ve worker icin `MONGODB_URI=mongodb://mongodb:27017/ai-video-generator`, `REDIS_HOST=redis`, `REDIS_PORT=6379` degerleri compose tarafindan otomatik verilir.

Servisleri durdurmak icin:

```bash
pnpm stack:down
```

Docker Desktop kapaliysa once Docker'i acin, sonra `pnpm stack:up` komutunu tekrar calistirin. Redis host portu proje icin `6380` olarak ayarlandi; bu sayede bilgisayarda baska Redis servisleri varsa port cakismasi azalir.

## Lokal Gelistirme

Uc terminal kullanin:

```bash
pnpm dev:api
```

```bash
pnpm worker
```

```bash
pnpm dev:web
```

Web arayuzu: `http://localhost:5173`

API saglik kontrolu: `http://localhost:4000/health`

Sistem durumu: `http://localhost:4000/api/system/status`

## Demo Akisi

1. Web arayuzunde tema, stil, yas grubu ve sahne sayisi secilir.
2. Express API MongoDB'de proje olusturur.
3. BullMQ worker hikaye, prompt, ceviri, gorsel, ses, altyazi, render ve export adimlarini sirayla calistirir.
4. Dashboard proje durumlarini ve pipeline loglarini gosterir.
5. Proje detayinda TR/EN/DE/ES dil sekmeleri, video player, caption, hashtag, sahneler ve MP4 indirme linkleri gorunur.
6. Gorsel iyi degilse sahne kartindan sadece ilgili sahne tekrar uretilebilir.

## Final Demo Komut Sirasi

```bash
pnpm stack:up
```

Sonra `http://localhost:5173` adresinden yeni proje olusturun. Web container'i `/api` ve `/outputs` isteklerini Express API container'ina proxy eder.

## API Ozeti

- `POST /api/projects`: Yeni video projesi olusturur ve pipeline'i baslatir.
- `GET /api/projects`: Projeleri listeler.
- `GET /api/projects/:id`: Proje, sahne, asset, varyant ve log detaylarini getirir.
- `GET /api/projects/:id/export`: Dil bazli sosyal medya export paketini getirir.
- `POST /api/projects/:id/retry`: Projeyi yeniden BullMQ pipeline'ina alir.
- `POST /api/projects/:id/scenes/:sceneId/regenerate`: Sadece secili sahne gorselini tekrar uretir.
- `GET /api/projects/:id/events`: Pipeline loglarini getirir.
- `GET /api/system/status`: MongoDB, BullMQ queue ve aktif provider durumlarini getirir.

## Otopilot Akisi

Otopilot bolumu konsept bazli sosyal medya operasyonu icindir. API key yoksa fallback fikirler uretir; Groq key varsa trend/konsept uyumu daha akilli skorlanir.

- `POST /api/autopilot/accounts`: Instagram/TikTok/YouTube konsept hesabi olusturur.
- `GET /api/autopilot/accounts`: Otopilot hesaplarini listeler.
- `POST /api/autopilot/accounts/:id/generate-ideas`: Konsepte uygun fikirleri skorlayip takvime alir.
- `GET /api/autopilot/ideas`: Fikir listesini getirir.
- `POST /api/autopilot/ideas/:id/approve`: Fikri onaylar.
- `POST /api/autopilot/ideas/:id/reject`: Fikri reddeder.
- `POST /api/autopilot/ideas/:id/produce`: Fikri video pipeline'ina aktarir.
- `POST /api/autopilot/run-due`: Zamanı gelmis ve onaylanmis fikirleri uretime alir.

## Sunum Icin Hizli Kontrol

```bash
pnpm typecheck
pnpm build
curl http://localhost:4000/api/system/status
```

Demo guvenilirligi icin API key olmasa bile fallback akisi korunur. Cloud servisleri calismazsa gorsel icin premium SVG sahneler, ses icin sessiz WAV fallback devreye girer ve pipeline tamamlanmaya calisir.

## Ders Isterleri

- LLM ile prompt/hikaye olusturma: Groq, Gemini veya fallback story service
- Hikayeyi veritabanina kaydetme: MongoDB Project modeli
- En az 3 gorsel olusturma: Cloud/free image providers, stok medya veya SVG fallback
- Hikayeyi sese donusturme: Azure Speech, Edge TTS, ElevenLabs veya audio fallback
- Ses ve gorsellerle video olusturma: Remotion render, dil bazli MP4 varyantlari
- Gorsel gecis efektleri: Remotion fade/smooth zoom
- Videoya altyazi ekleme: Remotion subtitle layer
- Scrum board/story point: `SCRUM_BOARD.md`
