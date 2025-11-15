# IELTS Writing Evaluator

A comprehensive, **free and open-source** IELTS Writing Task evaluator with **OCR support for handwritten essays** and **AI-powered scoring** using OpenAI GPT.

## ✨ Features

### Core Features
- ✅ **Logic-Based Scoring**: Advanced grammar, vocabulary, and coherence analysis
- 📸 **OCR Support**: Upload handwritten essay images and extract text automatically
- 🤖 **AI-Powered Scoring**: Optional OpenAI GPT integration for human-like feedback
- 📊 **IELTS Band Scores**: Get scores for all four criteria (TR, CC, LR, GRA)
- 💡 **Actionable Feedback**: Detailed suggestions for improvement
- 🎯 **Task-Specific Evaluation**: Separate evaluation for Task 1 and Task 2

### Advanced Analysis
- Grammar checks (run-ons, fragments, comma splices)
- Passive/active voice detection
- Vocabulary richness analysis
- Sentence variety assessment
- Academic word usage tracking
- Cohesive devices identification

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- (Optional) OpenAI API key for AI scoring

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/tanimnakib52-lang/ielts-writing-evaluator.git
cd ielts-writing-evaluator
```

2. **Install API dependencies**
```bash
cd api
npm install
```

3. **Install client dependencies**
```bash
cd ../client
npm install
```

4. **Configure environment variables** (Optional, for AI scoring)
```bash
cd ../api
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### Running Locally

**Terminal 1 - Start API server:**
```bash
cd api
npm start
# Server runs on http://localhost:3001
```

**Terminal 2 - Start React client:**
```bash
cd client
npm start
# App opens at http://localhost:3000
```

## 📖 Usage

### Text Input
1. Select Task Type (Task 1 or Task 2)
2. Paste or type your essay
3. Click "Submit" for evaluation

### Handwritten Essay OCR
1. Click "Upload Handwritten Essay Image"
2. Select an image file (JPG, PNG)
3. Click "Extract Text from Image"
4. Review and edit extracted text
5. Click "Submit" for evaluation

### AI-Powered Scoring
1. Check "Use Advanced AI Scoring"
2. Ensure OPENAI_API_KEY is configured
3. Submit your essay for AI-based feedback

## 🛠️ Tech Stack

### Backend
- **Express.js**: REST API server
- **Tesseract.js**: OCR engine for handwriting recognition
- **OpenAI GPT-4**: AI-powered essay evaluation
- **CORS**: Cross-origin resource sharing

### Frontend
- **React**: UI framework
- **CSS3**: Styling and animations

## 📂 Project Structure

```
ielts-writing-evaluator/
├── api/                  # Backend API
│   ├── index.js         # Main server file
│   ├── package.json     # API dependencies
│   ├── .env.example     # Environment template
│   └── README.md        # API documentation
├── client/              # React frontend
│   ├── App.js          # Main component
│   ├── App.css         # Styles
│   └── package.json    # Client dependencies
└── README.md           # This file
```

## 🔧 Configuration

### Environment Variables (api/.env)

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

## 🌐 Deployment

### Vercel (Recommended for Frontend)
1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Backend Deployment
- **Render**: Free tier available
- **Railway**: Easy Node.js deployment
- **Heroku**: Classic PaaS option

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push and create a Pull Request

## 📝 License

MIT License - feel free to use this project for learning or production.

## 🔗 Links

- **Live Demo**: [ielts-writing-evaluator.vercel.app](https://ielts-writing-evaluator.vercel.app/)
- **API Documentation**: See `/api/README.md`
- **Issues**: [GitHub Issues](https://github.com/tanimnakib52-lang/ielts-writing-evaluator/issues)

## 💬 Support

For questions or support, please open an issue on GitHub.

---

**Made with ❤️ for IELTS learners worldwide**
