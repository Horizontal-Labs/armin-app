# ArminApp - Argument Mining Frontend

A modern Vue.js 3 frontend application for argument mining and analysis, featuring interactive graph visualization and model selection capabilities.

## 🚀 Features

### Core Functionality
- **Argument Mining Analysis**: Send text to the backend API for argument structure extraction
- **Model Selection**: Choose from multiple AI models (modernbert, tinyllama, openai)
- **Interactive Graph Visualization**: Visualize argument structures using Cytoscape.js
- **Real-time Chat Interface**: Modern chat UI with message history

### Graph Visualization Features
- **Dynamic Graph Rendering**: Claims and premises as nodes, stance relations as edges
- **Interactive Controls**: Clickable zoom in/out and reset buttons
- **Enhanced Styling**: Beautiful PRO/CON edge styling with improved visibility
- **Responsive Design**: Adapts to different screen sizes
- **Model Display**: Shows the selected model name prominently

### User Experience
- **Modern UI**: Clean, intuitive interface built with Vue 3 and TypeScript
- **Real-time Feedback**: Loading states and error handling
- **Session Management**: Persistent chat sessions
- **Responsive Layout**: Works on desktop and mobile devices

## 🛠️ Technology Stack

- **Framework**: Vue.js 3 with Composition API
- **Language**: TypeScript for type safety
- **Build Tool**: Vite for fast development and building
- **Graph Library**: Cytoscape.js for interactive graph visualization
- **Styling**: CSS with modern design principles
- **State Management**: Vue 3 reactive system
- **HTTP Client**: Fetch API for backend communication

## 📋 Prerequisites

- **Node.js**: LTS 22.18.0 Version
- **npm**: Node package manager
- **Backend API**: The argument-mining-api backend must be running

## 🚀 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Horizontal-Labs/armin-app.git
   cd armin-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:5173`

## 🔧 Configuration

### Backend Connection
The frontend connects to the backend API at `http://localhost:8000`. Make sure:
- The backend server is running on port 8000
- CORS is properly configured in the backend
- API keys are set in the backend environment

### Environment Variables
Create a `.env` file in the root directory to specify the argument-mining-api URL:
```env
VITE_API_BASE_URL=http://localhost:8000
```


## 🏗️ Project Structure

```
armin-app/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ArgumentGraph.vue      # Graph visualization component
│   │   │   ├── ChatMessage.vue        # Individual message display
│   │   │   └── MessageInput.vue       # Input with model selection
│   │   └── layout/
│   ├── composables/
│   │   └── useChat.ts                 # Chat state management
│   ├── types/
│   └── main.ts
├── public/
├── package.json
├── vite.config.ts
└── README.md
```

## 🧪 Development

### Available Scripts
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

### Development Server
The development server runs on `http://localhost:5173` with hot module replacement (HMR) enabled.
## 🐛 Troubleshooting

### Common Issues

1. **"Failed to fetch" error**:
   - Check if backend is running on port 8000
   - Verify CORS configuration in backend
   - Check network connectivity

2. **Graph not displaying**:
   - Ensure Cytoscape.js is properly installed
   - Check browser console for JavaScript errors
   - Verify data format from backend

3. **Model selection not working**:
   - Check if backend supports the selected model
   - Verify API endpoint is accessible
   - Check browser console for errors

### Debug Mode
Enable debug logging by checking the browser console for detailed API request/response information.

## 📚 Documentation

- Backend repository: [argument-mining-api](https://github.com/Horizontal-Labs/argument-mining-api)

---

**Built with ❤️ for argument mining research and analysis**
