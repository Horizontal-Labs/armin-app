const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    // Reactive data
    const messageText = ref('');
    const uploadedFile = ref(null);
    const analysisResult = ref('');
    const fileInput = ref(null);
    
    const tips = [
      'Tip: Upload a document or paste text to analyze argumentative structures!',
      'Tip: The analysis will identify claims, premises, and logical connections.',
      'Tip: Supported formats include .txt, .pdf, and .docx files.',
      'Tip: Longer texts provide more comprehensive argument analysis.'
    ];
    const currentTip = ref(tips[0]);
    
    // Computed properties
    const canSend = computed(() => {
      return messageText.value.trim().length > 0 || uploadedFile.value !== null;
    });
    
    // Methods
    const handleUpload = () => {
      fileInput.value.click();
    };
    
    const onFileSelected = (event) => {
      const file = event.target.files[0];
      if (file) {
        uploadedFile.value = file;
        console.log('File selected:', file.name);
        // Here you would typically read the file content
        // For now, we'll just show it's uploaded
      }
    };
    
    const handleSend = () => {
      if (!canSend.value) return;
      
      console.log('Sending for analysis...');
      console.log('Text:', messageText.value);
      console.log('File:', uploadedFile.value);
      
      // Fake Output for demonstration
      analysisResult.value = `This is a fake analysis of: "${messageText.value.substring(0, 50)}${messageText.value.length > 50 ? '...' : ''}"\n\nClaims identified: 2\nPremises found: 4\nArgument structure: Deductive\n\nDetailed analysis and a new browser tab to a graph would appear here...`;
      
      // Clear inputs after sending
      messageText.value = '';
      uploadedFile.value = null;
      if (fileInput.value) {
        fileInput.value.value = '';
      }
    };
    
    const checkSendButton = () => {
    };
    
    const rotateTips = () => {
      const currentIndex = tips.indexOf(currentTip.value);
      const nextIndex = (currentIndex + 1) % tips.length;
      currentTip.value = tips[nextIndex];
    };
    
    // Lifecycle
    onMounted(() => {
      // Rotate tips every 5 seconds
      setInterval(rotateTips, 5000);
    });
    
    return {
      messageText,
      uploadedFile,
      analysisResult,
      fileInput,
      currentTip,
      canSend,
      handleUpload,
      onFileSelected,
      handleSend,
      checkSendButton
    };
  }
}).mount('#app');
