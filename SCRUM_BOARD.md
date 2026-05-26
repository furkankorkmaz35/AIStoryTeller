# AI Video Generator Scrum Board

| Story | Puan | Durum | Kabul Kriteri |
| --- | ---: | --- | --- |
| LLM ile program icinden prompt olusturma | 10 | Done | Vue formundan tema alinir, Express API Groq/Gemini/fallback prompt akisini baslatir. |
| Olusan hikayeyi veritabanina kaydetme | 10 | Done | Hikaye, proje bilgileri ve durum MongoDB Project kaydina yazilir. |
| Hikaye temelli en az 3 gorsel olusturma | 10 | Done | Her Scene icin image provider veya fallback SVG gorsel uretilir. |
| Hikayeyi sese donusturme | 20 | Done | Hikaye metni system TTS veya fallback audio ile ses dosyasina cevrilir. |
| Ses ve gorsellerle video olusturma | 20 | Done | BullMQ worker Remotion ile MP4 video render eder. |
| Gorsel gecislerine efekt ekleme | 10 | Done | Remotion sahne gecislerinde fade ve smooth zoom efektleri kullanilir. |
| Videoya altyazi ekleme | 10 | Done | Her sahne metni Remotion subtitle katmani olarak videoya eklenir. |
| Scrum board ve story point hesabi | 10 | Done | Toplam 100 puanlik takip tablosu ve sistem durum takibi hazirlanir. |

Toplam story point: **100**
