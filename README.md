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

- **Node.js**: Version 16 or higher
- **npm**: Node package manager
- **Backend API**: The argument-mining-api backend must be running
- **API Keys**: OpenAI and Hugging Face tokens configured in the backend

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
Create a `.env` file in the root directory if needed:
```env
VITE_API_BASE_URL=http://localhost:8000
```

## 📖 Usage

### Basic Workflow
1. **Select a Model**: Choose from the dropdown (modernbert, tinyllama, openai)
2. **Enter Text**: Type or paste your text in the input field
3. **Send for Analysis**: Click the send button to process your text
4. **View Results**: See the analysis results and interactive graph
5. **Interact with Graph**: Use zoom controls to explore the argument structure

### Graph Controls
- **Zoom In** (➕): Increase graph magnification
- **Zoom Out** (➖): Decrease graph magnification
- **Reset** (🔄): Return to default zoom level
- **Show/Hide**: Toggle graph visibility

### Understanding the Graph
- **Nodes**: Represent claims (blue) and premises (green)
- **Edges**: Show stance relations between claims and premises
- **PRO Edges**: Green arrows indicating supporting relationships
- **CON Edges**: Red arrows indicating opposing relationships

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

## 🔗 API Integration

### Backend Requirements
- **Endpoint**: `POST /chat/send`
- **Request Format**:
  ```json
  {
    "session_id": "string",
    "model": "modernbert|tinyllama|openai",
    "message": "text to analyze"
  }
  ```
- **Response Format**:
  ```json
  {
    "message": "original text",
    "session_id": "string",
    "model": "string",
    "output": {
      "claims": [...],
      "premises": [...],
      "stance_relations": [...]
    }
  }
  ```

## 🎨 Customization

### Styling
The application uses modern CSS with:
- Responsive design principles
- Clean, minimalist aesthetic
- Accessible color schemes
- Smooth animations and transitions

### Graph Customization
Graph styling can be modified in `ArgumentGraph.vue`:
- Node colors and sizes
- Edge styles and colors
- Layout parameters
- Zoom behavior

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

For detailed information about changes and implementation, see:
- `CHANGES_DOCUMENTATION.md` - Comprehensive change history
- Backend repository: [argument-mining-api](https://github.com/Horizontal-Labs/argument-mining-api)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is part of the Horizontal-Labs argument mining system.

## 🙏 Acknowledgments

- **Cytoscape.js** for graph visualization
- **Vue.js 3** for the reactive framework
- **Vite** for the build system
- **Horizontal-Labs** for the backend API

---

**Built with ❤️ for argument mining research and analysis**
