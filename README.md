# 🎙️ Speech-to-Speech Accessibility Platform

A real-time speech encoder–decoder that helps people better understand spoken language.

This app:
1. Takes **spoken audio**
2. Transcribes it to text
3. **Rewrites the text** based on user-defined accessibility preferences
4. Converts the rewritten text **back into speech**

Built for accessibility use cases like ESL learners, neurodivergent users, and anyone who benefits from simplified, clearer language.

---

## 🧠 Tech Stack

**Frontend**
- Next.js (React)
- Web Audio API (mic recording)

**Backend**
- Node.js
- Express

**AI / Speech APIs**
- **Gradium** — Speech → Text
- **Gemini** — Text transformation
- **ElevenLabs** — Text → Speech

No database. No auth. One clean pipeline.

---

## 🏗️ Architecture
