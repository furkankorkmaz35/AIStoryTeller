# AI Video Generator Project Plan

## Proje Ozeti

Bu proje, mevcut Python tabanli AIStoryTeller fikrinin modern bir web uygulamasina donusturulmus halidir. Uygulama kullanicidan tema ve video tercihleri alir, AI destekli hikaye uretir, hikayeyi sahnelere boler, sahneler icin gorsel uretir, metni sese cevirir ve Remotion ile altyazili, gecis efektli MP4 video olusturur.

Ana hedef, ders isterlerini karsilayan ama sadece script gibi durmayan, gercek bir AI video generator dashboard'u sunmaktir.

## Secilen Teknolojiler

- Frontend: Vue 3, Vite, TypeScript
- Backend: Node.js, Express, TypeScript
- Database: MongoDB, Mongoose
- Queue/Otomasyon: BullMQ
- Queue altyapisi: Redis
- Video render: Remotion
- AI metin uretimi: Groq, Gemini veya fallback
- Gorsel uretimi: ucretsiz/demo dostu image provider + fallback
- Ses uretimi: Edge TTS + fallback
- Container altyapisi: Docker Compose

Not: n8n kullanilmayacak. PostgreSQL, Prisma, TypeORM ve Next.js kullanilmayacak.

## MVP Kapsami

MVP, demo guvenilirligi oncelikli olacak sekilde tasarlanir. Harici AI servisleri calisirsa gercek uretim yapilir; API anahtari, internet veya servis problemi olursa fallback mekanizmalari devreye girer. Hikaye uretimi icin `AI_PROVIDER=fallback | groq | gemini | auto` yapisi kullanilir.

Uygulama ilk versiyonda kullanici girisi gerektirmez. Tek kullanicili dashboard yeterlidir.

## Ana Ozellikler

### Video Uretim Formu

Kullanici asagidaki bilgileri girerek yeni video projesi baslatir:

- Tema
- Gorsel stil: masalsi, cizgi film, sinematik, egitimsel
- Yas grubu
- Sahne sayisi: minimum 3, varsayilan 3

Form gonderildiginde backend yeni proje kaydi olusturur ve BullMQ pipeline'ini baslatir.

### Dashboard

Dashboard, uretilen projeleri ve durumlarini gosterir:

- Proje listesi
- Proje durum badge'i
- Olusturulma tarihi
- Tema ve stil bilgisi
- Video uretim ilerleme durumu
- Basarisiz islerde hata mesaji

Proje durumlari:

- queued
- generating_story
- generating_images
- generating_audio
- rendering_video
- completed
- failed

### Proje Detay Ekrani

Her proje icin detay ekrani bulunur:

- Video player
- Hikaye metni
- Sahne kartlari
- Gorsel preview'lari
- Image prompt bilgileri
- Altyazi metinleri
- Ses dosyasi linki
- MP4 indirme linki
- Pipeline loglari

Bu ekran, ders isterlerinin her birini sunumda kanitlamak icin kullanilir.

## Otomasyon Pipeline'i

BullMQ ile asagidaki adimlar sirali sekilde calisir:

1. Proje olusturulur.
2. Story generation job kuyruga eklenir.
3. Secilen provider ile hikaye uretilir: Groq, Gemini veya fallback.
4. Hikaye sahnelere bolunur.
5. Her sahne icin image prompt olusturulur.
6. Gorseller uretilir veya fallback placeholder gorsel olusturulur.
7. Hikaye metni Edge TTS ile sese cevrilir veya fallback audio olusturulur.
8. Remotion ile sahneler, gorseller, ses, altyazi ve gecis efektleri birlestirilir.
9. MP4 cikti dosyasi kaydedilir.
10. Proje completed durumuna alinir.

Her adim MongoDB'ye log olarak kaydedilir.

## Fallback Stratejisi

Demo sirasinda sistemin tamamen durmamasi icin fallback zorunludur:

- Groq/Gemini calismazsa yerel hikaye sablonu kullanilir.
- Gorsel servisi calismazsa sahne metinlerinden local placeholder gorseller uretilir.
- Edge TTS calismazsa placeholder veya sessiz audio uretilir.
- Video render, mevcut assetlerle tamamlanmaya calisilir.

Bu sayede internet veya API sorunu olsa bile proje akisi gosterilebilir.

## MongoDB Veri Modeli

### Project

- theme
- title
- story
- style
- ageGroup
- sceneCount
- status
- errorMessage
- videoPath
- createdAt
- updatedAt

### Scene

- projectId
- order
- text
- imagePrompt
- imagePath
- subtitle
- status

### Asset

- projectId
- sceneId
- type: image, audio, video
- path
- provider
- metadata
- createdAt

### JobEvent

- projectId
- step
- status
- message
- createdAt

