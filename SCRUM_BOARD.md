# AI Video Generator Scrum Board

| Story | Puan | Durum | Kabul Kriteri |
| --- | ---: | --- | --- |
| LLM ile program icinden prompt olusturma | 10 | Done | Vue formundan tema alinir, Express API Groq/Gemini/fallback prompt akisini baslatir. |
| Olusan hikayeyi veritabanina kaydetme | 10 | Done | Hikaye, proje bilgileri ve durum MongoDB Project kaydina yazilir. |
| Hikaye temelli en az 3 gorsel olusturma | 10 | Done | Cloud/free image, stok medya veya premium fallback sahne uretilir; sahne bazli tekrar uretim vardir. |
| Hikayeyi sese donusturme | 20 | Done | Azure Speech, Edge TTS, ElevenLabs veya fallback audio ile TR/EN/DE/ES ses varyantlari uretilir. |
| Ses ve gorsellerle video olusturma | 20 | Done | BullMQ worker Remotion ile her dil icin ayri MP4 render eder. |
| Gorsel gecislerine efekt ekleme | 10 | Done | Remotion sahne gecislerinde fade, smooth zoom, parallax ve premium fallback motion kullanilir. |
| Videoya altyazi ekleme | 10 | Done | Her dil varyanti icin altyazi metni Remotion katmani olarak videoya eklenir. |
| Scrum board ve story point hesabi | 10 | Done | Toplam 100 puanlik takip tablosu ve sistem durum takibi hazirlanir. |

Toplam story point: **100**