## API Taslagi

### POST /api/projects

Yeni video projesi olusturur ve pipeline'i baslatir.

Body:

```json
{
  "theme": "Cesur bir robot",
  "style": "cinematic",
  "ageGroup": "7-10",
  "sceneCount": 3
}
```

### GET /api/projects

Tum projeleri listeler.

### GET /api/projects/:id

Proje detayini, sahneleri, assetleri ve job loglarini dondurur.

### GET /api/projects/:id/events

Proje pipeline loglarini veya canli ilerleme bilgisini dondurur.

## Tasarim Dili

Tasarim projenin en onemli parcalarindan biridir. Uygulama klasik, basit ve yapay duran AI arayuzlerinden farkli olmalidir. Ilk ekran landing page degil, dogrudan calisan creator workspace olacaktir.

Ana tema:

- Koyu gri
- Lacivert
- Kontrollu cyan/teal vurgu renkleri
- Soldan saga akan gradient gecisleri
- Glow shadow efektleri
- 3D hover kartlari
- Akici page ve card transition'lari

Renk paleti:

```txt
Background: #090B10
Panel:      #111827
Navy:       #0B1B3A
Deep Blue:  #102A56
Accent:     #14B8A6
Glow:       #38BDF8
Text:       #E5E7EB
Muted:      #94A3B8
```

Tasarim detaylari:

- Sol tarafta koyu sabit sidebar
- Sagda genis creator workspace
- Premium gorunumlu tema giris alani
- 3D hover'li stil ve ayar kartlari
- Soldan saga akan gradient animasyonlu generate butonu
- Hover'da yukari kalkan proje kartlari
- Glow border ve shadow efektleri
- Animated progress timeline
- Loading shimmer efektleri
- Video sonuc ekraninda sinematik player frame'i
- Sahne kartlarinda preview, prompt, altyazi ve status badge'leri

UI'da aciklayici pazarlama metinleri yerine gercek uretim arayuzu one cikarilir.

## Remotion Video Davranisi

Video ciktisi su ozelliklere sahip olur:

- En az 3 sahne
- Her sahnede ayri gorsel
- Sahne gecislerinde fade veya smooth transition
- Seslendirme
- Altyazi katmani
- MP4 cikti
- Indirilebilir final video

## Ders Isterleriyle Eslesme

- LLM ile prompt/hikaye olusturma: Groq/Gemini/fallback story generation
- Hikayeyi veritabanina kaydetme: MongoDB Project kaydi
- Hikaye temelli en az 3 gorsel: Scene bazli image generation
- Hikayeyi sese donusturme: Edge TTS audio generation
- Ses ve gorsellerle video olusturma: Remotion render
- Gorsel gecis efektleri: Remotion transition/fade
- Videoya altyazi ekleme: Remotion subtitle layer
- Scrum board/story point: ayrica guncellenecek proje takip tablosu

## Gelistirme Asamalari

1. Vue + Express monorepo yapisini kur.
2. Docker Compose ile MongoDB ve Redis servislerini ekle.
3. Express API ve MongoDB modellerini hazirla.
4. BullMQ queue ve worker yapisini kur.
5. Fallback story, image ve audio generator'lari ekle.
6. Gemini ve gercek provider entegrasyonlarini ekle.
7. Remotion video composition ve local render akisini kur.
8. Vue dashboard, creator form ve proje detay ekranlarini tasarla.
9. 3D hover, gradient, shadow, transition ve loading animasyonlarini ekle.
10. Uctan uca demo testi yap.
11. README ve Scrum board'u yeni teknolojiye gore guncelle.

## Kabul Kriterleri

- Kullanici formdan tema girip proje baslatabilir.
- Sistem en az 3 sahne uretir.
- Hikaye MongoDB'ye kaydedilir.
- Her sahne icin gorsel asset kaydi olusur.
- Ses asset kaydi olusur.
- MP4 video uretilir.
- Videoda gecis efekti ve altyazi bulunur.
- Dashboard proje durumlarini gosterir.
- Proje detayinda video, hikaye, sahneler, assetler ve loglar gorunur.
- Harici servisler calismasa bile fallback ile demo tamamlanir.

## Test Plani

- API testleri:
  - Proje olusturma
  - Proje listeleme
  - Proje detay getirme
- Worker testleri:
  - Story job tamamlanir.
  - Image job en az 3 asset olusturur.
  - Audio job asset olusturur.
  - Render job video asset olusturur.
- UI manuel testleri:
  - Creator form calisir.
  - Dashboard status gunceller.
  - Proje detayinda player ve asset listesi gorunur.
  - Hover, transition ve loading animasyonlari sorunsuzdur.
- Demo testi:
  - API anahtarsiz fallback modda uctan uca video akisi tamamlanir.
